# Schema do Banco de Dados — MangaInk Agent

Documentação didática do schema Prisma. Atualizada sempre que o banco mudar.

> **Conexão**: PostgreSQL via `@prisma/adapter-pg`. DDL em `apps/backend/prisma/schema.prisma`.
> **Migrations**: `apps/backend/prisma/migrations/`.

---

## Diagrama de Relações

```
┌──────────┐
│   User   │ dono da conta, autenticação JWT
└────┬─────┘
     │ 1
     │
     │ N
┌────┴───────────┐  "Conversões que o usuário pediu"
│  Conversion     │  ───────────────────────────────
│                 │
│ source_id (soft)│── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│                 │                                │
│ books, output,  │                                │
│ options (JSONB) │                                │
└────┬────────────┘                                │
     │ 1                                           │
     │                                             │
     │ N                                           │
┌────┴───────────────┐                              │
│  ConversionJob     │ "Cada EPUB sendo gerado"    │
│                    │                              │
│ chapters, cover,   │                              │
│ options (JSONB)    │                              │
│                    │                              │
│ status: downloading │                             │
│ → converting       │                              │
│ → packaging        │                              │
│ → completed        │                              │
└────────────────────┘                              │
                                                    │
┌──────────────────────┐                            │
│       Source          │◄──────────────────────────┘
│                      │   "Obra catalogada do site"
│  source_id (UNIQUE)  │
│  metadata (JSONB)    │── título, autor, descrição, gêneros
│  statistics (JSONB)  │── total de capítulos e capas
│  provider_slug       │── de qual site veio (ex: mangalivre)
│  ttl_expires_at      │── cache expira em 30 dias
└──┬────────┬──────────┘
   │ 1      │ 1
   │        │
   │ N      │ N
┌──┴──────┐ ┌┴─────────┐
│ Chapter │ │  Cover    │
│         │ │           │
│ number  │ │ type      │ (original|gallery|upload)
│ title   │ │ label     │
│ url     │ │ image_url │
│ pages   │ │           │
└─────────┘ └───────────┘
```

---

## Modelos

### `users` (User)

Conta do usuário. Já existia antes dessa change — apenas ganhou a relação `conversions`.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador interno |
| `username` | VARCHAR(50) UNIQUE | Nome de usuário |
| `email` | VARCHAR(255) UNIQUE | Email |
| `password_hash` | VARCHAR | Senha com bcrypt |
| `kindle_email` | VARCHAR(255)? | Email do Kindle para envio |
| `avatar_url` | TEXT? | URL do avatar |
| `is_active` | BOOLEAN | Conta ativa? (default true) |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Última atualização |

**Relações**:
- `conversions` → N `Conversion` (CASCADE: deletar usuário deleta conversões)

---

### `sources` (Source)

Catálogo de obras inspecionadas. Toda vez que alguém cola a URL de um mangá, o sistema faz scraping e salva aqui.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador interno |
| `source_id` | VARCHAR(255) UNIQUE | ID de negócio: `src-{provider}-{slug}-{hash}` |
| `url` | VARCHAR(2048) | URL original do mangá |
| `language` | VARCHAR(10)? | Idioma (ex: `pt`, `en`) |
| `metadata` | JSONB | Título, autor, descrição, status, gêneros |
| `statistics` | JSONB? | `{chapters: 1100, covers: 5}` |
| `status` | VARCHAR(20) | `ready` ou `failed` |
| `provider_slug` | VARCHAR(50) | Slug do provider (ex: `mangalivre`) |
| `provider_name` | VARCHAR(100) | Nome legível do provider |
| `ttl_expires_at` | TIMESTAMPTZ? | Quando o cache expira |
| `cache_ttl_hours` | INT | Horas de validade (default 24) |
| `retention_days` | INT? | Dias até limpeza automática |
| `last_access_at` | TIMESTAMPTZ | Último acesso (hit ou miss) |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Última atualização |

**JSONB — `metadata`**:
```json
{
  "title": "One Piece",
  "author": "Eiichiro Oda",
  "description": "A história de Monkey D. Luffy...",
  "status": "ongoing",
  "genres": ["Ação", "Aventura", "Shounen"]
}
```

**Relações**:
- `chapters` → N `Chapter` (CASCADE)
- `covers` → N `Cover` (CASCADE)

**Índices**: `provider_slug`, `ttl_expires_at`

---

### `chapters` (Chapter)

Cada capítulo descoberto de um Source.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador interno |
| `chapter_id` | VARCHAR(100) UNIQUE | ID de negócio: `chap_0001` |
| `source_id` | VARCHAR(255) (FK → sources.source_id) | Qual obra pertence |
| `number` | VARCHAR(20) | Número (ex: `1`, `10.5`) |
| `title` | VARCHAR(500) | Título do capítulo |
| `url` | VARCHAR(2048) | URL do capítulo no site original |
| `pages` | INT? | Quantas páginas tem |
| `volume` | INT? | Número do volume |
| `placeholder_page_indices` | JSONB? | Páginas corrompidas: `[5, 12]` |
| `created_at` | TIMESTAMPTZ | Data de criação |

**Relação**: N:1 → `Source` (CASCADE: deletar Source deleta capítulos)

**Índice**: `(source_id, number)` — busca rápida de capítulos por obra ordenados

---

### `covers` (Cover)

Capas disponíveis para um Source (original, galeria, upload de fã).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador interno |
| `cover_id` | VARCHAR(100) UNIQUE | ID de negócio: `cover_001` |
| `source_id` | VARCHAR(255) (FK → sources.source_id) | Qual obra pertence |
| `type` | VARCHAR(20) | `original`, `gallery` ou `upload` |
| `label` | VARCHAR(255) | Rótulo (ex: `Volume 1`) |
| `image_url` | VARCHAR(2048) | URL da imagem |
| `created_at` | TIMESTAMPTZ | Data de criação |

**Relação**: N:1 → `Source` (CASCADE)

**Índice**: `source_id`

---

### `conversions` (Conversion)

Conversão pedida pelo usuário. Representa a intenção: "quero converter os capítulos X, Y, Z do mangá W para EPUB no meu Kindle 11".

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador interno |
| `conversion_id` | VARCHAR(100) UNIQUE | ID de negócio: `conv_{ts}_{rand}` |
| `user_id` | UUID (FK → users.id) | Dono da conversão |
| `source_id` | VARCHAR(255) (sem FK) | Referência à obra (soft ref) |
| `cover` | JSONB | Capa escolhida (CoverRef) |
| `output` | JSONB | `{deviceId: "K11", format: "EPUB"}` |
| `metadata` | JSONB | `{title?, author?}` — metadados customizados |
| `books` | JSONB | Array de livros: `[{title, chapters, cover?}]` |
| `options` | JSONB | Opções do KCC (mangaMode, spreadSplitter, etc.) |
| `error_handling_strategy` | VARCHAR(20)? | `ignore`, `skip_chapter` ou `abort` |
| `status` | VARCHAR(20) | `queued`, `processing`, `completed`, `failed`, `cancelled`, `partial` |
| `progress` | INT | 0 a 100 (%) |
| `total_jobs` | INT | Quantos Jobs esta conversão tem |
| `completed_jobs` | INT | Quantos Jobs já terminaram |
| `failed_jobs` | INT | Quantos Jobs falharam |
| `running_jobs` | INT | Quantos Jobs estão rodando |
| `pending_jobs` | INT | Quantos Jobs aguardando |
| `error` | TEXT? | Mensagem de erro se falhou |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Última atualização |
| `completed_at` | TIMESTAMPTZ? | Quando finalizou |
| `finished_at` | TIMESTAMPTZ? | Quando terminou (sucesso ou falha) |

**JSONB — `books`**:
```json
[
  {
    "title": "One Piece Vol 1",
    "chapters": ["chap_0001", "chap_0002", "chap_0003"],
    "cover": { "kind": "gallery", "coverId": "cover_001" }
  },
  {
    "title": "One Piece Vol 2",
    "chapters": ["chap_0004", "chap_0005", "chap_0006"]
  }
]
```

**Por que `source_id` não tem FK?** O cache do Source expira em ~30 dias. Se fosse FK com CASCADE, deletar o cache da obra apagaria seu histórico de conversões. Com soft ref, suas conversões sobrevivem ao cache.

**Relações**:
- N:1 → `User` (CASCADE: deletar usuário deleta conversões)
- 1:N → `ConversionJob` (CASCADE: deletar conversão deleta jobs)

**Índices**: `(user_id, created_at DESC)`, `status`

---

### `conversion_jobs` (ConversionJob)

Um Job é **um arquivo EPUB sendo gerado**. Cada Book da Conversion vira um Job. O Worker baixa imagens → monta ComicInfo.xml → roda KCC → empacota.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador interno |
| `job_id` | VARCHAR(100) UNIQUE | ID de negócio: `job_{ts}_{rand}` |
| `conversion_id` | UUID (FK → conversions.id) | Qual conversão pertence |
| `source_id` | VARCHAR(255) | Referência à obra (denormalizada) |
| `book_index` | INT | Índice do livro (0, 1, 2...) |
| `chapters` | JSONB | Array de chapter IDs: `["chap_0001","chap_0002"]` |
| `cover` | JSONB | Capa deste Job (CoverRef) |
| `output` | JSONB | `{deviceId, format}` |
| `metadata` | JSONB | `{title, author?}` |
| `options` | JSONB | Opções do KCC (inclui batchSplit/fileFusion internos) |
| `error_handling_strategy` | VARCHAR(20)? | `ignore`, `skip_chapter` ou `abort` |
| `status` | VARCHAR(20) | `queued` → `preparing` → `downloading` → `converting` → `packaging` → `completed`/`failed` |
| `progress` | INT | 0 a 100 (%) |
| `current_step` | VARCHAR(50) | Etapa atual legível |
| `downloaded_images` | INT | Quantas imagens já baixadas |
| `total_images` | INT | Total de imagens a baixar |
| `error` | TEXT? | Mensagem de erro |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Última atualização |
| `completed_at` | TIMESTAMPTZ? | Quando finalizou |
| `download_url` | VARCHAR(2048)? | URL para baixar o EPUB final |
| `output_file` | VARCHAR(500)? | Caminho do arquivo gerado |
| `output_size` | BIGINT? | Tamanho em bytes |

**Relação**: N:1 → `Conversion` (CASCADE)

**Índices**: `conversion_id`, `status`

---

## Fluxo Completo da Aplicação no Banco

```
1. INSPEÇÃO (scraping)
   ──────────────────
   Usuário cola URL → Sistema faz scraping → Salva em sources + chapters + covers
                                              │
2. CONVERSÃO (usuário configura)              │
   ─────────────────────────────              │
   Usuário monta books → POST /api/conversions│
   └→ INSERT conversion (status: queued)      │
      └→ INSERT N conversion_jobs             │
                                              │
3. PROCESSAMENTO (worker BullMQ)              │
   ────────────────────────────               │
   Worker pega job → baixa imagens dos chapters (usando URLs do Source)
    → gera ComicInfo.xml → roda KCC via Docker
    → UPDATE job (status: completed, download_url: ...)
    → UPDATE conversion (syncStatus: recalcula progresso)
                                              │
4. DOWNLOAD                                   │
   ────────                                   │
   Usuário baixa o EPUB pelo download_url do Job
```

---

## IDs de Negócio × IDs Internos

Toda tabela tem dois identificadores:

| Tipo | Exemplo | Uso |
|---|---|---|
| **UUID interno** (`id`) | `a1b2c3d4-...` | PK, FKs entre tabelas, cascade |
| **ID de negócio** (`source_id`, `chapter_id`, etc.) | `src-mangalivre-one-piece-a3f1` | Referência externa, APIs, legível |

Os IDs de negócio são gerados deterministicamente pelo `id-generator.ts`:
- `createSourceId(provider, url)` → `src-{slug}-{sha256[:8]}`
- `createChapterId(number)` → `chap_0001`
- `createCoverId(index)` → `cover_001`
- `createConversionId()` → `conv_{timestamp}_{random}`
- `createJobId()` → `job_{timestamp}_{random}`

---

## Convenções

- **Nomes de coluna**: snake_case no banco, mapeados via `@map()` do Prisma
- **Nomes de tabela**: plural em snake_case — `users`, `sources`, `chapters`, `covers`, `conversions`, `conversion_jobs`
- **Timestamps**: sempre `TIMESTAMPTZ` (com timezone)
- **PKs**: UUID via `gen_random_uuid()` do PostgreSQL
- **JSONB**: campos flexíveis (metadata, options, books) — validados em TypeScript na camada de aplicação
- **Soft ref**: `conversions.source_id` e `conversion_jobs.source_id` não têm FK — sobrevivem à expiração do cache
