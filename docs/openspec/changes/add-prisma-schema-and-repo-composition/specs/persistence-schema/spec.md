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