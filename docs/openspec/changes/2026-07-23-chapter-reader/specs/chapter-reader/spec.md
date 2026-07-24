# chapter-reader Specification

## Purpose
Permitir que o usuario visualize e leia capitulos individuais diretamente no navegador, com download sob demanda das imagens do site fonte e proxy inteligente para entrega progressiva.

## ADDED Requirements

### Requirement: Listagem de Capitulos com Status de Cache

O endpoint `GET /api/conversions/source/inspect/:sourceId` SHALL retornar cada `Chapter` com um campo `isDownloaded: boolean` indicando se as imagens daquele capitulo estao cacheadas em disco.

#### Scenario: Capitulo cacheado
- **GIVEN** o diretorio `storage/sources/{sourceId}/chapters/{chapterId}/` existe e contem pelo menos 1 arquivo de imagem (extensao `.jpg/.jpeg/.png/.webp/.gif/.bmp/.avif`)
- **WHEN** `GET /source/inspect/:sourceId` e chamado
- **THEN** o `Chapter` correspondente SHALL ter `isDownloaded: true`

#### Scenario: Capitulo nao cacheado
- **GIVEN** o diretorio `storage/sources/{sourceId}/chapters/{chapterId}/` nao existe, OU existe mas nao contem arquivos de imagem (apenas `manifest.json` ou vazio)
- **WHEN** `GET /source/inspect/:sourceId` e chamado
- **THEN** o `Chapter` correspondente SHALL ter `isDownloaded: false`

#### Scenario: Source nao encontrado
- **GIVEN** `sourceId` nao existe no banco
- **WHEN** `GET /source/inspect/:sourceId` e chamado
- **THEN** a API SHALL retornar 404 com codigo `SOURCE_NOT_FOUND`

---

### Requirement: Download Assincrono de Capitulo via BullMQ

O endpoint `POST /api/sources/:sourceId/chapters/:chapterId/download` SHALL enfileirar um job BullMQ para download das imagens do capitulo e retornar 202 imediatamente.

#### Scenario: Download enfileirado com sucesso
- **GIVEN** `sourceId` e `chapterId` validos e source existe no banco
- **WHEN** `POST .../download` e chamado
- **THEN** um job SHALL ser enfileirado na fila `chapter-download` com dados `{ sourceId, chapterId }`
- **AND** a resposta SHALL ser 202 com body `{ jobId: string, status: "queued" }`

#### Scenario: Source nao encontrado
- **GIVEN** `sourceId` nao existe no banco
- **WHEN** `POST .../download` e chamado
- **THEN** a API SHALL retornar 404 com codigo `SOURCE_NOT_FOUND`

#### Scenario: Capitulo nao pertence ao source
- **GIVEN** `sourceId` existe mas `chapterId` nao pertence a ele
- **WHEN** `POST .../download` e chamado
- **THEN** a API SHALL retornar 404 com codigo `CHAPTER_NOT_FOUND`

#### Scenario: Idempotencia — job em andamento
- **GIVEN** ja existe um job ativo (queued ou downloading) para o mesmo `sourceId` + `chapterId`
- **WHEN** `POST .../download` e chamado novamente
- **THEN** a API SHALL retornar 200 com o `jobId` existente e `status` atual
- **AND** nenhum novo job SHALL ser enfileirado

#### Scenario: Idempotencia — cache completo
- **GIVEN** o cache do capitulo ja existe em disco com o numero esperado de imagens
- **WHEN** `POST .../download` e chamado
- **THEN** a API SHALL retornar 200 `{ status: "ready" }` sem enfileirar nenhum job

#### Scenario: Idempotencia — job completed
- **GIVEN** existe um job `completed` para o capitulo
- **WHEN** `POST .../download` e chamado
- **THEN** a API SHALL retornar 200 `{ status: "ready" }` sem enfileirar

#### Scenario: Retry — job failed
- **GIVEN** existe um job `failed` para o capitulo
- **WHEN** `POST .../download` e chamado
- **THEN** a API SHALL retornar 202 com um novo `jobId` e enfileirar novo job (retry automatico)

---

### Requirement: Worker de Download de Imagens

O worker da fila `chapter-download` SHALL: resolver o provider, obter as URLs das imagens do site fonte, escrever `manifest.json` no cache, baixar todas as imagens em paralelo salvando no disco, e publicar progresso via Redis Pub/Sub.

#### Scenario: Fluxo completo de download
- **GIVEN** um job `{ sourceId, chapterId }` na fila `chapter-download`
- **WHEN** o worker processa o job
- **THEN** ele SHALL:
  1. Chamar `resolveProvider(sourceId)` para obter `IProviderStrategy`
  2. Carregar source do `SourceCacheRepository.load(sourceId)` para obter `chapter.url`
  3. Chamar `provider.getChapterImages(chapter.url)` para obter `string[]` de URLs
  4. Escrever `manifest.json` no diretorio de cache com `{ totalImages, urls }`
  5. Baixar todas as imagens via `provider.downloadImage(url)` e salvar como `0001.ext, 0002.ext, ...`
  6. Publicar evento `progress` via Redis Pub/Sub a cada imagem baixada
  7. Publicar evento `completed` ao finalizar

#### Scenario: Validacao de magic bytes
- **GIVEN** uma imagem baixada tem buffer invalido (nao comeca com assinatura JPEG/PNG/WEBP/GIF/BMP)
- **WHEN** o worker detecta a corrupcao
- **THEN** a imagem SHALL ser substituida por um placeholder PNG gerado via sharp com texto "Pagina indisponivel"
- **AND** o evento `progress` SHALL incluir informacao de corrupcao

#### Scenario: Falha no download
- **GIVEN** `provider.getChapterImages()` ou `provider.downloadImage()` lanca erro
- **WHEN** o worker nao consegue completar o download
- **THEN** o job SHALL ser marcado como `failed`
- **AND** um evento `failed` com a mensagem de erro SHALL ser publicado via Redis Pub/Sub

#### Scenario: Rate limiting compartilhado
- **GIVEN** o `ProviderResolver` usa singleton com instancias Bottleneck compartilhadas
- **WHEN** o worker e o endpoint de proxy usam o mesmo provider
- **THEN** as chamadas a `downloadImage()` SHALL compartilhar o mesmo pool de rate limiting

---

### Requirement: Consulta de Status do Download

O endpoint `GET /api/sources/:sourceId/chapters/:chapterId/download` SHALL retornar o status atual do download do capitulo.

#### Scenario: Download em progresso
- **GIVEN** um job BullMQ esta ativo para o capitulo
- **WHEN** `GET .../download` e chamado
- **THEN** a resposta SHALL conter `{ status: "downloading" | "queued", totalImages: number, downloadedImages: number, jobId: string }`

#### Scenario: Download concluido (cache hit)
- **GIVEN** o diretorio de cache existe e contem o numero esperado de imagens
- **WHEN** `GET .../download` e chamado
- **THEN** a resposta SHALL conter `{ status: "ready", totalImages: number, downloadedImages: number }`

#### Scenario: Nenhum download ativo ou cache
- **GIVEN** nao ha job ativo e o cache nao existe
- **WHEN** `GET .../download` e chamado
- **THEN** a resposta SHALL conter `{ status: "not_downloaded" }`

---

### Requirement: SSE de Progresso de Download

O endpoint `GET /api/sources/:sourceId/chapters/:chapterId/download/events` SHALL fornecer uma conexao SSE (Server-Sent Events) com eventos de progresso do download em tempo real.

#### Scenario: Eventos de progresso durante download
- **GIVEN** um job de download esta em execucao
- **WHEN** o cliente conecta ao endpoint SSE
- **THEN** eventos `progress` SHALL ser enviados com dados `{ downloaded: number, total: number }`
- **AND** ao finalizar, um evento `completed` SHALL ser enviado com `{ totalImages: number }`

#### Scenario: Conexao tardia (replay via journal)
- **GIVEN** o download ja iniciou e emitiu eventos antes do cliente conectar
- **WHEN** o cliente conecta ao SSE
- **THEN** eventos anteriores armazenados no journal (Redis List com IDs monotonicos via `INCR`) SHALL ser reenviados ao cliente
- **AND** o SSE SHALL seguir o padrao do `ConversionEventsService` (com journal/replay), nao do `SourceEventsService` (live-only sem replay)

#### Scenario: Erro durante download
- **GIVEN** o worker encontra um erro fatal
- **WHEN** o job falha
- **THEN** um evento `failed` SHALL ser enviado com `{ error: string }`
- **AND** a conexao SSE SHALL ser fechada

---

### Requirement: Servir Imagem de Pagina com Proxy Inteligente

O endpoint `GET /api/sources/:sourceId/chapters/:chapterId/images/:index` SHALL servir a imagem da pagina solicitada, com multiplas estrategias de fallback. Este endpoint e **publico (sem requisicao de JWT)** — tags `<img>` no browser nao conseguem enviar Bearer token, seguindo o padrao do endpoint de capas (`GET /source/:sourceId/covers/:coverId`).

#### Scenario: Cache hit — imagem existe no disco
- **GIVEN** o arquivo `storage/sources/{sourceId}/chapters/{chapterId}/{index-padded}.{ext}` existe
- **WHEN** `GET .../images/:index` e chamado
- **THEN** a imagem SHALL ser enviada como stream do arquivo em disco
- **AND** o header `Content-Type` SHALL ser determinado via **magic bytes** do arquivo (nao via extensao), para evitar mismatch quando a URL termina em `.jpg` mas o servidor retornou `image/webp`
- **AND** o header `Cache-Control` SHALL ser `public, max-age=86400, immutable`

#### Scenario: Cache miss + manifest existe (download em progresso)
- **GIVEN** o arquivo nao existe no disco mas `manifest.json` existe no diretorio de cache
- **WHEN** `GET .../images/:index` e chamado
- **THEN** a URL externa SHALL ser lida do `manifest.json` pelo indice
- **AND** `provider.downloadImage(url)` SHALL ser chamado (respeitando Bottleneck compartilhado)
- **AND** o buffer SHALL ser enviado como stream para o frontend
- **AND** o header `Content-Type` SHALL ser o `contentType` retornado pelo provider
- **AND** a imagem NAO SHALL ser salva no disco pelo endpoint (apenas o worker escreve)

#### Scenario: Cache miss + manifest existe + proxy falha (425 Too Early)
- **GIVEN** o arquivo nao existe no disco, `manifest.json` existe, mas `provider.downloadImage()` falha (URL expirada, erro de rede, timeout)
- **AND** o worker ainda esta baixando as imagens em paralelo
- **WHEN** `GET .../images/:index` e chamado
- **THEN** a API SHALL retornar **425 Too Early** com body `{ readyPages: number, totalPages: number }`
- **AND** `readyPages` SHALL ser o numero de arquivos de imagem ja salvos no disco pelo worker
- **AND** `totalPages` SHALL ser o `totalImages` do `manifest.json`
- **AND** o frontend SHALL fazer retry a cada 500ms ate receber 200 (imagem em cache ou proxy com sucesso)

#### Scenario: Cache miss + sem manifest (capitulo baixado via conversao antiga sem manifest)
- **GIVEN** o arquivo nao existe no disco e `manifest.json` tambem nao existe, mas o capitulo tem `url` no banco
- **WHEN** `GET .../images/:index` e chamado
- **THEN** o backend SHALL carregar `chapter.url` do `SourceCacheRepository.load(sourceId)`
- **AND** `provider.getChapterImages(chapter.url)` SHALL ser chamado para obter a lista de URLs
- **AND** `provider.downloadImage(urls[index-1])` SHALL ser chamado para a pagina solicitada
- **AND** o buffer SHALL ser enviado como stream para o frontend (sem salvar no disco)

#### Scenario: Cache miss + sem manifest + sem chapter.url
- **GIVEN** o arquivo nao existe, `manifest.json` nao existe, e o capitulo nao tem `url` no banco
- **WHEN** `GET .../images/:index` e chamado
- **THEN** a API SHALL retornar 404 com codigo `PAGE_NOT_FOUND`

#### Scenario: Indice fora do range
- **GIVEN** `manifest.json` existe com `totalImages: 20`
- **WHEN** `GET .../images/25` e chamado (indice > totalImages)
- **THEN** a API SHALL retornar 400 com codigo `INVALID_PAGE_INDEX`

#### Scenario: Indice menor que 1
- **WHEN** `GET .../images/0` e chamado
- **THEN** a API SHALL retornar 400 com codigo `INVALID_PAGE_INDEX`

---

### Requirement: Aba Capitulos com Dados Reais e isDownloaded

A aba "Capitulos" em `/biblioteca/$sourceId` SHALL exibir a lista real de capitulos obtida de `GET /source/inspect/:sourceId`, com indicacao visual de cache por capitulo.

#### Scenario: Lista de capitulos reais
- **WHEN** o usuario acessa a aba "Capitulos"
- **THEN** os capitulos SHALL ser carregados via `useScraping(sourceId)` (hook existente)
- **AND** cada capitulo SHALL exibir numero, titulo, contagem de paginas
- **AND** cada capitulo SHALL exibir um badge de status de cache

#### Scenario: Badge de capitulo cacheado
- **GIVEN** `chapter.isDownloaded === true`
- **WHEN** o capitulo e renderizado
- **THEN** um badge verde com icone `CheckCircle` SHALL ser exibido

#### Scenario: Badge de capitulo nao cacheado
- **GIVEN** `chapter.isDownloaded === false`
- **WHEN** o capitulo e renderizado
- **THEN** um badge cinza com icone `CloudOff` SHALL ser exibido

#### Scenario: Clique em capitulo cacheado
- **GIVEN** `chapter.isDownloaded === true`
- **WHEN** o usuario clica no capitulo
- **THEN** o router SHALL navegar para `/biblioteca/reader-chapter/$sourceId?chapterId={chapterId}`

#### Scenario: Clique em capitulo nao cacheado
- **GIVEN** `chapter.isDownloaded === false`
- **WHEN** o usuario clica no capitulo
- **THEN** o modal `DownloadChapterDialog` SHALL abrir

---

### Requirement: Modal de Confirmacao de Download

O modal `DownloadChapterDialog` SHALL perguntar ao usuario se deseja baixar o capitulo antes de abrir o reader.

#### Scenario: Modal abre para capitulo nao cacheado
- **GIVEN** `open === true`
- **WHEN** o modal e renderizado
- **THEN** o texto "Este capitulo nao esta em cache. Deseja baixar para ler?" SHALL ser exibido
- **AND** o titulo do capitulo SHALL ser exibido em destaque

#### Scenario: Usuario confirma download
- **WHEN** o usuario clica em "Baixar e Ler"
- **THEN** `onConfirm` SHALL ser chamado
- **AND** a chamada `POST .../download` SHALL ser disparada
- **AND** o modal SHALL fechar

#### Scenario: Usuario cancela
- **WHEN** o usuario clica em "Cancelar"
- **THEN** `onOpenChange(false)` SHALL ser chamado
- **AND** nenhum download SHALL ser disparado

---

### Requirement: Manifest no ImageDownloaderService

O `ImageDownloaderService` existente (usado pelo worker de conversao) SHALL escrever `manifest.json` no diretorio de cache **apenas no cache miss path** — quando baixa imagens novas do site fonte. Isso garante que capitulos baixados via conversao (fluxo existente) tenham o manifest disponivel para o proxy inteligente.

#### Scenario: Manifest escrito apos download de conversao (cache miss)
- **GIVEN** o `ImageDownloaderService` baixou todas as imagens de um capitulo durante uma conversao (cache miss path)
- **WHEN** o download e concluido
- **THEN** um arquivo `manifest.json` SHALL ser escrito no diretorio `storage/sources/{sourceId}/chapters/{chapterId}/` com `{ totalImages: number, urls: string[] }`

#### Scenario: Manifest NAO escrito no cache hit
- **GIVEN** o cache hit path do `ImageDownloaderService` encontra imagens em disco (cache valido)
- **WHEN** o cache hit e processado
- **THEN** o `manifest.json` NAO SHALL ser escrito retroativamente
- **AND** a ausencia do manifest faz o proxy inteligente cair no fallback path 3 (`provider.getChapterImages()` on-the-fly), que e o comportamento correto para capitulos baixados via conversao antiga sem manifest

---

### Requirement: Erros de Dominio do Chapter Reader

O modulo SHALL definir erros de dominio proprios em `chapter-download.errors.ts` e registra-los no error handler global de `server.ts`.

#### Scenario: CHAPTER_NOT_FOUND
- **WHEN** um endpoint recebe `sourceId` valido mas `chapterId` nao pertence ao source
- **THEN** a API SHALL retornar 404 com codigo `CHAPTER_NOT_FOUND`

#### Scenario: PAGE_NOT_FOUND
- **WHEN** `GET .../images/:index` nao encontra a imagem no cache e nao consegue fazer proxy
- **THEN** a API SHALL retornar 404 com codigo `PAGE_NOT_FOUND`

#### Scenario: INVALID_PAGE_INDEX
- **WHEN** `GET .../images/:index` recebe indice < 1 ou > totalImages
- **THEN** a API SHALL retornar 400 com codigo `INVALID_PAGE_INDEX`

---

### Requirement: Reader de Imagens com Navegacao

O componente `ChapterReader` na rota `/biblioteca/reader-chapter/$sourceId` SHALL exibir as paginas do capitulo como imagens navegaveis.

#### Scenario: Reader no estado loading com totalPages desconhecido
- **GIVEN** o status do download e `"downloading"` e `totalImages` ainda e `0` ou `null` (worker nao escreveu manifest)
- **WHEN** o reader e renderizado
- **THEN** uma mensagem "Carregando..." SHALL ser exibida em vez da barra de progresso
- **AND** quando o primeiro evento `progress` com `total > 0` chegar via SSE, a barra de progresso SHALL substituir a mensagem

#### Scenario: Reader no estado loading com totalPages conhecido
- **GIVEN** o status do download e `"downloading"` e `totalImages > 0`
- **WHEN** o reader e renderizado
- **THEN** uma barra de progresso SHALL ser exibida mostrando `downloadedImages / totalImages`
- **AND** atualizacoes de progresso via SSE SHALL ser refletidas em tempo real na barra

#### Scenario: Reader no estado pronto
- **GIVEN** o status do download e `"ready"`
- **WHEN** o reader e renderizado
- **THEN** as imagens SHALL ser carregadas via `GET .../images/:index` para cada pagina
- **AND** a primeira pagina SHALL ser exibida

#### Scenario: Navegacao para proxima pagina
- **GIVEN** o usuario esta na pagina N (N < totalPages)
- **WHEN** o usuario clica no botao "Proxima" ou pressiona ArrowRight
- **THEN** a pagina N+1 SHALL ser exibida

#### Scenario: Navegacao para pagina anterior
- **GIVEN** o usuario esta na pagina N (N > 1)
- **WHEN** o usuario clica no botao "Anterior" ou pressiona ArrowLeft
- **THEN** a pagina N-1 SHALL ser exibida

#### Scenario: Modo manga (right-to-left)
- **GIVEN** `mangaMode === true`
- **WHEN** o usuario pressiona ArrowRight
- **THEN** a pagina anterior SHALL ser exibida (navegacao invertida)
- **AND** ArrowLeft SHALL ir para a proxima pagina

#### Scenario: ReaderToolbar exibe progresso
- **GIVEN** o usuario esta na pagina N de um total de M paginas
- **WHEN** o reader e renderizado
- **THEN** o `ReaderToolbar` no rodape SHALL exibir "Pagina N de M" e uma barra de progresso proporcional

#### Scenario: Imagem falha ao carregar
- **GIVEN** uma imagem nao pode ser carregada (erro de rede ou 404)
- **WHEN** o `<img>` dispara `onError`
- **THEN** um placeholder "Pagina indisponivel" SHALL ser exibido no lugar

#### Scenario: Estado de erro (download falhou)
- **GIVEN** o status do download e `"failed"`
- **WHEN** o reader e renderizado
- **THEN** uma mensagem de erro SHALL ser exibida
- **AND** um botao "Tentar novamente" SHALL permitir re-disparar o download

---

### Requirement: Consistencia Visual com Design System Comic

Todos os componentes novos SHALL seguir o design system comic-pop-art, utilizando variaveis CSS (`--comic-*`), classes utilitarias (`border-ink`, `shadow-comic`, `font-display`) e componentes existentes (`ComicPanel`, `SpeechBubble`).

#### Scenario: Componentes usam primitivos do design system
- **WHEN** qualquer componente novo e renderizado
- **THEN** ele SHALL usar `border-ink` para bordas e `shadow-comic` ou `shadow-comic-sm` para sombras
- **AND** textos de destaque SHALL usar `font-display`
- **AND** containers SHALL usar `ComicPanel` ou `bg-card` conforme apropriado

#### Scenario: Dialog usa SpeechBubble
- **WHEN** `DownloadChapterDialog` e renderizado
- **THEN** o texto principal SHALL estar dentro de um componente `SpeechBubble`

---

### Requirement: Testes

Todos os novos modulos, servicos, endpoints, componentes e hooks SHALL ter cobertura de testes unitarios e/ou E2E.

#### Scenario: Testes backend passam
- **WHEN** `pnpm test` e executado no backend
- **THEN** todos os testes unitarios de `chapter-image.service`, `chapter-download.worker`, `chapter-download-events.service`, `chapter-download-pubsub.service`, `resolve-provider` e `get-source.use-case` SHALL passar
- **AND** o teste do `ImageDownloaderService` (existente) SHALL incluir cenario que verifica escrita do `manifest.json` no cache miss e ausencia de escrita no cache hit
- **AND** todos os testes E2E de `chapter-download` e `chapter-image-serve` (incluindo o novo cenario de 425 Too Early) SHALL passar

#### Scenario: Testes frontend passam
- **WHEN** `pnpm test` e executado no frontend
- **THEN** todos os testes de `ChapterReader`, `DownloadChapterDialog`, `TabCapitulos`, `useChapterDownload` e `useChapterPages` SHALL passar

#### Scenario: Build e lint passam
- **WHEN** `pnpm lint` e `pnpm build` sao executados
- **THEN** nao SHALL haver erros de ESLint ou TypeScript nos pacotes frontend e backend
