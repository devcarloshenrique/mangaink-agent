## Why

A "Biblioteca" está documentada como feature futura desde a change `conversions-job` (posta em `archive/conversions-job/spec.md` nota "Biblioteca (persistencia e CRUD)" como NOT YET IMPLEMENTED). Sem DB, listar conversões por usuário exigiria `readdir` + parse de N `config.json` em disco — inviável. Agora que `migrate-conversions-and-jobs-to-postgres` move configs/estado para Postgres com índice em `(user_id, created_at DESC)`, podemos habilitar listagem paginada, filtros por status e contagem agregada em O(log n) — pré-requisito para a tela `biblioteca.index.tsx` (frontend existe, hoje mock).

## What Changes

- **ADDED** Use case `apps/backend/src/modules/conversion/use-cases/list-conversions.use-case.ts` que pagina Conversions por `userId` com filtros opcionais (`status`, `sourceId`), ordenados por `createdAt DESC`.
- **ADDED** Controller `apps/backend/src/modules/conversion/controllers/list-conversions.controller.ts`.
- **ADDED** Rota `GET /api/conversions` em `conversion.routes.ts` — autenticada; valida `userId` do JWT.
- **ADDED** DTOs `apps/backend/src/modules/conversion/dtos/list-conversions.dto.ts` (Zod schema para query params `page`, `limit`, `status?`, `sourceId?`).
- **ADDED** Método `listByUser(userId, filters, pagination): Promise<{ items, total, page, limit }>` em `ConversionRepository` e adapters (`Filesystem*` levanta `Error("listing requires REPO_BACKEND=prisma")`; `Prisma*` implementa).
- **ADDED** Testes (unit + E2E) cobrindo paginação, filtros, ownership, lista vazia.

## Capabilities

### New Capabilities

- `conversion-library-listing`: capacidade de listar conversões por usuário em Postgres com filtros e paginação, base da tela de Biblioteca.

### Modified Capabilities

<!-- Nenhum — o endpoint novo não altera contratos das conversões existentes. -->

## Impact

- **Arquivos novos:** Use case, controller, DTO, rota extendida, testes.
- **Arquivos modificados:**
  - `apps/backend/src/modules/conversion/repositories/conversion.repository.ts` (interface + adiciona `listByUser`)
  - `apps/backend/src/modules/conversion/repositories/filesystem-conversion.repository.ts` (implementação que lança "not supported")
  - `apps/backend/src/modules/conversion/repositories/prisma-conversion.repository.ts` (implementação concreta)
  - `apps/backend/src/modules/conversion/conversion.routes.ts` (adiciona a rota)
- **Depende de:** `migrate-conversions-and-jobs-to-postgres` (Postgres-backed `ConversionRepository`).
- **Frontend impact:** Habilita a tela `biblioteca.index.tsx` a consumir dados reais. A implementação do consumo/estado TanStack Query fica fora desta change (futura change frontend).
- **Risco:** Se rodado em `REPO_BACKEND=filesystem`, o endpoint retorna 501 com mensagem clara ("listing requires Postgres backend").