# Scraping Module — Especificação Técnica

> **Status: IMPLEMENTED** (2026-07-08)
> A especificação detalhada do fluxo de inspeção está em `docs/source_inspect_spec.md`.
> Este arquivo é o resumo arquivado do que foi implementado.

---

## 1. Visão Geral

Módulo responsável por extrair metadados de mangás de fontes online (ex: MangaLivre, MangaDex).
O scraping é **assíncrono**: o endpoint `POST /inspect` apenas dispara o processamento e retorna
imediatamente. O progresso é acompanhado via **SSE** (Server-Sent Events) e o resultado final
é obtido via `GET /inspect/:sourceId`.

### Fluxo Principal

```
Frontend                          Backend
   │                                 │
   │  POST /api/conversions/source/inspect
   │────────────────────────────────►│
   │                                 ├── Normaliza URL (remove tracking, fragmentos)
   │                                 ├── Resolve provider (SSRF protection)
   │                                 ├── Gera sourceId determinístico (SHA-256)
   │                                 ├── Verifica cache (metadata.json)
   │                                 │
   │                                 ├── Cache válido?
   │                                 │   ├── Sim → 200 { sourceId, status: "ready" }
   │                                 │   └── Não → Adquire lock Redis
   │                                 │            ├── Lock OK → Enfileira job BullMQ
   │                                 │            └── Lock ocupado → Outro já processando
   │                                 │
   │  ◄────────────────────────────────┤ 202 { sourceId, status: "processing" }
   │                                 │
   │  GET /inspect/:sourceId/events  │
   │════════════════════════════════►│  (SSE — streaming)
   │                                 │
   │  ◄──── event: progress ────────┤
   │  ◄──── event: completed ───────┤
   │                                 │
   │  GET /inspect/:sourceId         │
   │────────────────────────────────►│
   │  ◄── { metadata, chapters, covers, ... }
```

---

## 2. Providers

### Interface `ScrapingProvider`

Cada provider implementa a interface em `providers/provider.interface.ts`:

| Propriedade     | Tipo          | Descrição                              |
|-----------------|---------------|----------------------------------------|
| `slug`          | `string`      | Identificador único (ex: 'mangalivre') |
| `name`          | `string`      | Nome de exibição (ex: 'Manga Livre')   |
| `engine`        | `ProviderEngine` | 'api' \| 'cheerio' \| 'playwright'   |
| `urlPattern`    | `RegExp`      | Padrão de URL que o provider suporta   |
| `allowedDomains`| `string[]`    | Domínios autorizados (SSRF protection) |
| `supports(url)` | `boolean`     | Verifica se suporta a URL              |
| `getInfo()`     | `ProviderInfo`| Informações do provider para API       |
| `inspect(url)`  | `Promise<SourceInspectResponse>` | Executa scraping |

### Provider Resolver

`ProviderResolver` em `providers/provider-resolver.ts`:
- Mantém registro de todos os providers
- `resolve(url)` → encontra o provider que `supports()` a URL
- `list()` → retorna todos os providers cadastrados
- Lança `ProviderNotFoundError` se nenhum provider suportar a URL

### MangaLivre Provider (Implementado)

- **Engine:** `cheerio` (parsing HTML)
- **Domínio:** `mangalivre.to`
- **Parser:** `mangalivre.parser.ts` — extrai título, autor, descrição, status, gêneros, capítulos, capa
- **Selectors:** `mangalivre.selectors.ts` — seletores CSS centralizados
- **HTTP Client:** axios com retry, User-Agent de browser, rate limit conservador (3 tentativas, 2s delay)

---

## 3. Cache

### Estrutura em Disco

```
storage/sources/{sourceId}/
├── metadata.json      ← dados completos + cache metadata
├── covers/            ← imagens de capa (futuro)
└── chapters/          ← páginas dos capítulos (futuro)
```

### Formato do `metadata.json`

```typescript
interface SourceMetadataFile extends SourceInspectResponse {
  cache: MetadataCache
}

interface MetadataCache {
  createdAt: string        // ISO 8601
  updatedAt: string        // ISO 8601
  lastAccessAt: string     // ISO 8601
  cacheTtlHours: number    // 24h (padrão)
  retentionDays: number | null  // 30d (padrão)
}
```

### CacheService

- `isValid(sourceId)` → verifica se TTL expirou
- `touch(sourceId)` → atualiza `updatedAt` e `lastAccessAt` no hit
- `createFreshCache()` → cria objeto MetadataCache para nova inspeção

---

## 4. Infraestrutura Assíncrona

### Redis

- **Lock Distribuído:** `RedisLockService` — `SET key value EX 120 NX` (atomicidade)
  - Liberação atômica via script Lua (só o worker que adquiriu pode liberar)
  - TTL de 120s (job deve completar dentro deste prazo)
- **Pub/Sub:** `RedisPubSubService` — canais `source:{sourceId}` para progresso em tempo real
  - Workers publicam eventos → SSE consome e repassa ao frontend
- Conexão própria ioredis (separada do BullMQ para evitar conflitos)

### BullMQ

- **Fila:** `source-inspect`
- **Worker:** `inspect-source.worker.ts` — `concurrency: 3`
- **Job Options:** 3 tentativas, backoff exponencial (2s), removeOnComplete: 100, removeOnFail: 50
- **Eventos:** `completed` e `failed` com logging

### SSE (Server-Sent Events)

- `SourceEventsService` faz bridge Redis Pub/Sub → cliente HTTP
- Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`
- Eventos: `progress` (stage, message, progress%), `completed` (sourceId), `failed` (message)
- Conexão fechada automaticamente em `completed` ou `failed`

---

## 5. IDs Determinísticos

| Função            | Formato                              | Exemplo                          |
|--------------------|--------------------------------------|----------------------------------|
| `createSourceId()` | `src-{slug}-{sha256[0..7]}`          | `src-hunter-x-hunter-a34f19c2`   |
| `createChapterId()`| `chap_{número padded}_{decimal}`     | `chap_0010`, `chap_0010_5`       |
| `createCoverId()`  | `cover_{index padded}`               | `cover_001`                      |

---

## 6. Normalização de URL

`normalizeUrl()` em `shared/utils/url-normalizer.ts`:
1. Remove parâmetros de rastreamento (`utm_*`, `fbclid`, `gclid`, `ref`, etc.)
2. Remove fragmentos (`#...`)
3. Garante barra final no pathname
4. URLs equivalentes geram exatamente a mesma string canônica
5. Garante que o sourceId seja determinístico

---

## 7. Error Handling

| Erro                     | Código           | HTTP Status | Causa                        |
|--------------------------|------------------|-------------|------------------------------|
| `InvalidUrlError`        | `INVALID_URL`    | 400         | URL malformada ou inválida   |
| `ProviderNotFoundError`  | `PROVIDER_NOT_FOUND` | 422     | Nenhum provider suporta URL  |
| `SourceNotFoundError`    | `SOURCE_NOT_FOUND`  | 404         | SourceId não encontrado      |
| `ScrapingNetworkError`   | `NETWORK_ERROR`  | 500         | Erro de rede no scraping     |
| `ScrapingParseError`     | `PARSE_ERROR`    | 500         | Erro de parsing do HTML      |

---

## 8. Estrutura de Arquivos

```
src/modules/scraping/
├── scraping.routes.ts                    ← 4 endpoints Fastify com Zod
├── controllers/
│   ├── inspect-source.controller.ts      ← POST /inspect
│   ├── preview-source.controller.ts      ← GET /inspect/:sourceId
│   ├── source-events.controller.ts       ← GET /inspect/:sourceId/events (SSE)
│   └── providers.controller.ts           ← GET /providers
├── use-cases/
│   ├── inspect-source.use-case.ts        ← Orquestra fluxo completo
│   └── get-source.use-case.ts            ← Busca resultado do cache
├── services/
│   ├── cache.service.ts                  ← Lógica de cache (TTL, touch)
│   ├── inspect-queue.service.ts          ← Wrapper BullMQ
│   ├── redis-lock.service.ts             ← Lock distribuído
│   ├── redis-pubsub.service.ts           ← Pub/Sub para SSE
│   └── source-events.service.ts          ← Bridge Redis → SSE
├── providers/
│   ├── index.ts                          ← Re-exports
│   ├── provider.interface.ts             ← Interface ScrapingProvider
│   ├── provider-resolver.ts              ← Resolve provider por URL
│   └── mangalivre/
│       ├── mangalivre.provider.ts        ← Implementação MangaLivre
│       ├── mangalivre.parser.ts          ← Parsing HTML (cheerio)
│       └── mangalivre.selectors.ts       ← Seletores CSS
├── repositories/
│   ├── source-cache.repository.ts        ← Interface
│   └── filesystem-source.repository.ts   ← Implementação filesystem
├── workers/
│   └── inspect-source.worker.ts          ← BullMQ worker
├── types/
│   ├── source.types.ts                   ← SourceInspectResponse, Chapter, Cover
│   ├── metadata.types.ts                 ← MetadataCache, SourceMetadataFile
│   └── provider.types.ts                 ← ProviderEngine, ProviderInfo
├── errors/
│   └── scraping.errors.ts                ← 5 classes de erro
├── dtos/
│   ├── inspect-source.dto.ts             ← Zod schemas para POST
│   └── preview-source.dto.ts             ← Zod schemas para GET
└── tests/
    └── unit/
        └── mangalivre.parser.test.ts     ← Testes do parser
```