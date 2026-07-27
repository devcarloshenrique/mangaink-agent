# Quick Download — Proposta

> **Status:** DRAFT
> **Data:** 2026-07-25
> **Módulo:** `conversion` + `scraping`

---

## 1. Problema

Atualmente, a única forma de baixar as imagens dos capítulos de um mangá para leitura no navegador é através do wizard completo de conversão (5 passos). O usuário precisa configurar dispositivo, formato, preset, capa e entrega apenas para ter as imagens em cache.

Não existe um caminho rápido para simplesmente adicionar uma obra à biblioteca e baixar seus capítulos sem gerar um arquivo EPUB/MOBI.

## 2. Solução Proposta

### 2.1. "Adicionar obra" na biblioteca

Adicionar um botão **"Adicionar obra"** na página da biblioteca que expande uma barra de URL inline (estilo lupa que expande campo de busca). Após a inspeção da URL via scraping, abre um modal com layout em 2 colunas:

1. **Barra de URL inline** — Ao clicar em "Adicionar obra", expande um campo de URL com botão "Buscar". Inspeção via scraping (reusa `useScraping` + SSE). Ao concluir, abre o modal.
2. **Modal de seleção** — Layout 2 colunas: capa e metadados à esquerda, lista de capítulos com busca/filtro à direita. Checkboxes com número, título e contagem de páginas. Rodapé com badge de selecionados + total de páginas.

Ao confirmar, o backend cria uma `Conversion` com `downloadOnly: true`. Essa conversion não gera arquivo final — apenas baixa as imagens para o cache local. O progresso é acompanhado na tela de progresso de conversão, porém com apenas a barra de download (sem etapa KCC).

### 2.2. API

Aproveitamos o endpoint existente com uma nova flag:

```
POST /api/conversions
```

Body:
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

> `output` (deviceId/format) é opcional quando `downloadOnly: true`.

Response `202`:
```json
{
  "conversionId": "conv_xyz",
  "status": "queued",
  "totalJobs": 1,
  "createdAt": "2026-07-25T..."
}
```

### 2.3. Fila dedicada

Download-only usa uma fila BullMQ separada (`download-only`) com um worker dedicado. Isso evita que downloads fiquem bloqueados atrás de jobs de KCC, que podem durar vários minutos.

### 2.4. Integração com a biblioteca

Download-only cria uma `Conversion` comum, então aparece automaticamente na biblioteca agrupada por `sourceId`, junto com as conversões normais. A diferença é que não possui arquivo final para download.

---

## 3. Fluxo Completo

```
Biblioteca (/biblioteca)
   │
   ├─ [Adicionar obra] → Expande InlineUrlBar
   │     ├─ Input de URL + botão "Buscar"
   │     └─ scrapingApi.inspect(url)
   │          ├─ Cache hit?  200 → Abre AddMangaDialog
   │          └─ Cache miss? 202 → SSE progress → Abre AddMangaDialog
   │
   ├─ AddMangaDialog (layout 2 colunas)
   │     ├─ Coluna esquerda: capa, autor, ano, status, nota
   │     ├─ Coluna direita: título, alt, gêneros, sinopse
   │     │   ├─ Busca/filtro de capítulos
   │     │   └─ Lista: checkbox + número + título + páginas
   │     └─ Rodapé: "N SELECIONADOS ~N páginas" + [Baixar capítulos]
   │
   └─ Confirmar → POST /api/conversions (downloadOnly: true)
         └─ 202 { conversionId }
         └─ Fecha modal → navigate(/biblioteca/converter/$conversionId)

Progresso (/biblioteca/converter/$convId)
   │
   ├─ Barra geral: 0-100% (apenas download)
   ├─ Stage card único: "Baixando capítulos"
   ├─ SpeechBubble: "Baixando Capítulo N — X/Y imagens"
   ├─ Fila de capítulos com status (check/spinner/clock)
   ├─ Terminal de logs: eventos download.*
   │
   └─ Concluído → "DONE!" → [Ver na biblioteca]

Biblioteca → Nova obra aparece agrupada
   └─ Clica na obra → /biblioteca/$sourceId → Aba "Capítulos" → Ler
```

---

## 4. Escopo

### Incluído
- [ ] Botão "Adicionar obra" na biblioteca (ao lado de "Converter novo")
- [ ] Barra de URL inline expansível (estilo lupa) com scraping via `useScraping`
- [ ] Modal com layout 2 colunas: capa/metadados + lista de capítulos com busca
- [ ] Seleção de capítulos com checkboxes, badges de número e contagem de páginas
- [ ] CTA "Baixar capítulos" no rodapé com badge "N SELECIONADOS ~N páginas"
- [ ] `POST /api/conversions` com `downloadOnly: true`
- [ ] Worker e fila BullMQ dedicados (`download-only`)
- [ ] Download de imagens com rate limit + placeholders
- [ ] Página de progresso adaptada: 1 stage "Baixando capítulos", fila de capítulos, terminal
- [ ] Terminal de logs reutilizando SSE journal
- [ ] Itens aparecem na biblioteca agrupados por `sourceId`
- [ ] Tratamento de erros: `ignore` / `skip_chapter` / `abort`
- [ ] Labels da biblioteca ajustados para "obras"/"itens"

### Excluído
- [ ] Conversão KCC (EPUB/MOBI/CBZ/PDF)
- [ ] Seleção de dispositivo, formato, preset
- [ ] Configuração de capas
- [ ] Envio para Kindle
- [ ] Agendamentos

---

## 5. Critérios de Aceitação

1. Botão "Adicionar obra" visível ao lado de "Converter novo"
2. Clique expande barra de URL inline com input + botão "Buscar"
3. Scraping funciona com cache hit (abre modal direto) e cache miss (SSE → abre modal)
4. Modal exibe layout 2 colunas: capa/metadados + lista de capítulos com busca/filtro
5. Selecionar capítulos mostra badge "N SELECIONADOS ~N páginas"
6. CTA "Baixar capítulos" chama POST /api/conversions com downloadOnly: true
7. Fila `download-only` é separada da fila `conversion-job`
8. Progresso mostra 1 stage "Baixando capítulos" com fila de capítulos e terminal de logs
9. Barra geral vai de 0 a 100% conforme capítulos processados
10. Ao concluir, obra aparece na biblioteca agrupada por sourceId
11. Clicando na obra, a aba "Capítulos" mostra capítulos baixados

---

## 6. Dependências

- Módulo de scraping (existente)
- Módulo de conversão (existente — será estendido)
- Infraestrutura SSE/PubSub/Redis (existente)
- Componente `Dialog` do shadcn/ui (existente)
- Hook `useScraping` (existente)
- `ImageDownloaderService` (existente)
- `BullMQ` (existente)
