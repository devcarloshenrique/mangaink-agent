import type { AxiosInstance } from 'axios'
import type { IProviderStrategy } from '../../interfaces/provider-strategy.interface'
import type {
  ProviderEngine,
  ProviderInfo,
  ProviderSearchResult,
  ProviderSearchOptions,
} from '../../types/provider.types'
import type { SourceInspectResponse } from '../../types/source.types'
import type { RateLimiter } from '../../rate-limit/types'
import { ScrapingNetworkError } from '../../errors/scraping.errors'
import { createHttpClient } from '../../../../shared/http/http-client'
import { createSourceId, createCoverId } from '../../../../shared/utils/id-generator'
import {
  parseSearchResults,
  mapMangaDetails,
  mapApiChaptersToChapters,
  parseChapterImages,
} from './mangakakalot.mapper'
import type {
  MangaKakalotApiChapter,
  MangaKakalotApiChaptersResponse,
} from './mangakakalot.types'

export class MangaKakalotStrategy implements IProviderStrategy {
  readonly slug = 'mangakakalot'
  readonly name = 'MangaKakalot'
  readonly engine: ProviderEngine = 'cheerio'
  readonly urlPattern = /mangakakalot\.(com|gg|tv|to|org|fun|site|me|live)/i
  readonly allowedDomains = [
    'mangakakalot.gg',
    'www.mangakakalot.gg',
    'mangakakalot.com',
    'www.mangakakalot.com',
    'mangakakalot.tv',
    'www.mangakakalot.tv',
    'mangakakalot.to',
    'www.mangakakalot.to',
    'mangakakalot.org',
    'www.mangakakalot.org',
    'mangakakalot.fun',
    'www.mangakakalot.fun',
    '2xstorage.com',
    'imgs-2.2xstorage.com',
    'img-r1.2xstorage.com',
    'mkklcdnv6temp.com',
    'v1.mkklcdnv6temp.com',
    'v2.mkklcdnv6temp.com',
    'v3.mkklcdnv6temp.com',
    'v4.mkklcdnv6temp.com',
    'v5.mkklcdnv6temp.com',
    'v6.mkklcdnv6temp.com',
    'v7.mkklcdnv6temp.com',
    'v8.mkklcdnv6temp.com',
    'avt.mkklcdnv6temp.com',
    'mghcdn.com',
    'imgx.mghcdn.com',
    'thumb.mghcdn.com',
  ]
  readonly rateLimiter: RateLimiter

  private readonly baseUrl = 'https://www.mangakakalot.gg'
  private readonly client: AxiosInstance

  constructor(rateLimiter: RateLimiter, client?: AxiosInstance) {
    this.rateLimiter = rateLimiter
    this.client =
      client ??
      createHttpClient({
        allowedHosts: this.allowedDomains,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })
  }

  supports(url: string): boolean {
    try {
      const parsed = new URL(url)
      return (
        parsed.hostname === 'mangakakalot.gg' ||
        parsed.hostname.endsWith('.mangakakalot.gg') ||
        parsed.hostname === 'mangakakalot.com' ||
        parsed.hostname.endsWith('.mangakakalot.com') ||
        parsed.hostname === 'mangakakalot.tv' ||
        parsed.hostname.endsWith('.mangakakalot.tv') ||
        parsed.hostname === 'mangakakalot.to' ||
        parsed.hostname.endsWith('.mangakakalot.to') ||
        parsed.hostname === 'mangakakalot.org' ||
        parsed.hostname.endsWith('.mangakakalot.org') ||
        parsed.hostname === 'mangakakalot.fun' ||
        parsed.hostname.endsWith('.mangakakalot.fun')
      )
    } catch {
      return false
    }
  }

  getInfo(): ProviderInfo {
    return {
      slug: this.slug,
      name: this.name,
      engine: this.engine,
    }
  }

  async search(query: string, opts?: ProviderSearchOptions): Promise<ProviderSearchResult[]> {
    if ((opts?.offset ?? 0) > 0) return []

    return this.rateLimiter.schedule(async () => {
      const searchUrl = `${this.baseUrl}/home/search/json?searchword=${encodeURIComponent(query)}`
      let html: string
      try {
        const res = await this.client.get<string>(searchUrl, {
          signal: opts?.signal,
          headers: {
            Referer: `${this.baseUrl}/`,
          },
        })
        html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
      } catch (err: any) {
        if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') {
          throw err
        }
        // Fallback para rota de busca padrão HTML
        try {
          const fallbackUrl = `${this.baseUrl}/search/story/${encodeURIComponent(query)}`
          const fallbackRes = await this.client.get<string>(fallbackUrl, {
            signal: opts?.signal,
            headers: {
              Referer: `${this.baseUrl}/`,
            },
          })
          html = fallbackRes.data
        } catch {
          throw new ScrapingNetworkError(searchUrl, err)
        }
      }

      const results = parseSearchResults(html, this.baseUrl)
      if (opts?.limit && opts.limit > 0) {
        return results.slice(0, opts.limit)
      }
      return results
    })
  }

  async inspect(url: string, opts?: { signal?: AbortSignal }): Promise<SourceInspectResponse> {
    return this.rateLimiter.schedule(async () => {
      const slugMatch = url.match(/\/manga\/([^/?#]+)/i)
      const slug = slugMatch ? slugMatch[1] : null

      let mangaResult: SourceInspectResponse | null = null

      try {
        const res = await this.client.get<string>(url, {
          signal: opts?.signal,
          headers: {
            Referer: `${this.baseUrl}/`,
          },
        })
        mangaResult = mapMangaDetails(res.data, url, this.getInfo(), this.baseUrl)
      } catch (err: any) {
        if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') {
          throw err
        }

        // Se slug estiver disponível, tenta recuperar via search + chapters API
        if (slug) {
          try {
            const queryTerm = slug.replace(/-/g, ' ')
            const searchResults = await this.search(queryTerm, { signal: opts?.signal })
            const matched = searchResults.find(
              (r) =>
                r.url.includes(`/manga/${slug}`) ||
                r.title.toLowerCase().includes(queryTerm.toLowerCase()),
            )

            let coverImageUrl = `https://img-r1.2xstorage.com/thumb/${slug}.webp`
            let title = slug
              .split('-')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')
            let author = null

            if (matched) {
              title = matched.title
              author = matched.author ?? null
              if (matched.coverUrl) {
                if (matched.coverUrl.includes('url=')) {
                  try {
                    const parsedUrl = new URL(matched.coverUrl, 'http://localhost')
                    coverImageUrl = parsedUrl.searchParams.get('url') || coverImageUrl
                  } catch {}
                } else {
                  coverImageUrl = matched.coverUrl
                }
              }
            }

            mangaResult = {
              sourceId: createSourceId(this.slug, url),
              status: 'ready',
              provider: this.getInfo(),
              source: {
                url,
                language: 'en',
              },
              metadata: {
                title,
                author,
                description: null,
                status: 'unknown',
                genres: [],
              },
              chapters: [],
              covers: [
                {
                  id: createCoverId(1),
                  type: 'original',
                  label: 'Capa Principal',
                  imageUrl: coverImageUrl,
                },
              ],
              statistics: {
                chapters: 0,
                covers: 1,
              },
            }
          } catch {
            // Continua para lançar o erro original caso não consiga
          }
        }

        if (!mangaResult) {
          throw new ScrapingNetworkError(url, err)
        }
      }

      // Garante que a capa principal exista via busca caso o scraping da página omita
      if ((!mangaResult.covers || mangaResult.covers.length === 0) && slug) {
        try {
          const searchResults = await this.search(slug, { signal: opts?.signal })
          const matched =
            searchResults.find(
              (r) =>
                r.url.includes(`/manga/${slug}`) ||
                r.title.toLowerCase().includes(slug.toLowerCase()),
            ) || searchResults[0]
          if (matched?.coverUrl) {
            mangaResult.covers = [
              {
                id: createCoverId(1),
                type: 'original',
                label: 'Capa Principal',
                imageUrl: matched.coverUrl,
              },
            ]
            mangaResult.statistics.covers = 1
          }
        } catch {
          // ignora falha no fallback de capa
        }
      }

      // Paginação completa de capítulos (100% dos capítulos disponíveis)
      if (slug) {
        try {
          const allApiChapters: MangaKakalotApiChapter[] = []
          let offset = 0
          const limit = 500
          let hasMore = true

          while (hasMore) {
            const apiUrl = `${this.baseUrl}/api/manga/${slug}/chapters?limit=${limit}&offset=${offset}`
            const apiRes = await this.client.get<MangaKakalotApiChaptersResponse>(apiUrl, {
              signal: opts?.signal,
              headers: {
                Referer: `${this.baseUrl}/`,
                Accept: 'application/json',
              },
            })

            const chapters = apiRes.data?.data?.chapters ?? []
            if (chapters.length === 0) {
              hasMore = false
              break
            }

            allApiChapters.push(...chapters)

            const pagination = apiRes.data?.data?.pagination
            if (pagination && typeof pagination.has_more === 'boolean') {
              if (!pagination.has_more) {
                hasMore = false
                break
              }
            } else if (chapters.length < limit) {
              hasMore = false
              break
            }

            offset += chapters.length
          }

          if (allApiChapters.length > 0) {
            const mappedChapters = mapApiChaptersToChapters(allApiChapters, this.baseUrl, slug)
            mangaResult.chapters = mappedChapters
            mangaResult.statistics.chapters = mappedChapters.length
          }
        } catch {
          // Se a API de capítulos não responder (ex: testes unitários offline com mock HTML),
          // mantém os capítulos já extraídos do HTML
        }
      }

      return mangaResult
    })
  }

  async getChapterImages(chapterUrl: string, opts?: { signal?: AbortSignal }): Promise<string[]> {
    return this.rateLimiter.schedule(async () => {
      let html: string
      try {
        const res = await this.client.get<string>(chapterUrl, {
          signal: opts?.signal,
          headers: {
            Referer: `${this.baseUrl}/`,
          },
        })
        html = res.data
        const images = parseChapterImages(html, this.baseUrl)
        if (images.length > 0) return images
      } catch (err: any) {
        if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') {
          throw err
        }
      }

      // Fallback para mirror mangakakalot.fun
      const match = chapterUrl.match(/\/(?:manga|chapter)\/([^/?#]+)\/([^/?#]+)/i)
      if (match) {
        const mirrorUrl = `https://mangakakalot.fun/chapter/${match[1]}/${match[2]}`
        try {
          const mirrorRes = await this.client.get<string>(mirrorUrl, {
            signal: opts?.signal,
            validateStatus: (status) => status < 400,
            headers: {
              Referer: 'https://mangakakalot.fun/',
            },
          })
          const mirrorImages = parseChapterImages(mirrorRes.data, 'https://mangakakalot.fun')
          if (mirrorImages.length > 0) return mirrorImages
        } catch {
          // Continua para lançar ScrapingNetworkError
        }
      }

      throw new ScrapingNetworkError(chapterUrl, new Error('Could not fetch chapter images'))
    })
  }

  async downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
    return this.rateLimiter.schedule(async () => {
      const candidateUrls = [imageUrl]
      if (imageUrl.includes('.2xstorage.com/thumb/')) {
        const thumbName = imageUrl.split('/thumb/')[1]
        candidateUrls.push(
          `https://imgs-2.2xstorage.com/thumb/${thumbName}`,
          `https://img-r1.2xstorage.com/thumb/${thumbName}`,
          `https://img-r2.2xstorage.com/thumb/${thumbName}`,
        )
      }

      for (let i = 0; i < candidateUrls.length; i++) {
        const u = candidateUrls[i]
        try {
          const res = await this.client.get<ArrayBuffer>(u, {
            responseType: 'arraybuffer',
            headers: {
              Referer: `${this.baseUrl}/`,
            },
          })
          const contentType = (res.headers['content-type'] as string) || 'image/jpeg'
          return {
            buffer: Buffer.from(res.data),
            contentType,
          }
        } catch (err: any) {
          if (i === candidateUrls.length - 1) {
            throw new ScrapingNetworkError(imageUrl, err)
          }
        }
      }

      throw new ScrapingNetworkError(imageUrl, new Error('Could not download image'))
    })
  }
}
