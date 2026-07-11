# Conversion Job — Especificacao

> **Status:** IMPLEMENTED
> **Data:** 2026-07-11
> **Modulo:** `conversion`

---

## Purpose

O modulo de conversao transforma metadados de uma obra (obtidos via scraping) em arquivos EPUB finais compativeis com e-readers Kindle. Ele baixa as imagens dos capitulos selecionados e executa o binario KCC (Kindle Comic Converter) em background via BullMQ, reportando progresso em tempo real via SSE.

A API representa a **intencao do usuario** — quais livros deseja obter — e nunca expoe conceitos internos do KCC como `batchSplit` ou `fileFusion`.

---

## Requirements

### Requirement: Catalogo de opcoes de conversao
The system MUST expose all available conversion options (devices, formats, configurable fields, presets) through a public endpoint.

#### Scenario: Listagem completa de opcoes
- **WHEN** o frontend chama `GET /api/conversions/options`
- **THEN** retorna `devices` (perfis Kindle), `formats` (EPUB, MOBI, CBZ, PDF, KFX), `fields` (campos ricos com `component`, `description`, `help`, `group`, `options`) e `presets` (manga, webtoon, comic, highQuality, noProcessing)
- **THEN** `batchSplit` e `fileFusion` NAO aparecem em `fields` nem em `presets.values`

#### Scenario: Campos com metadados ricos para renderizacao dinamica
- **WHEN** o endpoint retorna `fields`
- **THEN** cada campo possui `type` (boolean, enum, number), `component` (switch, select, slider), `label`, `description`, `help`, `group` e opcionalmente `options`, `min`, `max`, `step`
- **THEN** `kccFlag` e `kccMap` NAO sao expostos ao frontend

### Requirement: Criacao de Conversion via Planner
The system MUST accept `POST /api/conversions` with array `books: [...]` representing user intent and automatically generate necessary Jobs.

#### Scenario: Criacao bem-sucedida com multiplos Books
- **WHEN** o usuario envia `POST /api/conversions` com `sourceId`, `output: { deviceId, format }`, `metadata`, `books: [{title, chapters}, ...]` e `options`
- **THEN** o Planner valida `deviceId` e `format` contra o catalogo
- **THEN** o Planner verifica que `sourceId` existe e possui `metadata.json`
- **THEN** o Planner valida que nao ha capitulos duplicados entre Books
- **THEN** o Planner valida que todos os capitulos existem na source
- **THEN** gera 1 Job BullMQ por Book com `batchSplit: 'none'` e `fileFusion: false`
- **THEN** persiste a Conversion e cada Job em disco (`conversions/{convId}/jobs/{jobId}/`)
- **THEN** retorna 202 com `conversionId`, `totalJobs`, `status: "queued"`, `createdAt`
- **THEN** o tempo de resposta e < 200ms

#### Scenario: Heranca de capa global
- **WHEN** um Book no array `books` nao possui `cover` proprio
- **THEN** o Planner aplica o `cover` global da Conversion a esse Book

#### Scenario: Capa especifica do Book sobrescreve global
- **WHEN** um Book possui `cover` proprio definido
- **THEN** o Planner usa a capa especifica do Book, ignorando a global

#### Scenario: DeviceId invalido
- **WHEN** `output.deviceId` nao existe no catalogo de dispositivos
- **THEN** retorna 400 com erro apropriado

#### Scenario: Formato invalido
- **WHEN** `output.format` nao existe no catalogo de formatos
- **THEN** retorna 400 com erro apropriado

#### Scenario: Source inexistente
- **WHEN** `sourceId` nao possui `metadata.json` no storage
- **THEN** retorna 404 com erro `SourceNotFoundError`

#### Scenario: Capitulo duplicado entre Books
- **WHEN** o mesmo `chapterId` aparece em dois Books diferentes
- **THEN** retorna 404 com erro `DuplicateChapterError`

#### Scenario: Capitulo inexistente na source
- **WHEN** um `chapterId` referenciado nao existe no `metadata.json` da source
- **THEN** retorna 404 com erro `ChapterNotFoundError`

### Requirement: Status agregado auto-sincronizado
The system MUST keep the Conversion state always up-to-date based on individual Job states.

#### Scenario: Conversao em processamento
- **WHEN** o frontend chama `GET /api/conversions/:conversionId`
- **THEN** o repositorio executa `syncStatus()`: le todos os `status.json` dos Jobs, computa `status` agregado, `progress` (media), `completedJobs`, `failedJobs`, `runningJobs`, `pendingJobs`
- **THEN** retorna array `jobs[]` com estado individual de cada Job (`jobId`, `index`, `title`, `status`, `progress`)
- **THEN** `updatedAt` e sempre atualizado; `finishedAt` preenchido apenas quando todos Jobs atingem estado terminal

#### Scenario: Conversao concluida
- **WHEN** todos os Jobs estao em estado terminal (`completed` ou `failed`)
- **THEN** `status` agregado pode ser `completed`, `failed` ou `partial`
- **THEN** `finishedAt` e preenchido com timestamp
- **THEN** Jobs concluidos com sucesso incluem `outputFile`, `outputSize` e `downloadUrl`

#### Scenario: Conversion inexistente
- **WHEN** `conversionId` nao existe no storage
- **THEN** retorna 404 com erro `ConversionNotFoundError`

### Requirement: SSE fan-in de todos os Jobs
The system MUST provide a single SSE stream that forwards progress events from all Jobs in the Conversion.

#### Scenario: Conexao SSE estabelecida
- **WHEN** o frontend chama `GET /api/conversions/:conversionId/events`
- **THEN** retorna headers SSE: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`
- **THEN** assina todos os canais Redis dos Jobs da Conversion via `subscribeMany()`

#### Scenario: Eventos encaminhados com jobId
- **WHEN** um Job publica evento via Redis Pub/Sub
- **THEN** o SSE encaminha o evento ao cliente com `jobId` incluido em `data`
- **THEN** eventos incluem: `job.started`, `download.started`, `download.chapter.started`, `download.chapter.finished`, `download.progress`, `conversion.started`, `conversion.progress`, `conversion.finished`, `job.finished`, `job.failed`

#### Scenario: Conexao fechada ao terminar
- **WHEN** todos os Jobs atingem estado terminal
- **THEN** o SSE fecha a conexao com evento `done`

### Requirement: Cancelamento de Conversion
The system MUST allow cancelling all pending or in-progress Jobs of a Conversion.

#### Scenario: Cancelamento bem-sucedido
- **WHEN** o frontend chama `DELETE /api/conversions/:conversionId` ou `POST /api/conversions/:conversionId/cancel`
- **THEN** todos os Jobs com status `queued` ou `running` sao cancelados via BullMQ
- **THEN** `syncStatus()` e chamado para recomputar estado agregado
- **THEN** retorna `{ conversionId, status: "cancelled" }`

#### Scenario: Conversion ja concluida
- **WHEN** o frontend tenta cancelar uma Conversion com estado terminal (`completed`, `failed`, `cancelled`)
- **THEN** retorna 409 com erro `InvalidConversionStateError`

#### Scenario: Conversion inexistente
- **WHEN** `conversionId` nao existe
- **THEN** retorna 404 com erro `ConversionNotFoundError`

### Requirement: Pipeline de download e conversao via worker BullMQ
The system MUST execute image download and KCC conversion in background with one worker per Job.

#### Scenario: Worker executa fase de download
- **WHEN** o worker inicia um Job
- **THEN** emite evento `job.started`
- **THEN** para cada capitulo: baixa imagens, salva em disco no diretorio `temp/input/`
- **THEN** emite eventos `download.chapter.started`, `download.chapter.finished` e `download.progress` (percentual)

#### Scenario: Worker executa fase de conversao KCC
- **WHEN** a fase de download termina
- **THEN** emite evento `conversion.started`
- **THEN** invoca KCC via `child_process.spawn` com as flags mapeadas do `kcc-flag-mapper`
- **THEN** captura stdout/stderr para parse de progresso
- **THEN** emite eventos `conversion.progress` e `conversion.finished`
- **THEN** o EPUB final fica em `output/` dentro do diretorio do Job

#### Scenario: Worker sincroniza status apos cada atualizacao
- **WHEN** o worker atualiza o `status.json` do Job via `repository.update()`
- **THEN** chama `syncStatus(conversionId)` para recomputar o agregado da Conversion

#### Scenario: Worker trata erro
- **WHEN** ocorre falha no download ou conversao
- **THEN** o handler `on('failed')` chama `syncStatus(conversionId)`
- **THEN** emite evento `job.failed` com mensagem de erro
- **THEN** marca o Job como `failed` no `status.json`

### Requirement: Mapeamento de opcoes para flags KCC
The system MUST automatically translate user-configured options to KCC command-line flags.

#### Scenario: Mapeamento de campos booleanos
- **WHEN** `mangaMode: true`
- **THEN** gera flag `-m`
- **WHEN** `noProcessing: true`
- **THEN** gera flag `-n`
- **WHEN** `highQuality: true`
- **THEN** gera flag `-q`

#### Scenario: Mapeamento de campos enum
- **WHEN** `splitter: "rotate"`
- **THEN** gera flag `-r 1`
- **WHEN** `cropping: "marginsAndPageNumbers"`
- **THEN** gera flag `-c 2`
- **WHEN** `stretchMode: "upscale"`
- **THEN** gera flag `-u`

#### Scenario: Mapeamento de campos numericos
- **WHEN** `gamma: 1.8`
- **THEN** gera flag `-g 1.8`
- **WHEN** `jpegQuality: 75`
- **THEN** gera flag `--jpeg-quality 75`

#### Scenario: Preset sobrescreve defaults
- **WHEN** o usuario seleciona preset `manga`
- **THEN** aplica valores `{ mangaMode: true, cropping: "marginsAndPageNumbers", stretchMode: "upscale" }`
- **THEN** as flags resultantes sao `-m -c 2 -u`

#### Scenario: Flags internas nunca expostas
- **WHEN** o Planner gera um Job
- **THEN** define `batchSplit: "none"` e `fileFusion: false` automaticamente
- **THEN** essas flags NAO aparecem na API publica (`GET /options`)
- **THEN** o worker as aplica sem intervencao do usuario

### Requirement: Storage aninhado para Conversions e Jobs
The system MUST persist Conversions and Jobs in a directory structure on the filesystem.

#### Scenario: Layout de diretorios
- **WHEN** uma Conversion e criada
- **THEN** a estrutura segue: `conversions/{convId}/{config.json, status.json, logs/}`
- **THEN** cada Job fica em: `conversions/{convId}/jobs/{jobId}/{config.json, status.json, logs/, temp/, output/}`

#### Scenario: Repositorio de Job com escopo por Conversion
- **WHEN** o repositorio de Job e instanciado via `withConversion(conversionId)`
- **THEN** todas as operacoes (`create`, `findById`, `update`) sao relativas a `conversions/{conversionId}/jobs/`

### Requirement: Autenticacao e protecao de rotas
The system MUST protect all Conversion endpoints, except the options catalog.

#### Scenario: Endpoint publico
- **WHEN** o frontend chama `GET /api/conversions/options`
- **THEN** nao requer autenticacao JWT

#### Scenario: Endpoints protegidos
- **WHEN** o frontend chama qualquer outro endpoint de conversion (`POST`, `GET /:id`, `GET /:id/events`, `DELETE /:id`)
- **THEN** requer Bearer token JWT valido
- **THEN** retorna 401 se token ausente ou invalido

---

## NOT YET IMPLEMENTED (Future Enhancements)

These items are documented for future planning but are outside the current spec scope.

- **Envio para Kindle:** Send final EPUB to user's Kindle email via SMTP
- **Preview de pagina:** Endpoint `GET /api/conversions/preview` to preview how images will look in the EPUB
- **Upload de capas customizadas:** Support `cover.kind: "upload"` with `fileId` referencing user upload
- **Reconversao de volumes existentes:** Allow re-running an existing Conversion with new options
- **Download de EPUB:** Endpoint `GET /api/conversions/:conversionId/jobs/:jobId/download` to download the final file
- **Biblioteca (persistencia e CRUD):** Persistence of converted series for listing and management
