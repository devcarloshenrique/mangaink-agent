## 1. Remover flag `REPO_BACKEND` + simplificar composer

- [ ] 1.1 Em `apps/backend/src/shared/config/env.ts`, remover `REPO_BACKEND: z.enum(['filesystem', 'prisma']).default('filesystem')` do schema Zod.
- [ ] 1.2 **Deletar** `apps/backend/src/shared/config/repo-mode.ts` (expo `isPrismaBackend`, `REPO_BACKEND`, tipo `RepoBackend`).
- [ ] 1.3 Em `apps/backend/src/shared/database/repositories/index.ts`:
  - [ ] 1.3.1 Remover import de `isPrismaBackend` de `../../config/repo-mode`.
  - [ ] 1.3.2 Remover imports de `FilesystemSourceRepository`, `FilesystemConversionRepository`, `FilesystemJobRepository`.
  - [ ] 1.3.3 Remover branches `if (isPrismaBackend())` nas 3 factory functions.
  - [ ] 1.3.4 Cada factory retorna diretamente `new Prisma*Repository()`.

## 2. Remover branches filesystem em production code

- [ ] 2.1 Em `apps/backend/src/modules/conversion/workers/conversion-job.worker.ts`:
  - [ ] 2.1.1 Remover import `isPrismaBackend` de `../../../shared/config/repo-mode`.
  - [ ] 2.1.2 Remover import `FilesystemJobRepository` de `../repositories/filesystem-job.repository`.
  - [ ] 2.1.3 Remover import `FilesystemConversionRepository` de `../repositories/filesystem-conversion.repository`.
  - [ ] 2.1.4 Lines 26-32: remover branch `isPrismaBackend()` e ternários; obter `repository` e `conversions` sempre via composer (remover `.withConversion()` conforme seção 4).
  - [ ] 2.1.5 Lines 343-348 (failure-path): mesma remoção de branch.
- [ ] 2.2 Em `apps/backend/src/modules/conversion/use-cases/cancel-conversion.use-case.ts`:
  - [ ] 2.2.1 Remover import `isPrismaBackend` de `../../../shared/config/repo-mode`.
  - [ ] 2.2.2 Remover import `readJson, pathExists` de `../../../shared/utils/filesystem` (se não usados em outro lugar do arquivo).
  - [ ] 2.2.3 Remover branch `if (isPrismaBackend()) { ... } else { ... }`; manter somente o corpo do bloco `if` (path DB) como código direto.

## 3. Deletar adapters filesystem

- [ ] 3.1 **Deletar** `apps/backend/src/modules/scraping/repositories/filesystem-source.repository.ts`.
- [ ] 3.2 **Deletar** `apps/backend/src/modules/conversion/repositories/filesystem-conversion.repository.ts`.
- [ ] 3.3 **Deletar** `apps/backend/src/modules/conversion/repositories/filesystem-job.repository.ts`.
- [ ] 3.4 **Deletar** `apps/backend/src/modules/scraping/tests/unit/filesystem-source.repository.test.ts`.
- [ ] 3.5 Confirmar via grep que nenhum import remanescente referencia `Filesystem*Repository` ou `repo-mode`.

## 4. Remover `withConversion()` da interface

> Executar esta seção **antes ou em conjunto** com 2.1.4/2.1.5 para evitar dupla edição do worker.

- [ ] 4.1 Em `apps/backend/src/modules/conversion/repositories/conversion-job.repository.ts`: remover método `withConversion(conversionId: string): ConversionJobRepository` da interface (linhas 30-35) + o docstring.
- [ ] 4.2 Em `apps/backend/src/modules/conversion/repositories/prisma-job.repository.ts`:
  - [ ] 4.2.1 Remover field `private scopedConversionId?: string` (linha 19).
  - [ ] 4.2.2 Remover método `withConversion()` (linhas 21-25).
  - [ ] 4.2.3 Em `create()` linha 28: substituir `const convId = this.scopedConversionId ?? job.config.conversionId` por `const convId = job.config.conversionId`.
- [ ] 4.3 Em `apps/backend/src/modules/conversion/use-cases/create-conversion.use-case.ts` linha 185:
  - [ ] 4.3.1 Remover `const scopedJobs = this.jobs.withConversion(conversionId)`.
  - [ ] 4.3.2 No loop linha 187: `await scopedJobs.create(jobState)` → `await this.jobs.create(jobState)`.
- [ ] 4.4 Em `apps/backend/src/modules/conversion/workers/conversion-job.worker.ts` linhas 28 e 344:
  - [ ] 4.4.1 `getConversionJobRepository().withConversion(conversionId)` → `getConversionJobRepository()` (variable `repository` recebe o repo não-scoped).
- [ ] 4.5 Em `apps/backend/src/modules/conversion/tests/helpers/mock-job.repository.ts`: remover método `withConversion()` (linhas 28-30) + docstring (linha 5).
- [ ] 4.6 Em `apps/backend/src/modules/conversion/tests/unit/prisma-job.repository.test.ts`:
  - [ ] 4.6.1 Remover `describe('withConversion + create')` block; reescrever testes de `create` chamando `jobRepo.create(job)` diretamente (job já tem `config.conversionId`).
  - [ ] 4.6.2 Remover `describe('withConversion')` block.
- [ ] 4.7 Em `apps/backend/src/modules/conversion/tests/unit/prisma-conversion.repository.test.ts` linhas 134, 152:
  - [ ] 4.7.1 `new PrismaJobRepository().withConversion(convId)` → `new PrismaJobRepository()`.

## 5. Corrigir image-downloader (eliminar `images.json`)

- [ ] 5.1 Em `apps/backend/src/modules/conversion/services/image-downloader.service.ts`:
  - [ ] 5.1.1 Remover interface `ChapterImagesMeta` (linhas 26-28).
  - [ ] 5.1.2 Remover const `IMAGES_META_FILENAME = 'images.json'` (linha 30).
  - [ ] 5.1.3 Remover função `readChapterImagesMeta` (linhas 69-78).
  - [ ] 5.1.4 Remover função `writeChapterImagesMeta` (linhas 80-83).
  - [ ] 5.1.5 No constructor linha 89: remover `?` de `private readonly sourceRepo?: SourceCacheRepository` → `private readonly sourceRepo: SourceCacheRepository`.
  - [ ] 5.1.6 Linhas 108-110: remover o ternário; sempre `const placeholderIndices = await this.sourceRepo.getPlaceholderIndices(sourceId, chapterId)`.
  - [ ] 5.1.7 Remover imports não mais usados (`writeJson`, `readJson` de `shared/utils/filesystem` se não usados em outro lugar do arquivo; manter `mkdirp`, `pathExists`).
- [ ] 5.2 **Deletar** `apps/backend/src/modules/conversion/tests/unit/image-downloader.service.test.ts` (só testa as funções removidas).

## 6. Atualizar mocks de teste

- [ ] 6.1 Em `apps/backend/src/modules/scraping/tests/unit/inspect-source.use-case.test.ts`:
  - [ ] 6.1.1 Remover `vi.mock('../../repositories/filesystem-source.repository', ...)`.
  - [ ] 6.1.2 Manter `vi.mock('../../../../shared/database/repositories', ...)` (composer mock).
- [ ] 6.2 Em `apps/backend/src/modules/conversion/tests/e2e/conversion.e2e.test.ts`:
  - [ ] 6.2.1 Remover `vi.mock('../../repositories/filesystem-conversion.repository', ...)` (linhas 4-9).
  - [ ] 6.2.2 Adicionar `vi.mock('../../../../shared/database/repositories', () => ({ getConversionRepository: vi.fn(() => mockRepo), getConversionJobRepository: vi.fn(), getSourceRepository: vi.fn() }))` onde `mockRepo` é o mesmo shape do mock anterior (`create/findById/update/syncStatus/listJobIds/appendLog/delete`).
- [ ] 6.3 Em `apps/backend/src/modules/conversion/tests/unit/cancel-conversion.use-case.test.ts`:
  - [ ] 6.3.1 Remover `vi.mock('../../../shared/utils/filesystem', ...)` se não mais usado (após remover o filesystem branch no use-case).

## 7. Atualizar env files

- [ ] 7.1 Em `apps/backend/.env`: remover linhas 10-11 (`# Para usar PostgreSQL: ...` e `REPO_BACKEND=prisma`).
- [ ] 7.2 Em `apps/backend/.env.test`: remover linha 40 (`REPO_BACKEND=prisma`).

## 8. Atualizar docs

- [ ] 8.1 Em `CLAUDE.md`:
  - [ ] 8.1.1 Env table: remover linha `REPO_BACKEND`.
  - [ ] 8.1.2 Seção "Módulos do Backend": remover referências a `repo-mode.ts`, "filesystem mode", e `Filesystem*Repository` da estrutura de diretórios e descrições.
  - [ ] 8.1.3 Ajustar menções de dual-backend para Prisma-only onde aplicável.

## 9. Validação

- [ ] 9.1 `pnpm build:backend` sem erros TS (sem imports quebrados para `repo-mode`/`Filesystem*`).
- [ ] 9.2 `pnpm test` — todos testes passam (Δ: arquivos deletados reduzem contagem; a falha pré-existente de `cancel-conversion.use-case.test.ts` deve ser resolvida pela remoção do filesystem branch ou permanece).
- [ ] 9.3 Grep final: confirmar que nenhuma referência a `REPO_BACKEND`, `repo-mode`, `isPrismaBackend`, `FilesystemSourceRepository`, `FilesystemConversionRepository`, `FilesystemJobRepository`, `withConversion`, `images.json` (das funções removidas) resta em `apps/backend/src/`.
- [ ] 9.4 Smoke opcional: rodar `pnpm dev:backend` sem `REPO_BACKEND` setado — servidor inicia sem erro Zod.
