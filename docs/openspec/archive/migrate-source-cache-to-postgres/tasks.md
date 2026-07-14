## 1. Adapter Prisma

- [x] 1.1 Criar `apps/backend/src/modules/scraping/repositories/prisma-source.repository.ts` implementando `SourceCacheRepository`.
- [x] 1.2 Implementar `save(sourceId, payload)` usando `prisma.$transaction` com `source.upsert` + bulk `chapter.upsert`/`cover.upsert` (ou `deleteMany` + `createMany` em chunks).
- [x] 1.3 Implementar `findById(sourceId)` retornando `SourceInspectResponse` (mapear linhas → shape) ou `null`.
- [x] 1.4 Implementar `update(sourceId, partial)` escrita seletiva de campos (não sobrescrever atributos relationship).
- [x] 1.5 Implementar `touch(sourceId)` — `UPDATE ... SET last_access_at = NOW()`.
- [x] 1.6 Implementar `exists(sourceId)` — `SELECT 1`.
- [x] 1.7 Implementar `delete(sourceId)` — `DELETE` em `sources` (cascade automático).
- [x] 1.8 Implementar `updatePlaceholderIndices(sourceId, chapterId, indices: number[])` (método extra na interface ou via método dedicado que o `ImageDownloaderService` possa chamar).
- [x] 1.9 Garantir tipagem de retorno igual à do `FilesystemSourceRepository` (usar `satisfies SourceCacheRepository`).

## 2. Composição

- [x] 2.1 Em `apps/backend/src/shared/database/repositories/index.ts`, em `REPO_BACKEND === "prisma"` retornar `new PrismaSourceRepository(prisma)` em `getSourceRepository()`.
- [x] 2.2 Substituir o placeholder "not implemented" por esta implementação concreta; manter fallback para filesystem.

## 3. Placeholders Branch em ImageDownloader

- [x] 3.1 Em `apps/backend/src/modules/conversion/services/image-downloader.service.ts`, ler `isPrismaBackend()` para decidir leitura/gravação de placeholders.
- [x] 3.2 Path Prisma: ler/gravar via `getSourceRepository().updatePlaceholderIndices(...)` e `findById(sourceId).chapters[i].placeholderPageIndices`.
- [x] 3.3 Path Filesystem: manter `readChapterImagesMeta()` e `writeChapterImagesMeta()` atuais.
- [x] 3.4 Garantir que nenhum arquivo `images.json` é criado em modo Prisma.

## 4. Worker de Inspeção

- [x] 4.1 Em `apps/backend/src/modules/scraping/workers/inspect-source.worker.ts`, ao final do scraping, chamar o repository via interface (`save()`). Não há mudança de comportamento — apenas confirma que o adapter Prisma está plugável.
- [x] 4.2 Garantir que gravações de binários (covers/, chapters/*.webp) permanecem via disco (caminho inalterado).

## 5. Testes

- [x] 5.1 Criar `apps/backend/src/modules/scraping/tests/prisma-source.repository.test.ts` com setup Postgres (`docker-compose up -d`).
- [x] 5.2 Cobrir save → findById round-trip preservando `metadata`, `chapters[]`, `covers[]`, `statistics`, `cache`.
- [x] 5.3 Cobrir update parcial (não sobrescreve `metadata`).
- [x] 5.4 Cobrir touch (apenas `lastAccessAt`).
- [x] 5.5 Cobrir exists/delete (cascade em chapters/covers via FK).
- [x] 5.6 Cobrir `updatePlaceholderIndices` round-trip (ler → getPlaceholder → comparar).
- [x] 5.7 Confirmar que `findById` retorna `null` para Source inexistente.
- [x] 5.8 Rodar `pnpm test` global — todos testes existentes passam com `REPO_BACKEND=filesystem`.

## 6. Validação

- [x] 6.1 `pnpm build:backend` sem erros TS (apenas erros pré-existentes em testes, nenhum relacionado a esta change).
- [ ] 6.2 Smoke: com `REPO_BACKEND=prisma` e DB limpo, dispara `POST /api/conversions/source/inspect` → espera Source em `pnpm db:studio` (tabela `sources` populada).
- [ ] 6.3 Smoke: com `REPO_BACKEND=filesystem` o `metadata.json` continua sendo escrito (regressão confirmada).
- [ ] 6.4 Confirmar via `pnpm db:studio` que `chapters.placeholder_page_indices` JSONB população funciona quando corrupção é simulada.