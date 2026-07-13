import type { IProviderStrategy } from '../../interfaces/provider-strategy.interface'
import type { RateLimiter } from '../../rate-limit/types'
import type { ProviderEngine, ProviderInfo } from '../../types/provider.types'
import type { SourceInspectResponse } from '../../types/source.types'

const fakeLimiter: RateLimiter = {
  schedule: (fn: () => Promise<unknown>) => fn(),
} as unknown as RateLimiter

export class MockScrapingProvider implements IProviderStrategy {
  readonly slug = 'test-provider'
  readonly name = 'Test Provider'
  readonly engine: ProviderEngine = 'cheerio'
  readonly urlPattern = /test\.example\.com\/manga\//
  readonly allowedDomains = ['test.example.com']
  readonly rateLimiter: RateLimiter = fakeLimiter

  private _supportsResult = true
  private _inspectResult: SourceInspectResponse | null = null
  private _inspectError: Error | null = null
  private _chapterImagesResult: string[] = []
  private _chapterImagesError: Error | null = null

  supports(url: string): boolean {
    if (!this._supportsResult) return false
    try {
      const { hostname } = new URL(url)
      return this.allowedDomains.includes(hostname)
    } catch {
      return false
    }
  }

  getInfo(): ProviderInfo {
    return { slug: this.slug, name: this.name, engine: this.engine }
  }

  async getChapterImages(_chapterUrl: string): Promise<string[]> {
    if (this._chapterImagesError) throw this._chapterImagesError
    return this._chapterImagesResult
  }

  async downloadImage(_imageUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
    return { buffer: Buffer.from('mock-image-data'), contentType: 'image/png' }
  }

  async inspect(_canonicalUrl: string): Promise<SourceInspectResponse> {
    if (this._inspectError) throw this._inspectError
    if (this._inspectResult) return this._inspectResult
    return {
      sourceId: 'src-test-source-12345678',
      status: 'ready',
      provider: { slug: this.slug, name: this.name, engine: 'cheerio' },
      source: { url: _canonicalUrl, language: null },
      metadata: {
        title: 'Test Manga',
        author: 'Test Author',
        description: 'A test manga',
        status: 'ongoing',
        genres: ['Action', 'Adventure'],
      },
      chapters: [],
      covers: [],
      statistics: { chapters: 0, covers: 0 },
    }
  }

  setSupportsResult(value: boolean): void {
    this._supportsResult = value
  }

  setInspectResult(result: SourceInspectResponse): void {
    this._inspectResult = result
  }

  setInspectError(error: Error): void {
    this._inspectError = error
  }

  setChapterImagesResult(images: string[]): void {
    this._chapterImagesResult = images
  }

  setChapterImagesError(error: Error): void {
    this._chapterImagesError = error
  }

  reset(): void {
    this._supportsResult = true
    this._inspectResult = null
    this._inspectError = null
    this._chapterImagesResult = []
    this._chapterImagesError = null
  }
}
