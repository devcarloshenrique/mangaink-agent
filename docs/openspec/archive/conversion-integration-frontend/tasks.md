# Conversion Integration Frontend — Tasks de Implementação

> **Status:** DONE
> **Data:** 2026-07-12

---

## 1. Tipos TypeScript (NOVOS)

- [x] 1.1 `src/types/scraping.ts` — Tipos espelhando `scraping/types/source.types.ts`:
  - `SourceInspectResponse`, `MangaMetadata`, `Chapter`, `Cover`, `Statistics`, `ProviderInfo`
  - `ScrapingSSEEventType = 'progress' | 'completed' | 'failed'`
- [x] 1.2 `src/types/conversion.ts` — Tipos espelhando `conversion/types/conversion.types.ts`:
  - `ConversionOptions`, `ConversionField`, `ConversionPreset`, `DeviceProfile`, `OutputFormat`
  - `CoverRef`, `Book`, `ConversionState`, `ConversionJobSummary`
  - `ConversionStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'partial'`
  - `JobStatus = 'queued' | 'preparing' | 'downloading' | 'converting' | 'packaging' | 'completed' | 'failed' | 'cancelled'`
  - `ConversionSSEEventType` (todos os 10 tipos de evento)

## 2. Utilitário SSE (NOVO)

- [x] 2.1 `src/lib/sse.ts` — Função `createSSEStream(url, handlers, token?)`:
  - Usa `fetch` com `Accept: text/event-stream` e `Authorization: Bearer` (se token)
  - Lê stream via `ReadableStream` + `TextDecoder`
  - Faz parse de frames SSE (`event:` + `data:` separados por `\n\n`)
  - Ignora keepalive (`: keepalive`)
  - Retorna `{ close: () => void }` que aborta via `AbortController`
  - Trata `AbortError` silenciosamente no `onError`

## 3. Cliente API — Scraping (NOVO em `lib/api.ts`)

- [x] 3.1 `scrapingApi.inspect(url, refresh?)` — `POST /api/conversions/source/inspect` com body `{ url }` e query `?refresh=true`
- [x] 3.2 `scrapingApi.getSource(sourceId)` — `GET /api/conversions/source/inspect/:sourceId` → `SourceInspectResponse`
- [x] 3.3 `scrapingApi.listProviders()` — `GET /api/conversions/source/providers`
- [x] 3.4 `scrapingApi.inspectEvents(sourceId, handlers)` — Abre SSE `/source/inspect/:sourceId/events` (sem auth) usando `createSSEStream`:
  - `onEvent("progress", data)` → `handlers.onProgress({ stage, message, progress })`
  - `onEvent("completed", data)` → `handlers.onCompleted({ sourceId })`
  - `onEvent("failed", data)` → `handlers.onFailed({ message })`

## 4. Cliente API — Conversão (NOVO em `lib/api.ts`)

- [x] 4.1 `conversionsApi.getOptions()` — `GET /api/conversions/options` (sem auth) → `ConversionOptions`
- [x] 4.2 `conversionsApi.create(body)` — `POST /api/conversions` com Bearer token → `{ conversionId, status, totalJobs, createdAt }`
- [x] 4.3 `conversionsApi.get(conversionId)` — `GET /api/conversions/:conversionId` com Bearer token → `ConversionState`
- [x] 4.4 `conversionsApi.cancel(conversionId)` — `DELETE /api/conversions/:conversionId` com Bearer token → `{ conversionId, status: "cancelled" }`
- [x] 4.5 `conversionsApi.events(conversionId, handlers)` — Abre SSE `/:conversionId/events` (com auth) usando `createSSEStream`:
  - `onEvent(eventType, data)` → `handlers.onEvent(eventType, data)` (data já inclui `jobId`)

## 5. Hooks (NOVOS)

### useScraping

- [x] 5.1 `src/hooks/useScraping.ts` — Hook de inspeção assíncrona:
  - Estado: `{ sourceId, status: 'idle'|'processing'|'ready'|'failed', progress, message, metadata, error }`
  - `inspect(url, refresh?)`: chama `scrapingApi.inspect()` → se ready, busca metadados; se processing, conecta SSE
  - SSE `onProgress`: atualiza `progress` e `message`
  - SSE `onCompleted`: chama `scrapingApi.getSource()` → atualiza `metadata` e `status: "ready"`
  - SSE `onFailed`: atualiza `status: "failed"` e `error`
  - `reset()`: limpa estado
  - Cleanup: `useEffect` fecha SSE ao desmontar

### useConversionOptions

- [x] 5.2 `src/hooks/useConversionOptions.ts` — Hook com TanStack Query:
  - Query key: `['conversion-options']`
  - `staleTime: Infinity` (catálogo raramente muda)
  - Retorna `{ data: ConversionOptions | null, isLoading, isError }`

### useConversionProgress

- [x] 5.3 `src/hooks/useConversionProgress.ts` — Hook de progresso em tempo real:
  - Recebe `conversionId` como parâmetro
  - Busca estado inicial via `conversionsApi.get()`
  - Se status não terminal, conecta SSE via `conversionsApi.events()`
  - Mapeia eventos para estado local de Jobs:
    - `job.started` → marca Job como ativo
    - `download.progress` → atualiza progresso de download
    - `conversion.progress` → atualiza progresso de conversão
    - `job.finished` → marca Job como completed, re-sincroniza estado agregado
    - `job.failed` → marca Job como failed, re-sincroniza estado agregado
  - Se todos Jobs terminais → fecha SSE
  - `cancel()`: chama `conversionsApi.cancel()` + fecha SSE + atualiza estado
  - Cleanup: fecha SSE ao desmontar

## 6. Wizard — Tipagem e Estado

- [x] 6.1 Atualizar `WizardData` em `routes/wizard.tsx`:
  - Adicionar: `sourceId: string | null`, `inspectData: SourceInspectResponse | null`, `options: Record<string, string | number | boolean>`
  - Remover: `series` (substituído por `inspectData`), `coverMode`, `coverAssignments`
  - Inicializar `device`, `format`, `preset` com defaults do catálogo dinâmico (fallback vazio até carregar)
- [x] 6.2 Remover `mockFetchSeries()` e interfaces mockadas (`Chapter`, `Cover`, `Series`)
- [x] 6.3 Remover import de `KINDLE_DEVICES`, `OUTPUT_FORMATS`, `PRESETS` de `lib/kindle-presets.ts`

## 7. Wizard — Step 1 (Origem)

- [x] 7.1 Substituir `handleFetch` por `useScraping.inspect(url)` (ou chamar o hook no componente pai)
- [x] 7.2 Durante `status: "processing"`, exibir mensagem de progresso do SSE (stage + progress%)
- [x] 7.3 Ao concluir, exibir:
  - Título: `inspectData.metadata.title`
  - Total de capítulos: `inspectData.statistics.chapters`
  - **Remover** a contagem de volumes (não exibir "X volumes")
- [x] 7.4 Armazenar `sourceId` e `inspectData` no `WizardData`
- [x] 7.5 Em caso de erro, exibir via `toast.error()` com a mensagem do SSE ou da API

## 8. Wizard — Step 2 (Capítulos)

- [x] 8.1 Substituir `series.chapters` por `inspectData.chapters` (dados reais do scraping)
- [x] 8.2 Tratar `pages: null` → exibir "—" ou omitir contagem de páginas
- [x] 8.3 Manter lógica de agrupamento por volume (fixed/custom) — front-end continua computando volumes
- [x] 8.4 Manter controles: "Selecionar todos", "Limpar", agrupamento "single"/"separate"

## 9. Wizard — Step 3 (Capas simplificado)

- [x] 9.1 Remover os modos "per-volume" e "per-chapter" (componentes `ChoiceCard`)
- [x] 9.2 Remover o dialog de seleção de capa (`pickerFor`, `CoverPreview`, `describeRef`)
- [x] 9.3 Exibir apenas o modo "Uma só capa" ativo, com texto explicativo "Usa a capa original da obra"
- [x] 9.4 O `cover` final é sempre `{ kind: "original" }` (sem `coverAssignments`)

## 10. Wizard — Step 4 (Configurações dinâmicas)

- [x] 10.1 Usar `useConversionOptions()` para carregar catálogo
- [x] 10.2 Renderizar device `<Select>` a partir de `options.devices` (value: `d.id`, label: `d.name`)
- [x] 10.3 Renderizar format `<Select>` a partir de `options.formats`
- [x] 10.4 Renderizar preset `<Select>` a partir de `options.presets` (name + description)
- [x] 10.5 Renderizar fields dinamicamente agrupados por `group`:
  - `component: "switch"` → `<Switch>` (boolean)
  - `component: "select"` → `<Select>` com `field.options` (enum)
  - `component: "slider"` → slider com `min`/`max`/`step` (number)
  - `component: "input"` → `<Input type="number">` (number)
- [x] 10.6 Ao selecionar preset, aplicar `preset.values` aos fields correspondentes em `data.options`
- [x] 10.7 Se preset é `exclusive` (ex: `noProcessing`), desativar os demais fields
- [x] 10.8 Manter tempo estimado **mocado** (lógica atual de cálculo por páginas)
- [x] 10.9 Manter preview de página **mocado** (MockPage + ComparisonSlider, sem chamada de API)
- [x] 10.10 Manter inputs de título e autor (opcional)

## 11. Wizard — Step 5 (Envio sem créditos)

- [x] 11.1 Remover `cost`, `credits`, `enoughCredits` e toda lógica de créditos
- [x] 11.2 Botão final: exibir apenas "Converter" (sem "(X créditos)")
- [x] 11.3 "Baixar arquivo": apenas marca `delivery: "download"` em estado — não inicia download
- [x] 11.4 "Enviar pro Kindle": mantém input de email, mas exibe badge/indicador "em breve" (mocado)
- [x] 11.5 Manter `SizeBudget` (tamanho estimado) **mocado** — lógica atual baseada em `chapters * 1.2 MB`
- [x] 11.6 Remover textos referentes a créditos do resumo (SummaryRow) e do subtitle
- [x] 11.7 Remover validação de `enoughCredits` em `canNext`

## 12. Wizard — Função `finish()` (POST /api/conversions)

- [x] 12.1 Criar `buildBooks(data: WizardData): Book[]`:
  - Se `grouping === "single"`: 1 Book com `title = meta.title` e `chapters = [...selectedChapters]`
  - Se `grouping === "separate"`: 1 Book por volume, `title = "${meta.title} - Vol. ${n}"`, chapters do volume
- [x] 12.2 Construir `options` combinando `preset.values` + overrides de fields em `data.options`
- [x] 12.3 Validar antes de enviar: `sourceId` existe, `selectedChapters.size > 0`, `device` e `format` preenchidos
- [x] 12.4 Chamar `conversionsApi.create({ sourceId, cover: { kind: "original" }, output: { deviceId, format }, metadata, books, options })`
- [x] 12.5 Em caso de erro (400/404), exibir via `toast.error()`
- [x] 12.6 Em caso de sucesso, `navigate({ to: "/biblioteca/converter/$jobId", params: { jobId: conversionId } })`
- [x] 12.7 Remover chamada de `startJob` (hook mockado) e `addSeries` (biblioteca mockada)

## 13. Tela de Progresso — `/biblioteca/converter/$jobId`

- [x] 13.1 Substituir `useConversion` (mockado) por `useConversionProgress(conversionId)` onde `conversionId = jobId` param
- [x] 13.2 Buscar e exibir título da obra: `state.config.metadata.title` ou `state.jobs[0].title`
- [x] 13.3 Exibir formato: `state.config.output.format`
- [x] 13.4 Exibir progresso geral: `state.progress` (barra principal)
- [x] 13.5 Exibir contadores: `completedJobs/totalJobs`, `runningJobs`, `failedJobs`
- [x] 13.6 Exibir lista de Jobs individuais (`state.jobs[]`):
  - Cada Job: `title`, `status`, `progress`, `outputFile` (se completed)
  - Mapear `status` para stage visual: downloading → "Baixando", converting → "Convertendo", etc.
- [x] 13.7 Atualizar progresso em tempo real conforme eventos SSE chegam (via hook)
- [x] 13.8 Botão "Cancelar": chama `cancel()` do hook, redireciona ou atualiza UI para `cancelled`
- [x] 13.9 Ao concluir (`status: completed` ou `partial`):
  - Exibir badge "DONE!" e mensagem de sucesso
  - Exibir botão "Ver na biblioteca" → `navigate({ to: "/biblioteca" })`
- [x] 13.10 Em caso de erro (`status: failed`): exibir mensagem de erro e botão "Tentar novamente" → `/wizard`
- [x] 13.11 Tratar 404 (conversion não encontrada): manter tela "Conversão não encontrada" atual

## 14. Limpeza de Código Mockado

- [x] 14.1 Remover `lib/kindle-presets.ts` (substituído por `GET /options`)
- [x] 14.2 Remover `lib/conversion-job.ts` (tipos substituídos por `types/conversion.ts`)
- [x] 14.3 Remover `hooks/useConversion.tsx` (substituído por hooks reais)
- [x] 14.4 Remover referências a `useBiblioteca` no fluxo de conversão (não adicionar series mockadas)
- [x] 14.5 Atualizar imports em `wizard.tsx` e `biblioteca.converter.$jobId.tsx`

## 15. Verificação

- [x] 15.1 `pnpm lint` passa sem erros
- [x] 15.2 `pnpm build` (frontend) compila sem erros TypeScript
- [x] 15.3 Teste manual do fluxo completo:
  1. Colar URL real de mangá → buscar → ver capítulos reais
  2. Selecionar capítulos → configurar volumes
  3. Step 3: apenas capa original
  4. Step 4: devices/formats/fields carregados da API, preset funciona
  5. Step 5: clicar "Converter" → redirect para tela de progresso
  6. Tela de progresso: SSE atualiza em tempo real (download → conversão → packaging)
  7. Ao concluir: botão "Ver na biblioteca" aparece
  8. Verificar `storage/conversions/{conversionId}/jobs/` contém os EPUBs gerados

---

## Ordem de Implementação

```
1 (tipos) → 2 (SSE) → 3+4 (APIs) → 5 (hooks)
  → 6+7 (Step 1) → 8 (Step 2) → 9 (Step 3) → 10 (Step 4) → 11+12 (Step 5)
  → 13 (tela de progresso) → 14 (limpeza) → 15 (verificação)
```
