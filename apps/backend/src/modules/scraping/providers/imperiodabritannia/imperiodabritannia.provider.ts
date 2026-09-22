import { createHttpClient } from '../../../../shared/http/http-client'
import { createSourceId } from '../../../../shared/utils/id-generator'
import { env } from '../../../../shared/config/env'
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
  getMangaSlug,
  mapCapituloToImageUrls,
  mapObraToInspectResponse,
  parseChapterUrl,
} from './imperiodabritannia.mapper'
import type {
  BritanniaObra,
  BritanniaCapituloDetalhado,
} from './imperiodabritannia.types'

const BASE_URL = 'https://imperiodabritannia.net'
const API_BASE = 'https://api.imperiodabritannia.net'
const CDN_BASE = 'https://cdn.imperiodabritannia.net'

const http = createHttpClient({
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    'x-noencryptionbritta': '1',
    'X-API-Token': env.X_API_TOKEN,
    Referer: `${BASE_URL}/`,
    Origin: BASE_URL,
  },
  retries: 3,
  retryDelay: 2_000,
})

interface BritanniaSearchObra {
  id: number
  nome: string
  imagem: string | null
  slug?: string | null
}

interface BritanniaSearchResponse {
  sucesso?: boolean
  obras?: BritanniaSearchObra[]
}

export class ImperioDaBritanniaStrategy implements IProviderStrategy {
  readonly slug = 'imperiodabritannia'
  readonly name = 'Imperio da Britannia'
  readonly engine: ProviderEngine = 'api'
  readonly urlPattern = /imperiodabritannia\.net\/manga\//
  readonly allowedDomains = [
    'imperiodabritannia.net',
    'api.imperiodabritannia.net',
    'cdn.imperiodabritannia.net',
  ]

  /** Cache in-memory de slug → obraId */
  private readonly slugToObraId = new Map<string, number>()

  constructor(readonly rateLimiter: RateLimiter) {}

  supports(url: string): boolean {
    try {
      const { hostname } = new URL(url)
      return this.allowedDomains.includes(hostname)
    } catch {
      return false
    }
  }

  getInfo(): ProviderInfo {
    return buildProviderInfo()
  }

  async search(query: string, opts?: ProviderSearchOptions): Promise<ProviderSearchResult[]> {
    const limit = opts?.limit ?? 10
    const offset = opts?.offset ?? 0
    const pagina = Math.floor(offset / limit) + 1
    const url = `${API_BASE}/api/obras?busca=${encodeURIComponent(query)}&limite=${limit}&pagina=${pagina}`
    let obras: BritanniaSearchObra[]
    try {
      const res = await this.rateLimiter.schedule(() =>
        http.get<BritanniaSearchResponse>(url, { signal: opts?.signal }),
      )
      obras = res.data?.obras ?? []
    } catch (err) {
      if (err instanceof ScrapingNetworkError) throw err
      throw new ScrapingNetworkError(url, err)
    }

    const startIndex = offset % limit
    const candidates = obras.slice(startIndex, startIndex + limit).filter((obra) => obra?.nome)
    const settled = await Promise.allSettled(
      candidates.map(async (obra): Promise<ProviderSearchResult> => {
        let slug = obra.slug ?? null
        if (!slug && typeof obra.id === 'number') {
          slug = await this.fetchSlugByObraId(obra.id, opts?.signal)
        }
        if (!slug) {
          throw new Error(`Não foi possível resolver o slug da obra "${obra.nome}"`)
        }
        return {
          providerSlug: this.slug,
          title: obra.nome,
          url: `${BASE_URL}/manga/${slug}/`,
          coverUrl: obra.imagem ? `${CDN_BASE}/${obra.imagem}` : null,
          author: null,
        }
      }),
    )

    const seen = new Set<string>()
    const results: ProviderSearchResult[] = []
    const hydrationErrors: unknown[] = []
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        if (seen.has(outcome.value.url)) continue
        seen.add(outcome.value.url)
        results.push(outcome.value)
      } else {
        hydrationErrors.push(outcome.reason)
      }
    }

    if (results.length === 0 && hydrationErrors.length > 0) {
      throw new ScrapingNetworkError(
        `${API_BASE}/api/obras?busca=${encodeURIComponent(query)}`,
        hydrationErrors[0],
      )
    }

    return results
  }

  async inspect(canonicalUrl: string): Promise<SourceInspectResponse> {
    const slug = getMangaSlug(canonicalUrl)
    const obra = await this.fetchObraBySlug(slug)
    return mapObraToInspectResponse(obra, slug, canonicalUrl)
  }

  async getChapterImages(chapterUrl: string): Promise<string[]> {
    const parsed = parseChapterUrl(chapterUrl)
    if (!parsed) {
      throw new ScrapingParseError(
        `URL de capítulo inválida. Esperado: ${BASE_URL}/manga/{slug}/capitulo/{numero}`,
      )
    }

    const { slug, numero } = parsed
    const obraId = await this.getObraId(slug)
    const capitulo = await this.fetchChapterPages(obraId, numero)
    return mapCapituloToImageUrls(capitulo)
  }

  async downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
    try {
      const response = await this.rateLimiter.schedule(() =>
        http.get(imageUrl, {
          responseType: 'arraybuffer',
          validateStatus: (status) => status === 200,
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
      throw new ScrapingNetworkError(imageUrl, err)
    }
  }

  // ─── API Helpers (privados) ─────────────────────────────────────────────

  private async fetchObraBySlug(slug: string): Promise<BritanniaObra> {
    try {
      const res = await this.rateLimiter.schedule(() =>
        http.get(`${API_BASE}/api/obras/by-slug/${slug}`),
      )
      const data = res.data as { sucesso?: boolean; obra?: BritanniaObra }

      if (!data?.sucesso || !data?.obra) {
        throw new Error(
          `API retornou resposta inválida para slug "${slug}" (sucesso=${data?.sucesso ?? false})`,
        )
      }

      // Cachear obra_id
      if (data.obra.id) {
        this.slugToObraId.set(slug, data.obra.id)
      }

      return data.obra
    } catch (err) {
      if (err instanceof ScrapingNetworkError) throw err
      throw new ScrapingNetworkError(`${API_BASE}/api/obras/by-slug/${slug}`, err)
    }
  }

  private async fetchChapterPages(
    obraId: number,
    numero: number,
  ): Promise<BritanniaCapituloDetalhado> {
    try {
      const res = await this.rateLimiter.schedule(() =>
        http.get(`${API_BASE}/api/obras/${obraId}/capitulos/${numero}`),
      )
      const data = res.data as { sucesso?: boolean; capitulo?: BritanniaCapituloDetalhado }

      if (!data?.sucesso || !data?.capitulo) {
        throw new Error(
          `API retornou resposta inválida para capítulo ${numero} da obra ${obraId} (sucesso=${data?.sucesso ?? false})`,
        )
      }

      return data.capitulo
    } catch (err) {
      if (err instanceof ScrapingNetworkError) throw err
      throw new ScrapingNetworkError(
        `${API_BASE}/api/obras/${obraId}/capitulos/${numero}`,
        err,
      )
    }
  }

  private async getObraId(slug: string): Promise<number> {
    if (this.slugToObraId.has(slug)) {
      return this.slugToObraId.get(slug)!
    }
    const obra = await this.fetchObraBySlug(slug)
    return obra.id
  }

  /**
   * Hydrate do slug via detalhe da obra quando a listagem de busca não o traz.
   * Retorna null apenas quando a API responde sem slug; falha de rede propaga
   * como `ScrapingNetworkError` para o agregador registrar em `errors[]`.
   */
  private async fetchSlugByObraId(obraId: number, signal?: AbortSignal): Promise<string | null> {
    try {
      const res = await this.rateLimiter.schedule(() =>
        http.get<{ sucesso?: boolean; obra?: { slug?: string } }>(
          `${API_BASE}/api/obras/${obraId}`,
          { signal },
        ),
      )
      return res.data?.obra?.slug ?? null
    } catch (err) {
      if (err instanceof ScrapingNetworkError) throw err
      throw new ScrapingNetworkError(`${API_BASE}/api/obras/${obraId}`, err)
    }
  }
}
