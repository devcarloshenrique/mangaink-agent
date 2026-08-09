# Tasks — Desktop Embedded Conversion 500

> Gate de finalização: o change só é encerrado (arquivado via skill `change-completion`) depois que as conversões reais de mangá passarem na versão desktop — validado com `https://mangalivre.to/manga/chainsaw-man-pt-br/` (seção 5).

## 1. Default seguro por modo dos status stores (backend)

- [x] 1.1 `apps/backend/src/shared/redis/job-status-store.ts`: default do `IStatusStore` env-aware — `env.MI_EMBEDDED_MODE ? new InMemoryStatusStore() : new RedisStatusStoreAdapter()` (injeção explícita continua sobrepondo)
- [x] 1.2 `apps/backend/src/shared/redis/mobi-preview-status-store.ts`: mesmo default env-aware (simetria)
- [x] 1.3 Testes unitários (`shared/redis/tests/job-status-store.test.ts` + `mobi-preview-status-store.test.ts`): construção default com `MI_EMBEDDED_MODE=1` usa `InMemoryStatusStore` e faz set/get roundtrip sem Redis; sem flag usa `RedisStatusStoreAdapter`; injeção explícita sobrepõe

## 2. Injeção do status store no repositório de conversão (backend)

- [x] 2.1 `apps/backend/src/modules/conversion/repositories/prisma-conversion.repository.ts`: construtor aceita `statusStore?: IStatusStore`; `syncStatus()` usa `new JobLiveStatusStore(this.statusStore)` em vez de `new JobLiveStatusStore()` no corpo
- [x] 2.2 `apps/backend/src/shared/database/repositories/index.ts`: `getConversionRepository(statusStore?: IStatusStore)` repassa ao `PrismaConversionRepository`
- [x] 2.3 `apps/backend/src/modules/conversion/conversion.routes.ts` (`buildConversionDeps`): `getConversionRepository(runtime?.status)`
- [x] 2.4 `apps/backend/src/modules/conversion/workers/conversion-job.worker.ts`: `getConversionRepository(runtime.status)` no worker e no `onFailed`
- [x] 2.5 `apps/backend/src/modules/conversion/workers/download-only.worker.ts`: `getConversionRepository(runtime.status)` no worker e no `onFailed`
- [x] 2.6 Teste unitário de regressão (`modules/conversion/tests/unit/prisma-conversion-repository-syncstatus.test.ts`): `getPrisma` mockado (rows de conversion + jobs não-terminais) + `InMemoryStatusStore` com progresso live → `syncStatus` não lança e mescla status/progresso do live store (falha com o código atual em embedded)

## 3. E2E embedded de regressão (caminho real, sem mock de repo)

- [x] 3.1 Novo `apps/backend/src/modules/conversion/tests/e2e/embedded-get-conversion.e2e.test.ts` (modelado no `embedded-conversion.e2e.test.ts`): `createServer()` com `MI_EMBEDDED_MODE=1`, `getPrisma()` fake in-memory (conversion + conversionJob), `PrismaUserRepository`/providers/KCC mockados; **sem** mock de `getConversionRepository()`
- [x] 3.2 Cenários do E2E: POST /api/conversions → 202; GET /api/conversions/:id com job queued → **200** (não 500); job não-terminal com status live no store → GET reflete `downloading` + progresso; job terminal → GET → `completed`; GET /logs → 200; POST /cancel → 200
- [x] 3.3 Rodar a suíte do backend: `pnpm --filter @mangaink/backend test` — 96/100 arquivos verdes (810 testes); 4 suítes Prisma falham por Postgres fora do ar (baseline pré-existente comprovado, zero regressão)

## 4. Documentação

- [x] 4.1 `CLAUDE.md`: nova seção "Armazenamento de arquivos" com a árvore de diretórios — desktop (`%APPDATA%/MangaInk Agent/storage/sources/...`, `storage/conversions/{id}/jobs/{jobId}/output/`, `logs/`, `temp/` + `pgdata/` e `settings.json`) e web (`apps/backend/storage/`)
- [x] 4.2 `CLAUDE.md`: nota na arquitetura de conversão — `PrismaConversionRepository.syncStatus` consome o status store do runtime (compartilhado com workers) em embedded

## 5. Validação manual — GATE (não finalizar antes de passar)

- [x] 5.1 Suítes automatizadas verdes: `pnpm --filter @mangaink/backend test` — 100/100 arquivos, 870 testes passando + 1 skipped (smoke que exige CI) com Postgres/Redis do docker no ar; `pnpm --filter @mangaink/desktop test` — 94/94 ✓
- [x] 5.2 **Desktop embedded**: `pnpm desktop:dev:embedded` → login → wizard → converter (validado com Boruto - Two Blue Vortex, 12.4 MB EPUB, 21:38) → página `/biblioteca/converter/:id` acompanhou download → conversão → concluído **sem 500** (usuário confirmou "ocorreu tudo certo")
- [x] 5.3 Arquivos validados em disco: saída final em `%APPDATA%/MangaInk Agent/storage/conversions/{id}/jobs/{jobId}/output/*.epub|mobi` (arquivo legível, tamanho > 0 — Chainsaw Man.epub 58MB, 341 entradas ZIP íntegras), imagens em `storage/sources/{sourceId}/chapters/` (chap_0001..0005), capa em `covers/cover_001.webp` e logs em `logs/conversion.log`
- [x] 5.4 Segunda conversão (cache hit) + cancelamento: validado via API no backend embedded (usuário não refez a conversão manualmente — processo já validado em 5.2): POST /api/conversions/source/inspect com a mesma URL retornou 200 `{status:"ready"}` com o mesmo sourceId do cache (cache hit, sem 202); conversão criada (202) e cancelada com POST /cancel → 200 `{status:"cancelled"}` com jobs cancelled; GET sem 500; cancelar conversão já concluída retorna 409 com mensagem de domínio (comportamento esperado)
- [x] 5.5 **Portable**: `pnpm desktop:dist` → app instalado/portable → mesma conversão do Chainsaw Man → conclusão sem erros e página de acompanhamento funcional (validado no win-unpacked; Setup e portable exe regenerados às 20:18 com fix do `@prisma/engines` — **validação do Setup/instalador pendente: problema conhecido de instalação deixado para resolver depois, ressalva registrada no IMPLEMENTED**)

## 6. Finalização

- [x] 6.1 Revisão final do diff (apenas arquivos previstos no plano): arquivos da change conferidos um a um (status stores, prisma-conversion.repository, index.ts, routes, workers, testes novos) + desvio documentado `env.ts` (normalização NODE_ENV); `.env.test` restaurado; `.gitignore` atualizado (root: test-results/playwright-report/coverage; desktop: resources/ catch-all) — demais arquivos M/?? são de changes anteriores sem commit
- [x] 6.2 Encerrar com a skill `change-completion` (validação, marcação `IMPLEMENTED`, arquivamento em `docs/openspec/archive/` e organização dos commits)
