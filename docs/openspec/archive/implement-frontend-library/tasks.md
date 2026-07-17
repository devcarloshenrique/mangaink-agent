# Implement Frontend Library — Tasks de Implementação

> **Status:** DONE
> **Data:** 2026-07-17

---

## 1. Backend — Listagem Paginada

- [x] 1.1 `dtos/list-conversions.dto.ts` — DTO com filtros: `status` (comma-separated via `z.preprocess`), `sourceId`, `page`, `limit`
- [x] 1.2 `use-cases/list-conversions.use-case.ts` — delega para `conversions.listByUser(userId, filters, pagination)`
- [x] 1.3 `controllers/list-conversions.controller.ts` — handler extrai userId do token, chama use-case
- [x] 1.4 `conversion.routes.ts` — registra `GET /api/conversions` com `preHandler: verifyJwt`
- [x] 1.5 `PrismaConversionRepository.listByUser()` — select leve (sem books/options/jobs), status `{ in: array }`
- [x] 1.6 Testes unitários `list-conversions.use-case.test.ts` (9 cenários)
- [x] 1.7 Testes E2E `list-conversions.e2e.test.ts` (ownership, multi-status, 501)

## 2. Backend — Campo `cover` no Response

- [x] 2.1 `create-conversion.dto.ts` — exportar `coverSchema` (discriminatedUnion)
- [x] 2.2 `conversion.routes.ts` — importar `coverSchema`, adicionar `cover: coverSchema.optional()` ao `conversionSummarySchema`
- [x] 2.3 `PrismaConversionRepository.listByUser()` — já selecionava `cover: true` e mapeava `cover: (row.cover ?? undefined) as CoverRef`
- [x] 2.4 `InMemoryConversionRepository.listByUser()` — summaries não incluem `cover` (mock não precisa)
- [x] 2.5 Testes: todos passam (cover opcional, não quebra contratos existentes)

## 3. Backend — Delete + Download + Cover Endpoints

- [x] 3.1 `use-cases/delete-conversion.use-case.ts` — hard-delete com validação de ownership
- [x] 3.2 `use-cases/download-job.use-case.ts` — resolve path, valida ownership, retorna filePath + filename
- [x] 3.3 `use-cases/serve-cover.use-case.ts` — handle alias "original", cache disk, download fallback
- [x] 3.4 `controllers/delete-conversion.controller.ts` — handler
- [x] 3.5 `controllers/download-job.controller.ts` — handler com Content-Type + Content-Disposition
- [x] 3.6 `controllers/serve-cover.controller.ts` — handler público (sem auth), Cache-Control
- [x] 3.7 `conversion.routes.ts` — registrar DELETE, GET download, GET cover (sem verifyJwt no cover)
- [x] 3.8 Remover `response.200` raw JSON de download e cover (causava Swagger 500)
- [x] 3.9 Testes unitários `delete-conversion.use-case.test.ts` (3 cenários)
- [x] 3.10 Testes unitários `download-job.use-case.test.ts` (3 cenários)
- [x] 3.11 Testes unitários `serve-cover.use-case.test.ts` (3 cenários)

## 4. Frontend — Tipos e API Client

- [x] 4.1 `types/conversion.ts` — `ConversionSummary` com `cover?: CoverRef`, `ConversionListResult`
- [x] 4.2 `lib/api.ts` — `conversionsApi.list()`, `conversionsApi.remove()`, `conversionsApi.coverUrl()`, `conversionsApi.getLogs()`
- [x] 4.3 `lib/api.ts` — mover `cancel` de DELETE para POST (alias REST)

## 5. Frontend — Hooks

- [x] 5.1 `hooks/useConversions.ts` — `useConversionsList()`, `useActiveConversions()`, `groupConversionsBySource()`
- [x] 5.2 Adicionar `items: ConversionSummary[]` ao tipo `SeriesGroup`
- [x] 5.3 `hooks/useConversionActions.ts` — `cancel()`, `remove()`, `download()`, `reconvert()` com `queryClient.invalidateQueries`

## 6. Frontend — Biblioteca Index (`/biblioteca`)

- [x] 6.1 Grid view: cards `ComicPanel bg="yellow"` com capa em `aspect-[2/3]`, título overlay, contagem, tempo
- [x] 6.2 List view: thumbnail 16x12, título, status badge, tempo
- [x] 6.3 `SearchBar` com `highlightMatch` para busca textual
- [x] 6.4 Abas: Todas / Em Andamento / Concluídas
- [x] 6.5 `SeriesCover` component: `<img>` com `onError` hide + fallback `<Library>` icon
- [x] 6.6 `seriesCoverUrl()` helper: busca primeiro item com cover no grupo

## 7. Frontend — Detalhe da Obra (`/biblioteca/$sourceId`)

- [x] 7.1 Lista de conversões com capa, título, status badge, progresso, jobs, tempo
- [x] 7.2 Ações por card: log (`ScrollText` link), cancelar (se ativo), remover
- [x] 7.3 Link condicional: completed → reader, demais → progresso
- [x] 7.4 Botão "Reconverter" no header

## 8. Frontend — Leitor (`/biblioteca/reader/$conversionId`)

- [x] 8.1 Tela de seleção de volume (lista de Jobs completed com outputFile)
- [x] 8.2 Container `h-screen` (não `min-h-screen`) para altura definida
- [x] 8.3 EPUB viewer: `fetch` → `arrayBuffer()` → `<ReactReader url={arrayBuffer}>` com `location={null}`
- [x] 8.4 PDF viewer: `<iframe src={blobUrl} className="w-full h-full">`
- [x] 8.5 CBZ viewer: `JSZip.loadAsync(blob)` → galeria prev/next com contador
- [x] 8.6 MOBI fallback: tela informativa + `<a download>`

## 9. Frontend — Wizard Reconvert

- [x] 9.1 `wizard.tsx` — `validateSearch: z.object({ sourceId?, conversionId? })`
- [x] 9.2 `useEffect` prefill: carrega source + conversion config, preenche wizardData, salta step 2
- [x] 9.3 `useConversionActions.reconvert()` — navega com query params

## 10. Bug Fixes

- [x] 10.1 **Scraping 0 capítulos**: `mangalivre.parser.ts` — `classTokens.includes('c-btn')` (token match)
- [x] 10.2 **Ícone log removido**: `biblioteca.$sourceId.tsx` — botão `ScrollText` link para converter
- [x] 10.3 **Reader loading infinito**: `biblioteca.reader.$conversionId.tsx` — `setLoading(false)` no try
- [x] 10.4 **Swagger 500**: `conversion.routes.ts` — remover `200: { type: 'string', format: 'binary' }`
- [x] 10.5 **Capas não aparecem**: `conversion.routes.ts` — `cover: coverSchema.optional()` no schema

## 11. Verificação

- [x] 11.1 `pnpm test` (backend) — 49 files, 417 tests pass
- [x] 11.2 `pnpm test` (scraping) — 20 files, 185 tests pass  
- [x] 11.3 `npx vite build` (frontend) — build OK, chunk react-reader isolado

---

## Ordem de Implementação

```
1 (listagem) → 2 (cover campo) → 3 (delete+download+cover endpoints)
  → 4 (tipos+api) → 5 (hooks) → 6 (index) → 7 (detalhe)
  → 8 (leitor) → 9 (wizard reconvert) → 10 (bug fixes) → 11 (verificação)
```
