## ADDED Requirements

### Requirement: Listagem paginada de conversões por usuário
The system MUST expose `GET /api/conversions` returning paginated Conversions belonging to the authenticated user, ordered by creation date descending, with optional filters and pagination via query parameters.

#### Scenario: Listagem básica
- **WHEN** o usuário autenticado chama `GET /api/conversions?page=1&limit=20`
- **THEN** retorna 200 com `{ items: ConversionSummary[], total: number, page: number, limit: number }`
- **THEN** `items` contém apenas Conversions onde `conversions.user_id = <userId do JWT>`
- **THEN** `items` está ordenado por `created_at DESC`
- **THEN** cada item inclui `conversionId`, `sourceId`, `metadata.title`, `status`, `progress`, `totalJobs`, `completedJobs`, `failedJobs`, `createdAt`, `updatedAt`, `finishedAt`
- **THEN** não inclui snapshot `books`/`options`/`chapters` (payload pesado — usar `GET /api/conversions/:id` para detalhe)

#### Scenario: Filtro por status
- **WHEN** o usuário chama `GET /api/conversions?status=completed`
- **THEN** retorna apenas Conversions onde `conversions.status = 'completed'`
- **THEN** valores aceitos: `queued`, `processing`, `completed`, `failed`, `cancelled`, `partial`

#### Scenario: Filtro por sourceId
- **WHEN** o usuário chama `GET /api/conversions?sourceId=src-abc-123`
- **THEN** retorna apenas Conversions onde `conversions.source_id = 'src-abc-123'`

#### Scenario: Combinação de filtros
- **WHEN** o usuário chama `GET /api/conversions?status=completed&sourceId=src-abc-123&page=2&limit=10`
- **THEN** o adapter aplica `WHERE user_id=$1 AND status=$2 AND source_id=$3 ORDER BY created_at DESC LIMIT $4 OFFSET $5`
- **THEN** retorna apenas a página 2 (itens 11-20 pelo critério)

#### Scenario: Default de paginação
- **WHEN** o usuário chama `GET /api/conversions` sem `page` ou `limit`
- **THEN** `page=1` e `limit=20` são aplicados
- **THEN** `limit` máximo é 100 (recebe 400 se exceder)

#### Scenario: Lista vazia
- **WHEN** o usuário não possui Conversions
- **THEN** retorna 200 com `{ items: [], total: 0, page: 1, limit: 20 }`

#### Scenario: Usuário não vê conversions de outros
- **WHEN** dois usuários existem com Conversions distintas
- **THEN** a listagem do usuário A nunca retorna Conversions do usuário B
- **THEN** o filtro por `user_id` é sempre adicionado à query, mesmo se `sourceId`/`status` forem fornecidos

### Requirement: Autenticação obrigatória
The system MUST require JWT authentication for the listing endpoint.

#### Scenario: Sem token
- **WHEN** a request é feita sem Bearer token
- **THEN** retorna 401 Unauthorized

#### Scenario: Token inválido
- **WHEN** o token é inválido ou expirado
- **THEN** retorna 401 Unauthorized

#### Scenario: Token válido
- **WHEN** o token é válido
- **THEN** o `userId` é extraído do JWT e usado como filtro

### Requirement: Suporte requerido a backend Prisma
The listing endpoint MUST return HTTP 501 when `REPO_BACKEND=filesystem` because listing is not supported on filesystem repositories.

#### Scenario: Filesystem mode
- **WHEN** `REPO_BACKEND=filesystem` e o endpoint é chamado
- **THEN** retorna 501 com `{ error: { code: "LISTING_REQUIRES_PRISMA", message: "Listing requires REPO_BACKEND=prisma" } }`

#### Scenario: Prisma mode
- **WHEN** `REPO_BACKEND=prisma` e o endpoint é chamado
- **THEN** executa a query paginada e retorna 200

### Requirement: Schemas Zod para query params
The system MUST validate query parameters using Zod schemas with explicit defaults and limits.

#### Scenario: page inválido
- **WHEN** `page=0` ou `page=-1` ou `page=abc`
- **THEN** retorna 400 com erro de validação Zod

#### Scenario: limit inválido
- **WHEN** `limit=0` ou `limit=200`
- **THEN** retorna 400 (mínimo 1, máximo 100)

#### Scenario: status inválido
- **WHEN** `status=foo`
- **THEN** retorna 400 (status deve ser um dos valores enumerados)

#### Scenario: sourceId malformado
- **WHEN** `sourceId=` (vazio)
- **THEN** retorna 400 (string não-vazia obrigatória)