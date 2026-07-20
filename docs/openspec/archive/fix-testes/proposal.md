## Why

A suíte de testes apresenta 12 falhas em ambiente Windows (2 arquivos de teste, 0 falhas em Linux) causadas por strings de path hardcoded com separador POSIX (`/`) que não correspondem ao separador nativo do Windows (`\`). Além disso, 120+ diretórios residuais acumulam-se em `./storage/conversions/` após execuções consecutivas — os testes escrevem em paths de produção e nunca limpam. Por fim, o singleton `prisma.ts` inicializa uma conexão PostgreSQL no `import` do módulo, o que crasha toda a suíte se o banco não estiver disponível, mesmo para testes que não usam banco de dados.

## What Changes

- **MODIFIED** `apps/backend/src/modules/conversion/services/mobi-preview.service.test.ts` — mock de `env` e `fs/promises` passam a usar paths portáteis (via `path.join` nativo e normalização de chaves de storage map).
- **MODIFIED** `apps/backend/src/modules/conversion/tests/unit/serve-cover.use-case.test.ts` — mock de `STORAGE_PATH` usa `path.join(os.tmpdir(), ...)` e asserção de path usa `path.sep`.
- **MODIFIED** `apps/backend/.env.test` — adiciona `JWT_SECRET` completo e `STORAGE_PATH` baseado em `os.tmpdir()` (gerado no `globalSetup`).
- **ADDED** `apps/backend/vitest.globalSetup.ts` — gera diretório temporário único para storage de testes.
- **ADDED** `apps/backend/vitest.globalTeardown.ts` — remove o diretório temporário recursivamente.
- **MODIFIED** `apps/backend/vitest.config.ts` — registra `globalSetup` e `globalTeardown`.
- **MODIFIED** `apps/backend/src/shared/database/prisma.ts` — conexão PostgreSQL torna-se lazy para não crashar em testes que não usam banco.
- **MODIFIED** `.agents/skills/test-driven-development/SKILL.md` — adiciona seções sobre compatibilidade cross-platform, isolamento de recursos e singletons seguros.

## Capabilities

### New Capabilities

- `test-infrastructure`: infraestrutura de testes portátil com isolamento completo de filesystem, banco de dados e ambiente, com limpeza automática de artefatos.

### Modified Capabilities

<!-- Nenhum comportamento de produção é alterado — apenas a infraestrutura de teste. -->

## Impact

- **Arquivos novos:**
  - `apps/backend/vitest.globalSetup.ts`
  - `apps/backend/vitest.globalTeardown.ts`
- **Arquivos modificados:**
  - `apps/backend/.env.test`
  - `apps/backend/vitest.config.ts`
  - `apps/backend/src/modules/conversion/services/mobi-preview.service.test.ts`
  - `apps/backend/src/modules/conversion/tests/unit/serve-cover.use-case.test.ts`
  - `apps/backend/src/shared/database/prisma.ts`
  - `.agents/skills/test-driven-development/SKILL.md`
- **Risco:** Nenhum — muda apenas arquivos de teste e infraestrutura de teste. Código de produção inalterado.
- **Dependências:** Nenhuma.
