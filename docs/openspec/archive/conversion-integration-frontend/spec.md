# Conversion Integration Frontend — Especificação

> **Status:** DONE
> **Data:** 2026-07-11
> **Módulo:** `frontend`

---

## Purpose

Integrar o wizard de conversão (`/wizard`) e a tela de progresso (`/biblioteca/converter/$jobId`) aos endpoints reais do backend de scraping e conversão, substituindo toda a lógica mockada por chamadas HTTP reais e streaming SSE.

---

## Requirements

### Requirement: Cliente API de Scraping

The system MUST provide typed API methods for all scraping endpoints, reusing the existing `request()` infrastructure with automatic JWT injection.

#### Scenario: Inspeção de URL
- **WHEN** o frontend chama `scrapingApi.inspect(url, refresh?)`
- **THEN** envia `POST /api/conversions/source/inspect` com body `{ url }` e query `?refresh=true` se `refresh` for `true`
- **THEN** retorna `{ sourceId, status: "processing" | "ready" }` (202 se job enfileirado, 200 se cache hit)

#### Scenario: Busca de metadados da source
- **WHEN** o frontend chama `scrapingApi.getSource(sourceId)`
- **THEN** envia `GET /api/conversions/source/inspect/:sourceId`
- **THEN** retorna `SourceInspectResponse` com `{ sourceId, status: "ready", provider, source, metadata, chapters[], covers[], statistics }`

#### Scenario: Listagem de providers
- **WHEN** o frontend chama `scrapingApi.listProviders()`
- **THEN** envia `GET /api/conversions/source/providers`
- **THEN** retorna `{ providers: [{ slug, name, engine, allowedDomains }] }`

#### Scenario: Conexão SSE de inspeção
- **WHEN** o frontend chama `scrapingApi.inspectEvents(sourceId, handlers)`
- **THEN** abre conexão SSE para `GET /api/conversions/source/inspect/:sourceId/events`
- **THEN** invoca `handlers.onProgress({ stage, message, progress })` ao receber evento `progress`
- **THEN** invoca `handlers.onCompleted({ sourceId })` ao receber evento `completed` e fecha a conexão
- **THEN** invoca `handlers.onFailed({ message })` ao receber evento `failed` e fecha a conexão
- **THEN** retorna uma função `close()` para encerrar a conexão SSE

### Requirement: Cliente API de Conversão

The system MUST provide typed API methods for all conversion endpoints, reusing the existing `request()` infrastructure.

#### Scenario: Catálogo de opções (público)
- **WHEN** o frontend chama `conversionsApi.getOptions()`
- **THEN** envia `GET /api/conversions/options` sem Authorization
- **THEN** retorna `{ devices[], formats[], fields[], presets[] }` sem `batchSplit`/`fileFusion`

#### Scenario: Criação de Conversion
- **WHEN** o frontend chama `conversionsApi.create(body)`
- **THEN** envia `POST /api/conversions` com body `{ sourceId, cover, output, metadata, books[], options }` e Bearer token
- **THEN** retorna `{ conversionId, status: "queued", totalJobs, createdAt }` (202)

#### Scenario: Status agregado
- **WHEN** o frontend chama `conversionsApi.get(conversionId)`
- **THEN** envia `GET /api/conversions/:conversionId` com Bearer token
- **THEN** retorna `ConversionState` com `{ status, progress, totalJobs, completedJobs, failedJobs, runningJobs, pendingJobs, jobs[], config }`

#### Scenario: Cancelamento
- **WHEN** o frontend chama `conversionsApi.cancel(conversionId)`
- **THEN** envia `DELETE /api/conversions/:conversionId` com Bearer token
- **THEN** retorna `{ conversionId, status: "cancelled" }`

#### Scenario: Conexão SSE de Conversion (fan-in)
- **WHEN** o frontend chama `conversionsApi.events(conversionId, handlers)`
- **THEN** abre conexão SSE para `GET /api/conversions/:conversionId/events` com Bearer token
- **THEN** invoca `handlers.onEvent(eventType, data)` para cada evento recebido, onde `data` inclui `jobId`
- **THEN** retorna uma função `close()` para encerrar a conexão

### Requirement: Tipos TypeScript espelhando contratos do backend

The system MUST define TypeScript types that mirror the backend DTOs and response schemas.

#### Scenario: Tipos de scraping
- **THEN** define `SourceInspectResponse`, `MangaMetadata`, `Chapter`, `Cover`, `Statistics`, `ProviderInfo` correspondendo aos tipos de `scraping/types/source.types.ts`

#### Scenario: Tipos de conversão
- **THEN** define `ConversionOptions`, `ConversionField`, `ConversionPreset`, `DeviceProfile`, `OutputFormat`, `CoverRef`, `Book`, `ConversionState`, `ConversionJobSummary`, `ConversionStatus`, `JobStatus` correspondendo aos tipos de `conversion/types/conversion.types.ts`

#### Scenario: Tipos de eventos SSE
- **THEN** define `ConversionSSEEventType` (`job.started`, `download.started`, `download.chapter.started`, `download.chapter.finished`, `download.progress`, `conversion.started`, `conversion.progress`, `conversion.finished`, `job.finished`, `job.failed`)
- **THEN** define `ScrapingSSEEventType` (`progress`, `completed`, `failed`)

### Requirement: Hook useScraping — inspeção assíncrona com SSE

The system MUST provide a hook that manages the full inspection flow: POST → SSE (if processing) → GET metadata.

#### Scenario: Inspeção com cache hit (200)
- **WHEN** o usuário cola uma URL e clica em "Buscar"
- **THEN** o hook chama `scrapingApi.inspect(url)` e recebe `{ sourceId, status: "ready" }`
- **THEN** imediatamente chama `scrapingApi.getSource(sourceId)` e armazena os metadados em estado
- **THEN** expõe `{ sourceId, metadata, chapters, covers, status: "ready" }`

#### Scenario: Inspeção com job enfileirado (202)
- **WHEN** o hook recebe `{ sourceId, status: "processing" }`
- **THEN** conecta ao SSE via `scrapingApi.inspectEvents(sourceId, handlers)`
- **THEN** atualiza `progress` e `message` em estado a cada evento `progress`
- **THEN** ao receber `completed`, chama `scrapingApi.getSource(sourceId)` e armazena metadados
- **THEN** ao receber `failed`, armazena a mensagem de erro em estado

#### Scenario: Erro na inspeção
- **WHEN** a chamada `POST /inspect` retorna erro 400/422
- **THEN** o hook expõe o erro em estado para o wizard exibir via `toast.error()`

#### Scenario: Cleanup ao desmontar
- **WHEN** o componente que usa o hook é desmontado
- **THEN** a conexão SSE é encerrada via `close()`

### Requirement: Hook useConversionOptions — catálogo dinâmico

The system MUST fetch and cache the conversion options catalog.

#### Scenario: Busca e cache do catálogo
- **WHEN** o hook é montado
- **THEN** chama `conversionsApi.getOptions()` via TanStack Query
- **THEN** expõe `{ devices, formats, fields, presets, isLoading, isError }`
- **THEN** o cache permanece válido por toda a sessão (staleTime: Infinity)

### Requirement: Hook useConversionProgress — progresso em tempo real

The system MUST provide a hook that tracks a Conversion's progress via SSE and initial state fetch.

#### Scenario: Busca de estado inicial
- **WHEN** o hook é montado com um `conversionId`
- **THEN** chama `conversionsApi.get(conversionId)` para obter o estado agregado atual

#### Scenario: Conexão SSE para atualizações em tempo real
- **WHEN** o estado inicial é recebido
- **THEN** conecta ao SSE via `conversionsApi.events(conversionId, handlers)`
- **THEN** ao receber evento `job.started`, marca o Job correspondente como ativo
- **THEN** ao receber evento `download.progress`, atualiza o progresso de download do Job
- **THEN** ao receber evento `conversion.progress`, atualiza o progresso de conversão do Job
- **THEN** ao receber evento `job.finished`, marca o Job como concluído
- **THEN** ao receber evento `job.failed`, marca o Job como falho e armazena o erro

#### Scenario: Re-fetch do estado agregado ao receber evento terminal
- **WHEN** um Job atinge estado terminal (`job.finished` ou `job.failed`)
- **THEN** o hook chama `conversionsApi.get(conversionId)` para sincronizar o estado agregado
- **THEN** se todos os Jobs estão em estado terminal, o hook marca a conversão como concluída e fecha o SSE

#### Scenario: Cancelamento
- **WHEN** o usuário clica em "Cancelar"
- **THEN** o hook chama `conversionsApi.cancel(conversionId)`
- **THEN** fecha a conexão SSE
- **THEN** atualiza o estado para `cancelled`

#### Scenario: Cleanup ao desmontar
- **WHEN** o componente é desmontado
- **THEN** a conexão SSE é encerrada

### Requirement: Step 1 — Origem (apenas total de capítulos)

The wizard's Step 1 MUST use real scraping and display only the total chapter count.

#### Scenario: Busca e exibição
- **WHEN** o usuário cola uma URL e clica em "Buscar"
- **THEN** chama `useScraping.inspect(url)`
- **THEN** durante o processamento, exibe a mensagem de progresso do SSE
- **THEN** ao concluir, exibe o título da obra e o total de capítulos encontrados
- **THEN** NÃO exibe contagem de volumes (a maioria dos sites não mensura volumes)

#### Scenario: Armazenamento do sourceId
- **THEN** o `sourceId` retornado é armazenado em `WizardData` para uso nos steps 2 e 5

### Requirement: Step 2 — Capítulos reais do scraping

The wizard's Step 2 MUST display real chapter data from the scraping response.

#### Scenario: Listagem de capítulos
- **THEN** cada capítulo exibido tem `id`, `number`, `title` e `pages` reais do scraping
- **THEN** o agrupamento por volume (fixed/custom) permanece funcional usando a configuração de capítulos por volume

### Requirement: Step 3 — Apenas capa original (single)

The wizard's Step 3 MUST only offer the "single cover" mode using the original cover.

#### Scenario: Modo único habilitado
- **THEN** apenas o modo "Uma só capa" está visível e ativo por padrão
- **THEN** os modos "por volume" e "por capítulo" NÃO são exibidos
- **THEN** o dialog de seleção de capa NÃO é exibido
- **THEN** o `cover` final enviado à API é sempre `{ kind: "original" }`

### Requirement: Step 4 — Configurações dinâmicas da API

The wizard's Step 4 MUST render all conversion options from the API catalog, with mocked time estimate and page preview.

#### Scenario: Renderização de devices e formats
- **THEN** o `<Select>` de dispositivo é populado a partir de `devices[]` do catálogo
- **THEN** o `<Select>` de formato é populado a partir de `formats[]` do catálogo

#### Scenario: Renderização dinâmica de fields
- **THEN** cada `field` do catálogo é renderizado conforme seu `component`:
  - `switch` → `<Switch>` (boolean)
  - `select` → `<Select>` com `options[]` (enum)
  - `slider` → slider com `min`, `max`, `step` (number)
  - `input` → `<Input type="number">` (number)
- **THEN** fields são agrupados visualmente por `group` (reading, processing, image, output, format)

#### Scenario: Aplicação de presets
- **WHEN** o usuário seleciona um preset
- **THEN** os valores do preset são aplicados aos fields correspondentes
- **THEN** se o preset é `exclusive`, os demais fields são desativados

#### Scenario: Tempo estimado mocado
- **THEN** o componente de tempo estimado permanece com a lógica mockada atual (cálculo baseado em páginas)
- **THEN** NÃO chama nenhuma API para calcular tempo

#### Scenario: Preview de página mocado
- **THEN** o componente de preview permanece com a lógica mockada atual (MockPage + ComparisonSlider)
- **THEN** NÃO chama nenhuma API de preview

### Requirement: Step 5 — Envio sem créditos e sem download automático

The wizard's Step 5 MUST remove credit logic and not trigger downloads, with mocked Kindle send and estimated size.

#### Scenario: Remoção de lógica de créditos
- **THEN** as variáveis `cost`, `credits`, `enoughCredits` são removidas
- **THEN** o botão final exibe apenas "Converter" (sem "X créditos")
- **THEN** as legendas e textos referentes a créditos são removidos

#### Scenario: Opção "Baixar arquivo"
- **WHEN** o usuário seleciona "Baixar arquivo"
- **THEN** apenas marca a opção em estado (não inicia download)
- **THEN** exibe o componente de tamanho estimado (`SizeBudget`) — **mocado** como atualmente

#### Scenario: Opção "Enviar pro Kindle"
- **WHEN** o usuário seleciona "Enviar pro Kindle"
- **THEN** mantém a UI do e-mail Kindle, mas o envio real é **mocado** (não envia email ao final)
- **THEN** exibe indicador visual de que o envio é "em breve"

#### Scenario: Construção do body de POST /api/conversions
- **WHEN** o usuário clica em "Converter"
- **THEN** o frontend constrói o body:
  ```
  {
    sourceId: <sourceId do Step 1>,
    cover: { kind: "original" },
    output: { deviceId, format },
    metadata: { title, author },
    books: [
      { title: "<meta title>" | "<meta title> - Vol. N", chapters: [...chapterIds] }
    ],
    options: { ...preset values, ...field overrides }
  }
  ```
- **THEN** se `grouping === "single"`: cria 1 Book com todos os capítulos selecionados
- **THEN** se `grouping === "separate"`: cria 1 Book por volume (título = `<meta title> - Vol. <N>`)

#### Scenario: Redirect para tela de progresso
- **WHEN** a API retorna `{ conversionId, status: "queued", totalJobs }`
- **THEN** o frontend navega para `/biblioteca/converter/$jobId` passando `conversionId` como `jobId`

### Requirement: Tela de progresso real com SSE

The route `/biblioteca/converter/$jobId` MUST display real conversion progress via SSE.

#### Scenario: Carregamento do estado inicial
- **WHEN** a página é montada com um `conversionId` real
- **THEN** chama `conversionsApi.get(conversionId)` para obter estado agregado
- **THEN** exibe título, formato, contadores de Jobs e progresso geral

#### Scenario: Progresso em tempo real via SSE
- **THEN** conecta ao SSE `GET /:conversionId/events` via `useConversionProgress`
- **THEN** mapeia eventos para stages visuais:
  - `download.*` → stage "Baixando imagens"
  - `conversion.started`/`conversion.progress` → stage "Convertendo páginas"
  - `conversion.finished`/`job.finished` → stage "Gerando arquivo" (packaging)
- **THEN** atualiza o progresso de cada stage conforme os eventos chegam
- **THEN** atualiza o progresso geral calculado a partir do estado agregado

#### Scenario: Exibição de Jobs individuais
- **THEN** exibe uma lista de Jobs com título, status individual e progresso
- **THEN** cada Job mostra seu estado atual (queued, downloading, converting, packaging, completed, failed)

#### Scenario: Cancelamento funcional
- **WHEN** o usuário clica em "Cancelar"
- **THEN** chama `conversionsApi.cancel(conversionId)`
- **THEN** atualiza a UI para estado `cancelled`
- **THEN** fecha a conexão SSE

#### Scenario: Conclusão
- **WHEN** todos os Jobs atingem estado terminal (completed/failed)
- **THEN** exibe "Conversão concluída!" se todos completed
- **THEN** exibe badge de erro se algum Job falhou
- **THEN** exibe o botão "Ver na biblioteca" que navega para `/biblioteca`

#### Scenario: Conversion inexistente
- **WHEN** o `conversionId` não existe (404 da API)
- **THEN** exibe a tela "Conversão não encontrada" com link de volta

---

## NOT YET IMPLEMENTED (Future Enhancements)

- **Upload de capas:** Suporte a `cover.kind: "upload"` quando a rota de upload existir
- **Download de EPUB:** Iniciar download do arquivo ao finalizar conversão
- **Envio para Kindle:** SMTP real para `@kindle.com`
- **Preview de página real:** Endpoint `/conversions/preview`
- **Tempo estimado real:** Cálculo baseado em profiling histórico
- **Listagem na biblioteca:** Persistência e CRUD de séries convertidas
- **Reconversão:** Re-executar uma Conversion existente com novas opções
