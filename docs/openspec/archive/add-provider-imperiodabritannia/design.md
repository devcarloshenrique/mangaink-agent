# Provider ImperioDaBritannia — Design

> **Status:** PENDING
> **Data:** 2026-07-19

---

## 1. Contexto

O sistema hoje possui um único provider de scraping: **MangaLivre**, que utiliza **cheerio** (HTML parsing).
O Imperio da Britannia expõe uma **API REST interna** (`api.imperiodabritannia.net`) que retorna JSON,
eliminando a necessidade de parsing HTML. Isso torna o provider significativamente mais simples e confiável.

Dois scripts de prova de conceito já foram criados na raiz do monorepo:
- `imperiodabritannia.js` — inspect (metadata + lista de capítulos)
- `imperiodabritannia-2.js` — getChapterImages (páginas/imagens de um capítulo)

---

## 2. Arquitetura

### 2.1. Engine: `api`

O `ProviderEngine` já suporta o valor `'api'` (definido em `provider.types.ts`).
Diferente do MangaLivre (cheerio), este provider fará chamadas HTTP JSON diretas.

### 2.2. Estrutura de Arquivos

```
apps/backend/src/modules/scraping/providers/
├── mangalivre/
│   ├── mangalivre.provider.ts
│   ├── mangalivre.parser.ts
│   └── mangalivre.selectors.ts
├── imperiodabritannia/
│   ├── imperiodabritannia.provider.ts  ← IProviderStrategy
│   ├── imperiodabritannia.api.ts       ← HTTP client + chamadas API
│   ├── imperiodabritannia.mapper.ts    ← API response → domain types
│   └── imperiodabritannia.types.ts     ← Tipos da API externa
├── provider-resolver.ts
├── provider.interface.ts
└── index.ts
```

### 2.3. Fluxo de Dados

```
┌─────────────────────────────────────────────────────────┐
│  inspect(canonicalUrl)                                   │
│                                                         │
│  1. Extrair slug da URL                                 │
│  2. GET /api/obras/by-slug/{slug}    (via rateLimiter)  │
│  3. Mapear obra → SourceInspectResponse                 │
│     - metadata (título, descrição, status, gêneros)     │
│     - chapters (número, título, URL, pages, paywall)    │
│     - covers (CDN URL)                                  │
│  4. Retornar resultado                                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  getChapterImages(chapterUrl)                            │
│                                                         │
│  1. Extrair slug + número do capítulo da URL            │
│  2. GET /api/obras/by-slug/{slug}    → obter obra_id   │
│     (cache in-memory por slug)                          │
│  3. GET /api/obras/{id}/capitulos/{n} (via rateLimiter) │
│  4. Verificar paywall_bloqueado                         │
│  5. Extrair paginas[].cdn_id → URLs absolutas           │
│  6. Retornar lista de URLs                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  downloadImage(imageUrl)                                 │
│                                                         │
│  1. GET imageUrl (arraybuffer, via rateLimiter)          │
│  2. Retornar { buffer, contentType }                    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. API do Imperio da Britannia

### Headers Obrigatórios

| Header | Valor | Descrição |
|--------|-------|-----------|
| `Content-Type` | `application/json` | Tipo de conteúdo |
| `x-noencryptionbritta` | `1` | Desativa criptografia da resposta |
| `X-API-Token` | `bunker_api_token_secreto_2025` | Token estático do bundle JS |
| `Referer` | `https://imperiodabritannia.net` | Anti-hotlinking |
| `Origin` | `https://imperiodabritannia.net` | CORS |

### Endpoints

| Endpoint | Retorno |
|----------|---------|
| `GET /api/obras/by-slug/{slug}` | `{ sucesso: true, obra: { id, nome, descricao, imagem, status_nome, tags[], capitulos[] } }` |
| `GET /api/obras/{obraId}/capitulos/{numero}` | `{ sucesso: true, capitulo: { numero, nome, paginas[], paywall, paywall_bloqueado, capitulo_anterior, capitulo_proximo } }` |

### Domínios

| Domínio | Uso |
|---------|-----|
| `imperiodabritannia.net` | Site principal |
| `api.imperiodabritannia.net` | API REST |
| `cdn.imperiodabritannia.net` | CDN de imagens |

---

## 4. Rate Limiting

A API do Imperio da Britannia é uma API privada (não documentada), portanto devemos ser **conservadores** para evitar bloqueios.

### Configuração Recomendada

```env
RATE_LIMIT_IMPERIODABRITANNIA_MAX_CONCURRENT=2
RATE_LIMIT_IMPERIODABRITANNIA_MIN_TIME=500
```

**Justificativa:**
- `maxConcurrent: 2` — máximo 2 requisições simultâneas (API privada, sem SLA)
- `minTime: 500ms` — intervalo mínimo de 500ms entre requisições (2 req/s)
- Sem reservoir — o minTime+maxConcurrent já limita suficientemente

Esses valores são os menores possíveis que ainda protegem contra bloqueio:
- 2 req/s é conservador para uma API que não foi projetada para uso externo
- Comparado ao MangaLivre (10 concurrent, 0ms) que é um site preparado para alto tráfego

---

## 5. Mapeamentos

### Status da Obra

| API (`status_nome`) | Domain (`status`) |
|---------------------|-------------------|
| `ativo`, `andamento`, `ongoing` | `ongoing` |
| `completo`, `finalizado`, `encerrado` | `completed` |
| `hiato`, `pausa`, `hiatus` | `hiatus` |
| `cancelado` | `cancelled` |
| *outros* | `unknown` |

### Número do Capítulo

A API retorna `"1.00"`, `"2.00"`, `"10.50"`. Normalização:
- `"1.00"` → `"1"` (remove decimais `.00`)
- `"10.50"` → `"10.5"` (preserva decimais significativos)

---

## 6. Decisões de Design

1. **Sem selectors/cheerio** — provider usa API direta, não HTML parsing
2. **Arquivo separado para tipos da API** — `imperiodabritannia.types.ts` define as interfaces da API externa, isolando o acoplamento
3. **Mapper dedicado** — `imperiodabritannia.mapper.ts` transforma a resposta da API nos tipos do domínio (`Chapter`, `Cover`, `MangaMetadata`)
4. **Cache in-memory de obra_id** — `getChapterImages()` precisa do `obra_id` (obtido via slug), cachear evita chamada duplicada
5. **SSRF protection** — `allowedDomains` inclui os 3 domínios: site, API e CDN
6. **Paywall handling** — capítulos com `paywall_bloqueado: true` lançam erro em `getChapterImages()`
