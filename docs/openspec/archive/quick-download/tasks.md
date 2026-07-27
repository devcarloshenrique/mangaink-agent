# Quick Download — Tasks de Implementação

> **Status:** COMPLETED
> **Data:** 2026-07-27

---

## Ordem de Implementação

1. Backend: tipos + DTO
2. Backend: fila e worker download-only
3. Backend: use-case modificado
4. Backend: rota e registro
5. Frontend: InlineUrlBar
6. Frontend: AddMangaDialog (dados reais)
7. Frontend: biblioteca e progresso
8. Testes

---

## 1. Backend — Tipos e DTO

- [x] 1.1 `types/conversion.types.ts` — Adicionar `downloadOnly?: boolean` a `ConversionConfig`
- [x] 1.2 `types/conversion.types.ts` — Adicionar `downloadOnly?: boolean` a `ConversionJobData`
- [x] 1.3 `dtos/create-conversion.dto.ts` — Adicionar `downloadOnly: z.boolean().optional().default(false)`
- [x] 1.4 `dtos/create-conversion.dto.ts` — Tornar `output` condicional via `.refine()`
- [x] 1.5 `dtos/create-conversion.dto.ts` — Response schema mantido

## 2. Backend — Fila e Worker Download-Only

- [x] 2.1 `services/download-only-queue.service.ts` — Criar `DownloadOnlyQueueService`:
  - Nome da fila: `'download-only'`
  - Método `add(jobData: ConversionJobData)`
  - Método `remove(jobId: string)`
- [x] 2.2 `workers/download-only.worker.ts` — Criar worker:
  - [x] Inicializar `ImageDownloaderService`
  - [x] Inicializar `JobLiveStatusStore`
  - [x] Resolver provider via `resolveProvider(sourceId)`
  - [x] Loop pelos capítulos
  - [x] Emitir `job.started`, `download.started`, `download.chapter.*`, `download.progress`
  - [x] Aplicar `errorHandlingStrategy`
  - [x] Atualizar `ConversionJobRepository`
  - [x] Chamar `conversions.syncStatus(conversionId)`
  - [x] Emitir `job.finished` com `downloadOnly: true`
  - [x] Handlers `completed`/`failed`/`error`
- [x] 2.3 `services/placeholder.service.ts` — Adicionar método `generateDefault(pageLabel)` para download-only (sem deviceId)
- [x] 2.4 Registrar worker no `server.ts` via side-effect import

## 3. Backend — Use Case

- [x] 3.1 `use-cases/create-conversion.use-case.ts` — Adicionar `DownloadOnlyQueueService` como parâmetro opcional
- [x] 3.2 `use-cases/create-conversion.use-case.ts` — Adicionar branch downloadOnly:
  - Pular validação de dispositivo/formato
  - Não definir flags internas KCC
  - Enfileirar na fila `download-only`
- [x] 3.3 `use-cases/cancel-conversion.use-case.ts` — Aceitar `DownloadOnlyQueueService` e remover de ambas as filas

## 4. Backend — Rota e Registro

- [x] 4.1 `conversion.routes.ts` — Instanciar `DownloadOnlyQueueService`
- [x] 4.2 `conversion.routes.ts` — Passar `downloadOnlyQueue` para `CreateConversionUseCase` e `CancelConversionUseCase`
- [x] 4.3 `server.ts` — Importar worker `download-only.worker` (side-effect)
- [x] 4.4 DTO Zod aceita `downloadOnly` com refinamento condicional

## 5. Frontend — InlineUrlBar

- [x] 5.1 `components/biblioteca/InlineUrlBar.tsx` — Criar componente:
  - Barra expansível com animação (estilo lupa)
  - Input de URL + botão "Buscar" + botão fechar
  - Integração com `useScraping()` para inspeção
  - SpeechBubble de progresso/erro + barra de progresso
  - Callback `onReady(sourceId, metadata)` ao concluir scraping

## 6. Frontend — AddMangaDialog

- [x] 6.1 `components/biblioteca/AddMangaDialog.tsx` — Refatorar para dados reais:
  - Props: `sourceId`, `metadata: SourceInspectResponse`
  - Layout 2 colunas (capa/info + capítulos) — mantido do mock
  - Busca/filtro de capítulos
  - Capa via `conversionsApi.coverUrl()`
  - CTA: "Baixar capítulos" (não "Baixar e converter")
  - Submissão: `POST /api/conversions` com `downloadOnly: true`
  - Redirecionamento para `/biblioteca/converter/$conversionId`

## 7. Frontend — Biblioteca e Progresso

- [x] 7.1 `routes/biblioteca.index.tsx` — Adicionar estados `urlBarOpen`, `dialogOpen`, `scrapedData`
- [x] 7.2 `routes/biblioteca.index.tsx` — Integrar `InlineUrlBar` com fluxo: expandir → scrape → abrir dialog
- [x] 7.3 `routes/biblioteca.index.tsx` — Ajustar label "Histórico de conversões" → "Histórico de obras"
- [x] 7.4 `routes/biblioteca.index.tsx` — `AddMangaDialog` condicional (só renderiza com dados)
- [x] 7.5 `hooks/useConversionProgress.ts` — Detectar `downloadOnly` do config
- [x] 7.6 `hooks/useConversionProgress.ts` — `deriveStages` retorna só 1 stage quando downloadOnly
- [x] 7.7 `hooks/useConversionProgress.ts` — `overallProgress` 0-100% para download-only (processedChapters/totalChapters)
- [x] 7.8 `hooks/useConversionProgress.ts` — Log de `job.finished` com mensagem de download
- [x] 7.9 `routes/biblioteca.converter.$jobId.tsx` — Ajustes para download-only:
  - Mostrar "N capítulos" em vez de formato
  - Mensagem de corrupt pages sem mencionar KCC
  - SpeechBubble apropriado para download-only
- [x] 7.10 `types/conversion.ts` — Adicionar `downloadOnly` e tornar `output`/`metadata`/`options` opcionais

## 8. Testes

- [x] 8.1 Todos os 649 testes existentes passam sem regressão
- [x] 8.2 Testes unitários para `download-only.worker.ts` — 10 testes em `download-only.worker.test.ts`
- [x] 8.3 Testes unitários para `create-conversion.use-case.ts` — +10 testes branch downloadOnly em `create-conversion.use-case.test.ts`
- [x] 8.4 Fluxo AddMangaDialog coberto por testes E2E de scraping + create-conversion

---

## Resumo

| Camada | Arquivos Novos | Arquivos Modificados |
|---|---|---|
| Backend | 2 (queue service, worker) | 5 (routes, use-case x2, dto, types, placeholder service) |
| Frontend | 1 (InlineUrlBar) | 5 (AddMangaDialog, biblioteca.index, converter.$jobId, useConversionProgress, types) |
| **Total** | **3** | **10** |
