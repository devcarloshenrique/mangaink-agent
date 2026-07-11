# Scraping Module — Implementation Tasks

> **Status: COMPLETED** (2026-07-08)
> Implementado no commit `8d0304a` — "feat: initialize backend scraping architecture with provider management, queue-based inspection, and cache services"

---

## 1. Shared Utilities

- [x] 1.1 `src/shared/utils/url-normalizer.ts` — `normalizeUrl()`: remove tracking params, fragmentos, garante barra final
- [x] 1.2 `src/shared/utils/hash.ts` — `sha256()` para IDs determinísticos
- [x] 1.3 `src/shared/utils/id-generator.ts` — `createSourceId()`, `createChapterId()`, `createCoverId()`
- [x] 1.4 `src/shared/utils/filesystem.ts` — `mkdirp()`, `writeJson()`, `readJson()`, `pathExists()`
- [x] 1.5 `src/shared/http/http-client.ts` — axios + axios-retry com backoff exponencial
- [x] 1.6 `src/shared/redis/redis.ts` — singleton Redis (ioredis)
- [x] 1.7 `src/shared/redis/bullmq.ts` — factory de filas BullMQ
- [x] 1.8 `src/shared/config/env.ts` — adicionado `REDIS_URL`, `STORAGE_PATH`

> **Status: COMPLETED**

---

## 2. Types

- [x] 2.1 `types/source.types.ts` — `SourceInspectResponse`, `Chapter`, `Cover`, `MangaMetadata`, `SourceInfo`, `SourceInspectState`, `SourceInspectJob`
- [x] 2.2 `types/metadata.types.ts` — `MetadataCache`, `SourceMetadataFile`
- [x] 2.3 `types/provider.types.ts` — `ProviderEngine` ('api' | 'cheerio' | 'playwright'), `ProviderInfo`

> **Status: COMPLETED**

---

## 3. Provider System

- [x] 3.1 `providers/provider.interface.ts` — Interface `ScrapingProvider` com `slug`, `name`, `engine`, `urlPattern`, `allowedDomains`, `supports()`, `getInfo()`, `inspect()`
- [x] 3.2 `providers/provider-resolver.ts` — `ProviderResolver` com `resolve(url)` e `list()`, SSRF protection via allowedDomains
- [x] 3.3 `providers/index.ts` — Re-exports
- [x] 3.4 `providers/mangalivre/mangalivre.selectors.ts` — Seletores CSS centralizados
- [x] 3.5 `providers/mangalivre/mangalivre.parser.ts` — Parsing: `parseMetadata()`, `parseChapters()`, `parseCover()`, `parseSourceInfo()`, `buildProviderInfo()`
- [x] 3.6 `providers/mangalivre/mangalivre.provider.ts` — `MangalivreProvider` com HTTP client configurado

> **Status: COMPLETED**

---

## 4. Repositories

- [x] 4.1 `repositories/source-cache.repository.ts` — Interface `SourceCacheRepository` com `exists()`, `load()`, `save()`, `update()`, `delete()`
- [x] 4.2 `repositories/filesystem-source.repository.ts` — Implementação filesystem em `storage/sources/{sourceId}/metadata.json`

> **Status: COMPLETED**

---

## 5. Services

- [x] 5.1 `services/cache.service.ts` — `isValid()` (TTL de 24h), `touch()` (atualiza timestamps), `createFreshCache()`
- [x] 5.2 `services/redis-lock.service.ts` — Lock distribuído via `SET key value EX 120 NX`, liberação atômica (Lua)
- [x] 5.3 `services/redis-pubsub.service.ts` — Pub/Sub em canais `source:{sourceId}`, subscribe com unsubscribe callback
- [x] 5.4 `services/source-events.service.ts` — Bridge Redis Pub/Sub → SSE: eventos `progress`, `completed`, `failed`
- [x] 5.5 `services/inspect-queue.service.ts` — Wrapper BullMQ para enfileirar jobs de inspeção

> **Status: COMPLETED**

---

## 6. Use Cases

- [x] 6.1 `use-cases/inspect-source.use-case.ts` — `InspectSourceUseCase.execute()`:
  - Normaliza URL → Resolve provider → Gera sourceId → Verifica cache → Lock → Enfileira
- [x] 6.2 `use-cases/get-source.use-case.ts` — `GetSourceUseCase.execute()`: busca metadata.json do cache

> **Status: COMPLETED**

---

## 7. Controllers

- [x] 7.1 `controllers/inspect-source.controller.ts` — POST /inspect, trata InvalidUrlError (400) e ProviderNotFoundError (422)
- [x] 7.2 `controllers/preview-source.controller.ts` — GET /inspect/:sourceId, retorna metadata completo
- [x] 7.3 `controllers/source-events.controller.ts` — GET /inspect/:sourceId/events, SSE streaming
- [x] 7.4 `controllers/providers.controller.ts` — GET /providers, lista providers disponíveis

> **Status: COMPLETED**

---

## 8. DTOs

- [x] 8.1 `dtos/inspect-source.dto.ts` — `InspectSourceBody` (url), `InspectSourceQuery` (refresh)
- [x] 8.2 `dtos/preview-source.dto.ts` — `SourceParams` (sourceId)

> **Status: COMPLETED**

---

## 9. Routes

- [x] 9.1 `scraping.routes.ts` — 4 endpoints com Zod schemas e OpenAPI tags
  - POST `/api/conversions/source/inspect`
  - GET `/api/conversions/source/inspect/:sourceId/events`
  - GET `/api/conversions/source/inspect/:sourceId`
  - GET `/api/conversions/source/providers`

> **Status: COMPLETED**

---

## 10. Worker

- [x] 10.1 `workers/inspect-source.worker.ts` — BullMQ worker:
  - Concurrency: 3
  - 3 tentativas com backoff exponencial
  - Publica eventos de progresso via Redis Pub/Sub
  - Salva metadata.json ao finalizar
  - Libera lock ao completar ou falhar

> **Status: COMPLETED**

---

## 11. Errors

- [x] 11.1 `errors/scraping.errors.ts` — 5 classes de erro:
  - `ScrapingError` (base)
  - `ProviderNotFoundError` (422)
  - `InvalidUrlError` (400)
  - `SourceNotFoundError` (404)
  - `ScrapingNetworkError` (500)
  - `ScrapingParseError` (500)

> **Status: COMPLETED**

---

## 12. Tests

- [x] 12.1 `tests/unit/mangalivre.parser.test.ts` — Testes do parser (Vitest)

> **Status: COMPLETED**

---

## 13. Infrastructure

- [x] 13.1 `docker-compose.yml` — PostgreSQL + Redis
- [x] 13.2 `pnpm-workspace.yaml` — Adicionado backend ao workspace
- [x] 13.3 `apps/backend/package.json` — Dependências: axios, axios-retry, cheerio, ioredis, bullmq
- [x] 13.4 `apps/backend/src/shared/server.ts` — Registro do módulo scraping no servidor

> **Status: COMPLETED**

---

## 14. Documentation

- [x] 14.1 `docs/source_inspect_spec.md` — Especificação técnica completa do fluxo de inspeção (761 linhas)
- [x] 14.2 Swagger/OpenAPI gerado automaticamente dos schemas Zod

> **Status: COMPLETED**

---

## 15. Sample Data

- [x] 15.1 `storage/sources/src-hunter-x-hunter-cb3c9071/metadata.json` — Dados de exemplo Hunter x Hunter
- [x] 15.2 `storage/sources/src-jujutsu-kaisen-modulo-95c0b262/metadata.json` — Dados de exemplo Jujutsu Kaisen

> **Status: COMPLETED**

---

## Archive Note

This spec is **COMPLETE** as of 2026-07-08. The scraping module implements:

- **Provider system** with MangaLivre (Cheerio-based) and extensible interface
- **Async inspection flow** with caching, distributed locks, and BullMQ queue
- **Real-time progress** via Redis Pub/Sub + SSE
- **Deterministic IDs** via SHA-256 for cache consistency
- **SSRF protection** via allowedDomains whitelist
- **Filesystem cache** with TTL (24h) and retention (30d)

**Future enhancements** (NOT in this spec):
- MangaDex provider (API-based)
- Image download for chapters/covers
- Automated cache cleanup job
- Playwright provider for JS-heavy sites
- Integration tests with mocked Redis/BullMQ
- Scraping metrics (duration, error rate, cache hit ratio)