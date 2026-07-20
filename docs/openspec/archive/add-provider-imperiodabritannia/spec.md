# Provider ImperioDaBritannia — Spec

> **Status:** PENDING
> **Data:** 2026-07-19

---

## Objetivo

Adicionar o provider `imperiodabritannia` ao sistema de scraping, permitindo inspecionar obras e obter imagens de capítulos do site [Imperio da Britannia](https://imperiodabritannia.net). O provider utiliza a API REST interna do site (engine `api`), não HTML parsing.

---

## Escopo

### In-scope

- Implementação do provider `ImperioDaBritanniaStrategy` seguindo `IProviderStrategy`
- Tipos TypeScript para a API externa
- Mapper: API response → domain types
- Client HTTP dedicado com headers da API
- Rate limiting via Bottleneck (env vars `RATE_LIMIT_IMPERIODABRITANNIA_*`)
- Variáveis de ambiente no schema Zod
- Registro no `ProviderResolver`
- Export no `providers/index.ts`
- Testes unitários (TDD): provider, mapper, API client, provider-resolver atualizado

### Out-of-scope

- Autenticação de usuário na API (usa token estático público)
- Bypass de paywall
- Suporte a busca de mangás (search endpoint)
- Rate limiting adaptativo (HTTP 429)
- Cache distribuído de obra_id (usa in-memory)

---

## Contrato da Interface

O provider implementa `IProviderStrategy` (definida em `scraping/interfaces/provider-strategy.interface.ts`):

```typescript
interface IProviderStrategy {
  readonly slug: string                        // 'imperiodabritannia'
  readonly name: string                        // 'Imperio da Britannia'
  readonly engine: ProviderEngine              // 'api'
  readonly urlPattern: RegExp                  // /imperiodabritannia\.net\/manga\//
  readonly allowedDomains: string[]            // ['imperiodabritannia.net', 'api.imperiodabritannia.net', 'cdn.imperiodabritannia.net']
  readonly rateLimiter: RateLimiter            // Bottleneck instance

  supports(url: string): boolean
  getInfo(): ProviderInfo
  inspect(canonicalUrl: string): Promise<SourceInspectResponse>
  getChapterImages(chapterUrl: string): Promise<string[]>
  downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }>
}
```

---

## Arquivos Modificados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `providers/imperiodabritannia/imperiodabritannia.types.ts` | **CRIAR** | Interfaces da API externa (ObraResponse, CapituloResponse, etc.) |
| `providers/imperiodabritannia/imperiodabritannia.api.ts` | **CRIAR** | HTTP client com headers da API + funções `fetchObraBySlug()`, `fetchChapterPages()` |
| `providers/imperiodabritannia/imperiodabritannia.mapper.ts` | **CRIAR** | Funções puras de mapeamento: `mapObraToInspectResponse()`, `mapCapituloToImageUrls()`, `resolveStatus()`, `normalizeChapterNumber()` |
| `providers/imperiodabritannia/imperiodabritannia.provider.ts` | **CRIAR** | Classe `ImperioDaBritanniaStrategy implements IProviderStrategy` |
| `providers/provider-resolver.ts` | **EDITAR** | Registrar o novo provider no array + injetar rate limiter |
| `shared/config/env.ts` | **EDITAR** | Adicionar variáveis `RATE_LIMIT_IMPERIODABRITANNIA_*` |
| `.env` | **EDITAR** | Adicionar valores padrão para rate limiting |

---

## Testes (TDD)

### Testes Unitários Novos

| Arquivo de Teste | Testes | Descrição |
|------------------|--------|-----------|
| `tests/unit/imperiodabritannia.mapper.test.ts` | ~12 | Mappers puros: `resolveStatus()`, `normalizeChapterNumber()`, `mapObraToInspectResponse()`, `mapCapituloToImageUrls()` — edge cases, paywall, campos nulos |
| `tests/unit/imperiodabritannia.provider.test.ts` | ~12 | Provider: `supports()`, `getInfo()`, propriedades, `inspect()` sucesso/erro, `getChapterImages()` sucesso/erro/paywall, `downloadImage()` sucesso/erro |

### Testes Existentes Atualizados

| Arquivo de Teste | Alteração |
|------------------|-----------|
| `tests/unit/provider-resolver.test.ts` | Ajustar `listAll()` para esperar 2 providers; adicionar testes de resolução para URLs do ImperioDaBritannia |

### Estimativa: ~30 testes novos/atualizados

---

## Variáveis de Ambiente

### Novas no Schema Zod (`env.ts`)

```typescript
RATE_LIMIT_IMPERIODABRITANNIA_MAX_CONCURRENT: positiveMs.default(2),
RATE_LIMIT_IMPERIODABRITANNIA_MIN_TIME: numericMs.default(500),
```

### Valores no `.env`

```env
# Rate Limiting — Imperio da Britannia (API privada, conservador)
RATE_LIMIT_IMPERIODABRITANNIA_MAX_CONCURRENT=2
RATE_LIMIT_IMPERIODABRITANNIA_MIN_TIME=500
```

**Justificativa para limites conservadores:**
- API privada, não documentada, sem SLA
- `maxConcurrent=2` e `minTime=500ms` resultam em ~2 req/s
- Suficiente para inspect (1 request) e download de capítulos (~20-40 páginas em ~10-20s)
- Evita detecção/bloqueio sem impactar significativamente a experiência do usuário

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Token da API mudar | Média | Externalizar token como env var (futuro); por ora é estático no bundle |
| API retornar dados criptografados | Baixa | Header `x-noencryptionbritta: 1` desativa criptografia |
| Bloqueio por rate limit | Baixa | Limites conservadores (2 concurrent, 500ms) |
| Paywall em capítulos | Presente | Erro explícito para capítulos pagos |
| CDN offline | Baixa | Retry automático do http-client (3 tentativas com backoff) |
