# Enhanced Chapter List — Tasks de Implementação

> **Status:** COMPLETED
> **Data:** 2026-07-28

---

## Ordem de Implementação

1. Backend: Schema + migration
2. Backend: Middleware `verifyJwtOptional`
3. Backend: Repositório + use-cases de reading
4. Backend: Rotas de reading + registro no server
5. Backend: `deleteCache()` no `ChapterImageService` + endpoint
6. Backend: Refatoração `GetSourceUseCase` com DI + injeção de `isRead`
7. Frontend: Tipos + API client
8. Frontend: Hook `useReadingProgress`
9. Frontend: Hook `useChapterCache`
10. Frontend: ReadButton funcional
11. Frontend: TabCapitulos (ordenação, filtros, indicadores visuais)
12. Frontend: TabCapitulos (dropdown download, toggle lido, seleção múltipla)
13. Frontend: Acessibilidade
14. Testes

---

## 1. Backend — Schema e Migration

- [x] 1.1 `prisma/schema.prisma` — Adicionar model `UserChapterProgress`:
  ```prisma
  model UserChapterProgress {
    id        String   @id @default(uuid()) @db.Uuid
    userId    String   @db.Uuid
    sourceId  String   @map("source_id") @db.VarChar(255)
    chapterId String   @map("chapter_id") @db.VarChar(100)
    readAt    DateTime @default(now()) @map("read_at") @db.Timestamptz()
    createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz()

    user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
    source  Source  @relation(fields: [sourceId], references: [sourceId], onDelete: Cascade)
    chapter Chapter @relation(fields: [sourceId, chapterId], references: [sourceId, chapterId], onDelete: Cascade)

    @@unique([userId, sourceId, chapterId])
    @@index([userId, sourceId])
    @@map("user_chapter_progress")
  }
  ```
- [x] 1.2 Adicionar relações inversas: `userProgress UserChapterProgress[]` no `User`, `readingProgress UserChapterProgress[]` no `Source` e `Chapter`
- [x] 1.3 Gerar migration via `pnpm db:migrate` com nome `add-user-chapter-progress`
- [x] 1.4 Verificar que migration `apply` funciona em banco limpo e com dados existentes

## 2. Backend — Middleware `verifyJwtOptional`

- [x] 2.1 `shared/middlewares/verify-jwt-optional.ts` — Criar middleware:
  - Tenta `request.jwtVerify()`
  - Se falhar, continua sem retornar 401
  - `request.user` permanece `undefined` se não autenticado

## 3. Backend — Módulo `reading`

- [x] 3.1 `types/reading.types.ts` — Definir interfaces: `ReadingProgress`, `MarkReadResult`, `UnmarkReadResult`, `BatchMarkReadInput`, `BatchMarkReadResult`
- [x] 3.2 `repositories/user-chapter-progress.repository.ts` — Interface + adapter Prisma:
  - `findByUserAndSource(userId, sourceId): Promise<UserChapterProgress[]>`
  - `findByUserAndSourceAndChapter(userId, sourceId, chapterId): Promise<UserChapterProgress | null>`
  - `create(data): Promise<UserChapterProgress>`
  - `delete(userId, sourceId, chapterId): Promise<void>`
  - `createMany(userId, sourceId, chapterIds): Promise<number>`
  - `deleteMany(userId, sourceId, chapterIds): Promise<number>`
  - `getLastReadAt(userId, sourceId): Promise<Date | null>`
  - `countByUserAndSource(userId, sourceId): Promise<number>`
- [x] 3.3 `use-cases/mark-read.use-case.ts` — Lógica: se já existe → retorna `{ isRead: true }` (idempotente); senão → create. Validar source + chapter existencia.
- [x] 3.4 `use-cases/unmark-read.use-case.ts` — Lógica: se existe → delete; senão → retorna `{ isRead: false }` (idempotente).
- [x] 3.5 `use-cases/get-progress.use-case.ts` — Buscar todos os registros do user+source, montar resposta agregada com `lastReadAt` e `totalChapters`
- [x] 3.6 `use-cases/batch-mark-read.use-case.ts` — Se `markAsRead: true` → `createMany` com `skipDuplicates`; `false` → `deleteMany`
- [x] 3.7 `dtos/reading.dto.ts` — Schemas Zod para params e responses:
  - `readingParamsSchema`: `{ sourceId: z.string() }`
  - `readingChapterParamsSchema`: `{ sourceId: z.string(), chapterId: z.string() }`
  - `batchMarkReadBodySchema`: `{ chapterIds: z.array(z.string()).min(1), markAsRead: z.boolean() }`
  - `readingProgressResponseSchema`, `markReadResponseSchema`, `batchMarkReadResponseSchema`
- [x] 3.8 `controllers/` — 4 controllers seguindo padrão Fastify + Zod provider:
  - `mark-read.controller.ts` (POST)
  - `unmark-read.controller.ts` (DELETE)
  - `get-progress.controller.ts` (GET)
  - `batch-mark-read.controller.ts` (PUT)
- [x] 3.9 `reading.routes.ts` — 4 rotas com `preHandler: verifyJwt`
- [x] 3.10 `shared/server.ts` — Registrar `readingRoutes` com prefixo `/api/reading`

## 4. Backend — DELETE Cache Endpoint

- [x] 4.1 `scraping/services/chapter-image.service.ts` — Adicionar método `deleteCache()`:
  ```typescript
  async deleteCache(): Promise<{ deleted: boolean; reason?: string }> {
    const cacheDir = this.getCacheDir()
    if (!(await pathExists(cacheDir))) {
      return { deleted: false, reason: 'cache_not_found' }
    }
    await rm(cacheDir, { recursive: true, force: true })
    return { deleted: true }
  }
  ```
- [x] 4.2 `scraping/chapter.routes.ts` — Adicionar `DELETE /api/sources/:sourceId/chapters/:chapterId/cache`:
  - `preHandler: verifyJwt`
  - Instancia `ChapterImageService` e chama `deleteCache()`
  - Retorna `{ deleted: true }` ou `{ deleted: false, reason: 'cache_not_found' }`
- [x] 4.3 `scraping/dtos/` — Schema Zod para params da rota de delete (reutilizar `sourceId` + `chapterId`)
- [x] 4.4 Verificar que `isDownloaded` recalcula corretamente após delete (filesystem check no `GetSourceUseCase` já faz isso)

## 5. Backend — Refatoração `GetSourceUseCase` + Injeção de `isRead`

- [x] 5.1 `scraping/types/source.types.ts` — Adicionar `isRead: boolean` ao tipo `Chapter`
- [x] 5.2 `scraping/use-cases/get-source.use-case.ts` — Refatorar para DI via construtor:
  ```typescript
  export class GetSourceUseCase {
    constructor(
      private readonly sourceRepository: SourceRepository,
      private readonly readingRepository?: UserChapterProgressRepository,
    ) {}

    async execute(sourceId: string, userId?: string): Promise<SourceInspectResponse>
  }
  ```
- [x] 5.3 `scraping/use-cases/get-source.use-case.ts` — Se `userId` disponível, buscar progresso via `readingRepository.findByUserAndSource()` e injetar `isRead` em cada capítulo
- [x] 5.4 `scraping/use-cases/get-source.use-case.ts` — Se `userId` ausente, `isRead: false` para todos os capítulos
- [x] 5.5 `scraping/scraping.routes.ts` — Adicionar `isRead: z.boolean()` ao `chapterSchema` Zod
- [x] 5.6 `scraping/scraping.routes.ts` — Adicionar `preHandler: [verifyJwtOptional]` no GET `/inspect/:sourceId`
- [x] 5.7 `scraping/scraping.routes.ts` — Instanciar `GetSourceUseCase` com `readingRepository` e passar `request.user?.sub` como `userId`
- [x] 5.8 Atualizar todos os callers existentes do `GetSourceUseCase` para usar o novo construtor (verificar testes e controllers)

## 6. Frontend — Tipos e API Client

- [x] 6.1 `types/scraping.ts` — Adicionar `isRead: boolean` ao tipo `Chapter`
- [x] 6.2 `types/reading.ts` — Criar tipos:
  ```typescript
  export interface ReadingProgress {
    sourceId: string
    readChapterIds: string[]
    totalRead: number
    totalChapters: number
    lastReadAt: string | null
  }

  export interface MarkReadResponse { isRead: true }
  export interface UnmarkReadResponse { isRead: false }
  export interface BatchMarkReadInput { chapterIds: string[]; markAsRead: boolean }
  export interface BatchMarkReadResponse { updatedCount: number; readChapterIds: string[] }
  export interface DeleteCacheResponse { deleted: boolean; reason?: string }
  ```
- [x] 6.3 `lib/api.ts` — Adicionar `readingApi`:
  - `markRead(sourceId, chapterId)` → `POST /api/reading/:sourceId/chapters/:chapterId`
  - `unmarkRead(sourceId, chapterId)` → `DELETE /api/reading/:sourceId/chapters/:chapterId`
  - `getProgress(sourceId)` → `GET /api/reading/:sourceId`
  - `batchMarkRead(sourceId, body)` → `PUT /api/reading/:sourceId/batch`
  - `deleteChapterCache(sourceId, chapterId)` → `DELETE /api/sources/:sourceId/chapters/:chapterId/cache`

## 7. Frontend — Hook `useReadingProgress`

- [x] 7.1 `hooks/useReadingProgress.ts` — Criar hook com 3 funções:
  - `useReadingProgress(sourceId)` — `useQuery` com `staleTime: 30_000` e `refetchOnWindowFocus: true`
  - `useToggleRead(sourceId)` — `useMutation` com optimistic update em **ambas** as queries (`reading-progress` e `source`) + rollback completo em `onError`
  - `useBatchMarkRead(sourceId)` — `useMutation` com invalidação de ambas as queries
- [x] 7.2 `hooks/useReadingProgress.test.ts` — Testes para:
  - Optimistic update correto em ambas as queries
  - Rollback em caso de erro
  - Cache invalidation após settled

## 8. Frontend — Hook `useChapterCache`

- [x] 8.1 `hooks/useChapterCache.ts` — Hook para gerenciar download/delete de cache:
  - `useDeleteCache(sourceId)` — `useMutation` com invalidação da query `source`
  - `useDownloadChapter(sourceId)` — reutiliza `useChapterDownload` existente

## 9. Frontend — ReadButton Funcional

- [x] 9.1 `components/biblioteca/ReadButton.tsx` — Substituir no-op por lógica real:
  - Props: `sourceId`, `readChapterIds: Set<string>`, `chapters: Chapter[]`, `isLoading: boolean`
  - Estado loading: exibir `Loader2` com `animate-spin`
  - Nenhum lido: label "Começar a ler", onClick → `navigate({ to: '/biblioteca/reader-chapter/$sourceId', params: { sourceId }, search: { chapterId: chapters[0].id } })`
  - Parcial: label "Continuar lendo cap X", onClick → navega para primeiro **não lido E baixado** (fallback: primeiro não lido; fallback: cap 1)
  - Todos lidos: label "Re-ler cap 1", onClick → cap 1
- [x] 9.2 `routes/biblioteca.$sourceId.tsx` — Passar `readChapterIds`, `chapters`, `isLoading` para `ReadButton`

## 10. Frontend — TabCapitulos: Ordenação, Filtros, Indicadores Visuais

- [x] 10.1 `TabCapitulos.tsx` — Novas props: `readChapterIds: Set<string>`, `onToggleRead: (chapterId: string, isRead: boolean) => void`
- [x] 10.2 `TabCapitulos.tsx` — Ordenação: botão toggle asc/desc no cabeçalho, `useMemo` com `.reverse()`
- [x] 10.3 `TabCapitulos.tsx` — Filtros rápidos: chips "Todos (N)", "Não lidos (M)", "Baixados (K)" com `useState<ChapterFilter>`. Contadores computados do array pré-filtro de busca.
- [x] 10.4 `TabCapitulos.tsx` — Indicadores visuais:
  - Capítulo lido: título `text-muted-foreground`, sem negrito
  - Capítulo não lido: título `font-semibold`, cor normal
- [x] 10.5 `TabCapitulos.tsx` — Ícone toggle lido (`Eye`/`EyeOff`):
  - Lido: `EyeOff` (cinza) → chama `onToggleRead(chapter.id, false)` (DELETE)
  - Não lido: `Eye` (cor padrão) → chama `onToggleRead(chapter.id, true)` (POST)

## 11. Frontend — TabCapitulos: Dropdown Download, Seleção Múltipla

- [x] 11.1 `TabCapitulos.tsx` — Substituir ícone estático de download por `DropdownMenu`:
  - Baixado: opções "Abrir" e "Apagar do disco"
  - Não baixado: opção "Baixar"
  - "Apagar do disco" chama `useDeleteCache` mutation + atualiza UI
- [x] 11.2 `TabCapitulos.tsx` — Modo seleção:
  - Estado: `selectionMode: boolean`, `selectedIds: Set<string>`
  - Ativação: botão "Selecionar" no cabeçalho (desktop + mobile) + long-press (>500ms) em linha (mobile apenas)
  - Checkbox à esquerda de cada linha (visível apenas em modo seleção)
  - Checkbox "Selecionar todos" no cabeçalho
  - Barra de ações flutuante (sticky bottom): "Marcar N como lidos", "Baixar N", "Apagar N do disco", "Cancelar"
- [x] 11.3 `TabCapitulos.tsx` — Ações em lote:
  - Batch mark read → `useBatchMarkRead` mutation
  - Batch download → loop sequencial com toast progressivo (`toast.loading` com atualização) + tratamento de falhas parciais
  - Batch delete → loop sequencial `deleteChapterCache` com toast progressivo
- [x] 11.4 `routes/biblioteca.$sourceId.tsx` — Passar novas props para `TabCapitulos`:
  - `readChapterIds` derivado do `useReadingProgress`
  - `onToggleRead` usando `useToggleRead` mutation

## 12. Frontend — Acessibilidade

- [x] 12.1 `TabCapitulos.tsx` — Adicionar aria-labels:
  - Checkboxes: `aria-label="Selecionar capítulo X"`
  - Checkbox "Selecionar todos": `aria-label="Selecionar todos os capítulos"`
  - Toggle lido: `aria-label="Marcar como lido"` / `aria-label="Desmarcar como lido"`, `aria-pressed`
  - Chips de filtro: `role="tab"`, `aria-selected`
  - Botão ordenação: `aria-label="Ordenar crescente"` / `aria-label="Ordenar decrescente"`
  - DropdownMenu: `aria-label="Ações de download para capítulo X"`
- [x] 12.2 `ReadButton.tsx` — Adicionar `aria-label` dinâmico baseado no estado

## 13. Testes

### Backend
- [x] 13.1 Testes unitários: `MarkReadUseCase` (marca novo, marca existente idempotente, chapter inexistente, source inexistente)
- [x] 13.2 Testes unitários: `UnmarkReadUseCase` (desmarca existente, desmarca inexistente idempotente)
- [x] 13.3 Testes unitários: `GetProgressUseCase` (vazio, parcial, completo, lastReadAt correto)
- [x] 13.4 Testes unitários: `BatchMarkReadUseCase` (marcar, desmarcar, ids inválidos, lista vazia, skipDuplicates)
- [x] 13.5 Testes unitários: `ChapterImageService.deleteCache()` (cache existe, não existe, diretório vazio)
- [x] 13.6 Testes unitários: `GetSourceUseCase` com `isRead` (autenticado com progresso, autenticado sem progresso, anônimo, sem readingRepository)
- [x] 13.7 Testes de integração: `verifyJwtOptional` (com token válido, sem token, token inválido)
- [x] 13.8 Atualizar testes existentes do `GetSourceUseCase` para o novo construtor

### Frontend
- [x] 13.9 Testes unitários: `TabCapitulos` — renderização com filtros, ordenação, indicadores lido
- [x] 13.10 Testes unitários: `TabCapitulos` — toggle lido (POST/DELETE), dropdown download
- [x] 13.11 Testes unitários: `TabCapitulos` — modo seleção, ações em lote
- [x] 13.12 Testes unitários: `ReadButton` — estados loading/nenhum/parcial/todos, navegação para primeiro não-lido-e-baixado
- [x] 13.13 Testes de integração: `useReadingProgress` — TanStack Query cache, optimistic update e rollback
- [x] 13.14 `pnpm lint` passa sem erros
- [x] 13.15 `pnpm test` (backend) todos os testes passam

---

## Resumo

| Camada | Arquivos Novos | Arquivos Modificados |
|---|---|---|
| Backend | 10 (módulo reading + middleware + migration) | 6 (schema, source types, get-source use-case, scraping routes, chapter routes, server) |
| Frontend | 3 (hooks, types) | 5 (TabCapitulos, ReadButton, $sourceId, api.ts, scraping types) |
| **Total** | **13** | **11** |
