# Test Isolation Cleanup — Tasks de Implementação

> **Status:** DRAFT
> **Data:** 2026-08-16

---

## Ordem de Implementação

1. Setup de limpeza (hook global)
2. Configs Vitest (unit/e2e) + preservação do globalSetup existente
3. Script de preparação de ambiente + hooks npm
4. Scripts npm (backend + root)
5. Verificação end-to-end

---

## 1. Limpeza automatizada

- [ ] 1.1 Criar `apps/backend/src/shared/tests/db-cleanup.setup.ts`
- [ ] 1.2 Guard de isolamento: assert `*_test_db` + deny-list (throw com URL de dev)
- [ ] 1.3 Cache de lista de tabelas por worker (module-level)
- [ ] 1.4 TRUNCATE único com CASCADE + RESTART IDENTITY, excluindo `_prisma_%`
- [ ] 1.5 `beforeEach` + `afterAll` (client `pg` lazy)

## 2. Configs Vitest

- [ ] 2.1 `apps/backend/vitest.unit.config.ts` — base + exclude e2e + `globalSetup: './vitest.globalSetup.ts'`
- [ ] 2.2 `apps/backend/vitest.e2e.config.ts` — `include: ['**/tests/e2e/**/*.e2e.test.ts']` (glob multi-módulo) + setupFiles + `globalSetup: './vitest.globalSetup.ts'` + `fileParallelism: false`
- [ ] 2.3 Confirmar que ambos os configs preservam o `vitest.globalSetup.ts` (dirs temporários de storage)
- [ ] 2.4 Rodar `pnpm test:unit` (sem Docker) — testes passam

## 3. Ambiente automatizado

- [ ] 3.1 `apps/backend/scripts/prepare-test-db.mjs` — docker up → readiness → CREATE DATABASE (conecta via `mangaink_agent_db`, não `postgres`) → migrate deploy → generate
- [ ] 3.2 Hook `pretest:e2e` no package.json do backend

## 4. Scripts

- [ ] 4.1 Backend: `test:unit`, `test:e2e`, `db:migrate:test` (script `dev` mantém `cross-env NODE_ENV=dev` — inalterado)
- [ ] 4.2 Root: aliases `test:unit`, `test:e2e`, `db:migrate:test`

## 5. Verificação

- [ ] 5.1 `pnpm test:unit` — sem Docker
- [ ] 5.2 Inserir linha fake via psql no test DB → `pnpm test:e2e` → linha removida após o 1º teste (prova do TRUNCATE)
- [ ] 5.3 `pnpm test:e2e` com containers parados — sobe sozinho e passa
- [ ] 5.4 `pnpm dev` — backend boota com workers e providers seeded

---

## Resumo

| Camada | Arquivos |
|--------|----------|
| Criados | 3 (`db-cleanup.setup.ts`, `vitest.unit.config.ts`, `vitest.e2e.config.ts`, `prepare-test-db.mjs`) |
| Modificados | 2 (`apps/backend/package.json`, root `package.json`) |
| Inalterados (preservados) | 1 (`vitest.globalSetup.ts` — herdado por ambos configs) |
| **Total alterados** | **5** (+ 4 docs OpenSpec desta change) |
