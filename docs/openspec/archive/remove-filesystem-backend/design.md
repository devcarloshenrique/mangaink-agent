## Context

A arquitetura pós-migração tem:

- **Composer** (`shared/database/repositories/index.ts`) que seleciona entre `Filesystem*` e `Prisma*` via `isPrismaBackend()`.
- **`repo-mode.ts`** helper que lê `env.REPO_BACKEND` (Zod enum `filesystem|prisma`, default `filesystem`).
- **Adapters filesystem** (471 linhas): `FilesystemSourceRepository` (lê `metadata.json` + `images.json`), `FilesystemConversionRepository` (lê `config.json` + `status.json`, faz RMW), `FilesystemJobRepository` (`withConversion()` path-prefix scoping).
- **Branches condicionais** em `conversion-job.worker.ts` (2 callsites) e `cancel-conversion.use-case.ts` que instanciam `Filesystem*` diretamente no else-branch.
- **`withConversion()`** na interface `ConversionJobRepository` — em Prisma mode é um thin wrapper que guarda `scopedConversionId` (redundante: `job.config.conversionId` já está disponível em `create()`).
- **`image-downloader.service.ts`** que tem fallback `readChapterImagesMeta(images.json)` quando `sourceRepo` é `undefined` — mas o worker sempre injeta `sourceRepo = getSourceRepository()`, então o fallback é morto.

Ambos os env files já usam `REPO_BACKEND=prisma`. O módulo `User` já é Prisma-only.

## Goals / Non-Goals

**Goals:**
- Eliminar a flag `REPO_BACKEND` e o helper `repo-mode.ts`.
- Deletar os 3 adapters filesystem e seus testes diretos.
- Simplificar o composer para sempre retornar adapters Prisma.
- Remover branches condicionais em worker e cancel use-case.
- Remover `withConversion()` da interface (e de callers/adapter/mock/tests).
- Eliminar `images.json` no image-downloader — placeholders sempre via `SourceCacheRepository`.
- Atualizar env files, CLAUDE.md e mocks de teste.

**Non-Goals:**
- Migrar binários (EPUBs, imagens cacheadas) — continuam no filesystem.
- Refatorar `shared/utils/filesystem` (`mkdirp`, `writeJson`, `readJson`, `pathExists`) — ainda usado por `appendLog`, cache de imagens, e outros.
- Endpoint `GET /api/conversions` (lista por usuário) — change `add-conversion-library-listing`.
- Backfill de dados JSON legados — change `backfill-and-cleanup-legacy-json`.
- Status hot em Redis — change `add-redis-live-job-status`.

## Decisions

### D1. Sem período de transição / feature flag de flag-off
Remove `REPO_BACKEND` completamente em vez de deixar `filesystem` como valor inválido. Quem ainda setar `REPO_BACKEND=filesystem` em env custom terá erro Zod imediato na inicialização — falha explícita é preferível a silenciosamente correr Prisma. Documentar a remoção no CLAUDE.md.

### D2. `withConversion()` removido da interface (não retained para compat)
O adapter Prisma já usa `job.config.conversionId` como fallback em `create()`. Sem filesystem mode, o `scopedConversionId` é redundante. Remover o método da interface melhora clareza e elimina um conceito dead. Callers passam a chamar `this.jobs.create(job)` diretamente (`job.config.conversionId` já está populado pelo Planner).

### D3. image-downloader: `sourceRepo` torna-se obrigatório
O construtor `ImageDownloaderService` tinha `sourceRepo?` opcional com fallback a `images.json`. Como o worker sempre injeta `sourceRepo = getSourceRepository()`, tornar o param obrigatório formaliza a dependência e elimina o fallback. As funções `readChapterImagesMeta`/`writeChapterImagesMeta` e `ChapterImagesMeta` viram código morto e são removidas.

### D4. Composer não é mais uma factory condicional — vira factory simples
`getSourceRepository()`, `getConversionRepository()`, `getConversionJobRepository()` passam a instanciar `new Prisma*Repository()` diretamente, sem branch. Mantém-se a indireção via composer porque (a) testes mockam o composer, e (b) isola o singleton `prisma` do código de domínio (composition root).

### D5. Mocks de teste migram de `Filesystem*` symbols → composer
Testes que faziam `vi.mock('.../filesystem-conversion.repository')` ou `vi.mock('.../filesystem-source.repository')` passam a mockar `../../../../shared/database/repositories` (composer) retornando in-memory doubles. O e2e de conversão segue o padrão já adotado por `create-conversion.use-case.test.ts`.

### D6. `shared/utils/filesystem` permanece
`mkdirp`, `writeJson`, `readJson`, `pathExists` são usados por `appendLog` (worker escreve logs em disco), cache de imagens baixadas, e testes. Não são acoplados aos adapters filesystem — são utilitários genéricos de I/O.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Repositories `new`-ed a cada call no composer (custo de objeto) | Os adapters são stateless/leves; `prisma` é singleton. Se performance for preocupação futura, cache singleton no composer — fora de escopo aqui. |
| `REPO_BACKEND=filesystem` em env de produção quebra startup | Erro Zod explícito é preferível a silenciosamente correr Prisma. Documentar no CLAUDE.md. |
| Remover `withConversion()` quebra callers com `scopedJobs.create(job)` se `job.config.conversionId` missing | Planner sempre popula `config.conversionId` antes de `create()`. Testes de use-case cobrem este caminho. |
| image-downloader sem fallback `images.json` perde resiliência se `sourceRepo` falha | `getSourceRepository()` retorna adapter Prisma stateless — não há ponto de falha acima do DB. DB é já dependência obrigatória. |
| Testes Prisma rodam contra PostgreSQL real (shared) | Manter `--no-file-parallelism` já adotado. A remoção de filesystem adapters não muda isto. |
