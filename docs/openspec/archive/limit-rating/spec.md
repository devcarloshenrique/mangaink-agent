# Rate Limiting — Especificacao

> **Status:** IMPLEMENTED
> **Data:** 2026-07-12 (original) / 2026-07-13 (implementacao)
> **Modulo:** `scraping`, `conversion`

---

## Purpose

Este modulo adiciona uma camada de rate limiting proativo por provider ao pipeline de scraping e download de imagens. Utiliza a biblioteca `bottleneck` para implementar throttling configuravel por variavel de ambiente, coordenando todas as chamadas HTTP a um mesmo dominio (scraping de metadados + download de imagens) sob um mesmo teto de concorrencia.

A interface central `IProviderStrategy` (renomeada de `ScrapingProvider`) e estendida com o metodo `downloadImage()` e a propriedade `rateLimiter`, garantindo que o `ImageDownloaderService` compartilhe o mesmo limitador do provider.

---

## Requirements

### Requirement: Interface IProviderStrategy
The system MUST provide a strategy interface that standardizes scraping, chapter image extraction, and image downloading with integrated rate limiting.

#### Scenario: Provider implements all required methods
- **WHEN** a concrete provider class is created implementing `IProviderStrategy`
- **THEN** it MUST implement `inspect()`, `getChapterImages()`, and `downloadImage()`
- **THEN** it MUST expose `rateLimiter` as a public readonly property of type `RateLimiter`
- **THEN** it MUST expose `slug`, `name`, and `engine` as public readonly properties

#### Scenario: downloadImage returns buffer and content type
- **WHEN** `provider.downloadImage(imageUrl)` is called
- **THEN** it MUST internally use `this.rateLimiter.schedule()` to wrap the HTTP call
- **THEN** it MUST return `{ buffer: Buffer, contentType: string }` on success
- **THEN** it MUST throw `ScrapingNetworkError` on HTTP failure

#### Scenario: inspect and getChapterImages use rate limiter
- **WHEN** `provider.inspect(url)` or `provider.getChapterImages(url)` is called
- **THEN** the HTTP call MUST be wrapped in `this.rateLimiter.schedule()`
- **THEN** the method signature and return type remain unchanged from the existing `ScrapingProvider` interface

---

### Requirement: RateLimiter Factory
The system MUST provide a factory function that creates Bottleneck instances from RateLimiterConfig.

#### Scenario: createRateLimiter with full config
- **WHEN** `createRateLimiter({ maxConcurrent: 2, minTime: 500, reservoir: 10, reservoirRefreshInterval: 1000 })` is called
- **THEN** it MUST return a Bottleneck instance with `maxConcurrent: 2`, `minTime: 500`, `reservoir: 10`, `reservoirRefreshInterval: 1000`

#### Scenario: createRateLimiter with minimal config
- **WHEN** `createRateLimiter({ maxConcurrent: 3, minTime: 300 })` is called
- **THEN** it MUST return a Bottleneck instance with `maxConcurrent: 3`, `minTime: 300`, and default `reservoir` / `reservoirRefreshInterval` (undefined — no reservoir limit)

#### Scenario: Bottleneck rejects tasks that exceed concurrency
- **WHEN** 4 tasks are scheduled simultaneously on a limiter with `maxConcurrent: 2`
- **THEN** only 2 tasks execute concurrently
- **THEN** the remaining 2 are queued until a slot is available

---

### Requirement: RateLimitRegistry
The system MUST parse environment variables to build a provider-specific rate limit configuration map, with a default fallback.

#### Scenario: Parse provider-specific env vars
- **WHEN** env contains `RATE_LIMIT_MANGALIVRE_MAX_CONCURRENT=2` and `RATE_LIMIT_MANGALIVRE_MIN_TIME=500`
- **THEN** `registry.get('mangalivre')` MUST return `{ maxConcurrent: 2, minTime: 500 }`

#### Scenario: Parse default env vars as fallback
- **WHEN** env contains `RATE_LIMIT_DEFAULT_MAX_CONCURRENT=3` and `RATE_LIMIT_DEFAULT_MIN_TIME=300`
- **THEN** `registry.get('mangadex')` (provider without specific config) MUST return `{ maxConcurrent: 3, minTime: 300 }`

#### Scenario: Parse reservoir env vars
- **WHEN** env contains `RATE_LIMIT_MANGADEX_RESERVOIR=5` and `RATE_LIMIT_MANGADEX_RESERVOIR_REFRESH_INTERVAL=1000`
- **THEN** `registry.get('mangadex')` MUST include `reservoir: 5` and `reservoirRefreshInterval: 1000`

#### Scenario: Partial config merges with defaults
- **WHEN** env contains `RATE_LIMIT_MANGALIVRE_MAX_CONCURRENT=2` but no `RATE_LIMIT_MANGALIVRE_MIN_TIME`
- **THEN** `registry.get('mangalivre')` MUST return `{ maxConcurrent: 2 }` without `minTime`
- **THEN** Bottleneck uses its default `minTime` (0ms) for this provider

#### Scenario: has() checks for explicit config
- **WHEN** `registry.has('mangalivre')` is called and mangalivre has explicit env vars
- **THEN** returns `true`
- **WHEN** `registry.has('unknown-provider')` is called and unknown-provider has no env vars
- **THEN** returns `false`

---

### Requirement: ProviderResolver Injects Rate Limiter
The system MUST inject a provider-specific RateLimiter into each provider when resolved.

#### Scenario: Resolve provider with rate limiter
- **WHEN** `ProviderResolver.resolve(mangalivreUrl)` is called
- **THEN** the resolver MUST identify the provider slug (`mangalivre`)
- **THEN** the resolver MUST call `rateLimitRegistry.get('mangalivre')` to obtain config
- **THEN** the resolver MUST create a `RateLimiter` via `createRateLimiter(config)`
- **THEN** the resolver MUST pass the limiter to the provider constructor
- **THEN** the returned provider has `rateLimiter` populated

#### Scenario: Re-resolving same provider reuses limiter (optional optimization)
- **WHEN** `ProviderResolver.resolve()` is called twice for URLs of the same provider
- **THEN** the returned providers MAY share the same `RateLimiter` instance
- **THEN** scraping and download operations on the same domain are coordinated under one concurrency limit

---

### Requirement: ImageDownloaderService Uses Provider's downloadImage
The system MUST delegate HTTP image downloads to the provider's `downloadImage()` method instead of using a shared HTTP client directly.

#### Scenario: Download chapter images via provider
- **WHEN** `imageDownloader.downloadChapter(jobId, sourceId, chapterId, imageUrls, provider)` is called
- **THEN** for each `imageUrl`, the downloader MUST call `provider.downloadImage(imageUrl)` instead of `httpClient.get(imageUrl)`
- **THEN** the returned `{ buffer, contentType }` MUST be validated (magic bytes, HTML detection, Content-Type) as before
- **THEN** valid images are cached to `storage/sources/{sourceId}/chapters/{chapterId}/` as before

#### Scenario: Rate limiting applied during download
- **WHEN** `provider.downloadImage(imageUrl)` is called
- **THEN** the HTTP request MUST pass through `this.rateLimiter.schedule()`
- **THEN** concurrent downloads from the same provider respect `maxConcurrent`

#### Scenario: Corrupt image handling unchanged
- **WHEN** `provider.downloadImage()` returns a buffer that fails magic byte validation
- **THEN** the downloader MUST emit `download.image.corrupt` SSE event
- **THEN** the downloader MUST apply the configured `errorHandlingStrategy` (ignore/skip_chapter/abort)
- **THEN** placeholder images are generated as before

---

### Requirement: Environment Variable Schema
The system MUST validate rate limit environment variables using Zod in the shared config.

#### Scenario: Valid env vars
- **WHEN** `RATE_LIMIT_MANGALIVRE_MAX_CONCURRENT=2` and `RATE_LIMIT_DEFAULT_MIN_TIME=300` are set
- **THEN** the Zod schema MUST parse them as positive integers
- **THEN** `env.RATE_LIMIT` (or equivalent) contains the validated values

#### Scenario: Invalid env var type
- **WHEN** `RATE_LIMIT_MANGALIVRE_MAX_CONCURRENT=abc` (non-numeric)
- **THEN** the Zod schema MUST reject with a validation error
- **THEN** the application MUST fail fast on startup (as per existing env.ts convention)

#### Scenario: Missing env vars (graceful)
- **WHEN** no `RATE_LIMIT_*` env vars are set at all
- **THEN** the Zod schema MUST accept the absence (all fields optional)
- **THEN** the `RateLimitRegistry` MUST fall back to hardcoded safe defaults: `maxConcurrent: 3, minTime: 300`

---

### Requirement: MangaLivreStrategy Implementation
The system MUST refactor the existing `MangalivreProvider` to implement `IProviderStrategy` with integrated rate limiting.

#### Scenario: Constructor receives RateLimiter
- **WHEN** `new MangaLivreStrategy(rateLimiter)` is instantiated
- **THEN** `this.rateLimiter` MUST be set to the provided instance
- **THEN** the existing `httpClient` (created via `createHttpClient`) MUST continue to be used internally for HTTP calls

#### Scenario: inspect uses rate limiter
- **WHEN** `mangaLivreStrategy.inspect(canonicalUrl)` is called
- **THEN** the HTTP call to fetch series page HTML MUST be wrapped in `this.rateLimiter.schedule(() => http.get(url))`

#### Scenario: getChapterImages uses rate limiter
- **WHEN** `mangaLivreStrategy.getChapterImages(chapterUrl)` is called
- **THEN** the HTTP call to fetch chapter page HTML MUST be wrapped in `this.rateLimiter.schedule(() => http.get(url))`

#### Scenario: downloadImage uses rate limiter
- **WHEN** `mangaLivreStrategy.downloadImage(imageUrl)` is called
- **THEN** the HTTP call MUST use `this.rateLimiter.schedule(() => http.get(imageUrl, { responseType: 'arraybuffer' }))`
- **THEN** the response data and Content-Type header MUST be extracted and returned as `{ buffer, contentType }`
- **THEN** on HTTP error, a `ScrapingNetworkError` MUST be thrown with the original error details

---

### Requirement: Backward Compatibility
The system MUST maintain backward compatibility with all existing API endpoints and behavior.

#### Scenario: All existing endpoints unchanged
- **WHEN** calling `POST /api/conversions/source/inspect`, `GET /api/conversions/source/inspect/:id`, `POST /api/conversions`, `GET /api/conversions/:id`, etc.
- **THEN** request and response contracts MUST remain identical
- **THEN** status codes and error responses MUST remain identical

#### Scenario: Existing tests pass after refactor
- **WHEN** running all existing unit and E2E tests
- **THEN** all tests MUST pass after updating mocks to implement `IProviderStrategy` instead of `ScrapingProvider`
- **THEN** mock `RateLimiter` can be a simple pass-through (no actual bottleneck instance)

---

## NOT YET IMPLEMENTED (Future Enhancements)

- **Adaptive rate limiting:** Auto-adjust `maxConcurrent` and `minTime` based on HTTP 429 response rate. Requires metrics collection and feedback loop.
- **Redis-backed limiter clustering:** Share Bottleneck state across multiple worker processes via Redis. Required when horizontal scaling beyond 1 worker.
- **Provider-specific HTTP client:** Allow providers to customize the underlying HTTP client (e.g., MangaDex uses API key header, Cloudflare provider uses cookie jar).
- **Rate limit monitoring dashboard:** Expose rate limiter metrics (queued, running, done, rejected counts) via API endpoint.
- **Per-endpoint rate limits:** Support different concurrency for scraping vs. image download within the same provider (e.g., more aggressive downloads, conservative scraping).
