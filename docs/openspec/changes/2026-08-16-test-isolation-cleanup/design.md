# Test Isolation Cleanup — Design de Arquitetura

> **Status:** DRAFT
> **Data:** 2026-08-16

---

## 1. Motivação

Suíte de integração precisa de estado vazio e previsível por teste (RF) + ambiente de testes de um comando só (lição do incidente `NODE_ENV=test` no `.env`).

---

## 2. `db-cleanup.setup.ts`

### 2.1. Descoberta de tabelas (1× por worker)

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE '\_prisma\_%'     -- preserva _prisma_migrations
```

A lista é consultada uma única vez por fork (cache em variável de módulo) e reutilizada em todos os `beforeEach`.

### 2.2. Instrução executada por teste

> **Nota:** o SQL abaixo é ilustrativo — as tabelas são listadas pela query da seção 2.1 (dinâmico). A implementação monta a lista programaticamente a partir do cache.

```sql
TRUNCATE TABLE "User", "Source", "Chapter", "Cover", "Conversion",
  "ConversionJob", "UserPreset", "UserChapterProgress", "Provider"
RESTART IDENTITY CASCADE;
```

- `CASCADE` resolve FK nativamente (sem ordem de exclusão)
- `RESTART IDENTITY` reseta sequências → IDs previsíveis
- Tabelas vazias truncam sem erro — não precisa de condição

### 2.3. Guard de isolamento (antes de QUALQUER SQL destrutivo)

- `DATABASE_URL` lido via `dotenv.config({ path: '.env.test' })` (não sobrescreve env vars do processo)
- Validações, nessa ordem:
  1. URL parseável; senão `throw`
  2. Nome do banco termina em `_test_db`; senão `throw`
  3. Nome fora da deny-list (`postgres`, `template0`, `template1`, `mangaink_agent_db`, `mangaink_agent_db_mec54`); senão `throw`
- Mensagens de erro explícitas com o nome encontrado e o esperado
- Nenhum TRUNCATE é construído/executado sem o guard passar

### 2.4. Hooks

- `beforeEach(cleanup)` em escopo de módulo → aplicado a todos os testes e2e (semântica do `setupFiles` do Vitest)
- `afterAll(close client)` — cliente `pg` lazy singleton por fork (conexão única reutilizada)

---

## 3. Serialização (`fileParallelism: false`)

Com TRUNCATE por teste e forks paralelos, dois arquivos truncariam o mesmo banco enquanto o outro está no meio de um teste → flakiness e isolamento quebrado. Suíte com banco compartilhado **precisa** rodar serial.

- `vitest.e2e.config.ts`: `include: ['**/tests/e2e/**/*.e2e.test.ts']` (glob multi-módulo: scraping ×4, conversion ×7, auth ×1) + `fileParallelism: false` (um arquivo por vez; hooks `beforeEach` ainda rodam a cada teste)
- Custo: 12 arquivos e2e seriais — aceitável
- Unit continua paralelo (hermético, sem banco)

### 3.1. Preservação do `globalSetup` existente

O `vitest.globalSetup.ts` já existente cria diretórios temporários de storage (`STORAGE_PATH`, `CONVERSIONS_STORAGE_PATH`) e faz cleanup no `teardown`. **Ambos os configs** (unit e e2e) DEVEM manter `globalSetup: './vitest.globalSetup.ts'` — sem ele os testes de filesystem (download de capítulos, conversões, MOBI preview) falham com diretório inexistente.

> **Atenção:** `globalSetup` (Vitest `GlobalSetupContext`, roda 1× antes de todos os testes) ≠ `setupFiles` (roda por worker/thread). O `db-cleanup.setup.ts` é `setupFiles`; o `vitest.globalSetup.ts` é `globalSetup`. Ambos coexistem.

---

## 4. `prepare-test-db.mjs` — pipeline idempotente

```
docker compose -f docker-compose.yml up -d     (sobe se parado; nunca recria)
→ readiness Postgres (retry 10×1s via pg) + ping Redis (ioredis)
→ CREATE DATABASE mangaink_agent_test_db SE não existir
  (conecta no DB default `mangaink_agent_db`, NÃO no DB `postgres` —
   o user `mangaink` tem ownership do default DB e privilege CREATEDB
   na imagem bitnami/postgresql)
→ prisma migrate deploy  (env DATABASE_URL do .env.test no child)
→ prisma generate        (client em dia com o schema)
```

- Lê `.env.test` via `dotenv.config({ path: '.env.test' })` — sem sobrescrever env vars existentes (override manual vence)
- O Vitest já carrega `.env.test` via `envFile` na config; o `dotenv.config` no prepare-script NÃO conflita pois roda em processo separado (child do pnpm hook), não dentro do Vitest
- Rodado pelo hook `pretest:e2e` (pnpm executa `pre<script>` automaticamente)
- Falha rápida e clara em qualquer etapa (mensagens em PT-BR)

---

## 6. Fluxo de execução

```
pnpm test:unit   → vitest.unit.config.ts
                   globalSetup: vitest.globalSetup.ts (dirs temporários)
                   (sem Docker, paralelo)
pnpm test:e2e    → [pretest:e2e automático] prepare-test-db.mjs
                 → vitest.e2e.config.ts
                   globalSetup: vitest.globalSetup.ts (dirs temporários)
                   setupFiles: db-cleanup.setup.ts (TRUNCATE por teste)
                   (serial + include **/tests/e2e/**/*.e2e.test.ts)
```
