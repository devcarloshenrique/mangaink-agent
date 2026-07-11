# Fluxo de conversao do frontend para API

Este documento descreve o fluxo de conversao usado hoje no frontend e o contrato recomendado para criar a API real. Atualmente a maior parte do fluxo esta mockada em `apps/frontend/src/routes/wizard.tsx` e `apps/frontend/src/hooks/useConversion.tsx`.

## Visao geral

O usuario autenticado acessa `/wizard`, cola a URL de uma obra, escolhe capitulos, capas, configuracoes de conversao, forma de entrega e inicia um job. Depois ele e redirecionado para `/biblioteca/converter/$jobId`, onde acompanha o progresso ate a conversao virar item da biblioteca.

Fluxo de alto nivel:

1. Buscar metadados da obra pela URL.
2. Selecionar capitulos e definir volumes.
3. Definir capas.
4. Escolher dispositivo, formato, preset e metadados finais.
5. Opcionalmente gerar preview de uma pagina.
6. Escolher entrega: download ou Kindle.
7. Criar job de conversao.
8. Acompanhar progresso por etapas.
9. Ao concluir, registrar arquivos na biblioteca e liberar download/envio.

Todas as rotas de conversao devem exigir `Authorization: Bearer <token>`, seguindo o cliente atual em `apps/frontend/src/lib/api.ts`.

## Estado atual no frontend

Arquivos principais:

- `apps/frontend/src/routes/wizard.tsx`: wizard de 5 passos.
- `apps/frontend/src/hooks/useConversion.tsx`: cria e simula jobs em memoria.
- `apps/frontend/src/lib/conversion-job.ts`: tipos/status/etapas do job.
- `apps/frontend/src/lib/kindle-presets.ts`: dispositivos, formatos e presets aceitos.
- `apps/frontend/src/routes/biblioteca.converter.$jobId.tsx`: tela de progresso.
- `apps/frontend/src/lib/biblioteca-data.ts`: formato dos itens da biblioteca.

O frontend ainda nao chama API para conversao. A API deve substituir:

- `mockFetchSeries(...)`
- `handleGeneratePreview(...)`
- `startJob(...)`
- `getJob(...)`
- `cancelJob(...)`
- `addSeries(...)` apos conclusao

## Passo 1: Origem

Entrada do usuario:

- `url`: link da obra.

Validacao no frontend:

- A URL nao pode estar vazia.
- Hoje o mock apenas tenta construir `new URL(url)`.

Endpoint recomendado:

```http
POST /conversions/source/inspect
Content-Type: application/json
Authorization: Bearer <token>
```

Request:

```json
{
  "url": "https://exemplo.com/manga/meu-manga",
  "volumeSize": 8
}
```

Response:

```json
{
  "sourceId": "src_123",
  "url": "https://exemplo.com/manga/meu-manga",
  "title": "Meu Manga",
  "author": "Autor Desconhecido",
  "chapters": [
    {
      "id": "ch-1",
      "number": "1",
      "title": "O inicio",
      "pages": 24,
      "volume": 1
    }
  ],
  "covers": [
    {
      "id": "cv-1",
      "label": "Capa 1",
      "imageUrl": "https://cdn.exemplo.com/covers/cv-1.jpg"
    }
  ]
}
```

Campos esperados pelo frontend:

- `title`: string.
- `author`: string.
- `chapters[]`: lista com `id`, `number`, `title`, `pages`, `volume`.
- `covers[]`: lista com `id`, `label` e uma imagem real. O frontend mockado usa `hue`, mas a API deve retornar `imageUrl`.

Erros:

- `400`: URL invalida.
- `404`: obra nao encontrada.
- `422`: fonte ainda nao suportada.

## Passo 2: Capitulos e volumes

Entrada do usuario:

- `selectedChapters`: conjunto de IDs dos capitulos escolhidos.
- `grouping`: `"single"` ou `"separate"`.
- `volumeMode`: `"fixed"` ou `"custom"`.
- `volumeSize`: quantidade fixa de capitulos por volume.
- `volumeSizes`: lista de quantidades por volume quando `volumeMode = "custom"`.

Regras de frontend:

- Pelo menos 1 capitulo deve ser selecionado.
- Custo atual exibido: 1 credito por capitulo.
- O mock usa `volumeSize` para agrupar os arquivos finais.
- `grouping` aparece na UI, mas ainda nao e enviado em `startJob`. A API deve aceitar esse campo para nao perder a escolha do usuario.

Representacao recomendada no request final:

```json
{
  "chapters": ["ch-1", "ch-2", "ch-3"],
  "grouping": "single",
  "volume": {
    "mode": "fixed",
    "size": 8,
    "sizes": []
  }
}
```

Para volumes customizados:

```json
{
  "volume": {
    "mode": "custom",
    "size": 8,
    "sizes": [6, 7, 5]
  }
}
```

## Passo 3: Capas

Entrada do usuario:

- `coverMode`: `"single"`, `"per-volume"` ou `"per-chapter"`.
- `coverAssignments`: mapa por alvo.

Tipos atuais:

```ts
type CoverRef =
  | { kind: "original" }
  | { kind: "gallery"; coverId: string }
  | { kind: "upload"; name: string };
```

Alvos:

- `single`: chave `"all"`.
- `per-volume`: chaves `"vol-1"`, `"vol-2"`, etc.
- `per-chapter`: chave igual ao `chapter.id`.

Representacao recomendada:

```json
{
  "cover": {
    "mode": "per-volume",
    "assignments": {
      "vol-1": { "kind": "gallery", "coverId": "cv-1" },
      "vol-2": { "kind": "original" }
    }
  }
}
```

Upload de capa:

O frontend atual guarda apenas o nome do arquivo. Para API real, use upload multipart separado antes da conversao.

Endpoint recomendado:

```http
POST /conversions/covers/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

Response:

```json
{
  "uploadId": "upl_123",
  "fileName": "minha-capa.jpg",
  "imageUrl": "https://cdn.exemplo.com/uploads/upl_123.jpg"
}
```

Depois, no job:

```json
{
  "kind": "upload",
  "uploadId": "upl_123",
  "name": "minha-capa.jpg"
}
```

## Passo 4: Configuracoes de conversao

Entrada do usuario:

- `device`: perfil Kindle/dispositivo.
- `format`: formato de saida.
- `preset`: processamento de imagem.
- `meta.title`: titulo final opcional.
- `meta.author`: autor final opcional.

Dispositivos aceitos hoje:

```txt
kpw_11
kpw_signature
k_oasis
k_scribe
k_basic
k_colorsoft
k_voyage
k_fire_hd
```

Formatos aceitos hoje:

```txt
EPUB
MOBI
CBZ
KFX
```

Observacao: `biblioteca-data.ts` tambem aceita `PDF`, mas `OUTPUT_FORMATS` no wizard nao oferece PDF atualmente.

Presets aceitos hoje:

```txt
default
manga
webtoon
highQuality
noProcessing
comic
```

Filtros visuais usados no preview mockado:

```txt
default: contrast(1) brightness(1)
manga: grayscale(100%) contrast(1.2) brightness(1)
webtoon: contrast(1.05) brightness(1.05)
highQuality: grayscale(100%) contrast(1.1)
noProcessing: none
comic: contrast(1.15) brightness(1.05)
```

Esses filtros nao precisam ser literais no backend, mas indicam a intencao de cada preset.

## Preview de pagina

No passo 4 existe uma acao "Gerar Preview". Hoje ela e simulada, mas a UI espera preview vindo do servidor.

Entrada:

- `sourceId` ou `url`.
- `chapterId`.
- `page`: numero da pagina, com minimo 1 e maximo igual a `chapter.pages`.
- `device`.
- `preset`.
- Opcoes visuais:
  - `darkMode`: boolean.
  - `doublePageSplit`: boolean.

Endpoint recomendado:

```http
POST /conversions/preview
Content-Type: application/json
Authorization: Bearer <token>
```

Request:

```json
{
  "sourceId": "src_123",
  "chapterId": "ch-1",
  "page": 3,
  "device": "kpw_11",
  "preset": "manga",
  "darkMode": false,
  "doublePageSplit": true
}
```

Response:

```json
{
  "originalImageUrl": "https://cdn.exemplo.com/previews/original.jpg",
  "convertedImageUrl": "https://cdn.exemplo.com/previews/converted.jpg",
  "device": {
    "id": "kpw_11",
    "width": 180,
    "height": 240
  },
  "doublePageDetected": true,
  "splitApplied": true
}
```

Erros:

- `400`: pagina invalida, capitulo invalido ou parametros invalidos.
- `404`: fonte/capitulo/pagina nao encontrados.

## Passo 5: Entrega

Entrada do usuario:

- `delivery`: `"download"` ou `"kindle"`.
- `kindleEmail`: obrigatorio quando `delivery = "kindle"`.

Validacao do frontend:

```txt
^\S+@(kindle\.com|free\.kindle\.com)$
```

Limite exibido:

- Download: sem restricao visual.
- Kindle: estimativa de `capitulos * 1.2 MB`, limite exibido de 25 MB.
- Quando passar de 25 MB, a UI informa que vai dividir em partes.

Recomendacao para API:

- Validar o email Kindle no backend tambem.
- Dividir automaticamente os arquivos destinados ao Kindle se ultrapassarem o limite configurado.
- Retornar no job os arquivos finais gerados, inclusive partes, tamanhos e status de envio.

## Criacao do job de conversao

Endpoint recomendado:

```http
POST /conversions
Content-Type: application/json
Authorization: Bearer <token>
```

Request completo recomendado:

```json
{
  "sourceId": "src_123",
  "sourceUrl": "https://exemplo.com/manga/meu-manga",
  "series": {
    "title": "Meu Manga",
    "author": "Autor Desconhecido"
  },
  "chapters": ["ch-1", "ch-2", "ch-3"],
  "grouping": "single",
  "volume": {
    "mode": "fixed",
    "size": 8,
    "sizes": []
  },
  "cover": {
    "mode": "per-volume",
    "assignments": {
      "vol-1": { "kind": "gallery", "coverId": "cv-1" }
    }
  },
  "conversion": {
    "device": "kpw_11",
    "format": "EPUB",
    "preset": "manga",
    "metadata": {
      "title": "Meu Manga - Volume 1",
      "author": "Autor Desconhecido"
    }
  },
  "delivery": {
    "type": "kindle",
    "kindleEmail": "usuario@kindle.com"
  }
}
```

Response inicial:

```json
{
  "id": "job_123",
  "seriesTitle": "Meu Manga",
  "seriesSlug": "meu-manga",
  "seriesHue": 333,
  "format": "EPUB",
  "delivery": "kindle",
  "kindleEmail": "usuario@kindle.com",
  "totalChapters": 3,
  "totalPages": 72,
  "status": "queued",
  "overallProgress": 0,
  "stages": [
    {
      "id": "downloading",
      "label": "Baixando imagens",
      "status": "pending",
      "progress": 0
    },
    {
      "id": "converting",
      "label": "Convertendo paginas",
      "status": "pending",
      "progress": 0
    },
    {
      "id": "generating",
      "label": "Gerando arquivo",
      "status": "pending",
      "progress": 0
    },
    {
      "id": "sending",
      "label": "Enviando pro Kindle",
      "status": "pending",
      "progress": 0
    }
  ],
  "createdAt": 1783270000000
}
```

Observacoes importantes:

- Se `delivery = "download"`, nao incluir a etapa `sending`.
- `createdAt` e `completedAt` hoje sao timestamps numericos em milissegundos.
- `seriesSlug` deve ser estavel para abrir `/biblioteca/$slug`.
- `seriesHue` e usado apenas para cor de capa na UI atual; pode ser calculado no backend ou removido quando houver capa real.

## Status e etapas do job

Tipos atuais:

```ts
type JobStage = "downloading" | "converting" | "generating" | "sending";
type JobStatus = "queued" | "running" | "completed" | "error";
```

Status de etapa:

```ts
"pending" | "active" | "completed" | "error"
```

Etapas:

- `downloading`: baixar imagens dos capitulos.
- `converting`: aplicar preset e converter paginas.
- `generating`: compactar/gerar arquivo final.
- `sending`: enviar para Kindle, apenas quando entrega for Kindle.

Endpoint por polling:

```http
GET /conversions/:jobId
Authorization: Bearer <token>
```

Response:

```json
{
  "id": "job_123",
  "seriesTitle": "Meu Manga",
  "seriesSlug": "meu-manga",
  "seriesHue": 333,
  "format": "EPUB",
  "delivery": "kindle",
  "kindleEmail": "usuario@kindle.com",
  "totalChapters": 3,
  "totalPages": 72,
  "status": "running",
  "overallProgress": 42,
  "stages": [
    {
      "id": "downloading",
      "label": "Baixando imagens",
      "status": "completed",
      "progress": 100
    },
    {
      "id": "converting",
      "label": "Convertendo paginas",
      "status": "active",
      "progress": 25
    }
  ],
  "createdAt": 1783270000000
}
```

Alternativa em tempo real:

```http
GET /conversions/:jobId/events
Accept: text/event-stream
Authorization: Bearer <token>
```

Eventos SSE recomendados:

- `job.updated`
- `job.completed`
- `job.failed`
- `job.cancelled`

O frontend atual funciona com estado em memoria, mas para API real o ideal e usar polling curto ou SSE/WebSocket.

## Cancelamento

Endpoint recomendado:

```http
POST /conversions/:jobId/cancel
Authorization: Bearer <token>
```

Response:

```json
{
  "id": "job_123",
  "status": "error",
  "errorMessage": "Cancelado pelo usuario."
}
```

No frontend atual, cancelar marca o job como `error` com `errorMessage = "Cancelado pelo usuario."`.

## Resultado final e biblioteca

Quando o job conclui, o frontend atual cria uma `MangaSeries` e adiciona na biblioteca.

Formato esperado para biblioteca:

```ts
interface MangaSeries {
  slug: string;
  title: string;
  author: string;
  hue: number;
  files: MangaFile[];
  lastConverted: string;
  favorite: boolean;
  tags: string[];
  addedAt: string;
}

interface MangaFile {
  id: string;
  name: string;
  bytes: number;
  when: string;
  format: "EPUB" | "MOBI" | "PDF" | "CBZ" | "KFX";
  sent: boolean;
  status: "completed" | "pending" | "error" | "converting";
  chapters: Chapter[];
}

interface Chapter {
  id: string;
  number: string;
  title: string;
  status: "completed" | "pending" | "error" | "converting";
}
```

Response final recomendada em `GET /conversions/:jobId` quando completo:

```json
{
  "id": "job_123",
  "status": "completed",
  "overallProgress": 100,
  "completedAt": 1783270100000,
  "librarySeries": {
    "slug": "meu-manga",
    "title": "Meu Manga",
    "author": "Autor Desconhecido",
    "hue": 333,
    "lastConverted": "agora",
    "favorite": false,
    "tags": [],
    "addedAt": "2026-07-05T12:00:00.000Z",
    "files": [
      {
        "id": "meu-manga-vol-01",
        "name": "meu-manga-vol-01.epub",
        "bytes": 9437184,
        "format": "EPUB",
        "sent": true,
        "status": "completed",
        "downloadUrl": "https://cdn.exemplo.com/files/meu-manga-vol-01.epub",
        "when": "agora",
        "chapters": [
          {
            "id": "ch-1",
            "number": "1",
            "title": "O inicio",
            "status": "completed"
          }
        ]
      }
    ]
  }
}
```

Endpoint de biblioteca recomendado:

```http
GET /library
GET /library/:slug
DELETE /library/:slug
DELETE /library/:slug/files/:fileId
PATCH /library/:slug
```

Para download:

```http
GET /library/:slug/files/:fileId/download
Authorization: Bearer <token>
```

Pode retornar redirect assinado ou binario direto.

## Reconversao

A tela de serie possui reconversao mockada:

- Reconverter volume inteiro.
- Reconverter capitulos selecionados dentro de um volume.

Endpoints recomendados:

```http
POST /library/:slug/files/:fileId/reconvert
POST /library/:slug/files/:fileId/chapters/reconvert
```

Request para capitulos:

```json
{
  "chapterIds": ["ch-1", "ch-2"]
}
```

Response:

```json
{
  "jobId": "job_456"
}
```

A reconversao deve criar um novo job de conversao, reaproveitando as configuracoes originais do arquivo/serie quando possivel.

## Validacoes obrigatorias no backend

- Usuario autenticado em todos os endpoints de conversao e biblioteca.
- URL valida e fonte suportada.
- `chapters` nao vazio.
- Todos os `chapterIds` pertencem ao `sourceId`.
- `volume.size >= 1`.
- `volume.sizes` nao pode exceder nem deixar buracos sem regra definida.
- `format` dentro de `EPUB`, `MOBI`, `CBZ`, `KFX` ou `PDF` se decidir habilitar PDF.
- `device` dentro da lista suportada.
- `preset` dentro da lista suportada.
- `delivery.type` dentro de `download` ou `kindle`.
- `kindleEmail` obrigatorio e com dominio `kindle.com` ou `free.kindle.com` quando entrega for Kindle.
- Arquivos para Kindle devem respeitar limite de tamanho ou ser divididos automaticamente.

## Erros padronizados

Formato recomendado, compatibilidade com `ApiError` atual:

```json
{
  "error": "Mensagem legivel para o usuario",
  "issues": [
    {
      "path": "delivery.kindleEmail",
      "message": "Use um endereco @kindle.com ou @free.kindle.com."
    }
  ]
}
```

Codigos comuns:

- `400`: payload invalido.
- `401`: sem token ou token invalido.
- `403`: recurso pertence a outro usuario.
- `404`: job, obra, capitulo ou arquivo nao encontrado.
- `409`: job nao pode ser cancelado/reconvertido no estado atual.
- `422`: fonte nao suportada ou conversao inviavel.
- `500`: falha inesperada.

## Checklist de implementacao da API

1. Criar modulo `conversions` no backend.
2. Persistir fontes inspecionadas, jobs, etapas e arquivos finais.
3. Implementar `POST /conversions/source/inspect`.
4. Implementar upload de capas ou definir que apenas capas originais/galeria serao aceitas inicialmente.
5. Implementar `POST /conversions/preview`.
6. Implementar `POST /conversions`.
7. Rodar conversao em worker/fila, nao dentro da request HTTP.
8. Implementar `GET /conversions/:jobId`.
9. Implementar cancelamento.
10. Implementar biblioteca real e downloads.
11. Trocar `useConversion` e `useBiblioteca` para chamar API em vez de estado mockado.
12. Adicionar polling ou SSE na tela `/biblioteca/converter/$jobId`.

