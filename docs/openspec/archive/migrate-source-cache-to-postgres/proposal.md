## Why

A cache de scraping hoje mora em `storage/sources/{sourceId}/metadata.json` (~50 KB cada, com `chapters[]` embutido). É um cache **compartilhado entre usuários**, mas sofre de dois problemas: (1) qualquer listagem administrativa de fontes exige `readdir` + parse de todos os JSONs; (2) o lookup de um capítulo é `Array.find` em memória (sem índice). Além disso `images.json` por capítulo (placeholders de corruption) é um arquivo adicional a parte. Migrar metadados para Postgres (mantendo binários no filesystem) habilita `WHERE`/`ORDER BY`/Paginação, índices em `source_id` e absorve `images.json` como coluna JSONB.

## What Changes

- **ADDED** `apps/backend/src/modules/scraping/repositories/prisma-source.repository.ts` implementando `SourceCacheRepository`.
- **MODIFIED** `apps/backend/src/shared/database/repositories/index.ts`: quando `REPO_BACKEND=prisma`, `getSourceRepository()` retorna instância do novo adapter (em vez de lançar "not implemented").
- **MODIFIED** `apps/backend/src/modules/scraping/services/cache.service.ts` (somente se necessário ajustar tipagem de retorno);
- **MODIFIED** `apps/backend/src/modules/scraping/workers/inspect-source.worker.ts`: ao persistir metadados, chama o adaptador (interface `SourceCacheRepository.save()`); as gravações binárias (imagens/capas) permanecem filesystem via `ImageDownloaderService` (sem mudança).
- **MODIFIED** `apps/backend/src/modules/conversion/services/image-downloader.service.ts`: ao ler placeholders, consulta `Chapter.placeholderPageIndices` (via Source repo) quando em modo Prisma; legado filesystem ainda lê `images.json`.
- **ADDED** Testes unitários para `PrismaSourceRepository` (usando Postgres real local do `docker-compose`) cobrindo save/findById/update/touch/exists/delete + bulk chapters/covers + placeholderPageIndices.

## Capabilities

### New Capabilities

- `prisma-source-repository`: adapter Prisma que persiste metadados de scraping (Source/Chapter/Cover) e placeholders de corruption em Postgres, mantendo binários no filesystem.

### Modified Capabilities

<!-- Nenhum requisito de spec de comportamento muda — o scraping continua produzindo o mesmo `SourceInspectResponse`; apenas o storage backend alterna por flag. -->

## Impact

- **Arquivos novos:**
  - `apps/backend/src/modules/scraping/repositories/prisma-source.repository.ts`
  - `apps/backend/src/modules/scraping/tests/prisma-source.repository.test.ts`
- **Arquivos modificados:**
  - `apps/backend/src/shared/database/repositories/index.ts`
  - `apps/backend/src/modules/scraping/services/cache.service.ts` (somente se tipagens exigirem)
  - `apps/backend/src/modules/scraping/workers/inspect-source.worker.ts` (continua usando a interface)
  - `apps/backend/src/modules/conversion/services/image-downloader.service.ts` (branch por `REPO_BACKEND` para ler placeholders)
- **Depende de:** `add-prisma-schema-and-repo-composition` (schema + composer).
- **Performance:** Recuperação de Source por `source_id` indexado; lookup de capítulo por `(source_id, number)`.
- **Risco:** Binários não mudam — apenas metadados migram; se a migration rodar antes do backfill a tabela fica vazia, mas `REPO_BACKEND` default é `filesystem` nesta change.