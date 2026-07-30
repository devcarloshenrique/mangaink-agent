# Enhanced Chapter List — Design de Arquitetura

> **Status:** COMPLETED
> **Data:** 2026-07-28

---

## 1. Motivação

Enriquecer a experiência do usuário na aba de capítulos com tracking de leitura, organização e ações rápidas. A base é o modelo `user_chapter_progress`, que habilita a maioria das funcionalidades.

---

## 2. Modelo de Dados

### 2.1. Nova Tabela: `user_chapter_progress`

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

**Decisão:** Cascade delete em todas as FKs. Se um source for removido, progresso some junto (consistente com o resto do schema).

**Relações inversas:** Adicionar `userProgress UserChapterProgress[]` ao model `User`, `readingProgress UserChapterProgress[]` ao model `Source`, e `readingProgress UserChapterProgress[]` ao model `Chapter`.

### 2.2. Campo `isRead` no tipo `Chapter`

```typescript
// Backend: scraping/types/source.types.ts
export interface Chapter {
  // ... existente
  isDownloaded: boolean
  isRead: boolean        // NOVO
}

// Frontend: types/scraping.ts — espelho
export interface Chapter {
  // ... existente
  isDownloaded: boolean
  isRead: boolean         // NOVO
}
```

`isRead` é injetado pelo `GetSourceUseCase` cruzando a lista de `chapterIds` lidos do `UserChapterProgressRepository.findByUserAndSource(userId, sourceId)`.

---

## 3. API

### 3.1. `POST /api/reading/:sourceId/chapters/:chapterId`

**Request:** sem body. Marca o capítulo como lido. **Idempotente:** se já existe registro, retorna 200 sem criar duplicata.

**Response `200`:**
```json
{ "isRead": true }
```

**Erros:**
- `404` se source não existe
- `404` se chapter não existe
- `401` se não autenticado

### 3.2. `DELETE /api/reading/:sourceId/chapters/:chapterId`

**Request:** sem body. Desmarca o capítulo como lido. **Idempotente:** se não existe registro, retorna 200.

**Response `200`:**
```json
{ "isRead": false }
```

**Erros:**
- `401` se não autenticado

### 3.3. `GET /api/reading/:sourceId`

**Response `200`:**
```json
{
  "sourceId": "abc123",
  "readChapterIds": ["chap_0001", "chap_0003"],
  "totalRead": 2,
  "totalChapters": 87,
  "lastReadAt": "2026-07-28T12:00:00Z"
}
```

`lastReadAt` = `MAX(readAt)` do usuário para aquele source. `null` se nenhum capítulo lido.

### 3.4. `PUT /api/reading/:sourceId/batch`

**Request body:**
```json
{
  "chapterIds": ["chap_0001", "chap_0002", "chap_0003"],
  "markAsRead": true
}
```

**Response `200`:**
```json
{
  "updatedCount": 3,
  "readChapterIds": ["chap_0001", "chap_0002", "chap_0003"]
}
```

Implementação: `createMany` com `skipDuplicates` quando `markAsRead: true`. `deleteMany` com `chapterId IN [...]` quando `markAsRead: false`.

### 3.5. `DELETE /api/sources/:sourceId/chapters/:chapterId/cache`

**Response `200`:**
```json
{ "deleted": true }
```

**Response `200` (cache não encontrado):**
```json
{ "deleted": false, "reason": "cache_not_found" }
```

Remove `storage/sources/{sourceId}/chapters/{chapterId}/` recursivamente via `fs.rm(path, { recursive: true })`. Implementado como método `deleteCache()` no `ChapterImageService` existente (não cria nova classe).

### 3.6. Modificação: `GET /api/conversions/source/inspect/:sourceId`

Adiciona campo `isRead: boolean` em cada item do array `chapters[]`:

```json
{
  "chapters": [
    {
      "id": "chap_0001",
      "number": "1",
      "title": "O Começo",
      "pages": 22,
      "isDownloaded": true,
      "isRead": true
    }
  ]
}
```

**Implementação:**

1. **Middleware `verifyJwtOptional`** (novo): tenta verificar o JWT; se falhar, continua sem retornar 401. Popula `request.user` como `undefined` se não autenticado.

```typescript
// shared/middlewares/verify-jwt-optional.ts
export async function verifyJwtOptional(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    // Não retorna 401 — apenas continua sem usuário
    // request.user permanece undefined
  }
}
```

2. **`GetSourceUseCase` refatorado com DI via construtor:**

```typescript
export class GetSourceUseCase {
  constructor(
    private readonly sourceRepository: SourceRepository,
    private readonly readingRepository?: UserChapterProgressRepository,
  ) {}

  async execute(sourceId: string, userId?: string): Promise<SourceInspectResponse> {
    const metadata = await this.sourceRepository.load(sourceId)
    if (!metadata) throw new SourceNotFoundError(sourceId)

    // Computa isDownloaded para cada capítulo
    const downloadedSet = await this.computeDownloadedChapters(sourceId, metadata.chapters)

    // Computa isRead se userId disponível
    const readSet = userId && this.readingRepository
      ? await this.computeReadChapters(userId, sourceId)
      : new Set<string>()

    const chapters: Chapter[] = metadata.chapters.map((ch) => ({
      ...ch,
      isDownloaded: downloadedSet.has(ch.id),
      isRead: readSet.has(ch.id),
    }))

    const { cache: _cache, ...response } = metadata
    return { ...response, chapters } as SourceInspectResponse
  }
}
```

3. **`chapterSchema` Zod atualizado** em `scraping.routes.ts`:

```typescript
const chapterSchema = z.object({
  id: z.string(),
  number: z.string(),
  title: z.string(),
  url: z.string(),
  pages: z.number().nullable(),
  volume: z.number().nullable(),
  isDownloaded: z.boolean(),
  isRead: z.boolean(),          // NOVO
})
```

4. **Rota atualizada** para usar `verifyJwtOptional`:

```typescript
app.get(
  '/api/conversions/source/inspect/:sourceId',
  {
    preHandler: [verifyJwtOptional],  // NOVO
    schema: { ... }
  },
  getSource,
)
```

---

## 4. Frontend

### 4.1. `useReadingProgress` hook

```typescript
// hooks/useReadingProgress.ts

function useReadingProgress(sourceId: string) {
  return useQuery({
    queryKey: ['reading-progress', sourceId],
    queryFn: () => readingApi.getProgress(sourceId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,  // Garante dados frescos ao voltar para a aba
  })
}

function useToggleRead(sourceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ chapterId, isRead }: { chapterId: string; isRead: boolean }) =>
      isRead
        ? readingApi.markRead(sourceId, chapterId)    // POST
        : readingApi.unmarkRead(sourceId, chapterId),  // DELETE
    onMutate: async ({ chapterId, isRead }) => {
      // Cancela queries em voo
      await queryClient.cancelQueries({ queryKey: ['reading-progress', sourceId] })
      await queryClient.cancelQueries({ queryKey: ['source', sourceId] })

      // Snapshot para rollback
      const previousProgress = queryClient.getQueryData(['reading-progress', sourceId])
      const previousSource = queryClient.getQueryData(['source', sourceId])

      // Optimistic update: reading-progress
      queryClient.setQueryData(['reading-progress', sourceId], (old) => {
        if (!old) return old
        const ids = new Set(old.readChapterIds)
        if (isRead) ids.add(chapterId)
        else ids.delete(chapterId)
        return { ...old, readChapterIds: [...ids], totalRead: ids.size }
      })

      // Optimistic update: source (isRead nos capítulos)
      queryClient.setQueryData(['source', sourceId], (old) => {
        if (!old) return old
        return {
          ...old,
          chapters: old.chapters.map(ch =>
            ch.id === chapterId ? { ...ch, isRead } : ch
          ),
        }
      })

      return { previousProgress, previousSource }
    },
    onError: (_err, _vars, context) => {
      // Rollback em caso de erro
      if (context?.previousProgress) {
        queryClient.setQueryData(['reading-progress', sourceId], context.previousProgress)
      }
      if (context?.previousSource) {
        queryClient.setQueryData(['source', sourceId], context.previousSource)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reading-progress', sourceId] })
      queryClient.invalidateQueries({ queryKey: ['source', sourceId] })
    },
  })
}

function useBatchMarkRead(sourceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { chapterIds: string[]; markAsRead: boolean }) =>
      readingApi.batchMarkRead(sourceId, payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reading-progress', sourceId] })
      queryClient.invalidateQueries({ queryKey: ['source', sourceId] })
    },
  })
}
```

### 4.2. Estados do `ReadButton`

| Estado | Condição | Label | Ação |
|---|---|---|---|
| Loading | Query pendente | `<Loader2 spin />` | — |
| Nenhum lido | `readChapterIds.size === 0` | "Começar a ler" | Navega para reader cap 1 |
| Progresso parcial | `0 < readChapterIds.size < total` | "Continuar lendo cap X" | Navega para primeiro **não lido E baixado** |
| Todos lidos | `readChapterIds.size === total` | "Re-ler cap 1" | Navega para reader cap 1 |

Encontrar "primeiro não lido E baixado":

```typescript
const firstUnread = chapters.find(
  ch => !readChapterIds.has(ch.id) && ch.isDownloaded
)
// Se não houver nenhum não-lido-baixado, fallback para primeiro não-lido
const target = firstUnread ?? chapters.find(ch => !readChapterIds.has(ch.id)) ?? chapters[0]
```

### 4.3. Ordenação

```typescript
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

const sorted = useMemo(() => {
  const list = [...filtered] // filtered = após filtro e busca
  if (sortOrder === 'desc') list.reverse()
  return list
}, [filtered, sortOrder])
```

Botão toggle no cabeçalho da lista:
```tsx
<button onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}>
  {sortOrder === 'asc' ? <ArrowDownUp /> : <ArrowUpDown />}
  {sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
</button>
```

### 4.4. Filtros Rápidos

```typescript
type ChapterFilter = 'all' | 'unread' | 'downloaded'
const [activeFilter, setActiveFilter] = useState<ChapterFilter>('all')

const filtered = useMemo(() => {
  let list = chapters
  // ... search query filter ...
  if (activeFilter === 'unread') list = list.filter(ch => !ch.isRead)
  if (activeFilter === 'downloaded') list = list.filter(ch => ch.isDownloaded)
  return list
}, [chapters, searchQuery, activeFilter, sortOrder])
```

Contadores são computados do array **pré-filtro de busca** (para refletir o total real, não o resultado da busca):

```typescript
const unreadCount  = chapters.filter(ch => !ch.isRead).length
const downloadCount = chapters.filter(ch => ch.isDownloaded).length
```

### 4.5. Menu Dropdown de Download

Ícone CheckCircle atual vira um trigger de `DropdownMenu`:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger aria-label={`Ações de download para capítulo ${chapter.number}`}>
    {chapter.isDownloaded ? <CheckCircle /> : <CloudOff />}
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {chapter.isDownloaded && (
      <>
        <DropdownMenuItem onClick={openReader}>Abrir</DropdownMenuItem>
        <DropdownMenuItem onClick={deleteCache}>Apagar do disco</DropdownMenuItem>
      </>
    )}
    {!chapter.isDownloaded && (
      <DropdownMenuItem onClick={download}>Baixar</DropdownMenuItem>
    )}
  </DropdownMenuContent>
</DropdownMenu>
```

### 4.6. Modo Seleção

Estado:
```typescript
const [selectionMode, setSelectionMode] = useState(false)
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
```

Ativado por:
- **Desktop:** Botão "Selecionar" no cabeçalho da lista
- **Mobile:** Long-press (>500ms) em qualquer linha de capítulo **ou** botão "Selecionar"

Checkbox aparece na esquerda de cada linha (antes do badge de número). Checkbox "Selecionar todos" no cabeçalho.

Barra de ações flutuante (sticky bottom do container):
```tsx
{selectionMode && selectedIds.size > 0 && (
  <div className="sticky bottom-4 ...">
    <Button onClick={batchMarkRead}>Marcar {selectedIds.size} como lidos</Button>
    <Button onClick={batchDownload}>Baixar {selectedIds.size} capítulos</Button>
    <Button onClick={batchDelete}>Apagar {selectedIds.size} do disco</Button>
    <Button variant="ghost" onClick={() => setSelectionMode(false)}>Cancelar</Button>
  </div>
)}
```

**Batch download com tratamento de falhas parciais:**
```typescript
const batchDownload = async () => {
  const ids = [...selectedIds]
  const toastId = toast.loading(`Baixando 0/${ids.length} capítulos...`)
  let failed = 0

  for (let i = 0; i < ids.length; i++) {
    toast.loading(`Baixando ${i + 1}/${ids.length} capítulos...`, { id: toastId })
    try {
      await chaptersApi.download(sourceId, ids[i])
    } catch {
      failed++
    }
  }

  setSelectionMode(false)
  setSelectedIds(new Set())

  if (failed === 0) {
    toast.success(`${ids.length} capítulos baixados`, { id: toastId })
  } else {
    toast.error(`${failed} de ${ids.length} downloads falharam`, { id: toastId })
  }

  queryClient.invalidateQueries({ queryKey: ['source', sourceId] })
}
```

### 4.7. Acessibilidade

Todos os componentes interativos devem ter atributos ARIA apropriados:

| Componente | Atributos |
|---|---|
| Checkbox de seleção | `aria-label="Selecionar capítulo X"` |
| Checkbox "Selecionar todos" | `aria-label="Selecionar todos os capítulos"` |
| Toggle lido/não lido (Eye/EyeOff) | `aria-label="Marcar como lido"` / `aria-label="Desmarcar como lido"`, `aria-pressed` |
| Chips de filtro | `role="tab"`, `aria-selected` |
| Botão ordenação | `aria-label="Ordenar crescente"` / `aria-label="Ordenar decrescente"` |
| DropdownMenu download | `aria-label="Ações de download para capítulo X"` |

---

## 5. Árvore de Componentes (modificados)

```
biblioteca.$sourceId.tsx (MODIFICADO)
├── busca readingApi.getProgress(sourceId) → readChapterIds
├── ReadButton (MODIFICADO — agora funcional)
│   ├── Loading: Loader2
│   ├── Nenhum lido: "Começar a ler" → cap 1
│   ├── Parcial: "Continuar lendo cap X" → primeiro não lido E baixado
│   └── Todos lidos: "Re-ler cap 1"
│
└── TabCapitulos (MODIFICADO)
    ├── readChapterIds: Set<string> (nova prop)
    ├── Ordenação: toggle asc/desc
    ├── Filtros: [Todos] [Não lidos] [Baixados] (chips com aria-selected)
    ├── SearchBar (existente)
    ├── Checkbox "Selecionar todos" (modo seleção, aria-label)
    └── Lista de capítulos:
        ├── [checkbox] (modo seleção, aria-label)
        ├── Badge número
        ├── Título (acinzentado se .isRead, bold se !.isRead)
        ├── Páginas
        ├── Eye/EyeOff toggle (aria-pressed, aria-label)
        └── DropdownMenu download (aria-label, substitui ícone estático)
    └── Barra ações em lote (sticky, condicional)
```

---

## 6. Estrutura de Arquivos

```
Novos:
├── apps/backend/src/
│   ├── modules/reading/                        ← NOVO módulo
│   │   ├── reading.routes.ts
│   │   ├── controllers/
│   │   │   ├── mark-read.controller.ts
│   │   │   ├── unmark-read.controller.ts
│   │   │   ├── get-progress.controller.ts
│   │   │   └── batch-mark-read.controller.ts
│   │   ├── use-cases/
│   │   │   ├── mark-read.use-case.ts
│   │   │   ├── unmark-read.use-case.ts
│   │   │   ├── get-progress.use-case.ts
│   │   │   └── batch-mark-read.use-case.ts
│   │   ├── repositories/
│   │   │   └── user-chapter-progress.repository.ts  (interface + Prisma adapter)
│   │   ├── dtos/
│   │   │   └── reading.dto.ts
│   │   └── types/
│   │       └── reading.types.ts
│   ├── shared/middlewares/
│   │   └── verify-jwt-optional.ts              ← NOVO middleware
│   └── prisma/migrations/...                   ← migration gerada
│
├── apps/frontend/src/
│   ├── hooks/useReadingProgress.ts             ← NOVO hook
│   ├── hooks/useChapterCache.ts                ← NOVO hook
│   └── types/reading.ts                        ← NOVO tipos

Modificados:
├── apps/backend/src/
│   ├── prisma/schema.prisma                    ← + UserChapterProgress + relações inversas
│   ├── modules/scraping/
│   │   ├── scraping.routes.ts                  ← + verifyJwtOptional, isRead no chapterSchema
│   │   ├── chapter.routes.ts                   ← + DELETE cache endpoint
│   │   ├── use-cases/get-source.use-case.ts    ← refatorado com DI + isRead
│   │   ├── services/chapter-image.service.ts   ← + deleteCache()
│   │   └── types/source.types.ts               ← + isRead
│   └── shared/server.ts                        ← + reading routes
│
├── apps/frontend/src/
│   ├── routes/biblioteca.$sourceId.tsx         ← + readingApi, ReadButton funcional
│   ├── components/biblioteca/ReadButton.tsx    ← + lógica de navegação
│   ├── components/biblioteca/TabCapitulos.tsx  ← + ordenação, filtros, seleção, dropdown, a11y
│   ├── lib/api.ts                              ← + readingApi
│   └── types/scraping.ts                       ← + isRead
```

---

## 7. Decisões de Design

| ID | Decisão | Justificativa |
|---|---|---|
| D1 | Tracking via PostgreSQL, não Redis | Leitura é persistente e de baixa frequência; Redis seria overkill |
| D2 | POST/DELETE separados em vez de toggle PUT | Idempotência HTTP: marcar duas vezes é seguro, desmarcar duas vezes também |
| D3 | `isRead` injetado no `GetSourceUseCase`, não endpoint separado | Evita N+1 no frontend; o source já retorna todos os capítulos |
| D4 | `reading` como módulo separado (não dentro de scraping) | Tracking de leitura é domínio próprio, reutilizável para outros contextos |
| D5 | Ordenação e filtros puramente no frontend | Dados já estão em memória (lista de capítulos ≤ 500 itens); backend seria latência desnecessária |
| D6 | Batch download sequencial (não paralelo) | Respeita rate limit do provider; evita sobrecarregar o Bottleneck |
| D7 | Optimistic update com rollback completo | UX instantânea; rollback restaura tanto `reading-progress` quanto `source` queries |
| D8 | Middleware `verifyJwtOptional` (novo) | Mantém endpoint público para preview, mas injeta `isRead` para usuários autenticados |
| D9 | `deleteCache()` no `ChapterImageService` existente | Evita criar nova classe; `ChapterImageService` já tem `getCacheDir()` e lógica de filesystem |
| D10 | `GetSourceUseCase` refatorado com DI via construtor | Permite injetar `UserChapterProgressRepository` sem quebrar testabilidade |
| D11 | ReadButton navega para primeiro não-lido E baixado | Evita levar o usuário a um capítulo que precisa ser baixado primeiro |
| D12 | `refetchOnWindowFocus: true` no reading-progress | Garante dados frescos ao voltar para a aba (resolve concorrência multi-aba) |
| D13 | Long-press apenas em mobile | Desktop usa apenas botão "Selecionar"; long-press não é intuitivo com mouse |

---

## 8. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| GET source público + `isRead` condicional | Requests anônimos nunca veem `isRead: true` | Middleware `verifyJwtOptional`; use-case checa `request.user?.sub` |
| Batch mark read com muitos capítulos | Query longa se 500+ capítulos | `createMany` + `deleteMany` são O(1) no Prisma |
| Batch download sequencial lento para muitos capítulos | UX de espera | Toast progressivo com contador; botão "Cancelar" para interromper |
| Migration em tabela existente | Zero — tabela nova sem impacto em dados existentes | Migration padrão do Prisma |
| `isRead` não definido no contrato existente do Source | Frontend quebra se campo não vier | `isRead: z.boolean()` adicionado ao `chapterSchema` Zod |
| `GetSourceUseCase` refatorado quebra callers existentes | Controllers que instanciam o use-case | Atualizar todos os callers para usar construtor |
| Concorrência multi-aba (marcar/desmarcar simultâneo) | Dados stale temporariamente | `refetchOnWindowFocus: true` + `staleTime: 30_000` |
| Falhas parciais em batch download | Usuário não sabe quais falharam | Toast com contagem de falhas; não interrompe o loop |
| Listas com 1000+ capítulos | Performance de renderização | Fora de escopo nesta iteração; virtualização futura |

---

## 9. Plano de Testes

### Backend
- Testes unitários para `MarkReadUseCase` (marca novo, marca existente idempotente, chapter inexistente)
- Testes unitários para `UnmarkReadUseCase` (desmarca existente, desmarca inexistente idempotente)
- Testes unitários para `GetProgressUseCase` (vazio, parcial, completo)
- Testes unitários para `BatchMarkReadUseCase` (marcar, desmarcar, ids inválidos, lista vazia)
- Testes unitários para `ChapterImageService.deleteCache()` (cache existe, não existe)
- Testes unitários para `GetSourceUseCase` com `isRead` (autenticado, anônimo, sem readingRepository)
- Testes de integração para `verifyJwtOptional` (com token, sem token, token inválido)

### Frontend
- Testes unitários para `TabCapitulos` com `readChapterIds`, filtros e ordenação
- Testes unitários para `TabCapitulos` — toggle lido, dropdown download
- Testes unitários para `TabCapitulos` — modo seleção, ações em lote
- Testes unitários para `ReadButton` — estados loading/nenhum/parcial/todos
- Testes de integração para `useReadingProgress` — TanStack Query cache, optimistic update e rollback
- Testes de acessibilidade — verificar aria-labels em todos os componentes interativos
