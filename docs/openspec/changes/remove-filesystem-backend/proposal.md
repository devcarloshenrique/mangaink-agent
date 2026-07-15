## Why

As duas migrações anteriores (`migrate-source-cache-to-postgres` e `migrate-conversions-and-jobs-to-postgres`) adicionaram adapters Prisma **ao lado** dos adapters filesystem, alternáveis pela flag `REPO_BACKEND=filesystem|prisma`. Hoje:

- **Ambos os env files** (`.env` e `.env.test`) já usam `REPO_BACKEND=prisma` — os 471 linhas de adapters filesystem (3 arquivos) são código **dormant**, nunca executado em dev nem em testes.
- **Feature gap**: o adapter filesystem não implementa `listByUser` (lança `LISTING_REQUIRES_PRISMA` → HTTP 501). A Biblioteca já depende exclusivamente do Prisma.
- **Branches condicionais** em `conversion-job.worker.ts` e `cancel-conversion.use-case.ts` instanciam `FilesystemJobRepository`/`FilesystemConversionRepository` diretamente (bypass do composer), criando dois caminhos de manutenção.
- O módulo `User` **já é Prisma-only** desde o início — sem adapter filesystem. Os demais módulos deveriam seguir o mesmo padrão.
- O `image-downloader.service.ts` sempre injeta `sourceRepo = getSourceRepository()` no worker; o fallback a `images.json` (`readChapterImagesMeta`) é código morto defensivo.
- O método `withConversion()` na interface `ConversionJobRepository` existe apenas para path-prefix scoping no filesystem; em Prisma mode o `conversionId` já está embutido em `job.config.conversionId`.

Manter o modo filesystem custa ~471 linhas de production code dormant + branches em 2 call-sites + 3 test files filesystem-aware, sem benefício real.

## What Changes

- **REMOVED** `apps/backend/src/shared/config/repo-mode.ts` — expo `isPrismaBackend()` e `REPO_BACKEND`.
- **REMOVED** `apps/backend/src/modules/scraping/repositories/filesystem-source.repository.ts` (103 linhas).
- **REMOVED** `apps/backend/src/modules/conversion/repositories/filesystem-conversion.repository.ts` (236 linhas).
- **REMOVED** `apps/backend/src/modules/conversion/repositories/filesystem-job.repository.ts` (132 linhas).
- **REMOVED** `apps/backend/src/modules/scraping/tests/unit/filesystem-source.repository.test.ts` (teste direto do adapter deletado).
- **REMOVED** `apps/backend/src/modules/conversion/tests/unit/image-downloader.service.test.ts` (testa apenas funções mortas `readChapterImagesMeta`/`writeChapterImagesMeta`).
- **MODIFIED** `apps/backend/src/shared/config/env.ts`: remove `REPO_BACKEND` do schema Zod.
- **MODIFIED** `apps/backend/src/shared/database/repositories/index.ts`: remove imports de `Filesystem*` e branches `isPrismaBackend()` — sempre instancia `new Prisma*Repository()`.
- **MODIFIED** `apps/backend/src/modules/conversion/workers/conversion-job.worker.ts`: remove branch `isPrismaBackend()` e instanciação direta de `Filesystem*`; sempre obtém repos via composer.
- **MODIFIED** `apps/backend/src/modules/conversion/use-cases/cancel-conversion.use-case.ts`: remove branch `isPrismaBackend()` e imports de `readJson`/`pathExists`; mantém somente o path DB.
- **MODIFIED** `apps/backend/src/modules/conversion/repositories/conversion-job.repository.ts`: remove método `withConversion()` da interface.
- **MODIFIED** `apps/backend/src/modules/conversion/repositories/prisma-job.repository.ts`: remove field `scopedConversionId` e método `withConversion()`; `create()` usa `job.config.conversionId` diretamente.
- **MODIFIED** `apps/backend/src/modules/conversion/use-cases/create-conversion.use-case.ts`: remove `this.jobs.withConversion(conversionId)` — chama `this.jobs.create(job)` diretamente.
- **MODIFIED** `apps/backend/src/modules/conversion/services/image-downloader.service.ts`: remove `ChapterImagesMeta`, `IMAGES_META_FILENAME`, `readChapterImagesMeta`, `writeChapterImagesMeta`; torna `sourceRepo` obrigatório; sempre lê placeholders via `this.sourceRepo.getPlaceholderIndices()`.
- **MODIFIED** `apps/backend/src/modules/conversion/tests/helpers/mock-job.repository.ts`: remove `withConversion()`.
- **MODIFIED** testes que mockavam símbolos filesystem (`inspect-source.use-case.test.ts`, `conversion.e2e.test.ts`, `prisma-job.repository.test.ts`, `prisma-conversion.repository.test.ts`, `cancel-conversion.use-case.test.ts`).
- **MODIFIED** `apps/backend/.env` e `.env.test`: removem `REPO_BACKEND`.
- **MODIFIED** `CLAUDE.md`: remove `REPO_BACKEND` da env table e referências a filesystem mode/repo-mode.

## Capabilities

### Removed Capabilities

- `dual-repository-backend`: a flag `REPO_BACKEND` e a composição entre adapters filesystem/prisma é removida — Postgres via Prisma passa a ser o único backend de metadados/estado agregado.

### Modified Capabilities

- `prisma-conversion-repository`: remove o requisito de manter `withConversion()` para filesystem scoping — o método é retirado da interface; adapters agora usam `job.config.conversionId` embutido.
- `image-downloader-placeholder-resolution`: placeholders passam a ser lidos exclusivamente via `SourceCacheRepository.getPlaceholderIndices()` — o cache `images.json` em disco é eliminado.

## Impact

- **Arquivos removidos (production):** 3 adapters filesystem + `repo-mode.ts` = 4 arquivos / ~480 linhas.
- **Arquivos removidos (test):** `filesystem-source.repository.test.ts` + `image-downloader.service.test.ts` = 2 arquivos.
- **Arquivos modificados:** composer, worker, cancel use-case, create-conversion use-case, prisma-job repository, conversion-job interface, image-downloader service, mock-job helper, 5 test files, 2 env files, `CLAUDE.md`.
- **Depende de:** `migrate-source-cache-to-postgres` (arquivada) + `migrate-conversions-and-jobs-to-postgres` (IMPLEMENTED).
- **Risco:** Médio-baixo. Binários (EPUBs/imagens) permanecem em filesystem — apenas metadados/estado migram. A remoção de `withConversion()` exige atenção em callers (create-conversion, worker) e testes Prisma. A mudança no image-downloader elimina fallback defensivo, mas o worker sempre injeta `sourceRepo`.
- **Breaking change interno:** `REPO_BACKEND=filesystem` deixa de ser válido (erro Zod se alguém ainda setar). Documentar no CLAUDE.md.
