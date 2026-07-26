# Quick Download — Tasks de Implementação

> **Status:** DRAFT
> **Data:** 2026-07-25

---

## Ordem de Implementação

1. Backend: tipos + DTO
2. Backend: fila e worker download-only
3. Backend: use-case modificado
4. Backend: rota e registro
5. Frontend: AddMangaDialog
6. Frontend: biblioteca e progresso
7. Testes

---

## 1. Backend — Tipos e DTO

- [ ] 1.1 `types/conversion.types.ts` — Adicionar `downloadOnly?: boolean` a `ConversionConfig`
- [ ] 1.2 `types/conversion.types.ts` — Adicionar `downloadOnly?: boolean` a `ConversionJobData`
- [ ] 1.3 `types/conversion.types.ts` — Criar `DownloadOnlyJobData` separado (ou extender `ConversionJobData`)
- [ ] 1.4 `dtos/create-conversion.dto.ts` — Adicionar `downloadOnly: z.boolean().optional().default(false)`
- [ ] 1.5 `dtos/create-conversion.dto.ts` — Tornar `output` condicional via `.refine()`
- [ ] 1.6 `dtos/create-conversion.dto.ts` — Response schema mantido

## 2. Backend — Fila e Worker Download-Only

- [ ] 2.1 `services/download-only-queue.service.ts` — Criar `DownloadOnlyQueueService`:
  - Nome da fila: `'download-only'`
  - Método `add(jobData: DownloadOnlyJobData)`
  - Método `remove(jobId: string)`
- [ ] 2.2 `workers/download-only.worker.ts` — Criar worker:
  - [ ] Inicializar `ImageDownloaderService`
  - [ ] Inicializar `JobLiveStatusStore`
  - [ ] Resolver provider via `resolveProvider(sourceId)`
  - [ ] Loop pelos capítulos
  - [ ] Emitir `job.started`, `download.started`, `download.chapter.*`, `download.progress`
  - [ ] Aplicar `errorHandlingStrategy`
  - [ ] Atualizar `ConversionJobRepository`
  - [ ] Chamar `conversions.syncStatus(conversionId)`
  - [ ] Emitir `job.finished` com `downloadOnly: true`
  - [ ] Handlers `completed`/`failed`/`error` (similar ao conversion worker)
- [ ] 2.3 `workers/download-only.worker.ts` — Registrar worker no `app.ts` ou `server.ts`
- [ ] 2.4 `types/download-only.types.ts` — Definir `DownloadOnlyJobData` e `DownloadOnlyJobResult`

## 3. Backend — Use Case

- [ ] 3.1 `use-cases/create-conversion.use-case.ts` — Modificar constructor para receber:
  - `conversionQueue: ConversionQueueService`
  - `downloadOnlyQueue: DownloadOnlyQueueService`
  - repositórios existentes
- [ ] 3.2 `use-cases/create-conversion.use-case.ts` — Adicionar branch:
  ```ts
  if (body.downloadOnly) {
    // validar sem output
    // criar 1 book com todos os capítulos
    // enfileirar na download-only
  } else {
    // comportamento atual
  }
  ```
- [ ] 3.3 `use-cases/create-conversion.use-case.ts` — Garantir que `downloadOnly: true` usa `errorHandlingStrategy` default "ignore"

## 4. Backend — Rota e Registro

- [ ] 4.1 `conversion.routes.ts` — Instanciar `DownloadOnlyQueueService`
- [ ] 4.2 `conversion.routes.ts` — Passar `downloadOnlyQueue` para `CreateConversionUseCase`
- [ ] 4.3 `conversion.routes.ts` — Garantir que Zod schema aceita `downloadOnly`
- [ ] 4.4 `app.ts`/`server.ts` — Iniciar worker `download-only`

## 5. Frontend — AddMangaDialog

- [ ] 5.1 `components/biblioteca/AddMangaDialog.tsx` — Criar componente:
  - Props: `open`, `onOpenChange`
  - Estados: `step`, `url`, `selectedChapters`, `submitting`
- [ ] 5.2 Reutilizar `useScraping()` para inspeção
- [ ] 5.3 Passo 0: input de URL + botão Buscar + progresso/erro
- [ ] 5.4 Passo 1: listar capítulos com checkboxes
- [ ] 5.5 Submit: `conversionsApi.create({ sourceId, downloadOnly: true, books: [...] })`
- [ ] 5.6 On success: `navigate({ to: '/biblioteca/converter/$jobId', params: { jobId: conversionId } })`

## 6. Frontend — Biblioteca e Progresso

- [ ] 6.1 `routes/biblioteca.index.tsx` — Adicionar estado `addDialogOpen`
- [ ] 6.2 `routes/biblioteca.index.tsx` — Adicionar botão "Adicionar obra" azul ao lado do "Converter novo"
- [ ] 6.3 `routes/biblioteca.index.tsx` — Ajustar labels para "obras"/"itens":
  - "Histórico de conversões" → "Histórico de obras"
  - "N conversões" → "N itens"
  - "Converter um mangá" → "Adicionar uma obra"
  - Empty state messages
- [ ] 6.4 `routes/biblioteca.index.tsx` — Renderizar `<AddMangaDialog />`
- [ ] 6.5 `hooks/useConversionProgress.ts` — Detectar `downloadOnly`:
  ```ts
  const downloadOnly = (apiState?.config as any)?.downloadOnly === true
  ```
- [ ] 6.6 `hooks/useConversionProgress.ts` — `deriveStages` retorna 1 stage quando `downloadOnly`
- [ ] 6.7 `hooks/useConversionProgress.ts` — `overallProgress` 0-100% para download-only
- [ ] 6.8 `hooks/useConversionProgress.ts` — Log de `job.finished` com mensagem de download
- [ ] 6.9 `routes/biblioteca.converter.$jobId.tsx` — Ajustar labels quando download-only:
  - Esconder format badge
  - Mostrar "N capítulos" em vez de "Arquivo único / N volumes"
  - Botão "Ver na biblioteca" funciona

## 7. Testes

- [ ] 7.1 Backend — `create-conversion.use-case.test.ts`:
  - [ ] Criação download-only bem-sucedida
  - [ ] Criação normal continua funcionando
  - [ ] SourceId inexistente → 404
  - [ ] Capítulo inexistente → 404
  - [ ] output obrigatório quando downloadOnly false
  - [ ] output opcional quando downloadOnly true
- [ ] 7.2 Backend — `download-only.worker.test.ts`:
  - [ ] Download bem-sucedido emite eventos corretos
  - [ ] Não executa KCC
  - [ ] Error handling ignore/skip/abort
  - [ ] Job completo sem outputFile
- [ ] 7.3 Frontend — `AddMangaDialog.test.tsx` ou Storybook:
  - [ ] Renderiza passo 0
  - [ ] Transição para passo 1
  - [ ] Seleção de capítulos
  - [ ] Submit com capítulos selecionados
- [ ] 7.4 Frontend — `useConversionProgress.test.ts`:
  - [ ] download-only retorna 1 stage
  - [ ] progresso 0-100% para download-only

---

## Resumo

| Camada | Arquivos Novos | Arquivos Modificados |
|---|---|---|
| Backend | 3 (queue service, worker, types) | 4 (routes, use-case, dto, types) |
| Frontend | 1 (AddMangaDialog) | 4 (biblioteca.index, converter.$jobId, useConversionProgress, api.ts) |
| Testes | 2 (worker, dialog) | 2 (use-case, progress hook) |
| **Total** | **6** | **10** |
