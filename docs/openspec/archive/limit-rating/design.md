# Rate Limiting — Design de Arquitetura

> **Status:** IMPLEMENTED (2026-07-13)
> **Ultima validacao:** 2026-07-13 — ImageDownloaderService sem chunking manual, concorrencia controlada pelo Bottleneck do provider.
>
> Decisoes de arquitetura e design do sistema de rate limiting por provider.

---

## 1. Motivacao

O MangaInk Agent atualmente nao possui throttling proativo de requisicoes HTTP. O controle de taxa e puramente reativo (retry com backoff ao receber HTTP 429). Isso causa:

- **Paginas corrompidas em lote:** O teste de conversao de 10 capitulos de "The Beginning After The End" resultou em 83 paginas placeholder (29% de falha) — o servidor remoto (`mangalivre.to`) rejeitou requisicoes sob carga excessiva.
- **Imprevisibilidade:** Sem rate limiting, o numero de requisicoes simultaneas depende do acaso (quantos workers BullMQ estao processando jobs do mesmo dominio).
- **Futura expansao:** O provider MangaDex expoe uma API RESTful com rate limits documentados. Providers com Cloudflare exigem `playwright` com controle de sessao. Sem abstracao, cada provider reinventara sua propria logica.

**Objetivo:** Adicionar uma camada de rate limiting por provider que coordene **todas** as chamadas HTTP (scraping + download) a um mesmo dominio, com configuracao flexivel via variaveis de ambiente.

---

## 2. Conceitos de Dominio

### 2.1. `IProviderStrategy`

Interface central que substitui `ScrapingProvider`. Define o contrato que todo provider de fonte de manga deve implementar:

```typescript
interface IProviderStrategy {
  readonly slug: string
  readonly name: string
  readonly engine: ProviderEngine
  readonly rateLimiter: RateLimiter

  supports(url: string): boolean
  getInfo(): ProviderInfo
  inspect(canonicalUrl: string): Promise<SourceInspectResponse>
  getChapterImages(chapterUrl: string): Promise<string[]>
  downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }>
}
```

Diferencas da interface anterior (`ScrapingProvider`):
- **`downloadImage()`** — novo metodo que encapsula o download HTTP de uma imagem com rate limiting. Substitui chamadas diretas ao `httpClient` no `ImageDownloaderService`.
- **`rateLimiter`** — propriedade publica que expoe a instancia Bottleneck do provider, permitindo que o `ImageDownloaderService` compartilhe o mesmo limitador.
- Localizacao: `scraping/interfaces/provider-strategy.interface.ts` (antes em `providers/provider.interface.ts`).

### 2.2. `RateLimiterConfig`

Configuracao de rate limiting para um provider:

```typescript
interface RateLimiterConfig {
  maxConcurrent: number        // maximo de tarefas simultaneas (Bottleneck: maxConcurrent)
  minTime: number              // tempo minimo entre tarefas em ms (Bottleneck: minTime)
  reservoir?: number           // maximo de tarefas em um intervalo (Bottleneck: reservoir)
  reservoirRefreshInterval?: number  // intervalo de refresh do reservoir em ms
}
```

### 2.3. `RateLimiter`

Type alias para a instancia Bottleneck:

```typescript
import Bottleneck from 'bottleneck'
type RateLimiter = Bottleneck
```

### 2.4. `RateLimitRegistry`

Registro central que mapeia `providerSlug → RateLimiterConfig`:

```typescript
class RateLimitRegistry {
  private configs: Map<string, RateLimiterConfig>

  constructor(env: RateLimitEnv)
  get(slug: string): RateLimiterConfig   // fallback para 'default'
  has(slug: string): boolean
}
```

Le todas as variaveis de ambiente com prefixo `RATE_LIMIT_`, extrai o slug do nome da var, e monta o mapa de configs. Providers sem config especifica recebem o fallback `default`.

---

## 3. Principios de Design

### 3.1. Single Responsibility (SRP)

Cada componente tem uma unica responsabilidade:
- `IProviderStrategy` — contrato de scraping + download (o QUE)
- `MangaLivreStrategy` — implementacao concreta para Manga Livre (o COMO)
- `RateLimitRegistry` — leitura e gerenciamento de configuracoes
- `createRateLimiter()` — factory pura que instancia Bottleneck
- `ProviderResolver` — descoberta do provider correto + injecao de dependencias

### 3.2. Open-Closed (OCP)

Adicionar um novo provider (ex: `MangaDexStrategy`) requer:
1. Criar a classe implementando `IProviderStrategy`
2. Adicionar ao array `PROVIDERS` no `ProviderResolver`
3. (Opcional) Configurar env vars `RATE_LIMIT_MANGADEX_*`

Nenhum codigo existente em `ImageDownloaderService`, `conversion-job.worker.ts`, ou `ProviderResolver` precisa ser modificado.

### 3.3. Dependency Inversion (DIP)

O `ImageDownloaderService` depende da abstracao `IProviderStrategy`, nao da implementacao concreta. O `conversion-job.worker.ts` resolve o provider via `ProviderResolver` e injeta no downloader. O `RateLimiter` e injetado no provider pelo `ProviderResolver`, nao criado internamente.

### 3.4. Configuracao Explicita por Ambiente

Limites de rate sao definidos **fora do codigo**, via variaveis de ambiente. Isso permite ajustar limites em producao sem redeploy, por exemplo: reduzir `maxConcurrent` se o servidor remoto comecar a rejeitar com HTTP 429.

---

## 4. Arquitetura de Componentes

```
┌──────────────────────────────────────────────────────────────┐
│                         .env                                 │
│  RATE_LIMIT_MANGALIVRE_MAX_CONCURRENT=2                      │
│  RATE_LIMIT_MANGALIVRE_MIN_TIME=500                          │
│  RATE_LIMIT_DEFAULT_MAX_CONCURRENT=3                         │
│  RATE_LIMIT_DEFAULT_MIN_TIME=300                             │
└──────────────────────┬───────────────────────────────────────┘
                       │ import { env }
┌──────────────────────▼───────────────────────────────────────┐
│              RateLimitRegistry                                │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ parseEnvVars(env) → Map<slug, RateLimiterConfig>     │     │
│  │                                                       │     │
│  │ "mangalivre" → { maxConcurrent:2, minTime:500 }       │     │
│  │ "default"    → { maxConcurrent:3, minTime:300 }       │     │
│  │                                                       │     │
│  │ get("mangalivre") → config do mangalivre              │     │
│  │ get("mangadex")   → fallback "default"                │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────┬───────────────────────────────────────┘
                       │ registry.get(slug)
┌──────────────────────▼───────────────────────────────────────┐
│              createRateLimiter(config)                         │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ new Bottleneck({                                      │     │
│  │   maxConcurrent: config.maxConcurrent,                │     │
│  │   minTime: config.minTime,                            │     │
│  │   reservoir: config.reservoir,                        │     │
│  │   reservoirRefreshInterval: ...,                      │     │
│  │ })                                                    │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────┬───────────────────────────────────────┘
                       │ RateLimiter instance
                       │
         ┌─────────────┴──────────────┐
         │                            │
         ▼                            ▼
┌─────────────────────┐    ┌──────────────────────────┐
│   ProviderResolver   │    │  ImageDownloaderService   │
│                      │    │                           │
│ resolve(url)         │    │ downloadChapter(          │
│   → slug             │    │   jobId, sourceId,        │
│   → registry.get()   │    │   chapterId, imageUrls,   │
│   → createLimiter()  │    │   provider ← NOVO)        │
│   → new Provider()   │    │                           │
│                      │    │ provider.downloadImage()   │
│ providers[]:         │    │   → rateLimiter.schedule() │
│   MangaLivreStrategy │    │   → httpClient.get()      │
│   MangaDexStrategy   │    │                           │
│   ...                │    │                           │
└─────────┬────────────┘    └──────────────────────────┘
          │
          │ Injeta RateLimiter no constructor
          ▼
┌─────────────────────────────────────┐
│        MangaLivreStrategy            │
│                                      │
│ constructor(rateLimiter: RateLimiter)│
│                                      │
│ inspect(url)                         │
│   → this.rateLimiter.schedule(       │
│       () => http.get(url))           │
│                                      │
│ getChapterImages(url)                │
│   → this.rateLimiter.schedule(       │
│       () => http.get(url))           │
│                                      │
│ downloadImage(url)                   │
│   → this.rateLimiter.schedule(       │
│       () => http.get(url, {          │
│         responseType: 'arraybuffer'  │
│       }))                            │
│                                      │
│   → { buffer, contentType }          │
└─────────────────────────────────────┘
```

### 4.1. Fluxo de Resolucao de Provider com Rate Limiting

```
POST /api/conversions/source/inspect { url }
  → InspectSourceUseCase
    → ProviderResolver.resolve(url)
      → identifica slug = "mangalivre"
      → RateLimitRegistry.get("mangalivre")
        → { maxConcurrent: 2, minTime: 500 }
      → createRateLimiter(config)
        → new Bottleneck({ maxConcurrent: 2, minTime: 500 })
      → new MangaLivreStrategy(rateLimiter)
      → retorna provider
    → provider.inspect(url)
      → rateLimiter.schedule(() => http.get(url))
      → apenas 2 requisicoes simultaneas, 500ms entre cada
```

### 4.2. Fluxo de Download de Imagens com Rate Limiting

```
Worker processa ConversionJob
  → le job.data.sourceId
  → carrega storage/sources/{sourceId}/metadata.json
  → extrai provider.slug = "mangalivre"
  
  → ProviderResolver.resolve(chapterUrl)
    → retorna MangaLivreStrategy (com rateLimiter ja injetado)
  
  → provider.getChapterImages(chapterUrl)
    → rateLimiter.schedule(() => http.get(chapterUrl))
    → retorna imageUrls[]
  
  → imageDownloader.downloadChapter(jobId, sourceId, chapterId, imageUrls, provider)
    → provider.downloadImage(imageUrl)
      → rateLimiter.schedule(() => http.get(imageUrl, { responseType: 'arraybuffer' }))
      → valida magic bytes + Content-Type
      → retorna { buffer, contentType }
    → salva no cache (storage/sources/{sourceId}/chapters/{chapterId}/)
```

---

## 5. Decisoes Tecnicas

### 5.1. Por que `bottleneck` em vez de `p-limit`?

| Criterio | `bottleneck` | `p-limit` |
|----------|-------------|-----------|
| Reservoir (teto por intervalo) | Sim, nativo | Nao |
| Prioridade de jobs | Sim | Nao |
| Estrategias de rejeicao | Sim (LEAK, BLOCK, etc.) | Nao |
| Eventos/hooks | Sim (received, queued, executed, failed) | Nao |
| Clustering (compartilhar entre processos) | Sim (via Redis) | Nao |
| MinTime (espacamento entre tarefas) | Sim | Nao |
| API para `schedule(fn)` | Sim, retorna Promise<T> | Apenas `add(fn)` via `.limit` wrapper |
| Bundle size | ~15KB | ~2KB |
| Manutencao ativa | Sim (comunidade ativa) | Sim |

**Decisao:** `bottleneck` — a funcionalidade de reservoir (teto de requisicoes por intervalo de tempo) e essencial para providers com rate limits do tipo "X requisicoes por segundo/minuto". A capacidade de compartilhar estado entre workers via Redis (clustering) sera util quando o projeto escalar para multiplos processos. O `minTime` permite espacamento preciso entre requisicoes, prevenindo bursts.

### 5.2. Por que injetar `RateLimiter` no provider em vez de cria-lo internamente?

**Alternativa A (injetar no constructor):**
```typescript
const limiter = createRateLimiter(registry.get('mangalivre'))
const provider = new MangaLivreStrategy(limiter)
```

**Alternativa B (criar internamente):**
```typescript
class MangaLivreStrategy {
  private limiter = createRateLimiter(MANGALIVRE_CONFIG)
}
```

| Criterio | Injetar (A) | Interno (B) |
|----------|------------|-------------|
| Testabilidade | Alta — mock facil de injetar | Baixa — precisa mockar modulo |
| Flexibilidade | Permite compartilhar limiter entre provider e downloader | Limiter preso a instancia |
| Configuracao dinamica | Config vem do Registry (env vars) | Config hardcoded ou importado |
| Acoplamento | Baixo — provider depende da abstracao RateLimiter | Alto — provider conhece a factory |

**Decisao:** Injetar no constructor (Alternativa A). O `ProviderResolver` atua como Composition Root, montando o grafo de dependencias. O `ImageDownloaderService` recebe o provider (ou seu limiter) e compartilha a mesma instancia, garantindo que scraping e download coordenem o uso do teto de concorrencia.

### 5.3. Por que `downloadImage()` na interface do provider?

Atualmente, o `ImageDownloaderService` faz:
```typescript
const response = await httpClient.get(imageUrl, { responseType: 'arraybuffer' })
const buffer = Buffer.from(response.data)
```

Com a nova interface:
```typescript
const { buffer, contentType } = await provider.downloadImage(imageUrl)
```

Vantagens:
1. **Rate limiting transparente:** O downloader nao precisa saber sobre rate limits — o provider aplica `schedule()` internamente.
2. **Validacao por provider:** Providers podem validar respostas de forma customizada (ex: MangaDex verifica headers da API, Cloudflare provider verifica se nao e pagina de desafio).
3. **Compressao/transformacao:** Providers podem descomprimir, redimensionar ou converter formatos de imagem antes de retornar.
4. **Single Source of Truth:** A logica de "como falar com este servidor" fica 100% no provider.

### 5.4. Por que `RATE_LIMIT_DEFAULT_*` como fallback?

Novos providers adicionados sem configuracao explicita de rate limit nao devem quebrar. O fallback `default` garante um comportamento seguro (conservador) sem exigir que o desenvolvedor configure env vars imediatamente.

Quando um provider ganha trafego suficiente para justificar configuracao especifica, basta adicionar as env vars `RATE_LIMIT_{SLUG}_*` — sem modificar codigo.

### 5.5. Estrategia de Reserva (Reservoir) — Quando usar?

| Cenario | Configuracao |
|---------|-------------|
| Provider sem rate limit documentado (ex: Manga Livre) | `maxConcurrent: 2, minTime: 500` — throttling conservador |
| Provider com API rate limit (ex: MangaDex: 5 req/s) | `reservoir: 5, reservoirRefreshInterval: 1000` — teto por segundo |
| Provider local/teste | `maxConcurrent: 10, minTime: 0` — sem restricao |

---

## 6. Estrutura de Storage (inalterada)

O rate limiting nao altera a estrutura de storage. Os arquivos de cache (`metadata.json`, `images.json`) e output (`conversions/`) permanecem identicos. A unica mudanca e que os downloads agora passam pelo `rateLimiter.schedule()` antes de chegar ao disco.

---

## 7. Impacto na API HTTP

**Zero breaking changes.** Todos os endpoints mantem os mesmos contratos de request/response. A unica diferenca observavel e que requisicoes de scraping e conversao podem levar alguns milissegundos a mais devido ao `minTime` entre chamadas — mas a confiabilidade aumenta significativamente.

---

## 8. Itens Diferidos

- **Rate limiting adaptativo:** Ajustar dinamicamente `maxConcurrent` e `minTime` com base na taxa de erros HTTP 429. Requer metrica e feedback loop — complexidade alta para o MVP.
- **Rate limiting via Redis Cluster:** Compartilhar estado do Bottleneck entre multiplos workers/processos. Necessario apenas quando o projeto escalar horizontalmente alem de 1 worker.
- **Provider `playwright`:** Rate limiting para providers que usam navegador headless tem caracteristicas diferentes (sessoes, cookies, rotacao de IP) e devem ser modelados como um `IProviderStrategy` com `engine: 'playwright'`, mas a logica de limitacao e inerentemente diferente — justifica um design doc proprio no futuro.
