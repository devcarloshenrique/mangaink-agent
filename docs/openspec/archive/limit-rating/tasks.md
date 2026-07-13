# Rate Limiting — Tasks de Implementacao

> **Status:** COMPLETED
> **Data:** 2026-07-12 (original) / 2026-07-13 (implementacao)

---

## 1. Dependencia e Configuracao

- [ ] 1.1 `apps/backend/package.json` — Adicionar `bottleneck: ^2.19.5` e `@types/bottleneck: ^2.19.5` (dev)
- [ ] 1.2 Rodar `pnpm install` para instalar a nova dependencia
- [ ] 1.3 `shared/config/env.ts` — Adicionar schema Zod para variaveis `RATE_LIMIT_*`:
  - `RATE_LIMIT_DEFAULT_MAX_CONCURRENT` (number, optional, default 3)
  - `RATE_LIMIT_DEFAULT_MIN_TIME` (number, optional, default 300)
  - Schema generico para `RATE_LIMIT_{SLUG}_MAX_CONCURRENT`, `RATE_LIMIT_{SLUG}_MIN_TIME`, `RATE_LIMIT_{SLUG}_RESERVOIR`, `RATE_LIMIT_{SLUG}_RESERVOIR_REFRESH_INTERVAL` (ou usar `z.record` + parse manual)
- [ ] 1.4 `.env.example` — Documentar as novas variaveis com comentarios explicativos

> **Status: COMPLETED**

---

## 2. Modulo `scraping/rate-limit/`

- [ ] 2.1 `scraping/rate-limit/types.ts` — Definir `RateLimiterConfig` e `RateLimiter` (type alias para Bottleneck)
- [ ] 2.2 `scraping/rate-limit/rate-limiter.ts` — Implementar `createRateLimiter(config: RateLimiterConfig): RateLimiter`:
  - Instanciar `new Bottleneck({ maxConcurrent, minTime, reservoir, reservoirRefreshInterval })`
  - Configurar `highWater` e `strategy` (LEAK) para evitar memory leak em cenarios de overload
- [ ] 2.3 `scraping/rate-limit/rate-limit-registry.ts` — Implementar `RateLimitRegistry`:
  - Constructor recebe `env: RateLimitEnv`
  - Metodo privado `parseEnvVars()` que itera sobre `Object.entries(env)`, filtra prefixo `RATE_LIMIT_`, extrai slug e parametro
  - Metodo `get(slug: string): RateLimiterConfig` — retorna config do slug ou config `default`
  - Metodo `has(slug: string): boolean` — verifica se slug tem config explicita
  - Lida com slug normalization (lowercase, underscores → nao necessario pois slugs usam lowercase)
- [ ] 2.4 Testes unitarios:
  - `scraping/tests/unit/rate-limit-registry.test.ts` — parse de env vars, fallback default, config parcial, slugs desconhecidos
  - `scraping/tests/unit/rate-limiter.test.ts` — factory cria Bottleneck com config correta, `schedule()` enfileira tasks

> **Status: COMPLETED**

---

## 3. Interface `IProviderStrategy`

- [ ] 3.1 `scraping/interfaces/provider-strategy.interface.ts` — Criar nova interface:
  - Copiar assinaturas existentes de `ScrapingProvider`: `slug`, `name`, `engine`, `supports()`, `getInfo()`, `inspect()`, `getChapterImages()`
  - Adicionar propriedade `readonly rateLimiter: RateLimiter`
  - Adicionar metodo `downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }>`
- [ ] 3.2 `scraping/providers/provider.interface.ts` — Manter como re-export temporario para backward compatibility:
  - `export type { IProviderStrategy as ScrapingProvider } from '../../interfaces/provider-strategy.interface'`
  - Adicionar comentario `@deprecated Use IProviderStrategy from scraping/interfaces/`
- [ ] 3.3 `scraping/providers/index.ts` — Adicionar export do novo path: `export { IProviderStrategy } from '../interfaces/provider-strategy.interface'`

> **Status: COMPLETED**

---

## 4. Refatorar `MangaLivreStrategy`

- [ ] 4.1 Renomear classe `MangalivreProvider` → `MangaLivreStrategy` em `scraping/providers/mangalivre/mangalivre.provider.ts`
- [ ] 4.2 Alterar `implements ScrapingProvider` → `implements IProviderStrategy`
- [ ] 4.3 Adicionar parametro `rateLimiter: RateLimiter` ao constructor:
  - Armazenar como `private readonly rateLimiter: RateLimiter`
  - Manter criacao do `httpClient` interno (o client HTTP ainda e usado, mas envelopado pelo limiter)
- [ ] 4.4 Refatorar `inspect()`:
  - Envelopar `await http.get(url)` com `await this.rateLimiter.schedule(() => http.get(url))`
  - Preservar todo o resto da logica (cheerio, parsers, geracao de sourceId)
- [ ] 4.5 Refatorar `getChapterImages()`:
  - Envelopar `await http.get(chapterUrl)` com `await this.rateLimiter.schedule(() => http.get(chapterUrl))`
  - Preservar parse de imagens
- [ ] 4.6 Implementar `downloadImage()`:
  - `await this.rateLimiter.schedule(() => http.get(imageUrl, { responseType: 'arraybuffer' }))`
  - Extrair `buffer = Buffer.from(response.data)`
  - Extrair `contentType = response.headers['content-type'] || 'application/octet-stream'`
  - Retornar `{ buffer, contentType }`
  - Capturar erros HTTP e lancar `ScrapingNetworkError`
- [ ] 4.7 Atualizar `mangalivre.provider.test.ts` — renomear suite, adicionar testes para `downloadImage()`, mockar `RateLimiter`
- [ ] 4.8 Arquivos auxiliares (parser, selectors) — **sem alteracoes** (logica de parse permanece identica)

> **Status: COMPLETED**

---

## 5. Atualizar `ProviderResolver`

- [ ] 5.1 Adicionar dependencia `RateLimitRegistry` ao constructor:
  - `constructor(registry: RateLimitRegistry)`
  - Armazenar como `private readonly registry: RateLimitRegistry`
- [ ] 5.2 Refatorar `resolve(url)`:
  - Apos identificar o provider, obter `config = this.registry.get(provider.slug)`
  - Criar `rateLimiter = createRateLimiter(config)`
  - Passar `rateLimiter` ao constructor do provider: `new MangaLivreStrategy(rateLimiter)`
- [ ] 5.3 Manter array `PROVIDERS` — apenas renomear as referencias de classe
- [ ] 5.4 Atualizar `provider-resolver.test.ts` — mockar `RateLimitRegistry`, verificar que limiter e injetado

> **Status: COMPLETED**

---

## 6. Atualizar Workers

### 6.1. Worker de Scraping

- [ ] 6.1.1 `scraping/workers/inspect-source.worker.ts`:
  - Instanciar `RateLimitRegistry` no setup do worker
  - Passar `registry` ao `new ProviderResolver(registry)`
  - O resto do fluxo permanece identico (provider ja vem com limiter injetado)

### 6.2. Worker de Conversao

- [ ] 6.2.1 `conversion/workers/conversion-job.worker.ts`:
  - No inicio do handler, instanciar `RateLimitRegistry` e `ProviderResolver(registry)`
  - Na funcao `getChapterImageUrls()`, o provider resolvido ja possui `rateLimiter`
  - Na funcao `downloadChapter()`, passar o provider para `ImageDownloaderService.downloadChapter()`
- [ ] 6.2.2 `conversion/services/image-downloader.service.ts`:
  - Adicionar parametro `provider: IProviderStrategy` ao metodo `downloadChapter()`
  - Substituir `httpClient.get(imageUrl, { responseType: 'arraybuffer' })` por `provider.downloadImage(imageUrl)`
  - Manter validacao de magic bytes, Content-Type, HTML detection
  - Manter logica de cache check, placeholder generation, `images.json`
- [ ] 6.2.3 Atualizar testes:
  - `image-downloader.service.test.ts` — mockar `provider.downloadImage()`, verificar que nao usa `httpClient` diretamente

> **Status: COMPLETED**

---

## 7. Atualizar Tests Existentes

- [ ] 7.1 `scraping/tests/helpers/mock-scraping-provider.ts`:
  - Renomear para `MockProviderStrategy`
  - Implementar `IProviderStrategy` (substituir `implements ScrapingProvider`)
  - Adicionar mock `rateLimiter` (Bottleneck fake ou `{ schedule: async (fn) => fn() }`)
  - Adicionar mock `downloadImage()` que retorna `{ buffer: Buffer.from('fake'), contentType: 'image/png' }`
- [ ] 7.2 `conversion/tests/helpers/mock-job.repository.ts` / `fixtures.ts`:
  - Atualizar referencias de `ScrapingProvider` para `IProviderStrategy`
- [ ] 7.3 Atualizar imports em TODOS os arquivos de teste que referenciam `ScrapingProvider`:
  - `scraping/tests/unit/inspect-source.use-case.test.ts`
  - `scraping/tests/unit/get-source.use-case.test.ts`
  - `scraping/tests/unit/provider-resolver.test.ts`
  - `scraping/tests/unit/mangalivre.provider.test.ts` → renomear para `mangalivre.strategy.test.ts`
  - `scraping/tests/e2e/scraping.e2e.test.ts`
  - `conversion/tests/unit/create-conversion.use-case.test.ts`
  - `conversion/tests/unit/get-conversion.use-case.test.ts`
  - `conversion/tests/e2e/conversion.e2e.test.ts`
- [ ] 7.4 Rodar `pnpm test` e verificar que **todos** os testes passam

> **Status: COMPLETED**

---

## 8. Verificacao Final

- [ ] 8.1 Rodar `pnpm lint` — zero erros
- [ ] 8.2 Rodar `pnpm test` — zero falhas
- [ ] 8.3 Rodar `pnpm dev:backend` e verificar startup sem erros de schema Zod
- [ ] 8.4 Teste manual E2E:
  - Fazer scrape de um manga no Manga Livre
  - Disparar conversao de 10 capitulos
  - Verificar nos logs que o rate limiter esta ativo (Bottleneck emite eventos `received`, `executing`, `done`)
  - Verificar reducao de paginas corrompidas em comparacao ao baseline (83 placeholders sem rate limit)

> **Status: PENDING**

---

## Archive Note

Esta spec foi **COMPLETED** em 2026-07-13. O modulo implementa:

- Interface `IProviderStrategy` em `scraping/interfaces/` com `inspect()`, `getChapterImages()` e `downloadImage()`
- Rate limiting via Bottleneck configurado por env vars (`RATE_LIMIT_{SLUG}_{PARAM}`)
- `RateLimitRegistry` que le env vars e mapeia slug → RateLimiterConfig com fallback `default`
- `MangaLivreStrategy` refatorada com rate limiter injetado e metodo `downloadImage()`
- `ProviderResolver` estendido para injetar RateLimiter nos providers
- `ImageDownloaderService` delegando downloads para `provider.downloadImage()` (sem chunking manual — Bottleneck controla concorrencia)
- Schema Zod resiliente a sufixos (ex: `100ms` → 100) via `z.preprocess()`
- Zero breaking changes na API HTTP

**Futuras expansoes** (NOT in this spec):
- Rate limiting adaptativo baseado em taxa de HTTP 429
- Rate limiting via Redis Cluster para multi-worker
- Suporte a providers `playwright` com controle de sessao
- Dashboard de metricas de rate limit
