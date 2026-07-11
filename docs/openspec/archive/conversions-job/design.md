# Conversions Job — Design de Arquitetura

> **Status:** IMPLEMENTED
> **Data:** 2026-07-09 (original) / 2026-07-11 (refatoração: Conversion + Books + Planner)
> **Última validação:** 2026-07-11 — Nova arquitetura: Conversion (agregado) + Jobs (execução individual). API representa intenção do usuário, não organização interna do KCC.

---

## 1. Motivação

Após a inspeção (scraping), o próximo passo é baixar imagens e converter via KCC. O processo é pesado (minutos) e precisa rodar em background com feedback granular em tempo real.

**A API deve representar a intenção do usuário** — quais livros deseja obter — e nunca expor conceitos específicos do KCC como `batchSplit`, `fileFusion`, organização de diretórios ou quantidade de jobs.

## 2. Conceitos de Domínio

### 2.1. Conversion (agregado)

Representa uma solicitação de conversão feita pelo usuário. Uma Conversion contém um ou mais **Books** e é o ponto de entrada da API pública.

**Criada via:** `POST /api/conversions`

**Responsabilidades:**
- Representar o estado agregado da operação (status, progresso, contadores)
- Manter a lista de Jobs sincronizada automaticamente
- Fornecer SSE fan-in de todos os Jobs

### 2.2. Book (intenção do usuário)

Cada item dentro do array `books` representa exatamente **um EPUB final** desejado pelo usuário.

| Campo | Descrição |
|-------|-----------|
| `title` | Título do EPUB final |
| `chapters` | IDs dos capítulos que compõem este EPUB |
| `cover` (opcional) | Capa específica deste Book; se omitido, herda a capa global |

### 2.3. Conversion Job (execução interna)

Representa uma única execução do KCC. Cada Job processa exatamente 1 Book e produz 1 EPUB.

Os Jobs **nunca são criados diretamente pelo frontend**. Eles são gerados automaticamente pelo **Conversion Planner**.

### 2.4. Conversion Planner

Camada do backend responsável por:

- Validar a requisição (device, format, sourceId)
- Validar capítulos duplicados e inexistentes
- Aplicar herança da capa global (Book sem capa própria herda a capa global)
- Gerar 1 Job para cada Book
- Definir automaticamente as flags internas do KCC (`batchSplit`, `fileFusion`)
- Persistir a Conversion e cada Job em disco
- Enfileirar cada Job no BullMQ

## 3. Princípios de Design

### 3.1. API de Intenção, Não de Implementação

O frontend declara **quais livros deseja** (`books: [...]`). O backend decide **como gerá-los** (quantos jobs, organização de diretórios, flags do KCC).

### 3.2. Opções Dirigidas pelo Servidor

O frontend **não** hardcoda opções de conversão. `GET /api/conversions/options` retorna tudo: devices, formats, fields (com `description`, `help`, `component`), presets. Isso permite evoluir o backend sem deploy de frontend.

**Exceção:** `batchSplit` e `fileFusion` são removidos do catálogo público — são responsabilidade exclusiva do Planner (ver §3.5).

### 3.3. Mapeamento Rico de Campos

Cada campo KCC é mapeado com metadados ricos para o frontend renderizar dinamicamente:

```json
{
  "id": "splitter",
  "type": "enum",
  "component": "select",
  "label": "Páginas Duplas",
  "description": "Como tratar páginas duplas (spreads) encontradas no mangá.",
  "help": "Dividir separa em duas imagens. Rotacionar gira 90° para paisagem.",
  "default": "split",
  "group": "processing",
  "options": [
    { "id": "split", "label": "Dividir" },
    { "id": "rotate", "label": "Rotacionar" },
    { "id": "both", "label": "Dividir e Rotacionar" }
  ]
}
```

> **Nota:** `kccFlag` e `kccMap` são mapeados internamente em `config/kcc-flag-mapper.ts` — **nunca expostos ao frontend**.

### 3.4. Pipeline em Duas Fases (por Job)

O job executa em pipeline sequencial dentro de um único BullMQ worker:

```
Fase 1: Download          Fase 2: Conversão KCC
┌─────────────────┐       ┌──────────────────────┐
│ Para cada cap:   │       │ child_process.spawn  │
│  fetch imagens   │──────►│ kcc-c2e [flags] path │
│  salvar em disco │       │ parse stdout/stderr  │
└─────────────────┘       └──────────────────────┘
```

### 3.5. Flags batchSplit e fileFusion são Internas

Estas duas flags representam como o KCC organiza sua execução, não configurações de conversão de imagem. O Planner as define automaticamente:

| Cenário | batchSplit | fileFusion | Motivo |
|---------|-----------|------------|--------|
| Qualquer Book | `none` | `false` | 1 Book = 1 EPUB; pipeline envia diretório único ao KCC (`--filefusion` só serve para múltiplos arquivos ZIP/CBZ) |

### 3.6. Herança de Capa

A Conversion possui uma capa global (`cover`). Cada Book pode opcionalmente definir sua própria capa. Se um Book não tiver capa, herda a global.

```json
// Exemplo: todos os Books usam a mêsma capa (original)
{
  "cover": { "kind": "original" },
  "books": [
    { "title": "Volume 01", "chapters": ["chap_0001", "chap_0002"] }
  ]
}
```

```json
// Exemplo: Volume 02 tem capa própria; Volume 01 herda a global
{
  "cover": { "kind": "original" },
  "books": [
    { "title": "Volume 01", "chapters": ["chap_0001", "chap_0002"] },
    { "title": "Volume 02", "chapters": ["chap_0003"], "cover": { "kind": "upload", "fileId": "custom_cover" } }
  ]
}
```

### 3.7. Status Agregado Auto-Sincronizado

O `status.json` da Conversion é **recalculado automaticamente** sempre que um Job altera seu estado. O método `ConversionRepository.syncStatus()`:

1. Lê todos os `status.json` dos Jobs da Conversion
2. Recomputa: `status`, `progress` (média), `completedJobs`, `failedJobs`, `runningJobs`, `pendingJobs`, `jobs[]`
3. Atualiza `updatedAt` (sempre) e `finishedAt` (quando todos os Jobs atingem estado terminal)
4. Reescreve o `status.json` da Conversion

O worker (`conversion-job.worker.ts`) chama `syncStatus()` após cada `repository.update()` e no handler de erro.

---

## 4. Endpoints

### 4.1. GET /api/conversions/options

Retorna catálogo completo (sem `batchSplit`/`fileFusion`). Sem autenticação.

**Response:**

```json
{
  "devices": [...],
  "formats": [...],
  "fields": [...],
  "presets": [...]
}
```

### 4.2. POST /api/conversions

Cria uma Conversion (intenção do usuário). Requer Bearer token.

**Request:**

```json
{
  "sourceId": "src-hunter-x-hunter-cb3c9071",
  "cover": { "kind": "original" },
  "output": { "deviceId": "K11", "format": "EPUB" },
  "metadata": { "title": "Hunter x Hunter", "author": "Yoshihiro Togashi" },
  "books": [
    {
      "title": "Hunter x Hunter - Volume 01",
      "chapters": ["chap_0001", "chap_0002", "chap_0003"]
    },
    {
      "title": "Hunter x Hunter - Volume 02",
      "chapters": ["chap_0004", "chap_0005", "chap_0006"],
      "cover": { "kind": "original" }
    }
  ],
  "options": {
    "mangaMode": true,
    "cropping": "marginsAndPageNumbers",
    "stretchMode": "upscale",
    "splitter": "split"
  }
}
```

**Response (202):**

```json
{
  "conversionId": "conv_...",
  "status": "queued",
  "totalJobs": 2,
  "createdAt": "2026-07-11T00:00:00.000Z"
}
```

### 4.3. GET /api/conversions/:conversionId

Status agregado da Conversion (recomputado em tempo real). Requer Bearer token.

**Response (processing):**

```json
{
  "conversionId": "conv_...",
  "status": "processing",
  "progress": 35,
  "totalJobs": 2,
  "completedJobs": 0,
  "failedJobs": 0,
  "runningJobs": 1,
  "pendingJobs": 1,
  "createdAt": "...",
  "updatedAt": "...",
  "finishedAt": null,
  "jobs": [
    {
      "jobId": "job_001",
      "index": 0,
      "title": "Hunter x Hunter - Volume 01",
      "status": "converting",
      "progress": 70
    },
    {
      "jobId": "job_002",
      "index": 1,
      "title": "Hunter x Hunter - Volume 02",
      "status": "queued",
      "progress": 0
    }
  ],
  "config": { ... }
}
```

**Response (completed):**

```json
{
  "conversionId": "conv_...",
  "status": "completed",
  "progress": 100,
  "totalJobs": 2,
  "completedJobs": 2,
  "failedJobs": 0,
  "runningJobs": 0,
  "pendingJobs": 0,
  "finishedAt": "2026-07-11T00:05:00.000Z",
  "jobs": [
    {
      "jobId": "job_001",
      "status": "completed",
      "progress": 100,
      "outputFile": "Hunter x Hunter - Volume 01.epub",
      "outputSize": 52428800,
      "downloadUrl": "/api/conversions/conv_.../jobs/job_001/download"
    }
  ],
  "config": { ... }
}
```

### 4.4. GET /api/conversions/:conversionId/events (SSE fan-in)

Stream SSE que encaminha eventos de **todos os Jobs** da Conversion. Cada evento carrega `jobId` em `data` para o frontend saber a qual Job pertence. Requer Bearer token.

Eventos: `job.started`, `download.started`, `download.chapter.started`, `download.chapter.finished`, `download.progress`, `conversion.started`, `conversion.progress`, `conversion.finished`, `job.finished`, `job.failed`.

### 4.5. DELETE /api/conversions/:conversionId (POST /.../cancel alias)

Cancela todos os Jobs ainda pendentes ou em andamento. Requer Bearer token.

**Response:** `{ "conversionId": "...", "status": "cancelled" }`

### 4.6. Autenticação

| Endpoint | Auth |
|---|---|
| `GET /api/conversions/options` | Público |
| `POST /api/conversions` | Bearer token |
| `GET /api/conversions/:conversionId` | Bearer token |
| `GET /api/conversions/:conversionId/events` | Bearer token |
| `DELETE /api/conversions/:conversionId` | Bearer token |

---

## 5. Mapeamento de Campos → Flags KCC

### 5.1. Campos Boolean

| Campo | Label | Flag KCC | Grupo | Default |
|-------|-------|----------|-------|---------|
| `mangaMode` | Modo Mangá | `-m` | reading | `false` |
| `webtoonMode` | Modo Webtoon | `-w` | reading | `false` |
| `highQuality` | Alta Qualidade | `-q` | processing | `false` |
| `noProcessing` | Sem Processamento | `-n` | processing | `false` |
| `forceColor` | Manter Cores | `--forcecolor` | image | `false` |
| `noRotate` | Não Rotacionar | `--norotate` | output | `false` |
| `rotateRight` | Rotacionar à Direita | `--rotateright` | output | `false` |
| `coverFill` | Capa Preencher Tela | `--coverfill` | output | `false` |
| `smartCoverCrop` | Recorte Inteligente da Capa | `--smartcovercrop` | output | `false` |
| `onePageLandscape` | 1 Página Paisagem | `--onepagelandscape` | output | `false` |
| `eraseRainbow` | Apagar Efeito Arco-íris | `--eraserainbow` | image | `false` |
| `noQuantize` | Sem Quantização | `--noquantize` | image | `false` |
| `noAutocontrast` | Sem Autocontraste | `--noautocontrast` | image | `false` |
| `blackBorders` | Bordas Pretas | `--blackborders` | image | `false` |
| `whiteBorders` | Bordas Brancas | `--whiteborders` | image | `false` |
| `invertDirection` | Inverter Direção | `--invertdirection` | reading | `false` |
| `spreadShift` | Deslocar Spread | `--spreadshift` | output | `false` |
| `lightnovel` | Modo Light Novel | `--lightnovel` | reading | `false` |
| `autolevel` | Nível Automático | `--autolevel` | image | `false` |
| `colorAutocontrast` | Autocontraste Colorido | `--colorautocontrast` | image | `false` |
| `rotateFirst` | Rotacionar Primeiro | `--rotatefirst` | output | `false` |
| `preserveMargin` | Preservar Margem | `--preservemargin` | output | `false` |
| `maximizeStrips` | Maximizar Tiras | `--maximizestrips` | processing | `false` |
| `forcePng` | Forçar PNG | `--forcepng` | image | `false` |
| `webp` | WebP | `--webp` | image | `false` |
| `mozjpeg` | MozJPEG | `--mozjpeg` | image | `false` |
| `nokepub` | Sem KEPUB | `--nokepub` | format | `false` |
| `legacyExtract` | Extração Legada | `--legacyextract` | processing | `false` |
| `twoPanel` | 2 Painéis | `--two-panel` | reading | `false` |
| `vertical4Panel` | 4 Painéis Verticais | `--vertical4panel` | reading | `false` |

> **Internos (não expostos na API):** `fileFusion`, `batchSplit` — definidos automaticamente pelo Planner (§3.5).

### 5.2. Campos Enum

| Campo | Label | Opções | Flag KCC | Default |
|-------|-------|--------|----------|---------|
| `splitter` | Páginas Duplas | `split`→0, `rotate`→1, `both`→2 | `-r` | `split` |
| `cropping` | Recorte | `disabled`→0, `margins`→1, `marginsAndPageNumbers`→2 | `-c` | `marginsAndPageNumbers` |
| `interPanelCrop` | Recorte Entre Painéis | `disabled`→0, `horizontal`→1, `both`→2 | `--ipc` | `disabled` |
| `metadataTitle` | Título dos Metadados | `ignore`→0, `combine`→1, `metadataOnly`→2 | `--metadatatitle` | `ignore` |
| `stretchMode` | Redimensionamento | `disabled`→sem flag, `stretch`→`-s`, `upscale`→`-u` | `-s`/`-u` | `disabled` |

> `batchSplit` é interno (ver §3.5) — excluído da API pública.

### 5.3. Campos Numéricos

| Campo | Label | Min | Max | Step | Flag KCC | Default |
|-------|-------|-----|-----|------|----------|---------|
| `gamma` | Gamma | 0.1 | 5.0 | 0.1 | `-g` | auto |
| `jpegQuality` | Qualidade JPEG | 0 | 95 | 1 | `--jpeg-quality` | 85 |
| `croppingPower` | Poder de Recorte | 0.1 | 2.0 | 0.1 | `--cp` | 1.0 |
| `croppingMinimum` | Mínimo de Recorte | 0.0 | 1.0 | 0.05 | `--cm` | 0.0 |
| `targetSize` | Tamanho Alvo (MB) | 1 | 100 | 1 | `--targetsize` | — |
| `customWidth` | Largura Customizada | 100 | 9999 | 1 | `--customwidth` | — |
| `customHeight` | Altura Customizada | 100 | 9999 | 1 | `--customheight` | — |

---

## 6. Presets

```json
[
  {
    "id": "manga",
    "name": "Mangá",
    "description": "Leitura da direita para esquerda com recorte automático.",
    "values": { "mangaMode": true, "cropping": "marginsAndPageNumbers", "stretchMode": "upscale" }
  },
  {
    "id": "webtoon",
    "name": "Webtoon",
    "description": "Processamento para tiras longas verticais.",
    "values": { "webtoonMode": true, "cropping": "margins", "stretchMode": "stretch" }
  },
  {
    "id": "comic",
    "name": "HQ Ocidental",
    "description": "Leitura esquerda para direita sem modificações extras.",
    "values": { "cropping": "marginsAndPageNumbers" }
  },
  {
    "id": "highQuality",
    "name": "Alta Qualidade",
    "description": "Algoritmos de redimensionamento de maior qualidade.",
    "values": { "highQuality": true, "stretchMode": "upscale" }
  },
  {
    "id": "noProcessing",
    "name": "Sem Processamento",
    "description": "Apenas converte sem otimizar imagens. Ignora todos os outros campos.",
    "exclusive": true,
    "values": { "noProcessing": true }
  }
]
```

> Os presets não incluem `batchSplit` ou `fileFusion` — essas flags são responsabilidade do Planner.

---

## 7. Diagrama de Componentes

```
src/modules/conversion/
├── conversion.routes.ts                  ← 6 endpoints Fastify
├── controllers/
│   ├── conversion-options.controller.ts       ← GET /api/conversions/options
│   ├── create-conversion.controller.ts        ← POST /api/conversions
│   ├── get-conversion.controller.ts           ← GET /api/conversions/:conversionId
│   ├── conversion-events.controller.ts        ← GET /api/conversions/:id/events (SSE fan-in)
│   └── cancel-conversion.controller.ts        ← DELETE /api/conversions/:id
├── use-cases/
│   ├── get-conversion-options.use-case.ts
│   ├── create-conversion.use-case.ts          ← Conversion Planner
│   ├── get-conversion.use-case.ts             ← Delega para syncStatus
│   └── cancel-conversion.use-case.ts
├── services/
│   ├── conversion-queue.service.ts            ← Wrapper BullMQ
│   ├── conversion-pubsub.service.ts           ← Redis Pub/Sub (subscribeMany/unsubscribeMany)
│   ├── conversion-events.service.ts           ← Bridge Redis → SSE (job + conversion fan-in)
│   ├── image-downloader.service.ts            ← Download paralelo de imagens
│   └── kcc-runner.service.ts                  ← child_process.spawn do KCC
├── config/
│   ├── devices.ts                             ← Catálogo de dispositivos
│   ├── formats.ts                             ← Catálogo de formatos
│   ├── fields.ts                              ← Catálogo de campos ricos (sem batchSplit/fileFusion)
│   ├── presets.ts                             ← Presets (valores filtrados)
│   └── kcc-flag-mapper.ts                     ← Mapeia opções → flags CLI
├── repositories/
│   ├── conversion-job.repository.ts           ← Interface Job (com withConversion scoping)
│   ├── filesystem-job.repository.ts           ← Persiste jobs em .../conversionId/jobs/jobId/
│   ├── conversion.repository.ts               ← Interface Conversion
│   └── filesystem-conversion.repository.ts    ← Persiste conversion + syncStatus()
├── workers/
│   └── conversion-job.worker.ts               ← BullMQ worker (download + KCC + syncStatus)
├── types/
│   └── conversion.types.ts
├── errors/
│   └── conversion.errors.ts
└── dtos/
    ├── create-conversion.dto.ts
    ├── conversion-options.dto.ts
    └── conversion-params.dto.ts
```

---

## 8. Decisões Técnicas

### 8.1. Por que um único worker em vez de dois?

Download e conversão são **sequenciais** (não tem como converter sem ter baixado). Separar em duas filas adicionaria complexidade de coordenação sem ganho real. Um único worker com duas fases é mais simples.

### 8.2. Por que child_process.spawn em vez de exec?

`spawn` permite streaming de stdout/stderr para capturar progresso do KCC em tempo real. `exec` bufferiza tudo e só retorna ao final.

### 8.3. Por que filesystem para jobs em vez de banco?

Consistente com o módulo scraping. Jobs de conversão são efêmeros e os arquivos de saída já vivem no filesystem. Persistência em PostgreSQL pode ser adicionada depois para histórico/biblioteca.

### 8.4. Storage Layout

```
storage/
├── sources/
│   └── src-{slug}-{hash}/
│       ├── metadata.json
│       ├── covers/
│       └── chapters/
│
└── conversions/
    └── conv_{timestamp}_{random}/
        ├── config.json         ← Snapshot imutável da requisição
        ├── status.json         ← Agregado auto-sincronizado
        ├── logs/
        │   └── conversion.log
        └── jobs/
            ├── job_{ts}_{rnd}/
            │   ├── config.json     ← Config do Job (+ bookIndex, conversionId)
            │   ├── status.json     ← Estado mutável do Job
            │   ├── logs/
            │   │   └── conversion.log
            │   ├── temp/           ← Diretório de trabalho (hard links + capa)
            │   └── output/         ← EPUB final
            └── job_{ts}_{rnd}/
                └── ...
```

> Não existe diretório `outputs/` na raiz da Conversion — cada Job é dono do seu EPUB.

### 8.5. fileFusion Sempre false

Nosso pipeline passa um **único diretório** (`temp/input/`) ao KCC como fonte. O KCC já processa automaticamente todos os subdiretórios internos como um único EPUB. A flag `--filefusion` serve para cenários com **múltiplos arquivos de entrada** (ZIP/CBZ), que não usamos. O Planner define `fileFusion: false` incondicionalmente.

### 8.6. batchSplit Sempre none

Cada Job produz **exatamente 1 EPUB** (1 Book → 1 Job → 1 EPUB). A flag `-b` (`batchSplit`) controla se o KCC deve dividir a saída em múltiplos arquivos — não é necessário pois a divisão já é feita pelo Planner via múltiplos Books/Jobs. O Planner define `batchSplit: 'none'` incondicionalmente.

### 8.7. SSE fan-in para Conversion

O endpoint `GET /api/conversions/:id/events` assina **todos os canais Redis** dos Jobs da Conversion (`conversion-job:{jobId}`) usando `subscribeMany()` e encaminha cada evento com `jobId` em `data`. Isso permite ao frontend saber a qual Job pertence cada atualização.

### 8.8. Variáveis de Ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `KCC_BIN_PATH` | Caminho para o binário do KCC | `bin/kcc/windows/kcc_c2e_10.3.0.exe` |
| `CONVERSIONS_STORAGE_PATH` | Diretório raiz para saída de conversões | `./storage/conversions` |
| `STORAGE_PATH` | Diretório raiz do cache de scraping | `./storage` |
