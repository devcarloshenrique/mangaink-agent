# Implement Frontend Library — Proposta

> **Status:** DONE
> **Data:** 2026-07-17
> **Módulo:** `frontend` (biblioteca + reader) + `backend` (conversion)

---

## 1. Problema

O backend já possui todos os endpoints de conversão implementados (criação, listagem, cancelamento, download, SSE), mas o frontend da biblioteca (`/biblioteca`) não existia como interface real — apenas um placeholder estático. O usuário não conseguia:

- Listar conversões agrupadas por obra (sourceId)
- Ver capas das obras convertidas
- Ler EPUB/CBZ/PDF gerados pelo KCC dentro do navegador
- Cancelar, remover ou reconverter obras existentes
- Iniciar uma reconversão a partir da biblioteca (wizard preenchido)

Além disso, haviam 5 bugs críticos no backend e frontend que impediam o funcionamento correto das funcionalidades já existentes.

---

## 2. Solução Proposta

### 2.1. Novos Endpoints de Backend

Adicionar endpoints complementares ao módulo `conversion/` para suportar o frontend:

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/conversions` | `GET` | Listagem paginada por usuário (filtros: status, sourceId) |
| `/api/conversions/:id` | `DELETE` | Remoção permanente (hard-delete) |
| `/api/conversions/:id/cancel` | `POST` | Cancelamento sem remoção |
| `/api/conversions/:id/jobs/:jobId/download` | `GET` | Download do arquivo de saída (EPUB/MOBI/CBZ/PDF) |
| `/api/conversions/source/:sourceId/covers/:coverId` | `GET` | Serve imagem de capa cacheada (público) |

### 2.2. Filtro Multi-Status

O DTO `list-conversions.dto.ts` deve aceitar múltiplos status via query string: `?status=queued,processing` usando `z.preprocess` para split.

### 2.3. Campo `cover` no `ConversionSummary`

O `ConversionSummary` (tipagem e schema Zod) deve incluir `cover?: CoverRef` para que o frontend possa renderizar a capa sem buscar a source separadamente.

### 2.4. Frontend da Biblioteca

| Rota | Descrição |
|------|-----------|
| `/biblioteca` (index) | Grid/lista de obras agrupadas por sourceId, com capas, filtro de status, busca |
| `/biblioteca/$sourceId` | Detalhe da obra: lista de conversões com status, capas, ações (cancelar/remover/reconverter/ler) |
| `/biblioteca/reader/$conversionId` | Seletor de volume + leitor multi-formato (EPUB, PDF, CBZ, MOBI download-only) |

### 2.5. Wizard de Reconversão

A rota `/wizard` deve aceitar query params `sourceId` e `conversionId` para preencher automaticamente steps 1-4 com dados de uma conversão existente, pulando direto para step 2 (capítulos).

### 2.6. Leitor Multi-Formato

| Formato | Técnica |
|---------|---------|
| EPUB | `react-reader` via `ArrayBuffer` (evita problemas de blob URL com workers) |
| PDF | `<iframe>` com `src=blobURL` em container `h-screen flex-col` |
| CBZ | `JSZip` para extrair imagens + galeria com navegação prev/next |
| MOBI | Tela informativa + botão de download (sem renderização browser) |

---

## 3. Escopo

### Incluído

- [x] Endpoint `GET /api/conversions` (listagem paginada com filtros)
- [x] Filtro multi-status via `?status=queued,processing`
- [x] Endpoint `DELETE /api/conversions/:id` (hard-delete)
- [x] Endpoint `POST /api/conversions/:id/cancel`
- [x] Endpoint `GET /:id/jobs/:jobId/download` (download streaming)
- [x] Endpoint `GET /source/:sourceId/covers/:coverId` (serve imagem, público)
- [x] Campo `cover` em `ConversionSummary` (tipo + schema Zod + Prisma select)
- [x] Hooks: `useConversions`, `useConversionActions`
- [x] Rota `/biblioteca` (index com grid/lista agrupada por sourceId + capas)
- [x] Rota `/biblioteca/$sourceId` (detalhe da obra + ações)
- [x] Rota `/biblioteca/reader/$conversionId` (seletor de volume + leitor)
- [x] Leitor EPUB via `react-reader` + `ArrayBuffer` + props obrigatórias
- [x] Leitor PDF via `<iframe>` fullscreen
- [x] Leitor CBZ via `JSZip` + galeria de páginas
- [x] Fallback MOBI com download
- [x] Wizard reconvert: `validateSearch` + prefill com dados da conversão existente
- [x] Capas renderizadas no index (grid + list) e na detail view

### Fora de Escopo

- [ ] Envio para Kindle (mocado)
- [ ] Upload de capas customizadas
- [ ] Preview de página real
- [ ] Tempo estimado real
- [ ] Histórico de leitura / bookmark

---

## 4. Bugs Corrigidos

| # | Bug | Causa | Correção |
|---|-----|-------|----------|
| 1 | Scraping retorna 0 capítulos | `elClass.includes('c-btn')` com match parcial | `classTokens.includes('c-btn')` com split por espaço |
| 2 | Ícone de log removido | Botão `ScrollText` ausente nos cards de conversão | Adicionado `<Link to=/biblioteca/converter/$jobId>` |
| 3 | Reader loading infinito | `setLoading(false)` ausente no caminho de sucesso | Adicionado no `try` após `setTitle` |
| 4 | Swagger 500 | `response.200: { type: 'string', format: 'binary' }` quebra `jsonSchemaTransform` | Removido dos endpoints download + cover |
| 5 | Capas não aparecem | `cover` stripado pelo serializer Zod (não estava no response schema) | Adicionado `cover: coverSchema.optional()` ao `conversionSummarySchema` |

---

## 5. Critérios de Aceitação

1. `GET /api/conversions` retorna array paginado com filtros por status e sourceId
2. `DELETE /api/conversions/:id` remove permanentemente do banco
3. `GET /:id/jobs/:jobId/download` serve o arquivo com Content-Type e Content-Disposition corretos
4. `GET /source/:sourceId/covers/:coverId` serve imagem cacheada (pública, sem auth)
5. `/biblioteca` exibe grid/lista de obras com capas, busca e filtro de status
6. `/biblioteca/$sourceId` lista conversões com status, capa, ações (cancelar/remover/reconverter/ler)
7. `/biblioteca/reader/$conversionId` permite selecionar volume e ler EPUB/PDF/CBZ
8. EPUB carrega sem erro (via ArrayBuffer + props obrigatórios)
9. PDF ocupa tela cheia (container `h-screen` em vez de `min-h-screen`)
10. CBZ navega entre páginas com prev/next
11. MOBI exibe tela de download
12. Wizard preenche dados ao receber `?sourceId=&conversionId=`
13. Todas as capas aparecem (backend retorna campo `cover`, frontend renderiza `<img>`)
14. Swagger carrega sem erro 500
15. Scraping retorna capítulos corretamente
