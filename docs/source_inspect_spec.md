# Source Inspect — Especificação Técnica Unificada

> Documento consolidado que mescla o plano original com a arquitetura assíncrona melhorada.
> O scraping de referência atual está em [`mangalivre.js`](file:///c:/Users/devca/OneDrive/Documentos/developer/mangaink-agent/mangalivre.js).

---

## 1. Visão Geral do Fluxo

A inspeção de fontes é **assíncrona**. O endpoint `POST /inspect` apenas dispara o processamento e retorna imediatamente. O progresso é acompanhado via **SSE** e o resultado final é obtido via `GET`.

```text
Frontend
    │
    │  POST /api/conversions/source/inspect
    ▼
Backend
    │
    ├── Valida e normaliza URL
    ├── Resolve o provider pela URL (ProviderResolver)
    ├── Gera sourceId (determinístico)
    ├── Procura metadata.json no storage
    │
    ├── Cache válido?
    │       │
    │       ├── Sim → Atualiza lastAccessAt / updatedAt
    │       │         Retorna { sourceId, status: "ready" }
    │       │
    │       └── Não (expirado, inexistente ou refresh=true)
    │             │
    │             ├── Tenta adquirir lock Redis
    │             │       │
    │             │       ├── Lock adquirido → Cria Job BullMQ
    │             │       └── Lock não adquirido (outro worker já executando)
    │             │
    │             └── Retorna { sourceId, status: "processing" }
    │
    ▼
Frontend
    │
    ├── status === "ready"  → GET /inspect/:sourceId (busca resultado)
    │
    └── status === "processing" → Conecta SSE /inspect/:sourceId/events
                                    │
                                    ├── event: progress  (acompanha etapas)
                                    ├── event: completed → GET /inspect/:sourceId
                                    └── event: failed    → Exibe erro
```

---

## 2. Endpoints

### 2.1. POST /api/conversions/source/inspect

Dispara a inspeção de uma obra. Retorna imediatamente com o `sourceId` e o status atual.

**Query params opcionais:**

| Param     | Tipo    | Descrição                                    |
|-----------|---------|----------------------------------------------|
| `refresh` | boolean | Se `true`, ignora o cache e força novo scraping |

**Request:**

```json
{
  "url": "https://mangalivre.to/manga/hunter-x-hunter"
}
```

**Resposta — cache válido (200):**

```json
{
  "sourceId": "src-hunter-x-hunter-a34f19c2",
  "status": "ready"
}
```

**Resposta — scraping iniciado/em andamento (202):**

```json
{
  "sourceId": "src-hunter-x-hunter-a34f19c2",
  "status": "processing"
}
```

---

### 2.2. GET /api/conversions/source/inspect/:sourceId/events

Endpoint **SSE** (Server-Sent Events) para acompanhar o progresso do scraping em tempo real.

**Content-Type:** `text/event-stream`

**Eventos de progresso:**

```text
event: progress
data: { "stage": "metadata", "message": "Obtendo informações da obra" }

event: progress
data: { "stage": "chapters", "message": "Obtendo capítulos" }

event: progress
data: { "stage": "covers", "message": "Obtendo capas" }
```

**Evento de conclusão:**

```text
event: completed
data: { "sourceId": "src-hunter-x-hunter-a34f19c2" }
```

**Evento de falha:**

```text
event: failed
data: { "message": "Provider indisponível" }
```

> Múltiplos clientes podem acompanhar o mesmo `sourceId` simultaneamente.

---

### 2.3. GET /api/conversions/source/inspect/:sourceId

Retorna os metadados completos de uma obra já inspecionada.

**Response (200):**

```json
{
  "sourceId": "src-hunter-x-hunter-a34f19c2",
  "status": "ready",
  "provider": {
    "slug": "mangalivre",
    "name": "Manga Livre",
    "engine": "cheerio"
  },
  "source": {
    "url": "https://mangalivre.to/manga/hunter-x-hunter/",
    "language": null
  },
  "metadata": {
    "title": "Hunter x Hunter",
    "author": "Yoshihiro Togashi",
    "description": "...",
    "status": "ongoing",
    "genres": ["Ação", "Shounen"]
  },
  "chapters": [
    {
      "id": "chap_0001",
      "number": "1",
      "title": "Capítulo 1",
      "url": "https://mangalivre.to/manga/hunter-x-hunter/capitulo-1/",
      "pages": 24,
      "volume": 1
    }
  ],
  "covers": [
    {
      "id": "cover_001",
      "type": "original",
      "label": "Original",
      "imageUrl": "https://..."
    }
  ],
  "statistics": {
    "chapters": 410,
    "covers": 1
  }
}
```

> O objeto `cache` presente no `metadata.json` **nunca** é exposto na resposta da API.

---

## 3. Tipos TypeScript

### 3.1. Tipos de domínio

```ts
// --- Provider ---

export type ProviderEngine = "api" | "cheerio" | "playwright";

export interface ProviderInfo {
  slug: string;
  name: string;
  engine: ProviderEngine;
}

// --- Source ---

export interface SourceInfo {
  url: string;
  language: string | null;
}

// --- Metadata ---

export interface MangaMetadata {
  title: string;
  author: string | null;
  description: string | null;
  status: string | null;
  genres: string[];
}

// --- Chapters ---

export interface Chapter {
  id: string;
  number: string;
  title: string;
  url: string;
  pages: number | null;
  volume: number | null;
}

// --- Covers ---

export type CoverType = "original" | "gallery" | "upload";

export interface Cover {
  id: string;
  type: CoverType;
  label: string;
  imageUrl: string;
}

// --- Statistics ---

export interface Statistics {
  chapters: number;
  covers: number;
}

// --- Resposta completa do GET /inspect/:sourceId ---

export interface SourceInspectResponse {
  sourceId: string;
  status: "ready";
  provider: ProviderInfo;
  source: SourceInfo;
  metadata: MangaMetadata;
  chapters: Chapter[];
  covers: Cover[];
  statistics: Statistics;
}
```

### 3.2. Tipos do fluxo assíncrono

```ts
// --- Estado retornado pelo POST /inspect ---

export type SourceInspectStatus = "processing" | "ready" | "failed";

export interface SourceInspectState {
  sourceId: string;
  status: SourceInspectStatus;
}

// --- Payload do Job BullMQ ---

export interface SourceInspectJob {
  sourceId: string;
  provider: string;
  url: string;
  refresh: boolean;
}
```

### 3.3. Tipos de cache (internos)

```ts
// --- Apenas para metadata.json, nunca exposto na API ---

export interface MetadataCache {
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
  lastAccessAt: string; // ISO 8601
  cacheTtlHours: number;
  retentionDays: number | null;
}

export interface SourceMetadataFile extends SourceInspectResponse {
  cache: MetadataCache;
}
```

---

## 4. Geração do sourceId

O `sourceId` deve ser **determinístico** — a mesma obra sempre gera o mesmo ID.

```ts
sourceId = "src-" + slug + "-" + sha256(provider + canonicalUrl).substring(0, 8);
```

**Exemplo:**

```
src-hunter-x-hunter-a34f19c2
```

### 4.1. Normalização de URL (pré-hash)

Antes de gerar o hash, a URL deve ser **normalizada (canonicalizada)**:

1. Remover parâmetros de rastreamento (`utm_*`, `fbclid`, `gclid`, etc.)
2. Remover fragmentos (`#...`)
3. Garantir barra final (`/`)

As URLs abaixo devem gerar **exatamente o mesmo** `sourceId`:

```
https://mangalivre.to/manga/hunter-x-hunter
https://mangalivre.to/manga/hunter-x-hunter/
https://mangalivre.to/manga/hunter-x-hunter?utm=test
https://mangalivre.to/manga/hunter-x-hunter/?fbclid=abc123#section
```

### 4.2. Geração de IDs de capítulos

A função `createChapterId()` deve suportar capítulos decimais preservando a ordenação:

| Capítulo | ID gerado          |
|----------|--------------------|
| `1`      | `chap_0001`        |
| `10`     | `chap_0010`        |
| `10.1`   | `chap_0010_1`      |
| `10.5`   | `chap_0010_5`      |
| `10.10`  | `chap_0010_10`     |

> Nunca criar duas pastas/registros para a mesma obra. Sempre reutilizar pela correspondência do `sourceId`.

---

## 5. Storage (Filesystem)

Após uma inspeção bem-sucedida, a seguinte estrutura deve existir:

```
storage/
└── sources/
    └── src-hunter-x-hunter-a34f19c2/
        ├── metadata.json
        ├── covers/       ← criada vazia
        └── chapters/     ← criada vazia
```

### 5.1. metadata.json

Contém a mesma estrutura da resposta da API **mais** o objeto `cache` (uso interno):

```json
{
  "sourceId": "src-hunter-x-hunter-a34f19c2",
  "status": "ready",
  "provider": { "slug": "mangalivre", "name": "Manga Livre", "engine": "cheerio" },
  "source": { "url": "https://mangalivre.to/manga/hunter-x-hunter/", "language": null },
  "metadata": { "title": "Hunter x Hunter", "author": "Yoshihiro Togashi", "..." : "..." },
  "chapters": [ "..." ],
  "covers": [ "..." ],
  "statistics": { "chapters": 410, "covers": 1 },
  "cache": {
    "createdAt": "2026-07-08T15:10:00Z",
    "updatedAt": "2026-07-08T15:10:00Z",
    "lastAccessAt": "2026-07-08T15:10:00Z",
    "cacheTtlHours": 24,
    "retentionDays": 30
  }
}
```

### 5.2. Regras

- A escrita do `metadata.json` deve **substituir completamente** o arquivo anterior (overwrite total).
- O Worker do BullMQ é responsável por criar a estrutura de diretórios e o `metadata.json`.
- As pastas `covers/` e `chapters/` são criadas vazias (serão populadas em etapas futuras).

---

## 6. Regras de Cache

**Valores padrão:**

| Parâmetro       | Valor |
|-----------------|-------|
| `cacheTtlHours` | `24`  |
| `retentionDays` | `30`  |

**Comportamento ao receber uma requisição:**

| Cenário                                       | Ação                                                                 |
|-----------------------------------------------|----------------------------------------------------------------------|
| `metadata.json` existe e cache **válido**     | Atualiza `updatedAt` e `lastAccessAt`. Retorna `status: "ready"`.    |
| `metadata.json` existe mas cache **expirado** | Inicia novo scraping (via BullMQ). Retorna `status: "processing"`.   |
| `metadata.json` **não existe**                | Inicia novo scraping (via BullMQ). Retorna `status: "processing"`.   |
| `?refresh=true`                               | Ignora cache, sempre inicia novo scraping. Retorna `status: "processing"`. |

> **Não implementar** a rotina de limpeza automática de pastas expiradas (`retentionDays`) neste momento.

---

## 7. Redis

### 7.1. Lock distribuído

Antes de criar um Job BullMQ, o backend tenta adquirir um lock no Redis:

**Chave:**

```
lock:source:{sourceId}
```

**Comando:**

```
SET lock:source:src-hunter-x-hunter-a34f19c2 worker-id NX EX 120
```

**Regras:**

- Apenas **um processo** pode executar o scraping da mesma obra ao mesmo tempo.
- Requisições concorrentes para a mesma obra reutilizam o mesmo processamento em andamento.
- O lock expira automaticamente após **120 segundos** para evitar deadlocks.

### 7.2. Pub/Sub (progresso)

O Worker publica eventos de progresso em um canal Redis. O endpoint SSE se inscreve nesse canal e retransmite para os clientes.

**Canal:**

```
source:{sourceId}
```

**Mensagens:**

```json
{ "stage": "metadata", "progress": 30 }
{ "stage": "chapters", "progress": 60 }
{ "stage": "covers", "progress": 90 }
{ "stage": "completed" }
```

Em caso de erro:

```json
{ "stage": "failed", "message": "Provider indisponível" }
```

---

## 8. BullMQ

### 8.1. Fila

```
source-inspect
```

### 8.2. Payload

```ts
export interface SourceInspectJob {
  sourceId: string;
  provider: string;
  url: string;
  refresh: boolean;
}
```

### 8.3. Worker — Responsabilidades

1. Realizar o scraping (delegando ao provider correspondente).
2. Criar a estrutura de diretórios: `storage/sources/{sourceId}/`.
3. Criar o `metadata.json` (substituição completa).
4. Criar as pastas vazias `covers/` e `chapters/`.
5. Publicar progresso via Redis Pub/Sub.
6. Liberar o lock Redis ao finalizar.

### 8.4. Filas futuras (não implementar agora)

Preparar a arquitetura para filas independentes de:
- Download de páginas
- Conversão
- Limpeza

---

## 9. Arquitetura do Módulo de Scraping

O código atual em [`mangalivre.js`](file:///c:/Users/devca/OneDrive/Documentos/developer/mangaink-agent/mangalivre.js) é um script standalone. Ele deve ser refatorado como um **domínio completo** dentro de `modules/`, seguindo exatamente o mesmo padrão arquitetural usado nos módulos `auth` e `user` (controller → dto → use-case → repository → service).

### 9.1. Estrutura completa do módulo `scraping/`

```text
src/modules/scraping/
├── scraping.routes.ts
│
├── controllers/
│   ├── inspect-source.controller.ts      # POST /inspect
│   ├── preview-source.controller.ts      # GET  /inspect/:sourceId
│   ├── source-events.controller.ts       # GET  /inspect/:sourceId/events (SSE)
│   └── providers.controller.ts           # GET  /providers (listar providers)
│
├── dtos/
│   ├── inspect-source.dto.ts             # Validação Zod do body do POST
│   ├── preview-source.dto.ts             # Validação Zod dos params do GET
│   └── source-response.dto.ts            # Schema de resposta da API
│
├── use-cases/
│   ├── inspect-source.use-case.ts        # Orquestra: cache → lock → job
│   ├── preview-source.use-case.ts        # Lê metadata.json e retorna (sem cache obj)
│   ├── get-source.use-case.ts            # Busca source existente
│   └── refresh-source.use-case.ts        # Força re-scraping
│
├── providers/
│   ├── provider.interface.ts             # Interface base (contrato)
│   ├── provider-resolver.ts              # Descobre provider pela URL
│   │
│   ├── mangalivre/
│   │   ├── mangalivre.provider.ts        # Implementação do ScrapingProvider
│   │   ├── mangalivre.parser.ts          # Lógica de parsing do HTML
│   │   └── mangalivre.selectors.ts       # Seletores CSS centralizados
│   │
│   ├── mangadex/                         # (futuro — mesma estrutura)
│   │   ├── mangadex.provider.ts
│   │   ├── mangadex.parser.ts
│   │   └── mangadex.selectors.ts
│   │
│   └── index.ts                          # Registry de providers
│
├── repositories/
│   ├── source-cache.repository.ts        # Interface/Porta (contrato)
│   └── filesystem-source.repository.ts   # Adaptador concreto (filesystem)
│
├── services/
│   ├── source-storage.service.ts         # Criação de diretórios da source
│   ├── cache.service.ts                  # Lógica de validação/atualização de cache
│   ├── redis-lock.service.ts             # Lock distribuído (SET NX EX)
│   ├── redis-pubsub.service.ts           # Pub/Sub de progresso
│   ├── inspect-queue.service.ts          # Enfileiramento de jobs BullMQ
│   └── source-events.service.ts          # Bridge Pub/Sub → SSE
│
├── workers/
│   └── inspect-source.worker.ts          # Consumer BullMQ (executa o scraping)
│
├── types/
│   ├── provider.types.ts                 # ProviderEngine, ProviderInfo
│   ├── source.types.ts                   # Chapter, Cover, Statistics, etc.
│   └── metadata.types.ts                 # MetadataCache, SourceMetadataFile
│
├── errors/
│   └── scraping.errors.ts                # Exceções do domínio
│
└── tests/
    ├── unit/                             # Testes unitários (parsers, services)
    ├── integration/                      # Testes de fluxo (POST → Job → metadata)
    └── helpers/                          # Mocks, fixtures HTML, factories
```

### 9.2. Novos recursos em `shared/`

Utilitários e infraestrutura que **não pertencem a um único módulo** foram movidos para `shared/`:

```text
src/shared/
├── server.ts                             # (existente)
├── config/
│   └── env.ts                            # (existente)
├── database/
│   └── prisma.ts                         # (existente)
├── middlewares/
│   └── verify-jwt.ts                     # (existente)
│
├── http/                                 # ← NOVO
│   └── http-client.ts                    # Axios centralizado (retry, rate limit, interceptors)
│
├── utils/                                # ← NOVO
│   ├── url-normalizer.ts                 # Normalização de URLs (tracking params, trailing slash)
│   ├── id-generator.ts                   # sourceId, chapterId, coverId, jobId, etc.
│   ├── hash.ts                           # Wrapper SHA-256
│   └── filesystem.ts                     # Helpers de I/O (mkdirp, writeJson, readJson)
│
├── redis/                                # ← NOVO
│   ├── redis.ts                          # Cliente Redis (conexão, configuração)
│   └── bullmq.ts                         # Configuração base de filas BullMQ
│
└── logger/                               # ← NOVO
    └── logger.ts                         # Logger estruturado
```

### 9.3. Justificativa das decisões

| Decisão | Motivo |
|---------|--------|
| `http-client.ts` → `shared/http/` | Será usado por scraping, download de imagens, upload e futuras integrações |
| `url-normalizer.ts` → `shared/utils/` | Normalização de URL é genérica, não pertence ao domínio de scraping |
| `id-generator.ts` → `shared/utils/` | Gera `sourceId`, `jobId`, `uploadId`, `coverId` — serve múltiplos módulos |
| Providers em **subpastas** (`mangalivre/`) | Separa `.provider.ts`, `.parser.ts` e `.selectors.ts`. Quando o HTML do site mudar, altera-se apenas os seletores |
| Redis separado em `lock` + `pubsub` | Responsabilidade única. Lock cuida de exclusão mútua, PubSub cuida de eventos |
| `SourceCacheRepository` com interface | Permite trocar o adaptador (filesystem → S3 → banco) sem alterar use-cases |
| Workers **dentro do módulo** | Para o tamanho atual do projeto, mantê-los no módulo é mais simples. Serão extraídos se surgir necessidade |

### 9.4. Interface base do Provider

```ts
export interface ScrapingProvider {
  readonly slug: string;
  readonly name: string;
  readonly engine: ProviderEngine;
  readonly urlPattern: RegExp;
  readonly allowedDomains: string[];

  supports(url: string): boolean;
  inspect(url: string): Promise<SourceInspectResponse>;
}
```

### 9.5. Repository — Interface do Source Cache

```ts
export interface SourceCacheRepository {
  exists(sourceId: string): Promise<boolean>;
  load(sourceId: string): Promise<SourceMetadataFile | null>;
  save(sourceId: string, data: SourceMetadataFile): Promise<void>;
  update(sourceId: string, patch: Partial<MetadataCache>): Promise<void>;
  delete(sourceId: string): Promise<void>;
}
```

A implementação concreta (`FilesystemSourceRepository`) lê e escreve em `storage/sources/{sourceId}/metadata.json`. No futuro, se necessário migrar para S3 ou banco de dados, basta criar outro adaptador implementando a mesma interface.

### 9.6. Fluxo de responsabilidades

```text
controller         → Valida input (Zod), delega ao use-case
    ↓
use-case           → Orquestra: cache.service → lock → queue → repository
    ↓
provider           → Apenas extrai dados (scraping puro, sem side effects)
    ↓
repository         → Persiste/recupera metadata.json (filesystem ou outro)
    ↓
service            → Infraestrutura (cache TTL, lock Redis, Pub/Sub, fila BullMQ)
```

### 9.7. Princípios

- Cada provider é uma **classe independente** implementando `ScrapingProvider`.
- O `ProviderResolver` descobre automaticamente o provider correto pela URL.
- Providers são responsáveis **apenas por extrair dados** — sem regras de negócio, cache ou I/O.
- Todos os providers retornam o mesmo DTO padronizado.
- Adicionar um novo provider não exige alterações no fluxo principal.
- Seletores CSS ficam isolados em `.selectors.ts`, facilitando manutenção quando o HTML do site mudar.

### 9.8. Cliente HTTP centralizado (`shared/http/http-client.ts`)

- Centralizar configuração do Axios com factory configurável por provider.
- Implementar **retry automático** para erros temporários (5xx, timeout, network errors).
- Configurar tratamento para **HTTP 429** (Rate Limit) com backoff personalizado por provider.
- Centralizar timeout, headers padrão e interceptors.
- Implementar controle de taxa por provider (limitar requisições simultâneas ao mesmo domínio).

### 9.9. Melhorias na extração de dados

| Área          | Melhorias                                                                 |
|---------------|---------------------------------------------------------------------------|
| **Título**    | Detecção mais robusta, fallback para `<title>` e `og:title`              |
| **Autor**     | Buscar em múltiplos seletores, normalizar formatação                     |
| **Descrição** | Limpar HTML residual, truncar se necessário                              |
| **Status**    | Mapear variações de texto para enum (`ongoing`, `completed`, `hiatus`)   |
| **Gêneros**   | Seletores mais resilientes, menos dependentes da estrutura atual do site |
| **Capa**      | Fallback entre `src`, `data-src`, `data-lazy-src`, `og:image`           |
| **Seletores** | Isolados em `.selectors.ts`, menos acoplados à estrutura HTML atual      |

### 9.10. Melhorias em capítulos

- Ordenação correta com números decimais (`10.1`, `10.5`, `10.10`).
- Deduplicação usando `Set` ou `Map`.
- Retornar `pages` e `volume` como `null` quando indisponíveis.
- Padronizar títulos automaticamente quando ausentes (baseado no slug da URL).

---

## 10. Segurança

- **Validação rigorosa** das URLs recebidas.
- Aceitar apenas providers **cadastrados**.
- Impedir **SSRF** aceitando apenas domínios autorizados.
- **Sanitizar** todos os dados extraídos antes de persistir.

---

## 11. Tratamento de Erros

- Padronizar erros retornados pelos providers (tipo de erro + mensagem descritiva).
- Diferenciar erros de **rede**, **timeout** e **parsing**.
- Implementar **logs estruturados** para falhas.

---

## 12. Logging e Observabilidade

### 12.1. Logging

Registrar para cada scraping:
- Início e fim da execução
- Tempo total de execução
- Provider utilizado
- Cache hit vs. cache miss
- Falhas e exceções

### 12.2. Observabilidade (preparar para o futuro)

Métricas a expor futuramente (Prometheus/OpenTelemetry):
- Tempo médio de scraping
- Taxa de acerto do cache
- Quantidade de requisições por provider
- Taxa de falhas

---

## 13. Testes

| Tipo              | Escopo                                                  |
|-------------------|---------------------------------------------------------|
| **Unitários**     | Normalização de URL                                     |
| **Unitários**     | Geração de IDs (`sourceId`, `chapterId`)                |
| **Unitários**     | Funções utilitárias (`sanitizeFileName`, `absoluteUrl`)  |
| **Unitários**     | Parsers de cada provider (com HTML mockado)             |
| **Integração**    | Fluxo completo do endpoint POST → Job → metadata.json  |
| **Integração**    | Fluxo de cache (hit, miss, refresh)                     |

---

## 14. Resumo das Regras Fundamentais

> [!IMPORTANT]
> - O `sourceId` é **sempre determinístico** — mesma obra = mesmo ID.
> - **Nunca** criar duas pastas para a mesma obra.
> - **Sempre** reutilizar uma pasta existente.
> - A escrita do `metadata.json` é **substituição completa** (overwrite).
> - O objeto `cache` do `metadata.json` **nunca** é exposto na API.
> - **Apenas um scraping** é executado para a mesma obra, mesmo com múltiplos usuários simultâneos (garantido pelo lock Redis).
> - O frontend recebe feedback em **tempo real** via SSE.
> - O BullMQ **desacopla** o scraping da requisição HTTP.
> - O `metadata.json` é a **fonte de verdade** para os passos seguintes do fluxo de conversão.
