# Chapter Reader — Tasks de Implementacao

> **Status:** COMPLETED
> **Data:** 2026-07-23

---

## 1. Backend — Tipos e Utilitarios

- [x] 1.1 Adicionar `isDownloaded: boolean` a interface `Chapter` em `apps/backend/src/modules/scraping/types/source.types.ts`.
- [x] 1.2 Extrair funcao `resolveProvider(sourceId)` do `conversion-job.worker.ts:480-490` para `apps/backend/src/modules/scraping/utils/resolve-provider.ts`. Deve usar singleton de `ProviderResolver` para compartilhar instancias Bottleneck entre proxy e worker.
- [x] 1.3 Criar tipos `ChapterDownloadData` (job data: `{ sourceId, chapterId }`) e `ChapterDownloadStatus` (status do download: `queued | downloading | ready | failed`) em `apps/backend/src/modules/scraping/types/chapter-download.types.ts`.
- [x] 1.4 Criar tipo `ChapterManifest` (`{ totalImages: number, urls: string[] }`) para o arquivo `manifest.json` no diretorio de cache.
- [x] 1.5 Criar `apps/backend/src/modules/scraping/errors/chapter-download.errors.ts` com codigos: `CHAPTER_NOT_FOUND` (404), `PAGE_NOT_FOUND` (404), `INVALID_PAGE_INDEX` (400), `CHAPTER_DOWNLOAD_FAILED` (500). Registrar os status codes no error handler global de `apps/backend/src/shared/server.ts` (extender o `statusMap` existente em linhas 107-124).

## 2. Backend — ChapterImageService (Lightweight)

- [x] 2.1 Criar `apps/backend/src/modules/scraping/services/chapter-image.service.ts`:
  - `constructor(provider: IProviderStrategy, sourceId: string, chapterId: string)`
  - `getImageUrls(chapterUrl: string): Promise<string[]>` — wrapper para `provider.getChapterImages()`
  - `downloadAll(imageUrls: string[]): Promise<{ downloaded: number; errors: number }>` — baixa todas em paralelo via `provider.downloadImage()`, salva no cache (`storage/sources/{sourceId}/chapters/{chapterId}/0001.jpg`), valida magic bytes
  - `writeManifest(urls: string[]): Promise<void>` — escreve `manifest.json` no diretorio de cache
  - `readManifest(): Promise<ChapterManifest | null>` — le `manifest.json` do cache
  - `getCacheDir(): string` — retorna path absoluto do diretorio de cache
  - `getCachedPath(index: number): string` — retorna path do arquivo de imagem no cache
  - `isCached(): Promise<boolean>` — verifica se diretorio de cache existe **E contem pelo menos 1 arquivo de imagem** (filtro `.jpg/.jpeg/.png/.webp/.gif/.bmp/.avif`), nao so `pathExists` do diretorio

## 3. Backend — Fila BullMQ chapter-download

- [x] 3.1 Criar `apps/backend/src/modules/scraping/services/chapter-download-queue.service.ts`:
  - Fila BullMQ `chapter-download` usando `createQueue<ChapterDownloadData>()`
  - Metodos: `enqueue(data)`, `getJob(jobId)`, `close()`
- [x] 3.2 Criar `apps/backend/src/modules/scraping/workers/chapter-download.worker.ts`:
  - Orquestra fluxo: `resolveProvider(sourceId)` -> carrega source do repo -> pega `chapter.url` -> `provider.getChapterImages(url)` -> `writeManifest(urls)` -> `downloadAll(urls)`
  - Publica progresso via `ChapterDownloadPubSubService`: evento `progress` com `{ downloaded, total }` (contador incremental a cada imagem concluida, independente da ordem de finalizacao do `Promise.allSettled`) e evento `completed`
  - Trata falhas: evento `failed` com mensagem de erro
  - Atualiza Redis Hash `chapter-download-active:{sourceId}:{chapterId}` com `{ jobId, status }` (TTL 24h) para idempotencia do `POST .../download`
  - Funcao `startChapterDownloadWorker()` exportada para bootstrap
- [x] 3.3 Criar `apps/backend/src/modules/scraping/services/chapter-download-pubsub.service.ts`:
  - Pub/Sub dedicado com canal `chapter-download:{sourceId}:{chapterId}` (nao reusa `source:{sourceId}` do scraping)
  - Segue a mesma estrutura do `RedisPubSubService` existente mas com channel prefix proprio
- [x] 3.4 Criar `apps/backend/src/modules/scraping/services/chapter-download-events.service.ts`:
  - Bridge Redis Pub/Sub -> SSE com **journal de eventos** (Redis List + `INCR` para IDs monotonicos)
  - Segue o padrao do `ConversionEventsService` (`apps/backend/src/modules/conversion/services/conversion-events.service.ts`), **nao** do `SourceEventsService` (que e live-only sem replay)
  - Metodo: `stream(sourceId, chapterId, reply)` que conecta cliente SSE ao canal Pub/Sub
  - Replay de eventos do journal para clientes que conectam tardiamente
  - Cleanup no `onClose` da conexao SSE
- [x] 3.5 Registrar worker no bootstrap em `apps/backend/src/shared/server.ts`:
  - Adicionar `import '../modules/scraping/workers/chapter-download.worker'` no top-level (linha ~21-23)
  - Ou usar `startChapterDownloadWorker()` dentro do bloco `if (env.NODE_ENV !== 'test')` (linha 159-161), seguindo o padrao do MOBI preview worker

## 4. Backend — Rotas e Controllers

- [x] 4.1 Criar `apps/backend/src/modules/scraping/chapter.routes.ts`:
  - Schemas Zod para params (`sourceId`, `chapterId`), query e response
  - **Autenticacao**: `POST .../download`, `GET .../download` (status) e `GET .../download/events` (SSE) requerem `onRequest: [verifyJwt]`. `GET .../images/:index` e **publico** (sem JWT) — tags `<img>` nao conseguem enviar Bearer token; segue o padrao do endpoint de capas (`GET /source/:sourceId/covers/:coverId`)
- [x] 4.2 `POST /api/sources/:sourceId/chapters/:chapterId/download`:
  - Controller: `create-chapter-download.controller.ts`
  - Use-case: `create-chapter-download.use-case.ts`
  - Valida se source existe no banco, enfileira job BullMQ
  - Retorna 202 `{ jobId, status: "queued" }` quando enfileira novo job
  - **Regras de idempotencia** (consulta Redis Hash `chapter-download-active:{sourceId}:{chapterId}` antes de enfileirar):
    - Cache completo (imagens em disco): 200 `{ status: "ready" }` — nao enfileira
    - Job `queued` ou `downloading`: 200 com `{ jobId, status }` atual — nao enfileira (job em andamento)
    - Job `completed`: 200 `{ status: "ready" }` — nao enfileira
    - Job `failed`: 202 com novo `jobId` — re-enfileira (retry)
    - Sem cache nem job: 202 com novo `jobId` — enfileira
- [x] 4.3 `GET /api/sources/:sourceId/chapters/:chapterId/download`:
  - Controller: `get-chapter-download.controller.ts`
  - Use-case: consulta status do job BullMQ + estado do cache (quantas imagens prontas)
  - Retorna `{ status, totalImages, downloadedImages, jobId }`
- [x] 4.4 `GET /api/sources/:sourceId/chapters/:chapterId/download/events`:
  - Controller: `chapter-download-events.controller.ts` (SSE)
  - Usa `ChapterDownloadEventsService.subscribe()` para bridge Redis -> SSE
  - Headers SSE: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- [x] 4.5 `GET /api/sources/:sourceId/chapters/:chapterId/images/:index` (publico, sem JWT):
  - Controller: `serve-chapter-image.controller.ts`
  - Use-case: `serve-chapter-image.use-case.ts`
  - Logica:
    1. Cache hit: `readFile(cachedPath)` -> stream com `Cache-Control: public, max-age=86400, immutable`. Content-Type determinado via **magic bytes** do arquivo (nao da extensao), para evitar mismatch quando URL termina em `.jpg` mas o servidor retornou `image/webp`
    2. Cache miss + manifest existe: `resolveProvider(sourceId)` -> le URL do `manifest.json` pelo indice -> `provider.downloadImage(urls[index-1])` -> stream (NAO salva no disco). Content-Type do `contentType` retornado pelo provider
    3. Cache miss + manifest existe + proxy falha (URL expirada, erro de rede): retorna **425 Too Early** com `{ readyPages, totalPages }` do manifest. O frontend faz retry a cada 500ms ate a imagem aparecer no cache (worker em progresso) ou ate timeout
    4. Cache miss + sem manifest (capitulo baixado via conversao antiga sem manifest): `resolveProvider(sourceId)` -> carrega `chapter.url` do `SourceCacheRepository` -> `provider.getChapterImages(chapter.url)` para obter URLs -> `provider.downloadImage(urls[index-1])` -> stream (NAO salva no disco)
    5. Cache miss + sem manifest + sem chapter.url: 404 `PAGE_NOT_FOUND`
    6. Indice < 1 ou > totalImages: 400 `INVALID_PAGE_INDEX`
  - Contar `readyPages` (arquivos de imagem no cache) e comparar com `totalPages` do manifest para construir a resposta 425 quando aplicavel
- [x] 4.6 Estender `GET /api/conversions/source/inspect/:sourceId`:
  - Modificar `get-source.use-case.ts` para adicionar `isDownloaded` a cada `Chapter`
  - Para cada capitulo: `readdir(storage/sources/{sourceId}/chapters/{chapterId}/)` + filtrar por extensoes de imagem (`.jpg/.jpeg/.png/.webp/.gif/.bmp/.avif`). `isDownloaded = true` se e somente se o diretorio existe E tem >= 1 arquivo de imagem. Diretorio vazio ou com apenas `manifest.json` = `false`
  - Atualizar o schema Zod `chapterSchema` em `scraping.routes.ts` (linha 15-22) para incluir `isDownloaded: z.boolean()`

## 4.7. Backend — Modificar ImageDownloaderService Existente

- [x] 4.7.1 Modificar `apps/backend/src/modules/conversion/services/image-downloader.service.ts`:
  - Apos baixar todas as imagens de um capitulo (cache miss path, apos o loop `Promise.allSettled`), escrever `manifest.json` no diretorio de cache com `{ totalImages: imageUrls.length, urls: imageUrls }`
  - Reutilizar a funcao `writeManifest` do `ChapterImageService` (ou extrair para utilitario compartilhado em `filesystem.ts`)
  - **Nao escrever manifest no cache hit path** — as URLs originais nao estao disponiveis no cache hit, e escrever manifest com `urls: []` faria o proxy tentar URLs inexistentes. Sem manifest, o proxy cai no fallback path 3 (`getChapterImages()` on-the-fly), que e o comportamento correto para capitulos baixados via conversao antiga
- [x] 4.7.2 Teste: adicionar cenario em `image-downloader.service.test.ts` (teste existente) que verifica que `manifest.json` e escrito apos o download (cache miss path) e que **nao** e escrito no cache hit path

## 5. Backend — Testes

- [x] 5.1 `chapter-image.service.test.ts`: download de imagens (mock provider), cache hit/miss, validacao de magic bytes, escrita/leitura de manifest, `isCached()`.
- [x] 5.2 `chapter-download.worker.test.ts`: fluxo completo com `MockScrapingProvider`, mock do `RedisPubSubService`, mock do `SourceCacheRepository`. Verificar que `manifest.json` e imagens sao escritos, eventos Pub/Sub emitidos.
- [x] 5.3 `chapter-download-events.service.test.ts`: subscribe/unsubscribe, replay de eventos do journal, cleanup no close.
- [x] 5.3.1 `chapter-download-pubsub.service.test.ts`: publicacao no canal `chapter-download:{sourceId}:{chapterId}`, subscribe recebe mensagens corretas, unsubscribe limpa conexao.
- [x] 5.4 `get-source.use-case.test.ts`: adicionar cenario que verifica `isDownloaded` no array `chapters` do response.
- [x] 5.5 `resolve-provider.test.ts`: resolucao via sourceId com `SourceCacheRepository.load()` mockado, fallback quando source nao existe.
- [x] 5.6 E2E `POST .../download`: retorna 202 com `jobId`, valida se job foi enfileirado na fila `chapter-download`.
- [x] 5.7 E2E `GET .../download`: retorna status correto (`queued`, `downloading`, `ready`, `failed`).
- [x] 5.8 E2E `GET .../download/events`: SSE emite `progress` durante download e `completed` ao finalizar.
- [x] 5.9 E2E `GET .../images/:index`:
  - Cache hit: stream do arquivo existente com Content-Type correto (via magic bytes) e header `Cache-Control`.
  - Cache miss + manifest: chama `provider.downloadImage()`, retorna buffer com Content-Type correto, NAO escreve no disco.
  - Cache miss + manifest + proxy falha (URL expirada/erro de rede): retorna **425 Too Early** com `{ readyPages, totalPages }`.
  - Cache miss + sem manifest (fallback): carrega `chapter.url` do banco, chama `provider.getChapterImages()`, chama `provider.downloadImage()`, retorna buffer, NAO escreve no disco.
  - Cache miss + sem manifest + sem chapter.url: 404 `PAGE_NOT_FOUND`.
  - Index out of range (> totalImages): 400 `INVALID_PAGE_INDEX`.
  - Index < 1: 400 `INVALID_PAGE_INDEX`.

## 6. Frontend — Tipos e API Client

- [x] 6.1 Adicionar tipos em `apps/frontend/src/types/`:
  - `ChapterDownloadStatus`: `{ status, totalImages, downloadedImages, jobId }`
  - `ChapterPage`: `{ index: number, url: string }`
  - Estender `Chapter` (de `scraping.ts`) com `isDownloaded: boolean`
- [x] 6.2 Adicionar funcoes no API client (`apps/frontend/src/lib/api.ts` ou novo `chaptersApi`):
  - `chaptersApi.download(sourceId, chapterId)` -> `POST .../download`
  - `chaptersApi.getDownloadStatus(sourceId, chapterId)` -> `GET .../download`
  - `chaptersApi.downloadEventsUrl(sourceId, chapterId)` -> URL para `EventSource`
  - `chaptersApi.pageUrl(sourceId, chapterId, index)` -> URL para `GET .../images/:index`

## 7. Frontend — Hooks

- [x] 7.1 Criar `apps/frontend/src/hooks/useChapterDownload.ts`:
  - Parametros: `sourceId: string`, `chapterId: string`, `enabled: boolean`
  - Estado: `{ status, totalImages, downloadedImages }` atualizado via `EventSource`
  - Inicia `EventSource` no `useEffect` quando `enabled=true`
  - Limpa `EventSource` no cleanup do `useEffect`
  - Retorna: `{ status, totalImages, downloadedImages, progress }` onde `progress = downloadedImages/totalImages`
- [x] 7.2 Criar `apps/frontend/src/hooks/useChapterPages.ts`:
  - Parametros: `sourceId: string`, `chapterId: string`, `totalPages: number`, `enabled: boolean`
  - Retorna array de URLs para cada pagina (`chaptersApi.pageUrl(sourceId, chapterId, index)`)
  - Opcional: logica de pre-fetch / lazy loading futuro

## 8. Frontend — Componentes

- [x] 8.1 Atualizar `apps/frontend/src/components/biblioteca/TabCapitulos.tsx`:
  - Trocar `MOCK_CACHED_CHAPTERS` por dados reais via `useScraping(sourceId)?.chapters`
  - Exibir badge `isDownloaded`: icone `CheckCircle` verde (cacheado) ou `CloudOff` cinza (nao cacheado)
  - onClick no capitulo:
    - `isDownloaded=true` -> `navigate({ to: '/biblioteca/reader-chapter/$sourceId', search: { chapterId } })`
    - `isDownloaded=false` -> `setDownloadTarget({ sourceId, chapterId })` abre modal
  - Manter layout existente (numero, titulo, paginas)
- [x] 8.2 Criar `apps/frontend/src/components/biblioteca/DownloadChapterDialog.tsx`:
  - Props: `open: boolean`, `onOpenChange: (open: boolean) => void`, `sourceId: string`, `chapterId: string`, `chapterTitle: string`, `onConfirm: () => void`
  - Conteudo: `SpeechBubble` com texto "Este capitulo nao esta em cache. Deseja baixar para ler?"
  - Botao "Cancelar" (outline) + botao "Baixar e Ler" (primario `bg-comic-red`)
  - `onConfirm` dispara `chaptersApi.download(sourceId, chapterId)` e navega para o reader
- [x] 8.3 Criar `apps/frontend/src/components/reader/ChapterReader.tsx`:
  - Props: `sourceId: string`, `chapterId: string`, `totalPages: number | null`
  - Estados:
    - **Loading** (`status === "downloading"`): progresso via `useChapterDownload`, barra de progresso, spinner. Se `totalImages` ainda e `0` ou `null` (worker nao escreveu manifest ainda), exibir "Carregando..." em vez da barra de progresso
    - **Ready** (`status === "ready"`): galeria de imagens
    - **Error** (`status === "failed"`): mensagem de erro + botao "Tentar novamente"
  - Navegacao:
    - Teclado: ArrowLeft / ArrowRight (ou A/D) para pagina anterior/proxima
    - Suporte a `mangaMode`: inverte direcao (ArrowRight = pagina anterior)
    - `ReaderToolbar` fixo no bottom com pagina atual / total e barra de progresso
  - Imagens: `<img>` com `src={chaptersApi.pageUrl(...)}`, `loading="lazy"` para paginas distantes
  - Fallback: se imagem falhar (`onError`), placeholder "Pagina indisponivel"
  - Layout: imagens centralizadas com `max-h-screen`, scroll vertical entre paginas

## 9. Frontend — Rota

- [x] 9.1 Criar `apps/frontend/src/routes/biblioteca.reader-chapter.$sourceId.tsx`:
  - `createFileRoute("/biblioteca/reader-chapter/$sourceId")`
  - `validateSearch: z.object({ chapterId: z.string() })`
  - `beforeLoad`: auth guard
  - Componente:
    - Header: botao voltar (`ArrowLeft`) + titulo do capitulo (do `useScraping`)
    - Se `status === "ready"` (cache hit): renderiza `<ChapterReader>` direto
    - Se nao cacheado: dispara `chaptersApi.download()`, mostra `<ChapterReader>` com estado loading
    - Usa `useScraping(sourceId)` para obter titulo do capitulo. `totalPages` vem do `useChapterDownload` hook (atualizado via SSE quando o worker escreve o manifest). Inicialmente `null` — o `ChapterReader` mostra "Carregando..." ate receber o primeiro evento `progress` com `total > 0`
- [x] 9.2 Atualizar `apps/frontend/src/routes/biblioteca.$sourceId.tsx`:
  - Passar `sourceId` real para `TabCapitulos` (remover mock)
  - Adicionar estado `downloadTarget` para controlar abertura do `DownloadChapterDialog`

## 10. Frontend — Testes

- [x] 10.1 `ChapterReader.test.tsx`:
  - Renderiza imagens quando status e `ready`
  - Exibe barra de progresso quando status e `downloading`
  - Navegacao prev/next via clique e teclado
  - Fallback quando imagem falha (`onError`)
  - Modo manga inverte direcao de navegacao
- [x] 10.2 `DownloadChapterDialog.test.tsx`:
  - Abre/fecha corretamente via props `open`
  - Botao "Cancelar" fecha o modal
  - Botao "Baixar e Ler" dispara `onConfirm`
- [x] 10.3 `TabCapitulos.test.tsx`:
  - Renderiza capitulos com badges `isDownloaded` (check verde / nuvem cinza)
  - Clique em capitulo cacheado navega para reader
  - Clique em capitulo nao cacheado abre modal
  - Lista vazia exibe mensagem "Nenhum capitulo disponivel"
- [x] 10.4 `useChapterDownload.test.ts`:
  - `EventSource` conecta e atualiza estado com eventos `progress`
  - Estado `completed` quando evento `completed` recebido
  - Limpa `EventSource` no unmount
  - Reconecta em caso de erro de conexao
- [x] 10.5 `useChapterPages.test.ts`:
  - Gera URLs corretas para cada indice de pagina
  - Array vazio quando `totalPages=0`

## 11. Integracao e Verificacao

- [x] 11.1 Remover `MOCK_CACHED_CHAPTERS` e referencias mockadas da aba Capitulos.
- [x] 11.2 Verificar que `routeTree.gen.ts` e regenerado corretamente apos nova rota.
- [x] 11.3 `pnpm lint` — zero erros ESLint em todos os pacotes.
- [x] 11.4 `pnpm test` — todos os testes (existentes + novos) passam.
- [x] 11.5 `pnpm build` — frontend e backend compilam sem erros TypeScript.
- [x] 11.6 Teste manual end-to-end:
  1. Abrir `/biblioteca/:sourceId` -> aba Capitulos exibe lista real com badges `isDownloaded`.
  2. Clicar em capitulo cacheado -> reader abre com navegacao prev/next.
  3. Clicar em capitulo nao cacheado -> modal abre -> confirmar -> download inicia -> reader abre com progresso.
  4. SSE mostra progresso em tempo real durante download.
  5. Paginas carregam conforme ficam disponiveis.
  6. Reader funciona com teclado (ArrowLeft/Right) e botoes na tela.
  7. Modo manga inverte direcao de navegacao.

---

## Ordem de Implementacao

```
1 (tipos + util) -> 2 (ChapterImageService) -> 3 (fila + worker + events)
  -> 4 (rotas + controllers) -> 5 (testes backend)
  -> 6 (tipos + API client) -> 7 (hooks) -> 8 (componentes)
  -> 9 (rota) -> 10 (testes frontend) -> 11 (integracao + verificacao)
```

---

## Arquivos a Criar/Modificar

| Acao | Arquivo |
|------|---------|
| **MODIFICAR** | `apps/backend/src/modules/scraping/types/source.types.ts` (add `isDownloaded`) |
| **CRIAR** | `apps/backend/src/modules/scraping/utils/resolve-provider.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/types/chapter-download.types.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/errors/chapter-download.errors.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/services/chapter-image.service.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/services/chapter-download-queue.service.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/services/chapter-download-pubsub.service.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/services/chapter-download-events.service.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/workers/chapter-download.worker.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/chapter.routes.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/controllers/create-chapter-download.controller.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/controllers/get-chapter-download.controller.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/controllers/chapter-download-events.controller.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/controllers/serve-chapter-image.controller.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/use-cases/create-chapter-download.use-case.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/use-cases/get-chapter-download.use-case.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/use-cases/serve-chapter-image.use-case.ts` |
| **MODIFICAR** | `apps/backend/src/modules/scraping/use-cases/get-source.use-case.ts` (add `isDownloaded` com verificacao de arquivos de imagem) |
| **MODIFICAR** | `apps/backend/src/modules/conversion/workers/conversion-job.worker.ts` (extrair `resolveProvider`) |
| **MODIFICAR** | `apps/backend/src/modules/conversion/services/image-downloader.service.ts` (escrever `manifest.json` apos download) |
| **MODIFICAR** | `apps/backend/src/shared/server.ts` (registrar chapter-download worker + error codes no handler) |
| **MODIFICAR** | `apps/backend/src/modules/scraping/scraping.routes.ts` (add `isDownloaded` ao `chapterSchema` Zod, linha 15-22) |
| **CRIAR** | `apps/backend/src/modules/scraping/tests/unit/chapter-image.service.test.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/tests/unit/chapter-download.worker.test.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/tests/unit/chapter-download-events.service.test.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/tests/unit/chapter-download-pubsub.service.test.ts` |
| **MODIFICAR** | `apps/backend/src/modules/scraping/tests/unit/get-source.use-case.test.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/tests/unit/resolve-provider.test.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/tests/e2e/chapter-download.e2e.test.ts` |
| **CRIAR** | `apps/backend/src/modules/scraping/tests/e2e/chapter-image-serve.e2e.test.ts` |
| **MODIFICAR** | `apps/backend/src/modules/conversion/tests/` (adicionar cenario de manifest.json no teste existente do image-downloader) |
| **MODIFICAR** | `apps/frontend/src/types/scraping.ts` (estender `Chapter`) |
| **CRIAR** | `apps/frontend/src/types/chapter-reader.ts` |
| **MODIFICAR** | `apps/frontend/src/lib/api.ts` (add `chaptersApi`) |
| **CRIAR** | `apps/frontend/src/hooks/useChapterDownload.ts` |
| **CRIAR** | `apps/frontend/src/hooks/useChapterPages.ts` |
| **MODIFICAR** | `apps/frontend/src/components/biblioteca/TabCapitulos.tsx` |
| **CRIAR** | `apps/frontend/src/components/biblioteca/DownloadChapterDialog.tsx` |
| **CRIAR** | `apps/frontend/src/components/reader/ChapterReader.tsx` |
| **CRIAR** | `apps/frontend/src/routes/biblioteca.reader-chapter.$sourceId.tsx` |
| **MODIFICAR** | `apps/frontend/src/routes/biblioteca.$sourceId.tsx` |
| **CRIAR** | `apps/frontend/src/components/reader/ChapterReader.test.tsx` |
| **CRIAR** | `apps/frontend/src/components/biblioteca/DownloadChapterDialog.test.tsx` |
| **CRIAR** | `apps/frontend/src/components/biblioteca/TabCapitulos.test.tsx` |
| **CRIAR** | `apps/frontend/src/hooks/useChapterDownload.test.ts` |
| **CRIAR** | `apps/frontend/src/hooks/useChapterPages.test.ts` |
