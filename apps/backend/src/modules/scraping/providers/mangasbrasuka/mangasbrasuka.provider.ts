import { createHmac } from 'node:crypto'
import { createHttpClient } from '../../../../shared/http/http-client'
import type { IProviderStrategy } from '../../interfaces/provider-strategy.interface'
import type { RateLimiter } from '../../rate-limit/types'
import type {
  ProviderEngine,
  ProviderInfo,
  ProviderSearchOptions,
  ProviderSearchResult,
} from '../../types/provider.types'
import type { SourceInspectResponse } from '../../types/source.types'
import { ScrapingNetworkError, ScrapingParseError } from '../../errors/scraping.errors'
import {
  buildProviderInfo,
  getApiBase,
  getMangaSlug,
  mapObraToInspectResponse,
  mapPaginasToImageUrls,
  parseChapterUrl,
} from './mangasbrasuka.mapper'
import type { BrasukaObra, BrasukaCapitulo, BrasukaPagina } from './mangasbrasuka.types'

const BASE_URL = 'https://mangasbrasuka.com.br'

/**
 * Host do reader/site (o conteúdo migrou de `mangasbrasuka.com.br` para
 * `mangasbrasuka.org`). É nele que vivem o endpoint de chaves de imagem
 * (`/api/atfield/key`) e o `Referer`/`Origin` exigidos pelo CDN de imagens.
 */
const SITE_BASE = 'https://mangasbrasuka.org'

/**
 * Headers de browser exigidos pelo Cloudflare do SITE_BASE (sem eles o
 * `/api/atfield/key` responde 403 `Cf-Mitigated: challenge`). `sec-ch-ua*`
 * não é necessário; `sec-fetch-*` + `Accept-Language` são.
 */
const KEY_REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
  Referer: `${SITE_BASE}/`,
  Origin: SITE_BASE,
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
}

/**
 * Headers exigidos pelo CDN de imagens (`aurora.snipercache.com`): sem
 * `Referer`+`Origin` de `mangasbrasuka.org` o CDN responde 403/410.
 */
const CDN_REQUEST_HEADERS = {
  Referer: `${SITE_BASE}/`,
  Origin: SITE_BASE,
}

const http = createHttpClient({
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Referer: `${BASE_URL}/`,
    Origin: BASE_URL,
  },
  retries: 3,
  retryDelay: 2_000,
})

/** Página máxima por request na API de capítulos */
const CHAPTERS_PAGE_SIZE = 100

/** Tipos de obra aceitos pelo inspect (urlPattern do provider). */
const INSPECTABLE_TYPES = new Set(['manga', 'manhwa', 'manhua', 'novel', 'light-novel'])

interface BrasukaSearchItem {
  slug: string
  title: string
  coverUrl: string | null
  type: string
  author?: string | null
}

export class MangasBrasukaStrategy implements IProviderStrategy {
  readonly slug = 'mangasbrasuka'
  readonly name = 'Mangas Brasukas'
  readonly engine: ProviderEngine = 'api'
  readonly urlPattern = /mangasbrasuka\.(?:com\.br|org)\/(?:manga|manhwa|manhua|novel|light-novel)\//
  readonly allowedDomains = [
    'mangasbrasuka.com.br',
    'mangasbrasuka.org',
    'app.mangasbrasuka.com.br',
    'cdn.mugiverso.com',
    'aurora.snipercache.com',
  ]

  constructor(readonly rateLimiter: RateLimiter) {}

  supports(url: string): boolean {
    try {
      const parsed = new URL(url)
      if (!this.allowedDomains.includes(parsed.hostname)) return false
      return this.urlPattern.test(url)
    } catch {
      return false
    }
  }

  getInfo(): ProviderInfo {
    return buildProviderInfo()
  }

  async search(query: string, opts?: ProviderSearchOptions): Promise<ProviderSearchResult[]> {
    if ((opts?.offset ?? 0) > 0) return []
    const limit = opts?.limit ?? 10
    const url = `${getApiBase()}/v1/www/search?q=${encodeURIComponent(query)}&limit=${limit}`
    let items: BrasukaSearchItem[]
    try {
      const res = await this.rateLimiter.schedule(() =>
        http.get<{ data?: BrasukaSearchItem[] }>(url, { signal: opts?.signal }),
      )
      items = res.data?.data ?? []
    } catch (err) {
      if (err instanceof ScrapingNetworkError) throw err
      throw new ScrapingNetworkError(url, err)
    }

    const seen = new Set<string>()
    const results: ProviderSearchResult[] = []
    for (const item of items) {
      if (!item?.slug || !item?.title) continue
      const type = INSPECTABLE_TYPES.has(item.type) ? item.type : 'manga'
      const workUrl = `${BASE_URL}/${type}/${item.slug}/`
      if (seen.has(workUrl)) continue
      seen.add(workUrl)
      results.push({
        providerSlug: this.slug,
        title: item.title,
        url: workUrl,
        coverUrl: item.coverUrl ?? null,
        author: item.author ?? null,
        type: type,
        genres: null,
      })
      if (results.length >= limit) break
    }
    return results
  }

  async inspect(canonicalUrl: string): Promise<SourceInspectResponse> {
    const slug = getMangaSlug(canonicalUrl)
    if (!slug || slug === 'unknown') {
      throw new ScrapingParseError(`Não foi possível extrair o slug da obra: ${canonicalUrl}`)
    }

    const obra = await this.fetchObraBySlug(slug)
    const chapters = await this.fetchAllChapters(slug)
    return mapObraToInspectResponse(obra, chapters, slug, canonicalUrl)
  }
  async getChapterImages(chapterUrl: string): Promise<string[]> {
    const parsed = parseChapterUrl(chapterUrl)
    if (!parsed) {
      throw new ScrapingParseError(
        `URL de capítulo inválida. Esperado: ${BASE_URL}/{manga|manhwa|manhua}/{slug}/{numero}`,
      )
    }

    const { slug, number } = parsed
    const pages = await this.fetchChapterPages(slug, number)
    const tokens = mapPaginasToImageUrls(pages)

    if (tokens.length === 0) {
      throw new ScrapingParseError(
        `Nenhuma imagem encontrada para o capítulo ${number} da obra ${slug}`,
      )
    }

    // A API retorna tokens HMAC (`AQAA…`), não URLs: resolve cada um para a
    // URL assinada do CDN (`aurora.snipercache.com`) via `/api/atfield/key`.
    // Falha de resolução de um token não derruba o capítulo — o token bruto
    // é mantido e vira erro de download (segue o `errorHandlingStrategy`).
    const images: string[] = []
    for (const token of tokens) {
      if (token.startsWith('http://') || token.startsWith('https://')) {
        images.push(token)
        continue
      }
      try {
        images.push(await this.resolveImageToken(token))
      } catch {
        images.push(token)
      }
    }

    return images
  }

  async downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
    // Tokens não resolvidos (`AQAA…`) nunca baixam direto: resolve antes para
    // não mascarar o erro como falha de rede.
    let url = imageUrl
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = await this.resolveImageToken(url)
    }
    try {
      const response = await this.rateLimiter.schedule(() =>
        http.get(url, {
          responseType: 'arraybuffer',
          validateStatus: (status) => status === 200,
          // O CDN valida `Referer`+`Origin` de `mangasbrasuka.org` (403/410 sem eles).
          headers: { ...CDN_REQUEST_HEADERS },
        }),
      )

      const buffer = Buffer.from(response.data)
      const contentType =
        typeof response.headers['content-type'] === 'string'
          ? response.headers['content-type']
          : Array.isArray(response.headers['content-type'])
            ? (response.headers['content-type'][0] ?? '')
            : ''

      return { buffer, contentType: contentType || 'application/octet-stream' }
    } catch (err) {
      throw new ScrapingNetworkError(url, err)
    }
  }

  /**
   * Resolve um token de imagem (`AQAA…`) para a URL assinada do CDN.
   * Formato: `a[0]` = versão da chave, `u32be[1:5]` = key id, `[5:13]` =
   * nonce, `[13:]` = ciphertext XOR com keystream `HMAC-SHA256(key, nonce||ctr)`.
   * A chave vem de `GET {SITE_BASE}/api/atfield/key?v={a}&e={s}` (`{k}` base64).
   */
  private async resolveImageToken(token: string): Promise<string> {
    let raw: Buffer
    try {
      raw = Buffer.from(token, 'base64url')
    } catch {
      throw new ScrapingParseError('Token de imagem inválido')
    }
    if (raw.length < 14 || raw[0] !== 1) {
      throw new ScrapingParseError('Token de imagem inválido')
    }
    const version = raw[0]
    const keyId = raw.readUInt32BE(1)
    const nonce = raw.subarray(5, 13)
    const cipher = raw.subarray(13)

    let keyB64: string
    try {
      const res = await this.rateLimiter.schedule(() =>
        http.get<{ v?: number; e?: number; k?: string }>(
          `${SITE_BASE}/api/atfield/key?v=${version}&e=${keyId}`,
          { headers: { ...KEY_REQUEST_HEADERS } },
        ),
      )
      keyB64 = res.data?.k ?? ''
      if (!keyB64) throw new Error('resposta sem chave')
    } catch (err) {
      if (err instanceof ScrapingNetworkError) throw err
      throw new ScrapingNetworkError(`${SITE_BASE}/api/atfield/key?v=${version}&e=${keyId}`, err)
    }

    const key = Buffer.from(keyB64, 'base64')
    const plain = Buffer.alloc(cipher.length)
    let offset = 0
    let counter = 0
    while (offset < cipher.length) {
      const block = createHmac('sha256', key)
        .update(Buffer.concat([nonce, Buffer.from([counter & 0xff])]))
        .digest()
      const take = Math.min(block.length, cipher.length - offset)
      for (let i = 0; i < take; i++) plain[offset + i] = cipher[offset + i] ^ block[i]
      offset += take
      counter += 1
    }
    return plain.toString('utf-8')
  }

  // ─── API Helpers (privados) ─────────────────────────────────────────────

  private async fetchObraBySlug(slug: string): Promise<BrasukaObra> {
    try {
      const res = await this.rateLimiter.schedule(() =>
        http.get(`${getApiBase()}/v1/www/works/${slug}`),
      )
      const data = res.data as { data?: BrasukaObra }

      if (!data?.data) {
        throw new Error(`Falha no provider ${this.slug} ao buscar obra "${slug}"`)
      }

      return data.data
    } catch (err) {
      if (err instanceof ScrapingNetworkError) throw err
      throw new ScrapingNetworkError(`${getApiBase()}/v1/www/works/${slug}`, err)
    }
  }

  private async fetchAllChapters(slug: string): Promise<BrasukaCapitulo[]> {
    const chapters: BrasukaCapitulo[] = []
    let page = 1

    for (;;) {
      let data: BrasukaCapitulo[]
      try {
        const res = await this.rateLimiter.schedule(() =>
          http.get(
            `${getApiBase()}/v1/www/works/${slug}/chapters?page=${page}&limit=${CHAPTERS_PAGE_SIZE}`,
          ),
        )
        const body = res.data as { data?: BrasukaCapitulo[] }
        data = body?.data ?? []
      } catch (err) {
        if (err instanceof ScrapingNetworkError) throw err
        throw new ScrapingNetworkError(
          `${getApiBase()}/v1/www/works/${slug}/chapters?page=${page}`,
          err,
        )
      }

      chapters.push(...data)
      if (data.length < CHAPTERS_PAGE_SIZE) break
      page += 1
    }

    return chapters
  }

  private async fetchChapterPages(slug: string, number: string): Promise<BrasukaPagina[]> {
    try {
      const res = await this.rateLimiter.schedule(() =>
        http.get(`${getApiBase()}/v1/www/works/${slug}/chapters/${number}/pages`),
      )
      const body = res.data as { data?: { pages?: BrasukaPagina[] } }

      if (!body?.data?.pages) {
        throw new Error(
          `Falha no provider ${this.slug} ao buscar páginas do capítulo ${number} da obra "${slug}"`,
        )
      }

      return body.data.pages
    } catch (err) {
      if (err instanceof ScrapingNetworkError) throw err
      throw new ScrapingNetworkError(
        `${getApiBase()}/v1/www/works/${slug}/chapters/${number}/pages`,
        err,
      )
    }
  }
}

/**
 * @deprecated Use MangasBrasukaStrategy
 */
export { MangasBrasukaStrategy as MangasBrasukaProvider }
