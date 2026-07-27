# Quick Download — Design de Arquitetura

> **Status:** IMPLEMENTED
> **Data:** 2026-07-27

---

## 1. Motivação

Reduzir a fricção para baixar imagens de mangá para leitura no navegador. O usuário não precisa passar pelo wizard de conversão completo quando só quer baixar os capítulos.

## 2. Conceitos de Domínio

### 2.1. Download-Only Conversion

Uma `Conversion` com `downloadOnly: true`. Representa a intenção de apenas baixar imagens para cache.

| Aspecto | Conversão normal | Download-only |
|---|---|---|
| Objetivo | Arquivo para e-reader | Cache para reader |
| `output` | `{ deviceId, format }` | ausente / opcional |
| Books | 1+ books com chapters | 1 book com chapters |
| Fila BullMQ | `conversion-job` | `download-only` |
| Worker | KCC + download | Download apenas |
| Output file | EPUB/MOBI/CBZ | Nenhum |
| Progresso | Download(0-50%) + KCC(50-100%) | Download(0-100%) |

### 2.2. Fila dedicada

Fila `download-only` separada de `conversion-job`. Razões:

1. **Tempo de execução diferente:** downloads são rápidos (segundos), KCC é lento (minutos)
2. **Concorrência:** fila de KCC é `concurrency: 1` com lock de 5 min; downloads podem rodar com concorrência maior (3)
3. **Isolamento:** falha de KCC não afeta downloads e vice-versa

### 2.3. Reuso do agregado Conversion

A `Conversion` já contém tudo que precisamos:
- `conversionId`
- `sourceId`
- `status`
- `jobs[]`
- `config.books[]`
- `config.downloadOnly`

Isso garante que download-only apareça na biblioteca, use SSE, e seja cancelável da mesma forma.

---

## 3. API

### 3.1. POST /api/conversions (modificado)

**Request body:**
```json
{
  "sourceId": "abc123",
  "downloadOnly": true,
  "books": [
    {
      "title": "Chainsaw Man",
      "chapters": ["chap_0001", "chap_0002"]
    }
  ],
  "errorHandlingStrategy": "ignore"
}
```

**Validações:**
1. `sourceId` existe → senão `404 SourceNotFoundError`
2. `books` não vazio → senão `400`
3. Cada `book` tem `chapters` não vazio → senão `400`
4. Todos os `chapterIds` existem nos metadados → senão `404 ChapterNotFoundError`
5. Capítulos duplicados entre books → `409 DuplicateChapterError`
6. Se `downloadOnly !== true`, `output` obrigatório (comportamento atual)
7. Se `downloadOnly === true`, `output` opcional

**Planner modificado:**
- Se `downloadOnly: true`:
  - Não valida `output.deviceId`/`output.format`
  - Não aplica configuração de capa
  - Cria 1 job com `downloadOnly: true`
  - Enfileira na fila `download-only`
  - Usa dummy output (kindle_pw/epub) para compatibilidade de tipos
- Se `downloadOnly: false` (ou ausente):
  - Comportamento atual

**Response (202):**
```json
{
  "conversionId": "conv_abc123_xyz",
  "status": "queued",
  "totalJobs": 1,
  "createdAt": "2026-07-27T12:00:00Z"
}
```

### 3.2. GET /api/conversions/:id (já existente)

Sem alterações. Retorna a conversion completa, incluindo `downloadOnly` no config.

### 3.3. GET /api/conversions/:id/events (já existente)

Sem alterações. SSE fan-in funciona para qualquer job.

---

## 4. Worker Download-Only

### 4.1. download-only.worker.ts

O worker é uma versão simplificada do `conversion-job.worker.ts`:

- Inicializa `ImageDownloaderService`, `ConversionPubSubService`, `ConversionEventsService`
- Resolve provider via `resolveProvider(sourceId)`
- Loop pelos capítulos:
  - Busca URLs das imagens via `provider.getChapterImages()`
  - Download via `downloader.downloadChapter()`
  - Aplica `errorHandlingStrategy` (ignore/skip_chapter/abort)
  - Emite eventos `download.chapter.*`, `download.progress`
  - Atualiza `JobLiveStatusStore`
- Ao final:
  - Marca job como `completed` via `ConversionJobRepository`
  - Emite `job.finished` com `downloadOnly: true`
  - Chama `conversions.syncStatus(conversionId)`

**Concorrência:** `3` (diferente da fila conversion-job que é `1`)

### 4.2. Eventos emitidos

| Evento | Download-only | Conversão normal |
|---|---|---|
| `job.started` | Sim (com `downloadOnly: true`) | Sim |
| `download.started` | Sim | Sim |
| `download.chapter.*` | Sim | Sim |
| `download.image.corrupt` | Sim | Sim |
| `download.error` | Sim | Sim |
| `job.finished` | Sim (com `downloadOnly: true`) | Sim |
| `job.failed` | Sim | Sim |
| `conversion.started` | **Não** | Sim |
| `conversion.progress` | **Não** | Sim |
| `conversion.finished` | **Não** | Sim |

### 4.3. Cancelamento

O job de download-only pode ser cancelado via `DELETE /api/conversions/:id` ou `POST /api/conversions/:id/cancel`, que tenta remover o job de ambas as filas (`conversion-job` e `download-only`).

---

## 5. Frontend

### 5.1. Árvore de Componentes

```
Biblioteca (/biblioteca)
├── [Adicionar obra] → Toggle InlineUrlBar
│
├── InlineUrlBar (NOVO)
│   ├── Input (URL) + Button "Buscar" + Button fechar
│   ├── SpeechBubble (progresso/erro scraping)
│   └── ProgressBar (se processing)
│
└── AddMangaDialog (MODIFICADO)
    ├── Dialog (shadcn)
    │   ├── Coluna esquerda
    │   │   ├── Capa da obra (via coverUrl)
    │   │   ├── Autor
    │   │   ├── Status
    │   │   └── Estatísticas
    │   ├── Coluna direita
    │   │   ├── Título + provider/language
    │   │   ├── Gêneros (badges)
    │   │   ├── Descrição (sinopse)
    │   │   ├── Busca de capítulos (Input + Search)
    │   │   └── Lista: checkbox + número + título + páginas
    │   └── Rodapé
    │       ├── Badge "N SELECIONADOS ~N páginas"
    │       └── Button "Baixar capítulos"
```

### 5.2. Estados da InlineUrlBar

| Estado | Descrição |
|---|---|
| `collapsed` | Barra oculta |
| `input` | Barra expandida, campo de URL vazio |
| `inspecting` | Scraping em andamento (progresso + mensagem) |
| `failed` | Erro no scraping (mensagem + botão retry) |
| `ready` → fecha barra, abre AddMangaDialog |

### 5.3. API Client

```ts
conversionsApi.create({
  sourceId,
  downloadOnly: true,
  cover: { kind: 'original' },
  books: [{ title, chapters: [...selectedChapters] }],
  errorHandlingStrategy: 'ignore',
})
```

### 5.4. Biblioteca

Botão ao lado de "Converter novo":

```tsx
<button onClick={() => setUrlBarOpen(prev => !prev)} className="bg-comic-blue ...">
  <BookPlus /> Adicionar obra
</button>
```

Ajustes de labels:
- "Histórico de conversões" → "Histórico de obras"

### 5.5. Página de Progresso

Modo download-only:

```
┌─────────────────────────────────┐
│ Progresso geral         [ 72% ] │
│ ██████████████████░░░░░░░░░░░░░ │
├─────────────────────────────────┤
│ 📥 Baixando capítulos  🔄 72%  │
└─────────────────────────────────┘
```

Modo normal (sem alteração):

```
┌─────────────────────────────────┐
│ Progresso geral         [ 65% ] │
│ ████████████████░░░░░░░░░░░░░░░ │
├─────────────────────────────────┤
│ 📥 Baixando imagens    ✅ 100% │
│ ⚙️ Convertendo páginas 🔄 30% │
└─────────────────────────────────┘
```

### 5.6. useConversionProgress

Adaptações:
1. Detectar `downloadOnly`:
   ```ts
   const downloadOnly = (apiState?.config as Record<string, unknown>)?.downloadOnly === true
   ```
2. `deriveStages` retorna apenas 1 stage quando `downloadOnly`
3. `overallProgress` usa `processedChapters/totalChapters * 100` para download-only
4. Log de `job.finished` mostra "Download concluído — N capítulos, M imagens"

---

## 6. Estrutura de Arquivos

```
Novos:
├── apps/backend/src/modules/conversion/
│   ├── services/download-only-queue.service.ts
│   └── workers/download-only.worker.ts
├── apps/frontend/src/
│   └── components/biblioteca/InlineUrlBar.tsx

Modificados:
├── apps/backend/src/
│   ├── modules/conversion/
│   │   ├── dtos/create-conversion.dto.ts (+ downloadOnly opcional, output condicional)
│   │   ├── use-cases/create-conversion.use-case.ts (+ branch download-only)
│   │   ├── use-cases/cancel-conversion.use-case.ts (+ downloadOnlyQueue)
│   │   ├── routes/conversion.routes.ts (+ injetar fila download-only)
│   │   ├── services/placeholder.service.ts (+ generateDefault)
│   │   └── types/conversion.types.ts (+ downloadOnly)
│   └── shared/server.ts (+ import worker)
├── apps/frontend/src/
│   ├── routes/biblioteca.index.tsx (+ urlBarOpen, dialogOpen, scrapedData, InlineUrlBar, labels)
│   ├── routes/biblioteca.converter.$jobId.tsx (+ downloadOnly UI)
│   ├── hooks/useConversionProgress.ts (+ downloadOnly stages/progress)
│   ├── components/biblioteca/AddMangaDialog.tsx (dados reais, CTA)
│   └── types/conversion.ts (+ downloadOnly, tipos opcionais)
```

---

## 7. Decisões de Design

| ID | Decisão | Justificativa |
|---|---|---|
| D1 | Reutilizar `Conversion` para download-only | Reuso de biblioteca, SSE, journal, cancelamento |
| D2 | Fila `download-only` separada | Downloads não ficam bloqueados atrás de KCC |
| D3 | Estender `POST /api/conversions` | Consistência com API de intenção existente |
| D4 | `output` opcional quando `downloadOnly` | Evita dados dummy e reflete a intenção |
| D5 | Barra de URL inline + modal 2 colunas | Fluxo rápido, mantém contexto da biblioteca |
| D6 | 1 job por download-only | Não há divisão em volumes/arquivos |
| D7 | `generateDefault()` no PlaceholderService | Download-only não tem deviceId para placeholders |

---

## 8. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Worker download-only compartilha código com conversion worker | Mudanças no ImageDownloader podem afetar ambos | Manter download-only worker enxuto; testes cobrem ambos |
| `output` opcional pode quebrar validações existentes | Médio | Zod `.refine()` condicional; validação apenas para conversões normais |
| Biblioteca mostra download-only sem arquivo de download | Baixo | No progress page, botão "Ver na biblioteca" funciona sem arquivo de download |
| Concorrência 3 na fila download-only pode sobrecarregar provider | Médio | Rate limit por provider já controla via Bottleneck |
| Cancelamento de job download-only | Baixo | `CancelConversionUseCase` tenta remover de ambas as filas |
