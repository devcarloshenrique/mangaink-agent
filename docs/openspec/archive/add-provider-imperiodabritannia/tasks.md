# Provider ImperioDaBritannia — Tasks de Implementação

> **Status:** COMPLETED
> **Data:** 2026-07-19 (plano) / 2026-07-19 (implementação)
> **Metodologia:** TDD (Vermelho → Verde → Refatora)

---

## 1. Configuração e Ambiente

- [x] 1.1 `shared/config/env.ts` — Adicionar variáveis de rate limiting ao schema Zod:
  - `RATE_LIMIT_IMPERIODABRITANNIA_MAX_CONCURRENT` (positiveMs, default 2)
  - `RATE_LIMIT_IMPERIODABRITANNIA_MIN_TIME` (numericMs, default 500)
- [x] 1.2 `.env` — Adicionar valores padrão com comentário explicativo

> **Status: COMPLETED**

---

## 2. Tipos da API Externa

- [x] 2.1 Criar `providers/imperiodabritannia/imperiodabritannia.types.ts`:
  - `BritanniaObraTag`, `BritanniaCapitulo`, `BritanniaObra`, `BritanniaObraResponse`
  - `BritanniaPagina`, `BritanniaCapituloDetalhado`, `BritanniaCapituloResponse`

> **Status: COMPLETED**

---

## 3. Mapper (TDD)

- [x] 3.1 `resolveStatus()` — 10 testes (case-insensitive, null, unknown)
- [x] 3.2 `normalizeChapterNumber()` — 5 testes ("1.00" → "1", "10.50" → "10.5")
- [x] 3.3 `mapObraToInspectResponse()` — 12 testes (metadata, covers, chapters, sourceId, sanitize, null fields)
- [x] 3.4 `mapCapituloToImageUrls()` — 5 testes (extract, sort, empty, paywall, price message)
- [x] 3.5 `getMangaSlug()` + `parseChapterUrl()` — 7 testes (URL parsing, edge cases)
- [x] 3.6 Refatorar — Correção do bug `createChapterId(cap.numero)` → `createChapterId(number)` para normalizar antes

> **Status: COMPLETED** — 39 testes passando

---

## 4. API Client

- [x] 4.1 API logic embedded directly in provider (private methods) — simplificação vs arquivo separado
  - `fetchObraBySlug()`, `fetchChapterPages()`, `getObraId()` com cache in-memory
  - Arquivo `imperiodabritannia.api.ts` separado foi removido (desnecessário)

> **Status: COMPLETED**

---

## 5. Provider (TDD)

- [x] 5.1 Propriedades e `supports()` — 10 testes (slug, name, engine, allowedDomains, urlPattern, URL validation)
- [x] 5.2 `getInfo()` — 1 teste
- [x] 5.3 `inspect()` — 4 testes (sucesso, erro HTTP, status ready, provider info)
- [x] 5.4 `getChapterImages()` — 4 testes (sucesso, erro HTTP, paywall, URL inválida)
- [x] 5.5 `downloadImage()` — 2 testes (sucesso, erro HTTP)

> **Status: COMPLETED** — 21 testes passando

---

## 6. Registro no ProviderResolver (TDD)

- [x] 6.1 Importar `ImperioDaBritanniaStrategy` no resolver
- [x] 6.2 Criar rate limiter e adicionar ao array de providers
- [x] 6.3 Exportar no `providers/index.ts`
- [x] 6.4 Testes atualizados: +2 testes de resolução IDB, listAll atualizado para 2 providers

> **Status: COMPLETED** — 11 testes passando (todos existentes + 2 novos)

---

## 7. Verificação Final

- [x] 7.1 Todos os testes unitários do módulo scraping passam: 122/122 em 7 test files
- [x] 7.2 Testes pré-existentes que falham são causados por infraestrutura offline (Redis/PostgreSQL), não pelo código novo
- [x] 7.3 `CLAUDE.md` atualizado com informações do novo provider

> **Status: COMPLETED**

---

## Archive Note

Esta spec foi **COMPLETED** em 2026-07-19. O módulo implementa:

- Provider `ImperioDaBritanniaStrategy` com engine `api` (API REST direta, sem cheerio)
- Mapper puro com funções: `resolveStatus()`, `normalizeChapterNumber()`, `mapObraToInspectResponse()`, `mapCapituloToImageUrls()`
- Tipos TypeScript para API externa: `BritanniaObra`, `BritanniaCapituloDetalhado`, etc.
- Rate limiting conservador: `maxConcurrent=2`, `minTime=500ms` (~2 req/s)
- Cache in-memory de slug → obraId
- SSRF protection com 3 domínios: site, API, CDN
- Paywall handling com mensagens de preço
- 62 testes novos (39 mapper + 21 provider + 2 resolver), total 122 no módulo scraping

**Divergências em relação ao spec original:**
- `imperiodabritannia.api.ts` foi eliminado — lógica de API embutida como métodos privados no provider (mais simples, sem necessidade de abstração separada)
- Bug descoberto via TDD: `createChapterId("1.00")` gerava `chap_0001_00` em vez de `chap_0001` — corrigido normalizando o número antes de gerar o ID

**Arquivos criados:**
- `providers/imperiodabritannia/imperiodabritannia.types.ts`
- `providers/imperiodabritannia/imperiodabritannia.mapper.ts`
- `providers/imperiodabritannia/imperiodabritannia.provider.ts`
- `tests/unit/imperiodabritannia.mapper.test.ts`
- `tests/unit/imperiodabritannia.provider.test.ts`

**Arquivos modificados:**
- `shared/config/env.ts` (+2 vars)
- `providers/provider-resolver.ts` (+1 provider)
- `providers/index.ts` (+1 export)
- `tests/unit/provider-resolver.test.ts` (+2 testes, 1 atualizado)
- `.env` (+3 linhas)
- `CLAUDE.md` (documentação atualizada)
