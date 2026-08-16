# Test Isolation Cleanup — Proposta

> **Status:** DRAFT
> **Data:** 2026-08-16
> **Módulos:** `backend` (infra de testes) + tooling (scripts)

---

## 1. Problema

### 1.1. E2E sem isolamento de estado

Não existe rotina automática de limpeza de banco nos testes de integração/E2E: os 12 arquivos `*.e2e.test.ts` (distribuídos em `scraping/tests/e2e/` × 4, `conversion/tests/e2e/` × 7 e `auth/tests/e2e/` × 1) mockam 100% dos repositórios, mas quando um teste precisar de banco real não há garantia de estado vazio/previsível — dados persistem entre runs.

### 1.2. Ambiente de teste manual e propenso a erro

Incidente real: `apps/backend/.env` foi sobrescrito com `NODE_ENV=test`, o guard em `server.ts:202` pulou `initProviders()` e todos os workers, e o job de inspeção ficou preso na fila (sintoma: "Analisando obra…" para sempre). Não há separação unit/e2e (`pnpm test` roda tudo junto, exigindo Docker até para testes herméticos) e não há automação para criar/migrar o banco de teste (`mangaink_agent_test_db` não existe no docker-compose).

---

## 2. Solução Proposta

### 2.1. Hook global de limpeza (RF)

`apps/backend/src/shared/tests/db-cleanup.setup.ts` — setupFile do Vitest (e2e):

- `beforeEach` registrado em nível de módulo → executa antes de TODO teste, sem chamadas manuais nos arquivos de teste
- Limpeza massiva: `TRUNCATE TABLE t1, …, tN RESTART IDENTITY CASCADE` (1 instrução)
- Tabelas descobertas via `information_schema.tables` (schema `public`, `BASE TABLE`, cache por worker), excluindo `_prisma_migrations` e prefixo `_prisma_%`
- Guard rígido de isolamento: nome do banco DEVE terminar em `_test_db` e não pode estar na deny-list (`postgres`, `template*`, `mangaink_agent_db*`) — senão `throw`
- Cliente `pg` lazy singleton por worker, `afterAll` fecha conexão

### 2.2. Separação unitária × e2e

- `vitest.unit.config.ts` — base atual + `exclude` de e2e (testes herméticos, paralelos, SEM Docker) + `globalSetup` herdado do `vitest.globalSetup.ts` existente (diretórios temporários de storage)
- `vitest.e2e.config.ts` — `include: ['**/tests/e2e/**/*.e2e.test.ts']` (glob multi-módulo: scraping, conversion, auth) + `setupFiles` do cleanup + `globalSetup` herdado + `fileParallelism: false` (serial — isolamento real com banco compartilhado)

> **Nota:** o `vitest.globalSetup.ts` existente cria dirs temporários (`STORAGE_PATH`, `CONVERSIONS_STORAGE_PATH`) e DEVE ser preservado em ambos os configs — sem ele os testes de filesystem (download, conversão, MOBI preview) falham.

### 2.3. Ambiente automatizado

`scripts/prepare-test-db.mjs` (idempotente, via hook `pretest:e2e`):

1. `docker compose -f docker-compose.yml up -d` (Postgres+Redis, idempotente)
2. Readiness: retry de conexão Postgres (`pg`) + ping Redis (`ioredis`)
3. Garante `mangaink_agent_test_db` — conecta no DB default (`mangaink_agent_db`, não `postgres`) para executar `CREATE DATABASE IF NOT EXISTS` (o user `mangaink` do bitnami/postgresql tem ownership do default DB e privilege CREATEDB)
4. `prisma migrate deploy` (migrations pendentes)
5. `prisma generate` (client em dia com o schema)

### 2.4. Scripts e saneamento

| Script | Alvo | Conteúdo |
|---|---|---|
| `dev` | backend | `cross-env NODE_ENV=dev tsx watch src/app.ts` (mantido — defesa em profundidade contra `.env` corrompido) |
| `pretest:e2e` | backend | `node scripts/prepare-test-db.mjs` (hook automático) |
| `test:e2e` | backend | `vitest run -c vitest.e2e.config.ts` |
| `test:unit` | backend | `vitest run -c vitest.unit.config.ts` |
| `db:migrate:test` | backend | `cross-env DATABASE_URL=…_test_db prisma migrate deploy` |
| `test:unit` / `test:e2e` / `db:migrate:test` | root | aliases `--filter @mangaink/backend` |

---

## 3. Escopo

### Incluído

- [ ] `db-cleanup.setup.ts` (hook global + TRUNCATE + guard)
- [ ] `vitest.unit.config.ts` + `vitest.e2e.config.ts` (ambos herdam `globalSetup` existente)
- [ ] `scripts/prepare-test-db.mjs` + hook `pretest:e2e`
- [ ] Scripts `test:unit` / `test:e2e` / `db:migrate:test` (backend + root)
- [ ] Script `dev` mantém `cross-env NODE_ENV=dev` (defesa em profundidade)

### Excluído

- [ ] Migrar os 12 testes e2e existentes de mocks para banco real (fora de escopo; a infra fica pronta)
- [ ] Isolamento por schema/database por worker (parallel-safe) — usamos serial
- [ ] CI pipeline (GitHub Actions) — não existe hoje

---

## 4. Critérios de Aceitação (RF)

1. **Execução automática:** limpeza roda antes de cada teste e2e sem chamadas manuais nos arquivos de teste (hook de ciclo de vida)
2. **Limpeza otimizada:** todos os registros de todas as tabelas de domínio removidos em operação massiva única (TRUNCATE), sem exclusões linha a linha
3. **Relacionamentos:** FK resolvidas nativamente via `CASCADE`; sequências resetadas via `RESTART IDENTITY`
4. **Preservação:** `_prisma_migrations` (e `_prisma_%`) jamais truncada
5. **Isolamento:** guard rígido — operação aborta se o banco não for `*_test_db`
6. `pnpm test:unit` roda sem Docker (hermético)
7. `pnpm test:e2e` funciona com comando único (Docker → DB → migrate → generate → testes)

---

## 5. Dependências

- `pg` 8.x e `ioredis` (já são deps do backend — zero libs novas)
- `dotenv` (leitura de `.env.test` no prepare script)
- `cross-env` (permanece: uso em `db:migrate:test` + `dev`)
- `.env.test` (já existe — `mangaink_agent_test_db`, porta 3334)
