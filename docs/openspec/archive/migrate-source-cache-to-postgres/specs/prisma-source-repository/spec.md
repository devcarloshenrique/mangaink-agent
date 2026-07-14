## ADDED Requirements

### Requirement: Adaptador Prisma para SourceCacheRepository
The system MUST provide a Prisma-backed implementation of the existing `SourceCacheRepository` interface, selectable via `REPO_BACKEND=prisma`, that stores Source/Chapter/Cover metadata in PostgreSQL.

#### Scenario: save cria ou atualiza Source com chapters e covers
- **WHEN** `PrismaSourceRepository.save(sourceId, payload)` é chamado com payload incluindo `metadata`, `chapters[]`, `covers[]`, `statistics` e bloco `cache`
- **THEN** é executado `prisma.source.upsert({ where: { sourceId }, create: {...}, update: {...} })`
- **THEN** todos os `Chapter` são gravados via bulk upsert (transação) com `chapterId`, `number`, `title`, `url`, `pages`, `volume`, `placeholderPageIndices` (se existir)
- **THEN** todos os `Cover` são gravados via bulk upsert (transação) com `coverId`, `type`, `label`, `imageUrl`
- **THEN** toda a operação é atômica (transação Prisma)

#### Scenario: findById retorna Source com relações
- **WHEN** `PrismaSourceRepository.findById(sourceId)` é chamado para um Source existente
- **THEN** retorna um objeto com a mesma forma que o `SourceInspectResponse` consumido pelos use-cases atuais
- **THEN** inclui `chapters` (ordenados por `number`) e `covers` populados via `include`
- **THEN** para Source inexistente retorna `null`

#### Scenario: update patch dos campos de cache
- **WHEN** `PrismaSourceRepository.update(sourceId, partial)` é chamado com subset de campos (ex.: status, cache.updatedAt)
- **THEN** executa `prisma.source.update()` com apenas os campos fornecidos (sem sobrescrever `metadata`/`chapters`)

#### Scenario: touch atualiza apenas lastAccessAt
- **WHEN** `CacheService.touch(sourceId)` é invocado
- **THEN** o adapter executa `UPDATE sources SET last_access_at = NOW() WHERE source_id = $1`
- **THEN** não lê nem escreve outros campos (mínimo I/O)

#### Scenario: exists e delete
- **WHEN** `PrismaSourceRepository.exists(sourceId)` é chamado
- **THEN** retorna `true` se linha existe em `sources`, `false` caso contrário
- **WHEN** `PrismaSourceRepository.delete(sourceId)` é chamado
- **THEN** executa `DELETE` em `sources` com cascade em `chapters` e `covers` (FK `ON DELETE CASCADE`)
- **THEN** binários no filesystem (imagens, capas) **não** são removidos por esta operação (a cargo de cleanup separado)

### Requirement: Persistência de placeholders como JSONB em Chapter
The system MUST persist chapter corruption placeholder indices as a JSONB column on the Chapter row, eliminating the need for per-chapter `images.json` files in Prisma mode.

#### Scenario: Gravação de placeholders ao detectar corrupção
- **WHEN** o `ImageDownloaderService` detecta corrupção com estratégia `ignore` durante download de capítulo
- **THEN** em `REPO_BACKEND=prisma` o adapter atualiza `Chapter.placeholder_page_indices` (JSONB `number[]`)
- **THEN** em `REPO_BACKEND=filesystem` o comportamento existente (escrever `images.json`) permanece inalterado
- **THEN** nenhuma escrita de `images.json` ocorre em modo Prisma

#### Scenario: Leitura de placeholders em cache hit
- **WHEN** o `ImageDownloaderService` lê um capítulo cacheado
- **THEN** em `REPO_BACKEND=prisma` consulta `Chapter.placeholderPageIndices` via Source repo antes de iniciar downloads
- **THEN** em `REPO_BACKEND=filesystem` o comportamento existente (ler `images.json`) permanece inalterado
- **THEN** os índices retornados têm o mesmo formato `number[]` em ambos os modos

### Requirement: Binários de capítulos e capas permanecem no filesystem
The system MUST keep image binaries (chapter pages and cover images) on the filesystem regardless of `REPO_BACKEND`. Only metadata lives in Postgres.

#### Scenario: Imagens de capítulo continuam em disco
- **WHEN** `ImageDownloaderService.downloadChapter()` salva páginas
- **THEN** os arquivos `0001.webp` etc. são gravados em `storage/sources/{sourceId}/chapters/{chapterId}/`
- **THEN** este caminho não depende de `REPO_BACKEND`

#### Scenario: Capas continuam em disco
- **WHEN** o worker aplica capas (`applyCover()`)
- **THEN** o arquivo binário é gravado em `storage/sources/{sourceId}/covers/{coverId}.{ext}`
- **THEN** apenas `Cover.imageUrl` é persistido no Postgres
- **THEN** o caminho no disco é derivável a partir de `sourceId` + `coverId`

### Requirement: Compatibilidade de retorno com SourceInspectResponse
The system MUST return data from `PrismaSourceRepository` in the same shape as `FilesystemSourceRepository`, so that use-cases do not change.

#### Scenario: Idempotência de shape
- **WHEN** qualquer use-case (`inspect-source.use-case`, `get-source.use-case`, `create-conversion.use-case`) consome um Source via interface
- **THEN** o objeto retornado tem o mesmo contrato (`sourceId`, `status`, `provider`, `source`, `metadata`, `chapters[]`, `covers[]`, `statistics`, `cache`)
- **THEN** nenhum use-case precisa de `if (REPO_BACKEND === ...)` — a escolha é interna ao composer