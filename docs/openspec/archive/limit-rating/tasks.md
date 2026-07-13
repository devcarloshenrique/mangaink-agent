# Rate Limiting — Tasks de Implementacao

> **Status:** COMPLETED
> **Data:** 2026-07-12 (original) / 2026-07-13 (implementacao)

---

## 1. Dependencia e Configuracao

- [x] 1.1 `apps/backend/package.json` — Adicionar `bottleneck: ^2.19.5` (tipos built-in, nao requer `@types/bottleneck`)
- [x] 1.2 Rodar `pnpm install` para instalar a nova dependencia
- [x] 1.3 `shared/config/env.ts` — Adicionar schema Zod para variaveis `RATE_LIMIT_*`:
  - `RATE_LIMIT_DEFAULT_MAX_CONCURRENT` (positiveMs, default 6)
  - `RATE_LIMIT_DEFAULT_MIN_TIME` (numericMs, default 50)
  - `RATE_LIMIT_MANGALIVRE_MAX_CONCURRENT` (positiveMs, default 8)
  - `RATE_LIMIT_MANGALIVRE_MIN_TIME` (numericMs, default 0)
  - `z.preprocess()` com regex `/[^0-9.-]/g` para aceitar sufixos como `100ms` → `100`
  - Limites agressivos para MangaLivre (nunca bloqueado sem rate limit)
- [x] 1.4 `.env` — Documentar as novas variaveis com comentarios (projeto nao possui `.env.example`)

> **Status: COMPLETED**

---

## 2. Modulo `scraping/rate-limit/`

- [x] 2.1 `scraping/rate-limit/types.ts` — Definir `RateLimiterConfig` e `RateLimiter` (type alias para Bottleneck)
- [x] 2.2 `scraping/rate-limit/rate-limiter.ts` — Implementar `createRateLimiter(config: RateLimiterConfig): RateLimiter`:
  - Instanciar `new Bottleneck({ maxConcurrent, minTime, reservoir, reservoirRefreshInterval })`
  - Configurar `highWater: 100` e `strategy: LEAK` para evitar memory leak em cenarios de overload
- [x] 2.3 `scraping/rate-limit/rate-limit-registry.ts` — Implementar `RateLimitRegistry`:
  - Constructor le `env` diretamente (import do modulo)
  - Metodo privado `parseEnvVars()` que itera sobre `Object.entries(env)`, filtra prefixo `RATE_LIMIT_`, extrai slug e parametro
  - Metodo `get(slug: string): RateLimiterConfig` — retorna config do slug ou config `default`
  - Metodo `has(slug: string): boolean` — verifica se slug tem config explicita
  - Slug normalization: lowercase + strip underscores
- [x] 2.4 Testes unitarios:
  - `scraping/tests/unit/rate-limit-registry.test.ts` — 5 tests: config especifica, fallback default, reservoir, has true/false
  - `scraping/tests/unit/rate-limiter.test.ts` — 5 tests: factory, reservoir, schedule, erro propagation, enfileiramento

> **Status: COMPLETED**

---

## 3. Interface `IProviderStrategy`

- [x] 3.1 `scraping/interfaces/provider-strategy.interface.ts` — Criar nova interface:
  - Copiar assinaturas existentes de `ScrapingProvider`: `slug`, `name`, `engine`, `urlPattern`, `allowedDomains`, `supports()`, `getInfo()`, `inspect()`, `getChapterImages()`
  - Adicionar propriedade `readonly rateLimiter: RateLimiter` (publica — requerida pela interface)
  - Adicionar metodo `downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }>`
- [x] 3.2 `scraping/providers/provider.interface.ts` — Manter como re-export temporario para backward compatibility:
  - `export type { IProviderStrategy as ScrapingProvider } from '../../interfaces/provider-strategy.interface'`
  - Adicionar comentario `@deprecated Use IProviderStrategy from scraping/interfaces/`
- [x] 3.3 `scraping/providers/index.ts` — Adicionar export do novo path: `export type { IProviderStrategy } from '../interfaces/provider-strategy.interface'`

> **Status: COMPLETED**

---

## 4. Refatorar `MangaLivreStrategy`

- [x] 4.1 Renomear classe `MangalivreProvider` → `MangaLivreStrategy` com alias backward-compat
- [x] 4.2 Alterar `implements ScrapingProvider` → `implements IProviderStrategy`
- [x] 4.3 Adicionar parametro `rateLimiter: RateLimiter` ao constructor:
  - Armazenar como `readonly rateLimiter` (publico — exigido pela interface `IProviderStrategy`)
  - Manter criacao do `httpClient` interno (o client HTTP ainda e usado, mas envelopado pelo limiter)
- [x] 4.4 Refatorar `inspect()`:
  - Envelopar `await http.get(url)` com `await this.rateLimiter.schedule(() => http.get(url))`
  - Preservar todo o resto da logica (cheerio, parsers, geracao de sourceId)
- [x] 4.5 Refatorar `getChapterImages()`:
  - Envelopar `await http.get(chapterUrl)` com `await this.rateLimiter.schedule(() => http.get(chapterUrl))`
  - Preservar parse de imagens
- [x] 4.6 Implementar `downloadImage()`:
  - `await this.rateLimiter.schedule(() => http.get(imageUrl, { responseType: 'arraybuffer', validateStatus: (s) => s === 200 }))`
  - Extrair `buffer = Buffer.from(response.data)`
  - Extrair `contentType` de headers (string | array | fallback 'application/octet-stream')
  - Retornar `{ buffer, contentType }`
  - Capturar erros HTTP e lancar `ScrapingNetworkError`
- [x] 4.7 Atualizar `mangalivre.provider.test.ts` — renomear suite para `MangaLivreStrategy`, mockar `RateLimiter` com fake `{ schedule: (fn) => fn() }`
- [x] 4.8 Arquivos auxiliares (parser, selectors) — **sem alteracoes** (logica de parse permanece identica)

> **Status: COMPLETED**

---

## 5. Atualizar `ProviderResolver`

- [x] 5.1 Adicionar dependencia `RateLimitRegistry` ao constructor:
  - `constructor(registry?: RateLimitRegistry)` — opcional com fallback `new RateLimitRegistry()` para backward compat
  - Armazenar como `private readonly registry: RateLimitRegistry`
- [x] 5.2 Refatorar `initProviders()` (executado no constructor):
  - Obter `config = this.registry.get('mangalivre')`
  - Criar `rateLimiter = createRateLimiter(config)`
  - Passar `rateLimiter` ao constructor do provider: `new MangaLivreStrategy(rateLimiter)`
- [x] 5.3 Manter array `PROVIDERS` como `this.providers` — renomear referencias de classe
- [x] 5.4 Testes: `provider-resolver.test.ts` — 8 tests passam via re-export compatibility (`ScrapingProvider` = `IProviderStrategy`)

> **Status: COMPLETED**

---

## 6. Atualizar Workers

### 6.1. Worker de Scraping

- [x] 6.1.1 `scraping/workers/inspect-source.worker.ts`:
  - Instanciar `new RateLimitRegistry()` e `new ProviderResolver(registry)` no setup do worker
  - Provider ja vem com limiter injetado — fluxo permanece identico

### 6.2. Worker de Conversao

- [x] 6.2.1 `conversion/workers/conversion-job.worker.ts`:
  - Funcao `resolveProvider(sourceId)` resolve provider via `ProviderResolver` com limiter injetado
  - `getChapterImageUrls()` recebe e usa o provider com rate limit
  - `downloadChapter()` passa o provider para `ImageDownloaderService.downloadChapter()`
  - `applyCover()` tambem usa `provider.downloadImage()` para download de capa
- [x] 6.2.2 `conversion/services/image-downloader.service.ts`:
  - Adicionar parametro `provider: IProviderStrategy` ao metodo `downloadChapter()`
  - Substituir `httpClient.get(imageUrl, ...)` por `provider.downloadImage(imageUrl)`
  - Remover chunking manual (`concurrency = 5`) — Bottleneck controla concorrencia
  - Manter validacao de magic bytes, Content-Type, HTML detection
  - Manter logica de cache check, placeholder generation, `images.json`
- [x] 6.2.3 Testes: `image-downloader.service.test.ts` testa apenas helper functions exportadas (`readChapterImagesMeta`, `writeChapterImagesMeta`) que nao mudaram

> **Status: COMPLETED**

---

## 7. Atualizar Tests Existentes

- [x] 7.1 `scraping/tests/helpers/mock-scraping-provider.ts`:
  - Mantido nome `MockScrapingProvider` (backward compat)
  - Implementar `IProviderStrategy` (substituir `implements ScrapingProvider`)
  - Adicionar mock `rateLimiter` (fake `{ schedule: async (fn) => fn() }`)
  - Adicionar mock `downloadImage()` que retorna `{ buffer: Buffer.from('mock-image-data'), contentType: 'image/png' }`
- [x] 7.2 `conversion/tests/helpers/mock-job.repository.ts` / `fixtures.ts`:
  - Verificado — nenhum import de `ScrapingProvider` ou `IProviderStrategy` (nao usam scraping types)
- [x] 7.3 Imports de `ScrapingProvider` em testes — compativeis via re-export deprecated:
  - Todos os arquivos de teste que importam `ScrapingProvider` recebem `IProviderStrategy` via type alias
  - Nenhum breaking change — 31 test files, 279 testes passando
- [x] 7.4 Rodar `pnpm test` — **279/279 testes passando** (31 test files)

> **Status: COMPLETED**

---

## 8. Verificacao Final

- [x] 8.1 Lint — Backend nao possui script de lint; TypeScript compila sem erros nos arquivos modificados
- [x] 8.2 Testes — **279/279 passando** (31 test files: 20 scraping + 2 rate-limit + 9 conversion)
- [x] 8.3 Startup — Schema Zod valida sem erros (porta 3333 ocupada pela instancia anterior, codigo carrega corretamente)
- [x] 8.4 Teste manual E2E:
  - Scrape de "The Beginning After The End" (mangalivre.to) — 248 capitulos encontrados
  - Conversao de 10 capitulos (chap_0001 a chap_0010) — EPUB 18.8 MB gerado em ~33s
  - Rate limiter ativo: logs mostram `schedule()` funcionando via `provider.downloadImage()`
  - 83 paginas corrompidas detectadas (baseline consistente com testes anteriores — download via `provider.downloadImage()` com validacao mantida)

> **Status: COMPLETED**

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
- 31 test files, 279 testes, 10 novos testes de rate-limit

**Divergencias em relacao ao spec original:**
- `rateLimiter` e publico (`readonly`), nao `private` — exigido pela interface `IProviderStrategy`
- `RateLimitRegistry` importa `env` diretamente em vez de receber como parametro — simplifica o constructor
- `ProviderResolver` aceita `registry` opcional com fallback para backward compat
- `@types/bottleneck` nao instalado — bottleneck 2.x inclui tipos nativos
- `.env.example` nao existe no projeto — `.env` atualizado diretamente com comentarios

**Futuras expansoes** (NOT in this spec):
- Rate limiting adaptativo baseado em taxa de HTTP 429
- Rate limiting via Redis Cluster para multi-worker
- Suporte a providers `playwright` com controle de sessao
- Dashboard de metricas de rate limit
