## Context

A tela `biblioteca.index.tsx` no frontend existe, consome mocks. O backend não expõe listagem. A change `migrate-conversions-and-jobs-to-postgres` moveu configs para Postgres, mas falta o endpoint. Query por usuário é direta via índice `(user_id, created_at DESC)` (criado na change `add-prisma-schema-and-repo-composition`).

## Goals / Non-Goals

**Goals:**
- Habilitar listagem paginada filtrada por usuário.
- Garantir isolamento: cada usuário vê só suas conversões.
- Rejeitar filesystem mode com 501 claro.
- Validar com Zod os query params.

**Non-Goals:**
- Implementar o frontend (futura change).
- Implementar purge (`DELETE` como "remover do DB + binário") — cambio futuro.
- Implementar reconversão / CRUD de séries — futuro.
- Listagem de Sources (próxima change independente) — fora do escopo conforme plano.
- SSE / realtime progress — já existe.

## Decisions

### D1. Summary leve no endpoint de listagem
Retornar `items` sem `books`/`options`/`chapters` (que podem ser grandes). Frontend usa `GET /:id` quando usuário clica num item para ver detalhe. Mantém payload pequeno (~500 bytes por item).

### D2. Index compound em `user_id + created_at DESC`
Garantido pela change 1 (`@@index([userId, createdAt(sort: Desc)])`). Query é O(log n + limit).

### D3. 501 em filesystem mode explícito
Em vez de erro 500 genérico, retornamos 501 com `code: "LISTING_REQUIRES_PRISMA"`. Motivo: o contrato é claro — a feature exige Postgres; clientes podem distinguir de 500.

### D4. Filtros via Zod em query string
Pipeline: Fastify + `fastify-type-provider-zod` valida query → use-case recebe objetos tipados → adapter monta `WHERE` dinâmico. Nada de string interpolation; parametrizado via Prisma `where: { AND: [...] }`.

### D5. listByUser na interface, throwing em filesystem
A interface `ConversionRepository` ganha método `listByUser`. Adapter Filesystem lança `Error("listing requires REPO_BACKEND=prisma")`. Controller captura e mapeia para 501.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| N+1: incluir jobs em cada item | Não incluímos jobs no summary; apenas contadores escalares já em `conversions` (gravados por `syncStatus`) |
| Filtro por `source_id` sem índice | Índice em `conversions.source_id` é adicionado nesta change (se não criado na change 1) |
| Usuario com 10000+ conversions | Paginação default 20, máximo 100 — UI oferece paginação |
| Frontend pode quebrar se chamarendpoint antes do backend migrar | Contrato 501 é explícito no design; frontend pode tratar como estado "indisponível" |
| `appendLog` em modo Prisma ainda escrevendo no filesystem (definido em change 3) | Não afeta a listagem — log é secundário |