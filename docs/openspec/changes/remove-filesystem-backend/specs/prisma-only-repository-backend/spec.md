## REMOVED Requirements

### Requirement: Backend de persistência alternável via REPO_BACKEND
The system MUST NOT provide a `REPO_BACKEND` flag to toggle between filesystem and Prisma backends. Postgres via Prisma is the sole persistence backend for source cache metadata, conversion configs, and aggregated job status. Binary artifacts (EPUBs, cached images) remain on the filesystem regardless.

#### Scenario: Composer sempre retorna adapters Prisma
- **WHEN** `getSourceRepository()`, `getConversionRepository()`, or `getConversionJobRepository()` is called
- **THEN** each returns a `new Prisma*Repository()` instance unconditionally
- **AND** no `isPrismaBackend()` branch or filesystem fallback exists in the composer

#### Scenario: env REPO_BACKEND removido
- **WHEN** `apps/backend/src/shared/config/env.ts` loads environment variables
- **THEN** `REPO_BACKEND` is NOT in the Zod schema
- **AND** setting `REPO_BACKEND=filesystem` in an env file causes a Zod validation error at startup

## MODIFIED Requirements

### Requirement: Repositório de Job sem withConversion scoping
The system MUST NOT require `withConversion(conversionId)` scoping on the `ConversionJobRepository` interface. Job creation uses `job.config.conversionId` (populated by the Planner) to resolve the Conversion FK. Other methods (`findById`, `update`, `delete`, `appendLog`) key on `jobId` only.

#### Scenario: create sem scoping
- **WHEN** `ConversionJobRepository.create(job)` is called where `job.config.conversionId` is set
- **THEN** the adapter resolves the Conversion FK via `job.config.conversionId` and inserts the `conversion_jobs` row
- **AND** no prior `withConversion()` call is needed

#### Scenario: interface sem withConversion
- **WHEN** `ConversionJobRepository` interface is inspected
- **THEN** there is no `withConversion(conversionId: string)` method
- **AND** callers (`create-conversion.use-case`, `conversion-job.worker`, tests) call `repo.create(job)` / `repo.update(jobId, ...)` directly

### Requirement: Placeholders lidos exclusivamente via SourceCacheRepository
The `ImageDownloaderService` MUST read placeholder page indices exclusively via `SourceCacheRepository.getPlaceholderIndices(sourceId, chapterId)`. The `images.json` filesystem cache and the `readChapterImagesMeta`/`writeChapterImagesMeta` helper functions are removed. The `sourceRepo` constructor parameter is mandatory (non-optional).

#### Scenario: Cache hit com placeholders conhecidos
- **WHEN** `ImageDownloaderService.downloadChapter()` hits a valid image cache for a chapter
- **THEN** placeholder indices are obtained by calling `this.sourceRepo.getPlaceholderIndices(sourceId, chapterId)`
- **AND** no `images.json` file is read or written

#### Scenario: sourceRepo obrigatório
- **WHEN** `new ImageDownloaderService(events, repository, sourceRepo)` is constructed
- **THEN** `sourceRepo` is a required `SourceCacheRepository` parameter (not optional)
- **AND** no fallback path to `readChapterImagesMeta` exists
