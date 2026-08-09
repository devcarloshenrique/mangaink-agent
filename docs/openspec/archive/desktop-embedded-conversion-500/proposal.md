## Why

Bug real reportado no app desktop: ao converter um mangá (reproduzido com `https://mangalivre.to/manga/chainsaw-man-pt-br/`), a página de acompanhamento da conversão (`/biblioteca/converter/:conversionId`) termina com o erro **"Conversão não encontrada / Internal Server Error / Voltar"** — tanto no modo `desktop:dev:embedded` quanto na versão portable empacotada.

Causa raiz: `PrismaConversionRepository.syncStatus()` constrói `new JobLiveStatusStore()` **sem injeção** (default = `RedisStatusStoreAdapter`). No modo embedded (`MI_EMBEDDED_MODE=1`), o client Redis é lazy e `createSafeRedis()` lança `"Redis não disponível no modo embedded"` na primeira operação → `syncStatus` propaga erro não-domínio → error handler global devolve **500 `Internal Server Error`** → o frontend renderiza a tela de erro. O 500 dispara sempre que existe **pelo menos um job não-terminal** (queued/downloading/converting) — exatamente o momento em que o wizard abre a página após criar a conversão. A conversão em si continua rodando em background (os `sync()` do worker são `catch`-swallowed), mas a UI já está na tela de erro.

Os workers (`conversion-job`, `download-only`, `mobi-preview`) e o cancelamento já injetam `runtime.status` corretamente — o repositório de conversão ficou fora do composition root. Os testes E2E embedded não detectaram o bug porque mockam `getConversionRepository()` com repositório in-memory, nunca exercitando o caminho real do Prisma.

Complemento: não há documentação de **onde ficam os arquivos baixados e gerados pela conversão**, o que dificulta a validação manual (pedido explícito do usuário).

## What Changes

- **Default seguro por modo dos status stores**: `JobLiveStatusStore` (e `MobiPreviewStatusStore`, por simetria) passam a selecionar o adapter por env no default do construtor — `InMemoryStatusStore` quando `MI_EMBEDDED_MODE=1`, `RedisStatusStoreAdapter` caso contrário. Qualquer construção sem injeção passa a funcionar em embedded (rede de segurança para usos futuros) e preserva o comportamento web.
- **Injeção do status store no repositório de conversão**: `PrismaConversionRepository` ganha construtor com `statusStore?: IStatusStore`; `syncStatus()` passa a usar `new JobLiveStatusStore(statusStore)`. A factory `getConversionRepository(statusStore?)` repassa o store; os composition roots (rotas de conversion e workers de conversão/download-only) passam `runtime.status`, compartilhando a **mesma instância in-memory** dos workers — sem isso o GET perderia o progresso live durante o processamento.
- **Testes**: unitários (seleção de default por modo; `syncStatus` sem throw em embedded com jobs não-terminais e merge do progresso live) + E2E embedded de regressão com `getPrisma()` fake (exercita o caminho real: rotas → use-case → repositório → status store), cobrindo GET 200 com job não-terminal, logs e cancelamento.
- **Documentação**: seção em `CLAUDE.md` com a árvore de armazenamento de arquivos (desktop embedded/portable e stack web).

## Capabilities

### New Capabilities

- `embedded-conversion-status-store`: status stores com default seguro por modo (`MI_EMBEDDED_MODE`), `syncStatus` do repositório de conversão sem Redis em embedded e instância de status compartilhada entre workers e rotas via composition root, com cobertura de teste unitária e E2E.

### Modified Capabilities

- `backend-inprocess-runtime` (change `desktop-portable-runtime`): a regra "no modo embedded o composition root injeta a versão in-memory" passa a valer também para o repositório de conversão (`PrismaConversionRepository.syncStatus`), hoje o único consumidor de `JobLiveStatusStore` fora da injeção.

## Impact

- **`apps/backend/src/shared/redis/`**: `job-status-store.ts` e `mobi-preview-status-store.ts` (default env-aware) + testes.
- **`apps/backend/src/modules/conversion/repositories/`**: `prisma-conversion.repository.ts` (construtor + `syncStatus`) + novo teste unitário.
- **`apps/backend/src/shared/database/repositories/index.ts`**: `getConversionRepository(statusStore?)`.
- **`apps/backend/src/modules/conversion/`**: `conversion.routes.ts` (buildConversionDeps), `conversion-job.worker.ts`, `download-only.worker.ts` (passam `runtime.status`); novo E2E `embedded-get-conversion.e2e.test.ts`.
- **`apps/desktop`**: sem mudança de código — apenas validação manual como gate (modo `desktop:dev:embedded` e portable).
- **`CLAUDE.md`**: nova seção de armazenamento de arquivos.

## Non-goals

- Não altera o modelo de persistência (Postgres/Prisma continua a fonte de verdade).
- Não muda a stack web (Redis/BullMQ/Docker) — comportamento atual preservado integralmente.
- Não introduz novos endpoints nem mudanças de contrato da API.
