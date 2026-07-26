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

Adicionar um botão **"Adicionar obra"** na página da biblioteca que abre um modal com fluxo simplificado de 2 passos:

1. **Colar URL** — Inspeção via scraping (reusa `useScraping` + SSE)
2. **Selecionar capítulos** — Checkboxes com os capítulos disponíveis

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
   ├─ [Adicionar obra] → Abre AddMangaDialog
   │
   ├─ Passo 0: Colar URL → "Buscar"
   │     └─ scrapingApi.inspect(url)
   │     └─ Cache hit?  200 → metadata imediato
   │     └─ Cache miss? 202 → SSE progress → metadata
   │
   ├─ Passo 1: Selecionar capítulos
   │     └─ Checkboxes com títulos dos capítulos
   │     └─ Contador: "3 capítulos selecionados"
   │
   └─ Confirmar → POST /api/conversions (downloadOnly: true)
         └─ 202 { conversionId }
         └─ Fecha modal → navigate(/biblioteca/converter/$conversionId)

Progresso (/biblioteca/converter/$convId)
   │
   ├─ Barra geral: 0-100% (apenas download)
   ├─ Stage card único: "Baixando imagens"
   ├─ SpeechBubble: "Baixando Capítulo 5 — 12/30 imagens"
   ├─ Terminal de logs: eventos download.*
   │
   └─ Concluído → "DONE!" → [Ver na biblioteca]

Biblioteca → Nova obra aparece agrupada
   └─ Clica na obra → /biblioteca/$sourceId → Aba "Capítulos" → Ler
```

---

## 4. Escopo

### Incluído
- [x] Botão "Adicionar obra" na biblioteca (ao lado de "Converter novo")
- [x] Modal com input de URL + scraping reutilizando `useScraping`
- [x] Seleção de capítulos com checkboxes
- [x] `POST /api/conversions` com `downloadOnly: true`
- [x] Worker e fila BullMQ dedicados (`download-only`)
- [x] Download de imagens com rate limit + placeholders
- [x] Página de progresso adaptada: 1 stage (download), 0-100%
- [x] Terminal de logs reutilizando SSE journal
- [x] Itens aparecem na biblioteca agrupados por `sourceId`
- [x] Tratamento de erros: `ignore` / `skip_chapter` / `abort`
- [x] Labels da biblioteca ajustados para "obras"/"itens"

### Excluído
- [ ] Conversão KCC (EPUB/MOBI/CBZ/PDF)
- [ ] Seleção de dispositivo, formato, preset
- [ ] Configuração de capas
- [ ] Envio para Kindle
- [ ] Agendamentos

---

## 5. Critérios de Aceitação

1. Botão "Adicionar obra" visível ao lado de "Converter novo"
2. Clique abre modal com input de URL
3. Scraping funciona com cache hit e cache miss
4. Após scraping, lista de capítulos disponíveis para seleção
5. Selecionar capítulos e confirmar cria uma conversion download-only
6. Fila `download-only` é separada da fila `conversion-job`
7. Progresso mostra apenas 1 stage: "Baixando imagens"
8. Barra geral vai de 0 a 100% conforme capítulos processados
9. Terminal mostra logs de download por capítulo
10. Ao concluir, obra aparece na biblioteca
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
