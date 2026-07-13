# Rate Limiting — Proposta

> **Status:** IMPLEMENTED
> **Data:** 2026-07-12 (original) / 2026-07-13 (implementacao)
> **Modulo:** `scraping`, `conversion`

---

## 1. Problema

O MangaInk Agent realiza scraping e download de imagens de fontes externas (iniciando com Manga Livre). Atualmente, o controle de taxa e puramente **reativo**: o `http-client.ts` implementa retry com backoff exponencial ao receber HTTP 429, mas nao ha **throttling proativo** que limite a taxa de requisicoes antes que o servidor remoto as rejeite.

Agravantes:

1. **Concorrencia sem controle por dominio.** O worker BullMQ (`inspect-source.worker.ts`) tem `concurrency: 3` global — se 3 jobs baterem no mesmo dominio (`mangalivre.to`) simultaneamente, podem disparar dezenas de requests HTTP em paralelo sem qualquer espaçamento entre elas.

2. **ImageDownloaderService usa httpClient global.** O downloader de imagens (`conversion/services/image-downloader.service.ts`) faz downloads com concorrencia 5 por capítulo usando um `httpClient` compartilhado, sem qualquer conhecimento de qual provider/destino esta sendo acessado. Isso significa que downloads de imagens concorrem com scraping de metadados sem coordenacao.

3. **Futuros providers terao comportamentos radicalmente diferentes.** O provedor MangaDex usara API RESTful oficial (com rate limits documentados), enquanto outros exigirao `playwright` para bypass de Cloudflare. Sem uma abstracao de rate limiting por provider, cada novo provider precisara reinventar sua propria logica de throttling.

Consequencias visiveis no teste de hoje: o download dos 10 primeiros capitulos de "The Beginning After The End" resultou em **83 paginas corrompidas** (placeholder) de 290 imagens totais — muitas dessas falhas podem ser atribuidas a respostas HTTP de erro do servidor remoto sob carga.

---

## 2. Solucao Proposta

### 2.1. Interface `IProviderStrategy`

Renomear a interface existente `ScrapingProvider` para `IProviderStrategy` e move-la para `scraping/interfaces/`. A nova interface padroniza todos os metodos necessarios para scraping e download:

- `inspect(canonicalUrl)` — scraping de metadados da obra
- `getChapterImages(chapterUrl)` — extracao de URLs de imagens do capitulo
- `downloadImage(imageUrl)` — **novo**: download de uma imagem individual, encapsulando a chamada HTTP e retornando `{ buffer, contentType }`

Cada provider tambem expoe seu `rateLimiter` (instancia Bottleneck), permitindo que o `ImageDownloaderService` compartilhe o mesmo limitador.

### 2.2. Rate Limiting com Bottleneck

Criar o modulo `scraping/rate-limit/` com tres componentes:

| Componente | Responsabilidade |
|------------|-----------------|
| `types.ts` | `RateLimiterConfig` (maxConcurrent, minTime, reservoir, reservoirRefreshInterval) e type `RateLimiter` |
| `rate-limiter.ts` | Factory `createRateLimiter(config)` que instancia Bottleneck com as opcoes fornecidas |
| `rate-limit-registry.ts` | Le variaveis de ambiente, monta `Map<providerSlug, RateLimiterConfig>`, fallback para config `default` |

Cada provider recebe seu `RateLimiter` no constructor. Todas as chamadas HTTP do provider (`inspect`, `getChapterImages`, `downloadImage`) passam por `this.rateLimiter.schedule()`, garantindo que scraping e downloads respeitem o mesmo teto de concorrencia.

### 2.3. Integracao com o ImageDownloaderService

O `ImageDownloaderService` atualmente faz chamadas HTTP diretas com `httpClient.get()`. Com a nova interface, ele delega o download para `provider.downloadImage(imageUrl)`, que internamente aplica `rateLimiter.schedule()`. O provider e o limiter sao resolvidos uma vez no worker de conversao e injetados no downloader.

### 2.4. Factory e Registro

O `ProviderResolver` existente ja age como registry/factory. Ele sera estendido para:

1. Receber o `RateLimitRegistry` no constructor
2. Ao resolver um provider (`resolve(url)`), criar o `RateLimiter` apropriado com base no slug
3. Injetar o limiter no provider via constructor

Adicionar um novo provider no futuro requer apenas:
- Criar a classe concreta implementando `IProviderStrategy`
- Adiciona-la ao array `PROVIDERS` no `ProviderResolver`
- Configurar env vars `RATE_LIMIT_{SLUG}_*` (opicional — fallback para `default`)

### 2.5. Configuracao por Variavel de Ambiente

```bash
# Rate Limiting por Provider (Bottleneck)
RATE_LIMIT_MANGALIVRE_MAX_CONCURRENT=2
RATE_LIMIT_MANGALIVRE_MIN_TIME=500
RATE_LIMIT_MANGALIVRE_RESERVOIR=10
RATE_LIMIT_MANGALIVRE_RESERVOIR_REFRESH_INTERVAL=1000
RATE_LIMIT_DEFAULT_MAX_CONCURRENT=3
RATE_LIMIT_DEFAULT_MIN_TIME=300
```

A nomenclatura segue o padrao `RATE_LIMIT_{SLUG}_{PARAM}` onde `SLUG` e o identificador do provider em uppercase. O `RateLimitRegistry` le todas as vars com prefixo `RATE_LIMIT_` e monta o mapa de configs dinamicamente. Providers sem config especifica usam o fallback `default`.

---

## 3. Escopo

### Incluido

- [x] Renomear `ScrapingProvider` → `IProviderStrategy` e mover para `scraping/interfaces/`
- [x] Adicionar metodo `downloadImage(imageUrl)` a interface
- [x] Criar modulo `scraping/rate-limit/` (types, factory, registry)
- [x] Instalar e configurar `bottleneck` como dependencia
- [x] Implementar `MangaLivreStrategy` com rate limiter integrado
- [x] Estender `ProviderResolver` para injetar `RateLimiter` nos providers
- [x] Integrar `provider.downloadImage()` no `ImageDownloaderService`
- [x] Adicionar variaveis de ambiente `RATE_LIMIT_*` ao schema Zod em `env.ts`
- [x] Atualizar todos os imports e mocks (testes, workers, controllers)
- [x] Manter compatibilidade com a API HTTP existente (sem breaking changes na API)

### Fora de Escopo (futuro)

- [ ] Rate limiting para providers baseados em `playwright` (Cloudflare bypass)
- [ ] Rate limiting adaptativo (ajuste automatico baseado em respostas HTTP 429)
- [ ] Painel de monitoramento de rate limits (dashboard/metrics)
- [ ] Suporte a rate limiting por IP/proxy pool para bypass geografico
- [ ] Substituicao do `http-client.ts` por completo — o cliente HTTP existente continua funcionando, apenas envelopado pelo `rateLimiter.schedule()`

---

## 4. Criterios de Aceitacao

1. **Provider Strategy:** A interface `IProviderStrategy` define `inspect()`, `getChapterImages()` e `downloadImage()`. `MangaLivreStrategy` implementa todos os metodos com rate limiting aplicado via `this.rateLimiter.schedule()`.

2. **Rate Limiter por Provider:** Cada provider instancia seu proprio Bottleneck com config especifica do provider. O `MangaLivreStrategy` respeita `maxConcurrent=2` e `minTime=500ms` (configuraveis via env).

3. **Coordenacao Scraping + Download:** Um unico `RateLimiter` por provider coordena tanto requisicoes de scraping (`inspect`, `getChapterImages`) quanto downloads de imagens (`downloadImage`). Nao e possivel que 2 downloads e 1 scraping batam no mesmo dominio simultaneamente alem do `maxConcurrent`.

4. **ImageDownloaderService usa provider.downloadImage():** O downloader de imagens delega chamadas HTTP para `provider.downloadImage()` ao inves de usar `httpClient.get()` diretamente — o rate limiting e aplicado de forma transparente.

5. **Configuracao por env vars:** O `RateLimitRegistry` le variaveis `RATE_LIMIT_{SLUG}_{PARAM}` e aplica fallback `RATE_LIMIT_DEFAULT_*` quando o provider nao tem config especifica. Schema Zod valida os tipos (number, opcional).

6. **ProviderResolver injeta RateLimiter:** Ao resolver um provider, o `ProviderResolver` consulta o `RateLimitRegistry` e cria o `RateLimiter` apropriado, passando-o ao constructor do provider.

7. **Testes:** Testes unitarios do `RateLimitRegistry` validam parse de env vars e fallback. Testes do `MangaLivreStrategy` validam que `rateLimiter.schedule()` e chamado para `inspect()`, `getChapterImages()` e `downloadImage()`. Mocks atualizados para `IProviderStrategy`.

---

## 5. Dependencias

- **Modulo `scraping`** (existente) — interface `ScrapingProvider` a ser renomeada, `ProviderResolver` a ser estendido, `MangalivreProvider` a ser refatorado.
- **Modulo `conversion`** (existente) — `ImageDownloaderService` e `conversion-job.worker.ts` a serem atualizados para usar `provider.downloadImage()`.
- **Redis + BullMQ** (ja configurados) — sem alteracoes necessarias.
- **`bottleneck`** ^2.19.5 (nova dependencia) — biblioteca de rate limiting com suporte a reservoir, fila, e prioridade.
- **`shared/config/env.ts`** (existente) — schema Zod a ser estendido com novas env vars.
- **`shared/http/http-client.ts`** (existente) — continua funcionando como esta; o rate limiter envelopa suas chamadas, nao substitui o cliente.
