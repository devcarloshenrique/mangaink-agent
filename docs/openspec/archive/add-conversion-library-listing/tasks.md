## 1. Index Adicional (se necessário)

- [x] 1.1 Verificar se `conversions.source_id` tem índice na migration da change 1; se não, gerar migration adicional `add_conversions_source_id_index` nesta change (não mexer no index compound `(user_id, created_at DESC)` que já existe).

## 2. Interface e Adapters

- [x] 2.1 Adicionar à interface `ConversionRepository`: `listByUser(userId: string, filters: { status?: ConversionStatus; sourceId?: string }, pagination: { page: number; limit: number }): Promise<{ items: ConversionSummary[]; total: number; page: number; limit: number }>`.
- [x] 2.2 Adicionar tipo `ConversionSummary` no `conversion.types.ts` com campos planos (sem `books`/`options`/`chapters`).
- [x] 2.3 Implementar `listByUser` em `FilesystemConversionRepository` lançando `new RepositoryError("LISTING_REQUIRES_PRISMA", "Listing requires REPO_BACKEND=prisma")`.
- [x] 2.4 Implementar `listByUser` em `PrismaConversionRepository`:
  - `prisma.conversion.findMany({ where: { AND: [ { user_id: userId }, ...(status ? [{status}] : []), ...(sourceId ? [{source_id: sourceId}] : []) ] }, orderBy: { created_at: 'desc' }, skip: (page-1)*limit, take: limit })`
  - `prisma.conversion.count({ where: { ... } })` para `total`
- [x] 2.5 Garantir que o resultado `items` mapeia para `ConversionSummary` (sem `books`/`options`).

## 3. DTOs

- [x] 3.1 Criar `apps/backend/src/modules/conversion/dtos/list-conversions.dto.ts`:
  - `ListConversionsQuerySchema` com `z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), status: z.enum([...]).optional(), sourceId: z.string().min(1).optional() })`
- [x] 3.2 Exportar tipo `ListConversionsQuery` inferido.

## 4. Use Case

- [x] 4.1 Criar `apps/backend/src/modules/conversion/use-cases/list-conversions.use-case.ts`:
  - Recebe `userId` (do JWT) + `ListConversionsQuery` + `ConversionRepository`
  - Chama `repository.listByUser(userId, { status, sourceId }, { page, limit })`
  - Captura `RepositoryError` com `code: "LISTING_REQUIRES_PRISMA"` e relança como `ListingNotSupportedError`
- [x] 4.2 Criar `apps/backend/src/modules/conversion/errors/conversion.errors.ts` adicional: `ListingNotSupportedError` com code `LISTING_REQUIRES_PRISMA` mapeado para HTTP 501 (integrar no error handler).

## 5. Controller e Rota

- [x] 5.1 Criar `apps/backend/src/modules/conversion/controllers/list-conversions.controller.ts`:
  - Extrai `userId` do `request.user.sub` (JWT)
  - Aplica o query schema Zod
  - Chama o use-case
  - Retorna 200 com `{ items, total, page, limit }`
- [x] 5.2 Adicionar em `apps/backend/src/modules/conversion/conversion.routes.ts`: `server.get('/api/conversions', { schema: { querystring: ListConversionsQuerySchema }, preHandler: [verifyJwt] }, listConversionsController)`.
- [x] 5.3 Garantir que a rota NÃO conflita com `/api/conversions/options` (Fastify matching: paths exatos têm prioridade; ordem de registro importa — registrar `/options` antes ).

## 6. Error Handler Global

- [x] 6.1 Em `apps/backend/src/shared/server.ts`, mapear `ListingNotSupportedError.code === 'LISTING_REQUIRES_PRISMA'` → HTTP 501.
- [x] 6.2 Garantir que 400 (Zod) e 401 (verifyJwt) continuam funcionando.

## 7. Testes

- [x] 7.1 Teste unitário `list-conversions.use-case.test.ts`:
  - 3 conversões usuários A e 1 do B → listar de A retorna 3 (não vê B)
  - Filtro `status=completed` retorna apenas as completed
  - Filtro `sourceId=src-x` retorna apenas src-x
  - Paginação page=1 limit=2 retorna 2 items; page=2 retorna 1 item; total=3
  - Lista vazia retorna `{ items: [], total: 0, page: 1, limit: 20 }`
  - Em filesystem mode lança `ListingNotSupportedError`
- [x] 7.2 Teste E2E na rota `GET /api/conversions`:
  - Sem token → 401
  - Token válido → 200 com shape
  - Query inválida (`limit=200`) → 400
- [x] 7.3 Testar cenário ownership: dois usuários logados veem apenas suas próprias conversões.

## 8. Validação

- [x] 8.1 `pnpm build:backend` sem erros.
- [x] 8.2 `pnpm test` — todos passam.
- [x] 8.3 Smoke em `REPO_BACKEND=prisma`: criar 5 conversões para usuário A e 2 para B → `GET /api/conversions` com token A retorna 5; com token B retorna 2.
- [x] 8.4 Smoke em `REPO_BACKEND=filesystem`: `GET /api/conversions` retorna 501 com payload de erro.