# Chapter Reader — Proposta

> **Status:** IMPLEMENTED
> **Data:** 2026-07-23
> **Modulo:** `backend` (scraping + sources) + `frontend` (reader + biblioteca)

---

## 1. Problema

Atualmente a aba "Capitulos" em `/biblioteca/$sourceId` exibe dados inteiramente mockados (`MOCK_CACHED_CHAPTERS`). Nao ha como:

- Saber se um capitulo ja teve suas imagens baixadas do site fonte.
- Visualizar as paginas de um capitulo diretamente no navegador (leitura online).
- Disparar download sob demanda de um capitulo especifico sem passar pelo pipeline completo de conversao KCC.

O usuario precisa de um fluxo leve para **ler capitulos avulsos** sem criar uma conversao EPUB/MOBI.

---

## 2. Solucao Proposta

### 2.1. Fluxo Geral

```
Usuario na aba "Capitulos"
        |
        v
GET /source/inspect/:sourceId  ->  chapters: [{... isDownloaded: true/false }]
        |
        +-- isDownloaded=true
        |   -> navigate -> /biblioteca/reader-chapter/$sourceId?chapterId=X
        |        |
        |        v
        |   GET .../images/0001.jpg
        |        |
        |        +-- cache hit -> stream do disco
        |        +-- cache miss + manifest -> provider.downloadImage() -> stream (sem salvar)
        |
        +-- isDownloaded=false -> Modal "Baixar para ler?"
                 | (confirma)
                 v
            POST .../download -> 202 + enfileira BullMQ
                 |
                 v
            Reader abre + EventSource SSE
                 |
                 v
            Worker: resolveProvider -> getChapterImages -> manifest.json
                    -> downloadAll (salva no disco) -> Pub/Sub progress
                 |
                 v
            Frontend reage a eventos SSE -> imagens aparecem conforme ficam prontas
```

### 2.2. Backend — Novos Endpoints

| Metodo | Path | Descricao |
|--------|------|-----------|
| `POST` | `/api/sources/:sourceId/chapters/:chapterId/download` | Enfileira download BullMQ -> 202 |
| `GET` | `/api/sources/:sourceId/chapters/:chapterId/download` | Status do download (poll) |
| `GET` | `/api/sources/:sourceId/chapters/:chapterId/download/events` | SSE de progresso |
| `GET` | `/api/sources/:sourceId/chapters/:chapterId/images/:index` | Serve imagem (cache-first + proxy) |

**Regras de idempotencia do `POST .../download`:**

| Condico no momento do POST | Resposta | Acao |
|-----|------|---------|
| Cache completo (imagens em disco) | 200 `{ status: "ready" }` | Nao enfileira — cache ja existe |
| Job existe e esta `queued` ou `downloading` | 200 com `jobId` e `status` atual | Nao enfileira — job em andamento |
| Job existe e esta `completed` | 200 `{ status: "ready" }` | Nao enfileira — ja terminou |
| Job existe e esta `failed` | 202 com novo `jobId` | Re-enfileira novo job (retry automatico) |
| Nao existe cache nem job ativo | 202 com novo `jobId` | Enfileira novo job |

> **Deteccao de jobs ativos:** Para saber se um job existe/atul para um capitulo, mantemos um Redis Hash `chapter-download-active:{sourceId}:{chapterId}` com `{ jobId, status }` e TTL de 24h. Quando o worker completa/falha, atualiza o status. O POST consulta esse Hash antes de decidir enfileirar.

### 2.3. Backend — Estender Endpoint Existente

- `GET /api/conversions/source/inspect/:sourceId`: adicionar campo `isDownloaded: boolean` em cada `Chapter` do response. Calculado verificando se o diretorio `storage/sources/{sourceId}/chapters/{chapterId}/` existe **E contem pelo menos 1 arquivo de imagem** (filtro por extensao `.jpg/.jpeg/.png/.webp/.gif/.bmp/.avif`). Um diretorio vazio ou com apenas `manifest.json` NAO conta como cacheado — evita falso positivo quando o worker criou o dir mas ainda nao baixou imagens.

> **Nota de performance:** Para obras com 500+ capitulos, a verificacao sincrona por capitulo (`readdir` + filtro) pode ser lenta (~500 chamadas de I/O). Para o MVP, a verificacao direta e aceitavel. Otimizacao futura: cachear o resultado em Redis com TTL curto (ex: 60s) ou computar lazy on-demand apenas para capitulos visiveis na viewport (paginacao server-side).

### 2.4. Proxy Inteligente (GET images/:index)

```
1. Cache hit (arquivo no disco)?
   -> stream do arquivo local com Cache-Control
   -> Content-Type derivado de magic bytes (nao da extensao do arquivo)

2. Cache miss + manifest.json existe (download em progresso)?
   -> busca URL externa do manifest pelo indice
   -> provider.downloadImage(url) via Bottleneck compartilhado
   -> stream direto pro frontend (NAO salva no disco)

3. Cache miss + sem manifest (capitulo baixado via conversao antiga)?
   -> resolveProvider(sourceId) -> carrega chapter.url do banco
   -> provider.getChapterImages(chapter.url) para obter URLs
   -> provider.downloadImage(urls[index-1]) -> stream (NAO salva no disco)

4. Cache miss + sem manifest + sem chapter.url?
   -> 404 PAGE_NOT_FOUND
```

**Regra fundamental:** Apenas o Worker do BullMQ escreve no disco. O endpoint de leitura nunca escreve — elimina race conditions.

**Autenticacao:** O endpoint `GET .../images/:index` e **publico (sem JWT)** — tags `<img>` no browser nao conseguem enviar Bearer token. Os endpoints `POST .../download`, `GET .../download` (status) e `GET .../download/events` (SSE) requerem `verifyJwt`. Segue o mesmo padrao do endpoint de capas (`GET /source/:sourceId/covers/:coverId` — publico).

### 2.5. Frontend

- **`TabCapitulos`**: substituir mock por dados reais do `GET /source/inspect/:sourceId`. Exibir badge `isDownloaded` (check verde / nuvem cinza). onClick navega para reader ou abre modal.
- **`DownloadChapterDialog`**: modal "Este capitulo nao esta em cache. Deseja baixar para ler?". Confirmacao chama `POST .../download`.
- **Rota `/biblioteca/reader-chapter/$sourceId`**: galeria de imagens com navegacao prev/next. Estados: loading (SSE progresso), pronto (imagens), erro. Reaproveitar `ReaderToolbar` existente.
- **`useChapterDownload`**: hook com `EventSource` nativo (sem polling) para progresso em tempo real.
- **`useChapterPages`**: hook para fetch de paginas individuais via `GET .../images/:index`.

### 2.6. Servicos Internos

- **`ChapterImageService`** (lightweight): `downloadAll()` salva no disco; `getImageUrls()` faz scrape via provider; `writeManifest()` / `readManifest()` gerencia arquivo `manifest.json` com mapeamento indice -> URL.
- **`resolveProvider(sourceId)`**: extraido do `conversion-job.worker.ts` como utilitario compartilhado. Singleton de `ProviderResolver` para compartilhar instancias Bottleneck entre proxy e worker.
- **Fila BullMQ `chapter-download`**: worker orquestra scrape de URLs + download de imagens + Pub/Sub progresso.
- **`ChapterDownloadPubSubService`**: servico Pub/Sub dedicado com canal `chapter-download:{sourceId}:{chapterId}` (nao reusa o canal `source:{sourceId}` do scraping — evita misturar eventos de scraping e de download de capitulo).
- **`ChapterDownloadEventsService`**: bridge Redis Pub/Sub -> SSE com **journal de eventos** (Redis List + `INCR` para IDs monotonicos).Segue o padrao do `ConversionEventsService` (que tem journal/replay), **nao** do `SourceEventsService` (que e live-only sem replay). O replay permite que clientes que conectam tardiamente ao SSE recebam eventos ja emitidos.

### 2.7. Modificacao do ImageDownloaderService Existente

O `ImageDownloaderService` (usado pelo worker de conversao) deve escrever `manifest.json` **apenas no cache miss path** — quando baixa imagens novas do site fonte. Isso garante que capitulos baixados via conversao (fluxo existente) tenham o manifest disponivel para o proxy inteligente.

**Importante:** No cache hit path (imagens ja em disco), o manifest **NAO deve ser escrito retroativamente**, pois as URLs originais nao estao disponiveis — apenas os arquivos em disco. Escrever um manifest com `urls: []` ou `null` faria o proxy tentar baixar URLs inexistentes. Sem manifest, o proxy cai no path 3 (`getChapterImages()` on-the-fly), que e o comportamento correto para capitulos baixados via conversao antiga. Para capitulos novos baixados via conversao, o manifest sera escrito no cache miss e o path 2 funcionara normalmente.

### 2.8. Erros de Dominio

Criar `chapter-download.errors.ts` com codigos de erro mapeados no error handler global de `server.ts`:

| Codigo | HTTP | Descricao |
|--------|------|-----------|
| `CHAPTER_NOT_FOUND` | 404 | Capitulo nao existe ou nao pertence ao source |
| `PAGE_NOT_FOUND` | 404 | Imagem nao existe no cache e nao foi possivel fazer proxy |
| `INVALID_PAGE_INDEX` | 400 | Indice fora do range valido |
| `CHAPTER_DOWNLOAD_FAILED` | 500 | Erro durante o download no worker |

---

## 3. Escopo

### Incluido

- [ ] Campo `isDownloaded` no `Chapter` do `GET /source/inspect/:sourceId` (verifica arquivos de imagem, nao so diretorio)
- [ ] Utilitario `resolveProvider(sourceId)` extraido do worker
- [ ] `ChapterImageService` com `downloadAll`, `getImageUrls`, `writeManifest`, `readManifest`
- [ ] Modificacao do `ImageDownloaderService` existente para escrever `manifest.json` durante conversoes
- [ ] Fila BullMQ `chapter-download` + worker + `ChapterDownloadPubSubService` (canal dedicado) + `ChapterDownloadEventsService` (com journal/replay)
- [ ] 4 endpoints REST sob `/api/sources/:sourceId/chapters/:chapterId/...` (imagens publico, download com JWT)
- [ ] Proxy inteligente: `provider.downloadImage()` sem escrita em disco, Bottleneck compartilhado, fallback com `getChapterImages()` quando sem manifest
- [ ] Erros de dominio `chapter-download.errors.ts` + registro no error handler global de `server.ts`
- [ ] `TabCapitulos` com dados reais + `isDownloaded`
- [ ] `DownloadChapterDialog` modal
- [ ] Rota `/biblioteca/reader-chapter/$sourceId` + `ChapterReader` (lida com `totalPages` unknown inicialmente)
- [ ] `useChapterDownload` com `EventSource` SSE
- [ ] `useChapterPages` para fetch de paginas
- [ ] Bootstrap do worker em `server.ts` (import top-level + guard `NODE_ENV !== 'test'`)
- [ ] Testes unitarios e E2E (backend + frontend)

### Fora de Escopo (futuro)

- [ ] Leitura de capitulos diretamente do ZIP de saida de conversao
- [ ] Progresso de leitura persistido (historico de qual pagina o usuario parou)
- [ ] Pre-fetch de paginas seguintes (lookahead)
- [ ] Suporte a scroll continuo (webtoon mode)
- [ ] Zoom / fullscreen no reader
- [ ] Remocao de cache de capitulo pelo usuario
- [ ] Download em lote (multiplos capitulos de uma vez)

---

## 4. Criterios de Aceitacao

1. **`isDownloaded` no response**: `GET /source/inspect/:sourceId` retorna `chapters[]` com campo `isDownloaded: boolean` que reflete existencia de arquivos de imagem no diretorio de cache (nao so o diretorio).
2. **Download assincrono**: `POST .../download` retorna 202 e enfileira job BullMQ. Worker baixa todas as imagens para `storage/sources/{sourceId}/chapters/{chapterId}/`.
3. **SSE progresso com replay**: `GET .../download/events` emite eventos `progress` com `{ downloaded, total }` e evento `completed` ao finalizar. Clientes que conectam tardiamente recebem eventos do journal (Redis List).
4. **Proxy inteligente**: `GET .../images/:index` (publico, sem JWT) serve imagem do cache se existir; se nao, faz proxy via `provider.downloadImage()` se `manifest.json` existir; senao faz fallback com `provider.getChapterImages()` para obter URLs; senao retorna 404.
5. **Zero race conditions**: endpoint de imagens nunca escreve no disco. Worker e unico escritor.
6. **Manifest retroativo**: `ImageDownloaderService` existente escreve `manifest.json` ao baixar imagens durante conversoes, garantindo que capitulos convertidos anteriormente funcionem com o proxy.
7. **Reader funcional**: navegacao prev/next entre paginas, barra de progresso (`ReaderToolbar`), modo manga (right-to-left). Lida com `totalPages` unknown inicialmente (mostra "Carregando..." ate o worker escrever o manifest).
8. **Modal de download**: capitulo nao cacheado abre modal; confirmacao dispara download e redireciona ao reader.
9. **Erros de dominio**: `CHAPTER_NOT_FOUND` (404), `PAGE_NOT_FOUND` (404), `INVALID_PAGE_INDEX` (400), `CHAPTER_DOWNLOAD_FAILED` (500) mapeados no error handler global.
10. **Testes passam**: `pnpm test` sem falhas nos novos testes unitarios e E2E.
11. **Build compila**: `pnpm lint` + `pnpm build` (frontend e backend) sem erros.

---

## 5. Dependencias

- **`IProviderStrategy`** (ja existe) — `getChapterImages()`, `downloadImage()`
- **`ProviderResolver`** (ja existe) — resolucao de provider por URL
- **`SourceCacheRepository.load()`** (ja existe) — carrega source com chapters + URLs
- **`Bottleneck` (rate limiter)** (ja existe) — compartilhado entre proxy e worker
- **`BullMQ` + `createQueue()`** (ja existe) — fabrica de filas
- **`RedisPubSubService`** (ja existe) — Pub/Sub para SSE
- **`pathExists`, `mkdirp`, `readFile`, `writeFile`** (ja existe em `filesystem.ts`)
- **`useScraping` hook** (ja existe no frontend) — fetch de source metadata
- **`ReaderToolbar`** (ja existe, nao usado) — barra inferior de progresso
- **`ComicPanel`, `SpeechBubble`** (ja existem) — componentes comic
- **`Tabs`, `Dialog`** (ja existem em shadcn/ui) — abas e modal

---

## 6. Stack e Convencoes

- **Backend:** Fastify 5 + TypeScript + Prisma + Zod + BullMQ + ioredis
- **Frontend:** React 19 + Vite + TanStack Router + TanStack Query + Tailwind CSS v4
- **Testes:** Vitest (unit + E2E com in-memory/mock repos)
- **Naming:** endpoints sob `/api/sources/` (dominio de fonte), separado de `/api/conversions/` (pipeline KCC)
- **Design system:** comic-pop-art com `border-ink`, `shadow-comic`, `font-display`, `ComicPanel`
- **UI:** Portugues Brasileiro
