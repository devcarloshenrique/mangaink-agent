# Implement Frontend Library — Design de Arquitetura

> **Status:** DONE
> **Data:** 2026-07-17

---

## 1. Motivação

O backend de conversão possui todos os endpoints de CRUD e processamento (criação via Planner, execução via BullMQ + KCC Docker, SSE fan-in, cancelamento), mas o frontend não tinha uma interface de biblioteca funcional. O usuário precisava de:

1. **Listagem real** das conversões feitas (agrupadas por obra/sourceId)
2. **Visualização das capas** sem precisar chamar endpoint adicional
3. **Leitura inline** dos formatos gerados (EPUB, PDF, CBZ)
4. **Ações** sobre conversões (cancelar, remover, reconverter)
5. **Reconversão rápida** a partir da biblioteca

Este design descreve como cada camada foi estendida para suportar essas funcionalidades.

## 2. Backend — Novos Endpoints

### 2.1. Listagem Paginada (`GET /api/conversions`)

```
Controller: list-conversions.controller.ts
Use-case:   ListConversionsUseCase
Repository: PrismaConversionRepository.listByUser()
```

Filtros suportados:
- `status`: string única ou múltipla separada por vírgula (`?status=queued,processing`)
- `sourceId`: filtra por source específica
- `page` / `limit`: paginação padrão (1 / 20, max 100)

O DTO usa `z.preprocess` para splitar status em array:
```typescript
z.preprocess(
  (val) => (typeof val === 'string' ? val.split(',').map(s => s.trim()) : val),
  z.array(z.enum(['queued','processing','completed','failed','cancelled','partial']))
)
```

O Prisma usa `where.status: { in: array }`.

### 2.2. Campo `cover` no Response

```typescript
// conversion.routes.ts — adicionado ao conversionSummarySchema:
cover: coverSchema.optional()
```

O schema `coverSchema` é exportado de `create-conversion.dto.ts` (discriminatedUnion com `original` | `gallery` | `upload`).

O repositório Prisma já retornava `cover` (select: `{ cover: true }`), mas o serializer Zod do Fastify stripava o campo por não estar no response schema.

### 2.3. Download de Job (`GET /.../jobs/:jobId/download`)

```
Controller: download-job.controller.ts
Use-case:   DownloadJobUseCase
```

Fluxo:
1. Valida ownership (`config.userId === userId`)
2. Busca o Job por `jobId`
3. Constrói o path: `{CONVERSIONS_STORAGE_PATH}/{conversionId}/jobs/{jobId}/output/{outputFile}`
4. Verifica existência do arquivo
5. Streama via `createReadStream` com headers:
   - `Content-Type`: mapeado pela extensão (`.epub` → `application/epub+zip`, etc.)
   - `Content-Disposition: attachment; filename="..."`

### 2.4. Serve Cover (`GET /source/:sourceId/covers/:coverId`)

```
Controller: serve-cover.controller.ts (público, sem auth)
Use-case:   ServeCoverUseCase
```

Fluxo:
1. Carrega `SourceMetadataFile` do `PrismaSourceRepository.load(sourceId)`
2. Procura a capa: se `coverId === 'original'`, busca `covers.find(c => c.type === 'original')` com fallback para `covers[0]`
3. Verifica cache em disco: `storage/sources/{sourceId}/covers/{coverId}.{ext}`
4. Se não existe, baixa do provider via `provider.downloadImage()` e cacheia
5. Streama com `Content-Type` da imagem e `Cache-Control: public, max-age=86400`

**Por que público (sem auth)?** Tags `<img src="...">` não conseguem enviar headers `Authorization`. A URL da capa não expõe dados sensíveis do usuário.

### 2.5. Delete (`DELETE /api/conversions/:id`)

Hard-delete: remove a linha da tabela `conversions` (cascade deleta jobs). Diferente de `POST /.../cancel` que apenas marca status.

### 2.6. Resposta `response.200` removida de endpoints binários

Endpoints de download e cover usam `reply.send(createReadStream(...))` que não é compatível com serialização Zod. Manter `200` no schema de resposta causava erro 500 no Swagger (`jsonSchemaTransform` tentava serializar `{ type: 'string', format: 'binary' }` como Zod). **Removido.**

## 3. Frontend — Estrutura de Camadas

```
src/
├── hooks/
│   ├── useConversions.ts        ← listagem + agrupamento
│   └── useConversionActions.ts  ← cancel/remove/download/reconvert
├── lib/
│   └── api.ts                   ← conversionsApi (extendido)
├── types/
│   └── conversion.ts            ← ConversionSummary (+ cover), etc.
├── routes/
│   ├── biblioteca.index.tsx     ← listagem agrupada com capas
│   ├── biblioteca.$sourceId.tsx ← detalhe da obra
│   ├── biblioteca.reader.$conversionId.tsx ← leitor multi-formato
│   └── wizard.tsx               ← validateSearch + reconvert prefill
```

### 3.1. Hooks

#### `useConversions`

```typescript
useConversionsList(params)      // TanStack Query → GET /api/conversions?...
useActiveConversions()          // status=["queued","processing"]
groupConversionsBySource(items) // agrupa ConversionSummary[] por sourceId
```

`SeriesGroup` inclui `items: ConversionSummary[]` para acesso direto às capas no componente.

#### `useConversionActions`

```typescript
useConversionActions() → {
  cancel(conversionId)      // POST /.../cancel + invalidate queries
  remove(conversionId)      // DELETE /.../:id + invalidate queries
  download(conversionId)    // window.open → /.../download
  reconvert(conversionId)   // navigate → /wizard?sourceId=&conversionId=
}
```

Todas as ações usam `queryClient.invalidateQueries({ queryKey: ['conversions'] })` para refetch automático.

### 3.2. Biblioteca Index — Grid/Lista com Capas

```
┌────────────────────────────────────────────────────┐
│ 🔍 Buscar...                   [Grade|Lista] [+ Novo] │
├────────────────────────────────────────────────────┤
│ 💬 "42 obras na sua estante."                      │
│                                                    │
│ [Todas (42)] [Em Andamento (3)] [Concluídas (39)]  │
│                                                    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│ │          │ │          │ │          │ │          ││
│ │  CAPA    │ │  CAPA    │ │  CAPA    │ │  CAPA    ││
│ │          │ │          │ │          │ │          ││
│ │ Chainsaw │ │  Jujutsu │ │  One Pie │ │  Bleach  ││
│ │          │ │          │ │          │ │          ││
│ │ 2 conv.  │ │ 5 conv.  │ │ 1 conv.  │ │ 3 conv.  ││
│ │ há 14min │ │ há 2h    │ │ há 1d    │ │ há 3d    ││
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘│
└────────────────────────────────────────────────────┘
```

Cards usam `ComicPanel` com `bg="yellow"` (fundo amarelo vibrante), `tilt` alternado (left/right), e capa preenchendo `aspect-[2/3]` sem padding interno. Título sobreposto no rodapé da imagem (`absolute bottom-0`).

### 3.3. Detalhe da Obra (`$sourceId`)

Lista todas as conversões daquela obra com:
- Capa (via `conversionsApi.coverUrl`)
- Título, status badge, progresso, jobs completed/total, tempo relativo
- Ações: log (ícone `ScrollText`), cancelar (se ativo), remover
- Link: se completed → leitor; se ativo → tela de progresso
- Botão "Reconverter" no header (usa a última conversão como base)

### 3.4. Leitor Multi-Formato

```
┌────────────────────────────────────────────────────┐
│ ← Chainsaw Man                                     │ ← toolbar (shrink-0)
├────────────────────────────────────────────────────┤
│                                                    │
│                                                    │ ← flex-1 (preenche altura)
│              [VIEWER]                              │
│                                                    │
│                                                    │
└────────────────────────────────────────────────────┘
```

Container externo usa `h-screen` (não `min-h-screen`) para garantir altura definida de 100vh. O `flex-1` recebe altura resolvida e repassa para o viewer.

#### EPUB Viewer

Abordagem com `ArrayBuffer` em vez de blob URL:
1. `fetch(url)` do blob → `res.arrayBuffer()`
2. Passa o `ArrayBuffer` diretamente para `<ReactReader url={arrayBuffer}>`
3. Props obrigatórias: `location={null}`, `locationChanged={() => {}}`

**Por que ArrayBuffer?** `epubjs` (usado pelo react-reader) pode falhar com blob URLs em Web Workers devido a restrições de cross-origin. `ArrayBuffer` evita completamente fetch interno do epubjs.

#### PDF Viewer

```tsx
<iframe src={blobUrl} className="w-full h-full border-0" />
```

O iframe herda altura do container `h-screen → flex-1 → h-full`.

#### CBZ Viewer

1. `fetch(blobUrl)` → blob
2. `JSZip.loadAsync(blob)` → extrai arquivos de imagem
3. Filtra por extensão (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`)
4. Converte cada imagem para blob URL
5. Renderiza galeria com navegação prev/next e contador

#### MOBI Fallback

Tela informativa: "Formato MOBI não pode ser visualizado no navegador" + botão `<a download>`.

### 3.5. Wizard Reconvert

```typescript
// wizard.tsx
export const Route = createFileRoute("/wizard")({
  validateSearch: z.object({
    sourceId: z.string().optional(),
    conversionId: z.string().optional(),
  }),
  component: WizardPage,
})
```

Se `conversionId` está presente:
1. `useEffect` carrega `conversionsApi.get(conversionId)` → obtém `config`
2. Carrega `scrapingApi.getSource(config.sourceId)` → metadados da obra
3. Preenche `wizardData` com: `sourceId`, `inspectData`, `selectedChapters`, `device`, `format`, `preset`, `options`
4. Salta para step 2 (capítulos) via `setStep(2)`

## 4. Decisões Técnicas

### 4.1. Por que `h-screen` e não `min-h-screen` no reader?

`min-h-screen` define apenas altura mínima, não altura definida. Em um flex column, `flex-1` precisa de um container com altura computada para distribuir espaço. Com `min-h-screen`, o container tem altura = max(conteúdo, 100vh), e o `flex-1` colapsa se o conteúdo interno for pequeno. `h-screen` = `height: 100vh` dá altura definida, resolvendo o `<iframe>` e o chain `h-full`.

### 4.2. Por que cover endpoint é público?

`<img src="...">` não suporta headers customizados como `Authorization: Bearer <token>`. A URL da capa (`/api/conversions/source/{sourceId}/covers/{coverId}`) não vaza dados do usuário — é uma imagem de uma obra pública.

### 4.3. Por que ArrayBuffer no EPUB e não blob URL?

`epubjs` usa Web Workers para parsing do ZIP. Workers podem ter restrições de cross-origin com `blob:` URLs. `ArrayBuffer` evita o fetch interno do epubjs e funciona deterministicamente.

### 4.4. Por que exportar `coverSchema` do DTO?

Evita duplicação. O schema já existe em `create-conversion.dto.ts` para validação de input. O mesmo schema (discriminatedUnion) é reutilizado no response schema, mantendo consistência entre input e output.

### 4.5. Por que `SeriesGroup` inclui `items`?

O componente `biblioteca.index.tsx` precisa acessar `group.items[0].cover` para renderizar a capa do grupo. Sem o array `items` no tipo, `group.items` é `undefined` e causa crash (`Cannot read properties of undefined (reading 'find')`).
