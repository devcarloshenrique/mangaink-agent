## Context

`FilesystemSourceRepository` escreve/ler `storage/sources/{sourceId}/metadata.json` (~50 KB; capítulos embutidos). `images.json` por capítulo armazena índices de páginas placeholder geradas por corrupção. As interfaces já existem; basta criar um adapter Prisma com a mesma interface.

**Binários** (`*.webp` em `chapters/{cid}/`, capas em `covers/{coverId}.{ext}`) permanecem no filesystem — motivado pelo design doc original (`docs/openspec/archive/scraping/design.md` §4.1) que explicita "filesystem para binários grandes".

## Goals / Non-Goals

**Goals:**
- Implementar `PrismaSourceRepository` cobrindo a interface `SourceCacheRepository`.
- Mapear o JSON `metadata.json` para o modelo relacional criado na change anterior (`Source` + `Chapter` + `Cover`).
- Eliminar `images.json` em modo Prisma migrando para `Chapter.placeholderPageIndices` (JSONB).
- Fazer o Composer retornar o adapter Prisma quando `REPO_BACKEND=prisma`.

**Non-Goals:**
- Migrar metadados de conversões (job da change seguinte).
- Migrar binários para S3/MinIO (fora de escopo — decisão: filesystem local).
- Backfill de dados existentes (属 backfill change).
- Habilitar `REPO_BACKEND=prisma` em produção (default continua `filesystem`).
- Alterar quaisquer use-cases (a interface é mantida).

## Decisions

### D1. Bulk upsert em transação
`save()` faz `prisma.$transaction([upsertSource, ...upsertChapters, ...upsertCovers])`. Mesmo mantendo atômico, capítulos/capas que desapareceram da nova versão (após re-scrape) são removidos—`upsert` por `chapterId`/`coverId` apenas atualiza, mas chapters sumidos devem ser `deleteMany` where `sourceId` AND `chapterId NOT IN (...)`. Implementar como transação: `deleteMany` + `createMany` para simplicity, ou `upsert` por item para idempotência.

### D2. Schema Prisma de saída igual ao schema JSON
`PrismaSourceRepository.findById()` deve sintetizar `SourceInspectResponse` a partir das linhas (Source + Chapter[] + Cover[]). Tipagem garante shape idêntico — use-cases não enxergam diff.

### D3. Placeholders via update isolado do capítulo
`ImageDownloaderService` em modo Prisma chama `prismaSourceRepo.updatePlaceholderIndices(sourceId, chapterId, number[])`. Em modo Filesystem, mantém `writeChapterImagesMeta()`. A decisão de qual caminho usar é feita dentro do `ImageDownloaderService` (única branch condicional). encapsulamento para evitar leaks.

### D4. URLs de capa não serializam o binário
`Cover.imageUrl` mantém a URL do fonte original; o binário baixado vive em disco. O adapter Prisma só guarda metadados — o que já é a realidade do `metadata.json` atual.

### D5. Testes Vitest com Postgres local
Reaproveitar o Postgres do `docker-compose.yml`. Setup do teste garante DB limpo via `prisma.migrate.reset()` ou `deleteMany` antes de cada caso. Mock providers BullMQ não são necessários.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Performance de bulk upsert para source com 200+ chapters | Usar `createMany` em chunks de 50; transação única para consistência |
| Race condition entre `touch()` e `update()` | Postgres MVCC garante consistência; `touch` só atualiza timestamp |
| Adapter Prisma impactado por alterações no schema | Schema é estável pós change 1 (sem migrations adicionais esperadas) |
| `findById` com muitos chapters pode gerar query pesada | Já otimizado com `include` — não há N+1 (uma query com JOIN) |
| Backward compatibilidade no Filesystem mode | `FilesystemSourceRepository` é intocada; flag garante coexistência |
| Binários orfãos quando Source é deletado | Especificado em spec: cleanup de binários é operação separada; não acoplamos `delete()` a disco |