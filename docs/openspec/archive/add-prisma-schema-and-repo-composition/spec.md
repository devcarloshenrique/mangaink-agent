# add-prisma-schema-and-repo-composition — Especificação

## ADDED Requirements

### Requirement: Modelo relacional para metadados de scraping
The system MUST store scraping metadata (Source, Chapter, Cover) in PostgreSQL with normalized relations and indexes that enable efficient listing and chapter lookup.

#### Scenario: Tabelas criadas pela migration
- **WHEN** a migration `add_sources_conversions_jobs` é aplicada
- **THEN** são criadas as tabelas `sources`, `chapters`, `covers`, `conversions`, `conversion_jobs`
- **THEN** `sources.source_id` tem constraint `UNIQUE`
- **THEN** `chapters.chapter_id` e `covers.cover_id` têm `UNIQUE`
- **THEN** `conversions.conversion_id` e `conversion_jobs.job_id` têm `UNIQUE`
- **THEN** `conversions.user_id` referencia `users(id)` com `ON DELETE CASCADE`
- **THEN** `conversion_jobs.conversion_id` referencia `conversions(id)` com `ON DELETE CASCADE`

#### Scenario: Índices criados
- **WHEN** a migration é aplicada
- **THEN** existe índice em `(chapters.source_id, chapters.number)`
- **THEN** existe índice em `covers.source_id`
- **THEN** existe índice em `(conversions.user_id, conversions.created_at DESC)`
- **THEN** existe índice em `conversions.status`
- **THEN** existe índice em `(conversion_jobs.conversion_id)`
- **THEN** existe índice em `conversion_jobs.status`
- **THEN** existe índice em `sources.provider_slug` e em `sources.ttl_expires_at`

#### Scenario: Metadados ricos armazenados como JSONB
- **WHEN** um Source é inserido
- **THEN** a coluna `sources.metadata` é `JSONB` contendo `MangaMetadata` (title/author/description/status/genres)
- **THEN** a coluna `sources.statistics` é `JSONB` nullable
- **THEN** a coluna `chapters.placeholder_page_indices` é `JSONB` nullable (substitui `images.json`)

#### Scenario: Snapshot de conversão armazenado como JSONB
- **WHEN** uma Conversion é inserida
- **THEN** as colunas `cover`, `output`, `metadata`, `books`, `options` são `JSONB`
- **THEN** as colunas `chapters`, `cover`, `output`, `metadata`, `options` em `conversion_jobs` são `JSONB`

### Requirement: Modelo relacional para conversões e jobs
The system MUST store Conversion and ConversionJob state in PostgreSQL with foreign keys to the owning user, enabling per-user queries.

#### Scenario: Conversão pertence a um usuário
- **WHEN** uma Conversion é criada
- **THEN** a coluna `conversions.user_id` é obrigatória (`NOT NULL`) e referencia `users(id)`
- **THEN** ao deletar um User, suas Conversions são removidas em cascata

#### Scenario: Job pertence a uma Conversion
- **WHEN** um ConversionJob é criado
- **THEN** `conversion_jobs.conversion_id` é `NOT NULL` e referencia `conversions(id)`
- **THEN** ao deletar uma Conversion, seus Jobs são removidos em cascata

#### Scenario: Status agregado persistível
- **WHEN** uma Conversion é lida ou atualizada
- **THEN** as colunas `status`, `progress`, `total_jobs`, `completed_jobs`, `failed_jobs`, `running_jobs`, `pending_jobs` existem como escalares em `conversions`
- **THEN** as colunas `completed_at` e `finished_at` são `TIMESTAMPTZ` nullable
- **THEN** as colunas `created_at` e `updated_at` existem em `conversions` e `conversion_jobs`

---

### Requirement: Composição configurável de adapters de persistência
The system MUST allow selecting between filesystem-based and Prisma-based repository implementations through a single configuration flag, without modifying use-cases or controllers.

#### Scenario: Flag de configuração REPO_BACKEND
- **WHEN** o backend inicia
- **THEN** `env.ts` (Zod) valida a variável `REPO_BACKEND` aceitando `filesystem` (default) ou `prisma`
- **THEN** qualquer valor inválido dispara erro de inicialização (Zod parse)
- **THEN** o helper `shared/config/repo-mode.ts` exporta `REPO_BACKEND` tipado e `isPrismaBackend(): boolean`

#### Scenario: Composer central de factories
- **WHEN** um módulo (scraping, conversion) precisa instanciar um repositório
- **THEN** o ponto único de composição é `shared/database/repositories/index.ts`
- **THEN** em `REPO_BACKEND=filesystem` as factories retornam instâncias `Filesystem*Repository` existentes
- **THEN** em `REPO_BACKEND=prisma` as factories retornarão instâncias `Prisma*Repository` (criadas nas changes subsequentes); se ainda inexistentes, lançam erro explícito em runtime indicando "adapter Prisma para <X> não implementado"

#### Scenario: Comportamento inalterado por default
- **WHEN** `REPO_BACKEND` não está definido no ambiente
- **THEN** o backend usa `filesystem` como fallback
- **THEN** nenhum use-case, controller ou worker precisa ser alterado
- **THEN** a produção pode continuar operando sem migrar dados até a change `backfill-and-cleanup-legacy-json`

### Requirement: Coexistência de adapters durante a transição
The system MUST keep both `Filesystem*Repository` and `Prisma*Repository` implementations available simultaneously so migrations can occur per-module and be reversible.

#### Scenario: Implementações de Filesystem permanecem
- **WHEN** a change é aplicada
- **THEN** nenhum arquivo de `Filesystem*Repository` é removido
- **THEN** nenhum teste existente de `Filesystem*Repository` é alterado
- **THEN** testes E2E atuais continuam passando com `REPO_BACKEND=filesystem`

#### Scenario: Relação User ↔ Conversion exposta via Prisma
- **WHEN** o modelo `User` é consultado
- **THEN** o campo `conversions` (relationado a `Conversion[]`) está disponível `include` em queries Prisma
- **THEN** o tipo TypeScript do Prisma Client reflete essa relação
