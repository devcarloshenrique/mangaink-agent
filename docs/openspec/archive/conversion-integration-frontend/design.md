# Conversion Integration Frontend — Design de Arquitetura

> **Status:** DONE
> **Data:** 2026-07-11

---

## 1. Motivação

O backend de scraping e conversão está 100% implementado e testado (76 testes, 6 endpoints de conversão, 4 de scraping). O frontend, porém, opera inteiramente com mocks — `mockFetchSeries()` gera dados fictícios e `useConversion` simula progresso com `setTimeout`.

Este design descreve como substituir os mocks por chamadas reais, conectando o wizard aos endpoints já existentes, mantendo mocks apenas onde o backend ainda não oferece a funcionalidade (tempo estimado, preview de página, envio Kindle, download).

## 2. Camada de Cliente API

### 2.1. Extensão de `lib/api.ts`

O arquivo `lib/api.ts` já possui `request()` com injeção automática de JWT e tratamento de erros (`ApiError`). Vamos estendê-lo:

```
lib/api.ts
├── request<T>()              ← já existe (fetch + JWT)
├── authApi                    ← já existe
├── userApi                    ← já existe
├── scrapingApi                ← NOVO
│   ├── inspect(url, refresh?)
│   ├── getSource(sourceId)
│   ├── listProviders()
│   └── inspectEvents(sourceId, handlers) → close()
└── conversionsApi             ← NOVO
    ├── getOptions()           ← público (sem auth)
    ├── create(body)
    ├── get(conversionId)
    ├── cancel(conversionId)
    └── events(conversionId, handlers) → close()
```

### 2.2. Suporte a SSE

O `EventSource` nativo do browser não suporta headers customizados (necessário para JWT). Duas opções:

**Opção A — `fetch` streaming (recomendada):** Usa `fetch` com `Accept: text/event-stream` e lê o stream manualmente com `ReadableStream` + `TextDecoder`. Permite injetar `Authorization: Bearer <token>`.

**Opção B — Query param:** Passar o token como query param `?token=...` e usar `EventSource` nativo. Menos seguro (token em URL/logs).

> **Decisão:** Opção A. Implementar um utilitário `createSSEStream(url, handlers, token?)` que retorna `{ close() }`. Reutilizável para scraping e conversão.

```typescript
function createSSEStream(
  url: string,
  handlers: {
    onEvent: (event: string, data: any) => void
    onError?: (error: Error) => void
  },
  token?: string,
): { close: () => void }
```

O SSE do scraping (`/source/inspect/:id/events`) NÃO requer auth (frontend chama sem token). O SSE de conversão (`/:id/events`) REQUER auth (token injetado).

### 2.3. Tipos TypeScript

Criar `src/types/conversion.ts` e `src/types/scraping.ts` espelhando os tipos do backend:

```
types/
├── auth.ts          ← já existe
├── scraping.ts      ← NOVO
│   ├── SourceInspectResponse
│   ├── MangaMetadata
│   ├── Chapter
│   ├── Cover
│   ├── Statistics
│   └── ProviderInfo
└── conversion.ts    ← NOVO
    ├── ConversionOptions
    ├── ConversionField
    ├── ConversionPreset
    ├── DeviceProfile
    ├── OutputFormat
    ├── CoverRef
    ├── Book
    ├── ConversionState
    ├── ConversionJobSummary
    ├── ConversionStatus
    ├── JobStatus
    └── SSEEventType
```

## 3. Hooks

### 3.1. `useScraping`

```
hooks/useScraping.ts (NOVO)
```

```typescript
interface UseScraping {
  inspect: (url: string, refresh?: boolean) => Promise<void>
  state: {
    sourceId: string | null
    status: 'idle' | 'processing' | 'ready' | 'failed'
    progress: number
    message: string | null
    metadata: SourceInspectResponse | null
    error: string | null
  }
  reset: () => void
}
```

**Fluxo:**

```
inspect(url)
  │
  ├─ POST /source/inspect → { sourceId, status }
  │
  ├─ status === "ready" (200)
  │   └─ GET /source/inspect/:sourceId → metadata
  │   └─ state = { status: "ready", metadata }
  │
  └─ status === "processing" (202)
      └─ createSSEStream(/source/inspect/:sourceId/events)
          ├─ onEvent("progress", { stage, message, progress })
          │   └─ state = { status: "processing", progress, message }
          ├─ onEvent("completed", { sourceId })
          │   └─ GET /source/inspect/:sourceId → metadata
          │   └─ state = { status: "ready", metadata }
          │   └─ close()
          └─ onEvent("failed", { message })
              └─ state = { status: "failed", error: message }
              └─ close()
```

**Cleanup:** `useEffect` com `return () => close()` para fechar SSE ao desmontar.

### 3.2. `useConversionOptions`

```
hooks/useConversionOptions.ts (NOVO)
```

```typescript
interface UseConversionOptions {
  data: ConversionOptions | null
  isLoading: boolean
  isError: boolean
}
```

Usa TanStack Query com `staleTime: Infinity` (o catálogo raramente muda). Endpoint público (sem auth).

### 3.3. `useConversionProgress`

```
hooks/useConversionProgress.ts (NOVO)
```

```typescript
interface UseConversionProgress {
  state: ConversionState | null
  isLoading: boolean
  error: string | null
  cancel: () => Promise<void>
  isCancelled: boolean
}
```

**Fluxo:**

```
mount(conversionId)
  │
  ├─ GET /api/conversions/:conversionId → estado inicial
  │   └─ se status já terminal (completed/failed/cancelled) → não conecta SSE
  │
  ├─ se status NÃO terminal:
  │   └─ createSSEStream(/api/conversions/:conversionId/events, token)
  │       ├─ onEvent("job.started", { jobId })
  │       │   └─ marca Job como ativo no estado local
  │       ├─ onEvent("download.progress", { jobId, downloadedImages, totalImages })
  │       │   └─ atualiza progresso de download do Job
  │       ├─ onEvent("conversion.progress", { jobId, progress })
  │       │   └─ atualiza progresso de conversão do Job
  │       ├─ onEvent("job.finished", { jobId, outputFile, outputSize })
  │       │   └─ marca Job como completed
  │       │   └─ GET /:conversionId → re-sincroniza estado agregado
  │       ├─ onEvent("job.failed", { jobId, error })
  │       │   └─ marca Job como failed
  │       │   └─ GET /:conversionId → re-sincroniza estado agregado
  │       └─ se todos Jobs terminais → close()
  │
  └─ cancel()
      └─ DELETE /api/conversions/:conversionId
      └─ close()
      └─ state = { status: "cancelled" }
```

## 4. Transformação do Wizard

### 4.1. Estado `WizardData` (atualizado)

```typescript
interface WizardData {
  // Step 1 — Origem
  sourceId: string | null          // NOVO (do scraping real)
  url: string
  inspectData: SourceInspectResponse | null  // NOVO (substitui `series`)

  // Step 2 — Capítulos
  selectedChapters: Set<string>    // IDs reais do scraping
  grouping: "single" | "separate"
  volumeSize: number
  volumeMode: "fixed" | "custom"
  volumeSizes: number[]

  // Step 3 — Capas (simplificado)
  // Removido: coverMode, coverAssignments
  // Sempre cover: { kind: "original" }

  // Step 4 — Configurações
  device: string                   // ID do catálogo dinâmico
  format: string                   // ID do catálogo dinâmico
  preset: string                  // ID do catálogo dinâmico
  options: Record<string, string | number | boolean>  // NOVO — valores dos fields
  meta: { title: string; author: string }

  // Step 5 — Envio
  delivery: "download" | "kindle"  // download = marcar opção; kindle = mocado
  kindleEmail: string
  // Removido: cost, credits, enoughCredits
}
```

### 4.2. Step 1 — Origem

Substituir `mockFetchSeries()` por `useScraping.inspect(url)`:

```tsx
function StepOrigin() {
  const { state: scraping, inspect, reset } = useScraping()

  // "Buscar" → inspect(url)
  // Exibe progresso do SSE durante "processing"
  // Ao concluir, exibe:
  //   - Título: scraping.metadata.metadata.title
  //   - Total de capítulos: scraping.metadata.statistics.chapters
  //   - NÃO exibe volumes
  // Armazena sourceId e inspectData no WizardData
}
```

### 4.3. Step 2 — Capítulos

Usa `inspectData.chapters` (reais) em vez de `series.chapters` (mock):

```tsx
const chapters = data.inspectData?.chapters ?? []
// Cada capítulo: { id, number, title, url, pages, volume }
// pages pode ser null → exibir "—" ou "N páginas"
// volume pode ser null → agrupamento por volume continua funcionando (front-end computa)
```

### 4.4. Step 3 — Capas (simplificado)

Remove os 3 modos e o dialog. Apenas exibe uma confirmação visual:

```tsx
function StepCovers() {
  return (
    <ComicPanel bg="yellow">
      <h2>Capas</h2>
      <p>Uma só capa será aplicada a todos os volumes.</p>
      <ChoiceCard active title="Uma só capa" text="Usa a capa original da obra." />
      {/* Sem dialog, sem galeria, sem upload */}
    </ComicPanel>
  )
}
```

### 4.5. Step 4 — Configurações dinâmicas

Substitui `kindle-presets.ts` hardcodado por `useConversionOptions`:

```tsx
function StepConvert() {
  const { data: options } = useConversionOptions()

  // Device Select: options.devices.map(d => <SelectItem value={d.id}>{d.name}</SelectItem>)
  // Format Select: options.formats.map(f => <SelectItem value={f.id}>{f.name}</SelectItem>)
  // Preset Select: options.presets.map(p => <SelectItem value={p.id}>{p.name}</SelectItem>)

  // Fields dinâmicos agrupados por `group`:
  const grouped = groupBy(options.fields, 'group')
  // reading → switches e selects de leitura
  // processing → switches e selects de processamento
  // image → switches e sliders de imagem
  // output → switches de saída

  // Tempo estimado: MANTIDO MOCK (lógica atual)
  // Preview: MANTIDO MOCK (lógica atual)
}
```

### 4.6. Step 5 — Envio (sem créditos)

```tsx
function StepDelivery() {
  // Removido: cost, credits, enoughCredits
  // Botão: "Converter" (sem "X créditos")
  // "Baixar arquivo": marca opção, mostra SizeBudget (mocado)
  // "Enviar pro Kindle": mostra input de email, badge "em breve"

  // Resumo continua exibindo origem, capítulos, capa, kindle, envio
}
```

### 4.7. Função `finish()` — POST /api/conversions

```tsx
const finish = async () => {
  const books = buildBooks(data)  // 1 book (single) ou N books (separate por volume)
  const options = {
    ...presetValues,    // valores do preset selecionado
    ...fieldOverrides,  // overrides do usuário nos fields
  }

  const { conversionId } = await conversionsApi.create({
    sourceId: data.sourceId,
    cover: { kind: "original" },
    output: { deviceId: data.device, format: data.format },
    metadata: data.meta,
    books,
    options,
  })

  navigate({ to: "/biblioteca/converter/$jobId", params: { jobId: conversionId } })
}

function buildBooks(data: WizardData): Book[] {
  const selected = data.inspectData!.chapters.filter(c => data.selectedChapters.has(c.id))

  if (data.grouping === "single") {
    return [{
      title: data.meta.title || data.inspectData!.metadata.title,
      chapters: selected.map(c => c.id),
    }]
  }

  // Agrupar por volume (fixed ou custom)
  const volumes = computeVolumes(selected, data.volumeMode, data.volumeSize, data.volumeSizes)
  return volumes.map((chapters, i) => ({
    title: `${data.meta.title || data.inspectData!.metadata.title} - Vol. ${i + 1}`,
    chapters: chapters.map(c => c.id),
  }))
}
```

## 5. Tela de Progresso

### 5.1. Rota `/biblioteca/converter/$jobId`

O `jobId` param passa a ser um `conversionId` real. Substituir o hook mockado por `useConversionProgress`:

```tsx
function ConverterPage() {
  const { jobId: conversionId } = Route.useParams()
  const { state, isLoading, error, cancel } = useConversionProgress(conversionId)

  // state.status: queued | processing | completed | failed | cancelled | partial
  // state.progress: 0-100 (média dos Jobs)
  // state.jobs[]: estado individual de cada Job
  // state.config: snapshot da config original

  // Mapear jobs para stages visuais:
  // - Job status "downloading" → stage "Baixando imagens"
  // - Job status "converting" → stage "Convertendo páginas"
  // - Job status "packaging" → stage "Gerando arquivo"
  // - Job status "completed" → stage completo
}
```

### 5.2. Mapeamento de SSE → stages

```
SSE Event              → Visual Stage
─────────────────────────────────────────
job.started            → Job ativo, stage "preparando"
download.started       → stage "Baixando imagens" (ativo)
download.progress      → atualiza progresso do stage "Baixando"
download.chapter.*     → atualiza info do capítulo atual
conversion.started     → stage "Convertendo páginas" (ativo)
conversion.progress    → atualiza progresso do stage "Convertendo"
conversion.finished    → stage "Convertendo" (completed)
job.finished           → stage "Gerando arquivo" (completed), Job completo
job.failed             → stage com erro, Job falho
```

### 5.3. Multi-Job UI

Como uma Conversion pode ter N Jobs (1 por volume), a tela de progresso deve:

- Exibir progresso geral (média dos Jobs) na barra principal
- Exibir uma lista/accordion de Jobs individuais com seus próprios progressos
- Cada Job mostra: título, status, progresso %, stage atual

### 5.4. Botão "Ver na biblioteca"

Ao concluir (`status: completed` ou `partial`):
```tsx
{isDone && (
  <Button onClick={() => navigate({ to: "/biblioteca" })}>
    Ver na biblioteca
  </Button>
)}
```

## 6. Componente SSE — `createSSEStream`

```typescript
// lib/sse.ts (NOVO)

interface SSEHandlers {
  onEvent: (event: string, data: unknown) => void
  onError?: (error: Error) => void
}

export function createSSEStream(
  url: string,
  handlers: SSEHandlers,
  token?: string,
): { close: () => void } {
  const controller = new AbortController()

  const headers: HeadersInit = {
    Accept: 'text/event-stream',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  fetch(url, { headers, signal: controller.signal })
    .then(async (response) => {
      if (!response.ok) throw new Error(`SSE ${response.status}`)
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE frames separados por \n\n
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''

        for (const frame of frames) {
          const lines = frame.split('\n')
          let event = 'message'
          let data = ''
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim()
            else if (line.startsWith('data:')) data += line.slice(5).trim()
            else if (line.startsWith(':')) continue // comment/keepalive
          }
          if (event !== 'message') {
            handlers.onEvent(event, data ? JSON.parse(data) : {})
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') handlers.onError?.(err)
    })

  return { close: () => controller.abort() }
}
```

## 7. Remoção de Código Mockado

### Arquivos a remover/substituir

| Arquivo | Ação |
|---------|------|
| `lib/kindle-presets.ts` | **Remover** — substituído por `GET /options` |
| `lib/conversion-job.ts` | **Substituir** — tipos passam a vir de `types/conversion.ts` |
| `hooks/useConversion.tsx` | **Substituir** — por hooks reais |
| `wizard.tsx` → `mockFetchSeries()` | **Remover** — substituído por `useScraping` |

### Manter mocks internos

- `StepConvert` → tempo estimado (cálculo local, sem API)
- `StepConvert` → preview (MockPage + ComparisonSlider, sem API)
- `StepDelivery` → `SizeBudget` (cálculo local, sem API)
- `StepDelivery` → envio Kindle (marcado, sem SMTP)

## 8. Fluxo Completo

```
Frontend                                    Backend
   │                                          │
   │  POST /source/inspect { url }            │
   │─────────────────────────────────────────►│  → { sourceId, status }
   │◄─────────────────────────────────────────│
   │                                          │
   │  (se processing: SSE /inspect/:id/events)│
   │═════════════════════════════════════════►│  progress, completed, failed
   │                                          │
   │  GET /source/inspect/:sourceId           │
   │─────────────────────────────────────────►│  → metadata, chapters, covers
   │◄─────────────────────────────────────────│
   │                                          │
   │  GET /api/conversions/options            │
   │─────────────────────────────────────────►│  → devices, formats, fields, presets
   │◄─────────────────────────────────────────│
   │                                          │
   │  (Usuário configura wizard)              │
   │                                          │
   │  POST /api/conversions { books, options }│
   │─────────────────────────────────────────►│  → { conversionId, totalJobs, queued }
   │◄─────────────────────────────────────────│
   │                                          │
   │  redirect → /biblioteca/converter/:id   │
   │                                          │
   │  GET /api/conversions/:id                │
   │─────────────────────────────────────────►│  → estado agregado
   │◄─────────────────────────────────────────│
   │                                          │
   │  SSE /api/conversions/:id/events         │
   │═════════════════════════════════════════►│  fan-in: job.started, download.*,
   │◄── event: job.started ──────────────────│     conversion.*, job.finished/failed
   │◄── event: download.progress ────────────│
   │◄── event: conversion.progress ───────────│
   │◄── event: job.finished ──────────────────│
   │                                          │
   │  (tudo terminal → close SSE)             │
   │                                          │
   │  Button: "Ver na biblioteca" → /biblioteca│
```

## 9. Decisões Técnicas

### 9.1. Por que `fetch` streaming em vez de `EventSource`?

`EventSource` não permite headers customizados. O SSE de conversão requer `Authorization: Bearer <token>`. Usar `fetch` com `ReadableStream` dá controle total sobre headers e parsing.

### 9.2. Por que não manter `useConversion` e adaptar?

O hook atual é fundamentalmente diferente: simula progresso com `setTimeout`, não há SSE, não há chamadas HTTP. Adaptar seria mais complexo que criar hooks novos com responsabilidades claras.

### 9.3. Por que remover `kindle-presets.ts`?

O backend já retorna devices, formats, fields e presets via `GET /options`. Manter uma cópia local criaria inconsistência quando o backend for atualizado. O catálogo é público (sem auth) e raramente muda — cache com TanStack Query é suficiente.

### 9.4. Por que o tamanho estimado fica mocado?

O backend não possui endpoint de estimativa de tamanho. O cálculo real dependeria de baixar e medir imagens, o que é caro. A UI mockada (baseada em número de capítulos × 1.2 MB) é suficiente como placeholder visual.

### 9.5. Por que "Ver na biblioteca" só leva a `/biblioteca`?

A listagem de mangás na biblioteca (persistência, CRUD, listagem por série) é um recurso futuro. O objetivo deste change é fazer o processo de conversão funcionar end-to-end. O usuário valida inspecionando `storage/conversions/`.
