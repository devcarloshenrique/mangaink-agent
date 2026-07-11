# Scraping Module — Design de Arquitetura

> **Status: IMPLEMENTED** (2026-07-08)
> Decisões de arquitetura e design do módulo de scraping.

---

## 1. Motivação

O MangaInk Agent precisa converter mangás de diversas fontes online para formatos Kindle.
Antes da conversão, é necessário inspecionar a fonte para obter metadados (título, autor,
capítulos, capas) de forma confiável e eficiente.

## 2. Princípios de Design

### 2.1. Assíncrono desde o Início

O scraping de uma obra pode levar de alguns segundos a dezenas de segundos
(dependendo da fonte e do número de capítulos). Bloquear a requisição HTTP
durante todo esse período seria inaceitável para a UX.

**Decisão:** Todo o fluxo de inspeção é assíncrono:
- `POST /inspect` → retorna imediatamente com `sourceId` e `status`
- Progresso acompanhado via SSE (Server-Sent Events)
- Resultado final obtido via `GET /inspect/:sourceId`

### 2.2. Provider Pattern

Cada fonte de mangá tem estrutura HTML e regras de scraping diferentes.
Um acoplamento direto entre a lógica de scraping e a fonte específica
dificultaria a adição de novas fontes.

**Decisão:** Interface `ScrapingProvider` que abstrai a fonte:
- Cada provider implementa `inspect(url)` de forma independente
- `ProviderResolver` descobre qual provider usar baseado na URL
- Adicionar nova fonte = criar novo provider, sem modificar código existente (OCP)

### 2.3. Cache com Expiração

Scraping repetido da mesma obra é desperdício de recursos e pode causar
banimento por rate limiting.

**Decisão:** Cache em filesystem com TTL configurável (24h padrão):
- `metadata.json` em `storage/sources/{sourceId}/`
- `CacheService` verifica expiração antes de reprocessar
- `refresh=true` no POST força novo scraping

### 2.4. Lock Distribuído Evita Duplicação

Múltiplos workers podem tentar processar a mesma URL simultaneamente.

**Decisão:** Lock Redis com `SET NX EX`:
- Apenas um worker processa cada sourceId por vez
- TTL de 120s (job deve completar dentro deste prazo)
- Liberação atômica via script Lua (só o dono do lock pode liberar)

### 2.5. IDs Determinísticos

IDs precisam ser estáveis entre requisições para evitar duplicação de cache
e permitir referências consistentes.

**Decisão:** IDs baseados em conteúdo (SHA-256):
- `sourceId = src-{slug}-{sha256[:8]}`
- `chapterId = chap_{número padded}`
- Mesma URL sempre gera o mesmo sourceId

---

## 3. Diagrama de Componentes

```
┌──────────────────────────────────────────────────────────────────┐
│                       Fastify Server                              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                   scraping.routes.ts                          │ │
│  │  POST /inspect  │  GET /inspect/:id  │  GET /events  │  GET  │ │
│  └──────┬──────────┴────────┬───────────┴───────┬──────────┘    │ │
│         │                   │                   │                 │
│  ┌──────▼──────┐   ┌───────▼───────┐   ┌───────▼────────┐       │
│  │ InspectSrc  │   │ PreviewSrc    │   │ SourceEvents   │       │
│  │ Controller  │   │ Controller    │   │ Controller     │       │
│  └──────┬──────┘   └───────┬───────┘   └───────┬────────┘       │
│         │                  │                    │                 │
│  ┌──────▼──────┐   ┌───────▼───────┐   ┌───────▼────────┐       │
│  │ InspectSrc  │   │ GetSource     │   │ SourceEvents   │       │
│  │ UseCase     │   │ UseCase       │   │ Service        │       │
│  └──────┬──────┘   └───────┬───────┘   └───────┬────────┘       │
│         │                  │                    │                 │
│  ┌──────▼──────┐           │           ┌───────▼────────┐       │
│  │ Normalizer  │           │           │ RedisPubSub    │       │
│  │ (URL)       │           │           │ Service        │       │
│  └─────────────┘           │           └───────┬────────┘       │
│                            │                    │                 │
│  ┌──────▼──────┐  ┌───────▼───────┐            │                 │
│  │ Provider    │  │ CacheService  │            │                 │
│  │ Resolver    │  └───────┬───────┘            │                 │
│  └──────┬──────┘          │                    │                 │
│         │          ┌──────▼───────┐            │                 │
│  ┌──────▼──────┐   │ Filesystem   │            │                 │
│  │ MangaLivre  │   │ Repository   │            │                 │
│  │ Provider    │   └──────────────┘            │                 │
│  └──────┬──────┘                               │                 │
│         │                                       │                 │
│  ┌──────▼──────┐                   ┌───────────▼──────────┐     │
│  │ MangaDex    │                   │      Redis           │     │
│  │ Provider    │                   │  (Pub/Sub + Locks)   │     │
│  │ (futuro)    │                   └──────────────────────┘     │
│  └─────────────┘                                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              BullMQ Queue: source-inspect                  │   │
│  │  ┌──────────────────────────────────────────────────────┐ │   │
│  │  │         inspect-source.worker.ts                     │ │   │
│  │  │  resolve provider → scrape → Pub/Sub → save cache    │ │   │
│  │  └──────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Fluxo de Decisões

### 4.1. Por que filesystem para cache em vez de Redis?

| Critério        | Filesystem | Redis       |
|-----------------|------------|-------------|
| Custo           | Grátis     | RAM limitada|
| Persistência    | Natural    | RDB/AOF     |
| Dados grandes   | OK         | Limitado    |
| Metadata        | OK         | OK          |
| Imagens (futuro)| OK         | Ruim        |

**Decisão:** Filesystem para cache persistente, Redis apenas para locks e Pub/Sub
(coordenação em tempo real).

### 4.2. Por que Cheerio em vez de Playwright?

| Critério        | Cheerio | Playwright     |
|-----------------|---------|----------------|
| Velocidade      | Rápido  | Lento          |
| JavaScript      | Não     | Sim            |
| Memória         | Leve    | Pesado         |
| Anti-bot        | Fraco   | Melhor         |

**Decisão:** Cheerio para o provider inicial (MangaLivre). Playwright será
considerado para sites que exigem renderização JavaScript.

### 4.3. Por que SSE em vez de WebSocket?

| Critério        | SSE       | WebSocket     |
|-----------------|-----------|---------------|
| Unidirecional   | Nativo    | Possível      |
| HTTP/2          | Nativo    | Emulado       |
| Reconexão       | Nativa    | Manual        |
| Complexidade    | Baixa     | Média         |

**Decisão:** SSE é suficiente (apenas servidor → cliente) e mais simples de
implementar com Fastify.

---

## 5. Segurança

### SSRF Protection

O `ProviderResolver` só aceita URLs cujo domínio esteja na lista de
`allowedDomains` de algum provider cadastrado. URLs com domínios não
cadastrados retornam `ProviderNotFoundError` (422).

### Rate Limiting

O HTTP Client usa:
- Timeout de 30s
- 3 tentativas com backoff exponencial (1s, 2s, 4s)
- Respeita header `Retry-After` em HTTP 429
- User-Agent de browser real (evita bloqueios básicos)

---

## 6. Próximos Passos (Não Implementados)

- [ ] Provider MangaDex (API-based)
- [ ] Download de capítulos (imagens)
- [ ] Cache de imagens em disco
- [ ] Limpeza automática de cache expirado (job agendado)
- [ ] Playwright provider para sites com JS pesado
- [ ] Testes de integração com Redis/BullMQ mockados
- [ ] Métricas de scraping (duração, taxa de erro, cache hit ratio)