# Plano de Implementação: Busca Federada com Favoritos no PostgreSQL e Streaming Progressivo

## 1. Visão Geral e Objetivos

Este documento especifica a evolução arquitetural do sistema de busca do MangaInk de uma consulta síncrona agregada para uma **arquitetura federada progressiva com persistência relacional no PostgreSQL e transporte contínuo via Server-Sent Events (Estratégia C — Streaming SSE com Fila Prioritária sem Barreira)**, contemplando todas as correções arquiteturais de paginação real, controle de concorrência, rate limiting externo e estabilidade visual:

1. **Favoritos no Banco de Dados:** Provedores favoritos persistidos por usuário na tabela `user_favorite_providers` do PostgreSQL via Prisma.
2. **Autenticação Obrigatória Global (JWT + Cookie HttpOnly):** Todas as rotas de busca e provedores (`GET /search/stream`, `GET /search`, `GET /providers`, `GET /providers/favorites`, `POST /providers/:slug/favorite`) exigem `verifyJwt`. Usuários não autenticados são redirecionados para a tela de login (`/login`) via guards `beforeLoad` do TanStack Router. O transporte HTTP/SSE utiliza obrigatoriamente `credentials: 'include'` para transmitir o cookie HttpOnly da sessão (`mangaink_token` — VULN-10 / MEC-86) e `Authorization: Bearer <token>` como fallback de memória para o Desktop.
3. **Transporte Único via Streaming SSE:** A busca federada progressiva utiliza **uma única conexão HTTP persistente** via Server-Sent Events (`GET /api/conversions/source/search/stream`), eliminando tempestades de conexões simultâneas no navegador.
4. **Rate Limiting Focado na Proteção de IP nos Provedores:** O rate limit da rota HTTP no Fastify (`SEARCH_RATE_LIMIT_MAX`) é afrouxado para um teto generoso de proteção contra loops de cliente (ex.: 240 req/min), enquanto a proteção estrita de IP contra bloqueio de Cloudflare/Cloudhost reside onde deve estar: nos limitadores **Bottleneck por provedor** (`rateLimitMaxConcurrent`, `rateLimitMinTime`), alimentados pelas configurações do banco de dados (`Provider`).
5. **Paginação Real Homogênea com Cache de Fatiamento no Backend (Estratégia de Abastecimento):**
   * **Provedores com Paginação Nativa (ex.: MangaDex):** Repassa `offset` e `limit` diretamente para a API externa.
   * **Provedores sem Paginação Nativa (ex.: MangaLivre, MangasBrasuka):**
     * Na **primeira busca (`offset = 0` / streaming inicial)**, o backend solicita o lote completo disponível da fonte externa (ex.: até 50–100 obras, sem forçar limite baixo de 7), armazena a lista completa em um cache em memória compartilhado (TTL 3–5 min, chave `search_full:{slug}:{query}:{lang}`).
     * O backend fatia as primeiras `limit` obras (ex.: 7 ou 10) para o evento `provider-result` ou resposta REST com `total = results.length` e `hasMore = total > limit`.
     * Nas **consultas subsequentes (`offset > 0`, `loadProviderPage`)**, o backend atende a requisição direto da memória (`slice(offset, offset + limit)`) em **< 5ms**, **sem refazer scraping e sem floodar os sites externos**.
   * Ambas as abordagens retornam o contrato uniforme `{ results: [...], total: number, hasMore: boolean }`.
6. **Compartilhamento Singleton de Cache entre SSE e REST:** O `SearchSourcesStreamUseCase` e o `SearchSourcesUseCase` compartilham a **mesma instância de cache em memória singleton**. Dessa forma, o lote completo aquecido durante o streaming SSE fica imediatamente disponível quando o usuário rolar a tela ou clicar em "Ver mais" (rota REST).
7. **Cancelamento Ativo e Prevenção de Scrapers Órfãos:** O stream SSE no Fastify escuta `req.raw.on('close')` e aciona um `AbortController`. O `AbortSignal` é repassado ao `SearchSourcesStreamUseCase`, ao `Bottleneck` e às requisições `axios` dos provedores. Conexões abortadas pelo usuário interrompem o scraping imediatamente e evitam exceções `ERR_STREAM_WRITE_AFTER_END` / `EPIPE`.
8. **Disparo de Busca Sob Demanda:** O input de busca não altera a Home nem dispara requisições enquanto o usuário digita (remove debounce de digitação). O disparo ocorre estritamente via tecla **Enter** ou clique no **botão de lupa** (`>= 2` caracteres). Pressionar `Escape` ou clicar no `X` limpa e retorna ao dashboard normal.
9. **Priorização por Favoritos sem Bloqueio e Ordem Estável da Sessão:**
   * O backend consulta os favoritos do usuário no PostgreSQL e ordena a fila (favoritos no topo, depois alfabética). Provedores rápidos (ex.: 200ms) emitem eventos `provider-result` imediatamente pelo canal SSE, ocupando slots estáveis na UI sem Layout Shift (CLS).
   * **Congelamento da Sessão Ativa:** Se o usuário favoritar ou desfavoritar um provedor a partir do trilho de busca, o estado é persistido no banco e a estrela na UI acende/apaga na hora, mas a ordem dos trilhos naquela sessão de busca permanece **congelada** (não pula de posição sob o cursor do mouse). A nova prioridade de ordenação passa a valer na **próxima** busca disparada.
10. **Filtragem Inteligente por Idioma (Case-Insensitive):** Ao filtrar por um idioma específico (ex.: `language = 'en'` ou `'pt-br'`), provedores com tags estritamente de outro idioma (ex.: `mangalivre`, `imperiodabritannia` com tag `pt-BR`) são ignorados antes do fan-out via comparação case-insensitive (`tag.toLowerCase() === language.toLowerCase()`), evitando chamadas inúteis e poluição de resultados.
11. **Ocultação Suave de Trilhos Vazios e Erros de Scraping:** Fontes que retornarem 0 resultados (`results: []`) ou que falharem no scraping emitem evento `provider-skip` e são desmontadas suavemente na UI, sem trilho de erro visual. Falhas são registradas apenas em log/telemetria.
12. **Teto de Lotes com Encerramento Gracioso (`BATCH_VISIBLE = 7` como Upper Bound):**
   * O lote inicial busca até completar **7 provedores com obras visíveis** (`BATCH_VISIBLE = 7`), ou a totalidade dos provedores ativos disponíveis (`totalActiveProviders`), o que for menor (`Math.min(7, totalActiveProviders)`).
   * O stream processa os provedores disponíveis e finaliza graciosamente com `exhausted = true`, sem ficar bloqueado aguardando provedores inexistentes.
   * A arquitetura de prefetch em segundo plano (`BATCH_PREFETCH = 7`) fica pronta para quando novos provedores forem adicionados ao sistema.
13. **Desktop 100% Tauri v2:** Alinhamento estrito com o proxy Axum de `apps/desktop/src-tauri/src/http_server.rs` (streaming de bytes via `upstream_res.bytes_stream()`), sem qualquer dependência ou referência legada a Electron.

---

## 2. Modelagem no Banco de Dados (Prisma / PostgreSQL)

### 2.1 Model `UserFavoriteProvider` em `apps/backend/prisma/schema.prisma`
```prisma
model UserFavoriteProvider {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  providerSlug String   @map("provider_slug") @db.VarChar(50)
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, providerSlug])
  @@index([userId])
  @@map("user_favorite_providers")
}
```

### 2.2 Relação no model `User`
```prisma
model User {
  // ... campos existentes
  favoriteProviders UserFavoriteProvider[]
}
```

### 2.3 Migration
Execução de migration Prisma:
```bash
pnpm --filter @mangaink/backend exec prisma migrate dev --name add_user_favorite_providers
```

---

## 3. Backend: Repositório, Casos de Uso e Endpoints

### 3.1 Repositório (`user-favorite-provider.repository.ts`)
* **Interface `UserFavoriteProviderRepository`:**
  * `listByUserId(userId: string): Promise<string[]>` — lista os slugs favoritados pelo usuário.
  * `toggle(userId: string, providerSlug: string, isFavorite?: boolean): Promise<{ isFavorite: boolean }>` — adiciona/remove atomicamente ou define o estado explícito caso `isFavorite` seja fornecido.
* **Implementação Prisma `PrismaUserFavoriteProviderRepository`:**
  * Utiliza operações atômicas ou transações seguras no Prisma Client.

### 3.2 Casos de Uso e Cache Compartilhado

#### Cache de Busca Compartilhado (`SearchCacheStore`)
* Singleton em memória compartilhado entre os use-cases de streaming e REST.
* Gerencia:
  * `search_full:{slug}:{query}:{lang}` (TTL 3–5 min, LRU com max 2.000 entradas): armazena a lista bruta de obras para fatiamento de paginação.
  * `search:{query}:{providers}:{limit}:{offset}:{lang}` (TTL 60s): armazena respostas completas prontas para requisições idênticas.

#### `ListFavoriteProvidersUseCase`
* Retorna `{ favorites: string[] }` para o usuário autenticado a partir do PostgreSQL.

#### `ToggleFavoriteProviderUseCase`
* Valida a existência do `providerSlug` no banco de dados (`ProviderRepository`) com fallback para os seeds estáticos (`known-providers.ts`).
* Suporta operação idempotente: se receber `{ isFavorite: boolean }`, garante aquele estado; se não receber, inverte o estado atual. Retorna `{ slug: string, isFavorite: boolean }`.

#### `SearchSourcesStreamUseCase` (Novo — Streaming Federado SSE)
* Orquestra o streaming contínuo da busca federada:
  * Recebe: `userId: string`, `query: string`, `language?: string`, `providers?: string[]`, `limitPerProvider?: number`, `signal?: AbortSignal`.
  * Consulta os favoritos do usuário no PostgreSQL para priorizar a ordem de execução da fila.
  * Filtra os provedores elegíveis usando `ProviderResolver`:
    * Aplica o filtro de status (`active`, `slow`, etc.).
    * **Filtro de Idioma Inteligente:** descarta provedores cujas tags de idioma não correspondam ao idioma requisitado (comparação case-insensitive `tag.toLowerCase() === language.toLowerCase()`).
  * **Reaproveitamento de Cache:** se a query já tiver resultados em cache, emite os eventos `provider-result` cacheados instantaneamente (0ms).
  * **Abastecimento do Cache de Paginação:**
    * Para provedores sem paginação nativa (ex.: MangaLivre, MangasBrasuka), busca o lote completo (ex.: até 50–100 obras) da fonte externa, grava no cache compartilhado `search_full`, fatia as primeiras `limit` obras e emite `provider-result` com `total = results.length` e `hasMore = total > limit`.
  * Monta a fila com concorrência controlada (`SEARCH_CONCURRENCY = 3`), executando cada provedor com timeout de 6s via `AbortSignal.any([signal, AbortSignal.timeout(6000)])`.
  * Emite frames SSE:
    * `event: provider-result` -> `{ providerSlug, title, engine, results: [...], total: number, hasMore: boolean, durationMs: number }`
    * `event: provider-skip` -> `{ providerSlug, reason: 'empty' | 'error', durationMs: number }`
    * `event: done` -> `{ totalFound: number, exhausted: boolean, durationMs: number }`
  * Cancela requisições imediatamente caso o `signal` seja abortado pelo fechamento do socket do cliente.

#### `SearchSourcesUseCase` (REST — Paginação e Fatiamento Instantâneo)
* **Paginação Real Homogênea:**
  * Para provedores com paginação nativa: passa `offset` e `limit` adiante.
  * Para provedores sem paginação nativa: consulta o `SearchCacheStore` (`search_full`). Se presente, fatia o array em memória (`slice(offset, offset + limit)`) em **< 5ms**. Caso o cache expire ou não exista, faz a busca externa em lote completo, armazena no cache e fatia.
* **Otimizações:**
  * Uso de `findBySlug` ou cache do repositório para evitar `findAll()` ao paginar um único provedor (`loadProviderPage`).

### 3.3 Rotas HTTP (`scraping.routes.ts`) — Todas com `verifyJwt`

* **Ordem de Registro no Radix Tree:**
  1. `GET /api/conversions/source/providers/favorites` (registrado ANTES de qualquer rota `/:slug`).
  2. `POST /api/conversions/source/providers/:slug/favorite` (body opcional `{ isFavorite?: boolean }`).
  3. `GET /api/conversions/source/search/stream` (novo endpoint SSE).
  4. `GET /api/conversions/source/search` (REST unário para paginação horizontal).
  5. `GET /api/conversions/source/providers` (protegido por JWT).
  6. `PATCH /api/conversions/source/providers/:slug` (protegido por JWT + permissão de admin).

* **Configuração da Rota SSE (`/search/stream`) e Blindagem de Socket:**
  * `onRequest: [verifyJwt]`.
  * Headers: `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no` via `reply.hijack()`.
  * `reply.raw.socket?.setNoDelay(true)`.
  * Lifecycle & Abort:
    ```ts
    const abortController = new AbortController()
    req.raw.on('close', () => {
      abortController.abort()
    })
    ```
  * Proteção de escrita e captura de erros pós-hijack:
    * Envolver o loop de streaming em bloco `try...catch`.
    * Verificar `!reply.raw.writableEnded && !reply.raw.destroyed` antes de qualquer `reply.raw.write()`.
    * No `catch`, emitir `event: error` com `{ message }` e finalizar com `reply.raw.end()`.

* **Configuração de Rate Limiting na Rota REST (`/search`):**
  * `SEARCH_RATE_LIMIT_MAX = 240` por minuto (evita falsos positivos em uso normal de navegação/paginação; a proteção contra banimento externo reside no Bottleneck).

---

## 4. Frontend: Gerenciamento de Favoritos

### 4.1 Cliente de API (`apps/frontend/src/lib/api.ts`)
* `scrapingApi.getFavoriteProviders(): Promise<{ favorites: string[] }>`
* `scrapingApi.toggleFavoriteProvider(slug: string, isFavorite?: boolean): Promise<{ slug: string; isFavorite: boolean }>`
* `scrapingApi.searchStream(query, options, handlers): { close: () => void }`:
  * Conecta a `GET /api/conversions/source/search/stream?q=...&language=...&providers=...` utilizando o utilitário nativo de streaming `createSSEStream` em `apps/frontend/src/lib/sse.ts`.
  * Envia `credentials: 'include'` para tráfego do cookie HttpOnly da sessão.
  * Envia `Authorization: Bearer <token>` em memória se disponível.
  * Dispara callbacks tipados: `onProviderResult`, `onProviderSkip`, `onDone`, `onError`.
  * Retorna `{ close: () => void }` com `AbortController` nativo.
* `scrapingApi.search(...)` mantido para paginação de trilhos (`loadProviderPage`).

### 4.2 Hook `useFavoriteProviders` (`apps/frontend/src/hooks/useFavoriteProviders.ts`)
* Gerenciado via TanStack Query sob a chave `["providers", "favorites"]`.
* Optimistic updates instantâneos na UI ao favoritar/desfavoritar, com rollback automático em caso de erro.
* Fornece: `favoriteSlugs: string[]`, `isFavorite(slug: string): boolean`, `toggleFavorite(slug: string, isFavorite?: boolean): void`, `isLoading: boolean`.

### 4.3 Interface em `/fontes` e no Cabeçalho do Trilho
* **Página `/fontes` (`apps/frontend/src/routes/fontes.tsx`):**
  * Botão estrela pop-art (`ComicPanel`) em cada card de provedor com animação comic pop.
  * Nova opção no menu de ordenação: `"Favoritos primeiro"`.
* **Trilho de Busca (`ProviderSearchRail.tsx`):**
  * Botão estrela pop-art no cabeçalho do trilho ao lado do nome do provedor, permitindo favoritar/desfavoritar diretamente da tela de busca.

---

## 5. Frontend: Barra de Busca Sob Demanda

### 5.1 Estado Desacoplado no `HomeSearchBar.tsx`
* Estado local `draftQuery` desacoplado da rota e do dashboard.
* Sem disparos de busca ou debounce automático durante a digitação.
* Atalho global `Ctrl+K` / `⌘K` e tecla `/` para focar imediatamente no input de busca.
* Botão de lupa envolvido em `<button type="submit">`.
* Disparo estrito por submissão de formulário (**Enter** ou **clique na Lupa**) com validação de `length >= 2`.
* Pressionar `Escape` ou clicar no `X` limpa o input e fecha a visualização de busca, retornando a Home para o dashboard normal.

### 5.2 Reatividade de Filtros na Busca Ativa
* Caso uma busca já esteja ativa (`committedQuery.length >= 2`), alterações no `LanguageSelectorPopover` ou no `SearchFilterDrawer` cancelam o stream atual e disparam nova busca streaming imediatamente com os novos parâmetros, sem exigir novo Enter.

---

## 6. Frontend: Motor de Busca Progressiva & Lotes (`useFederatedSearch`)

### 6.1 Fila Prioritária com Slots Estáveis e Ordem Congelada
1. **Ordem Congelada por Sessão:** A ordem dos trilhos é determinada no momento em que a busca é submetida (favoritos ativos no topo, seguidos pelos demais em ordem alfabética) e **permanece congelada** durante a exibição dos resultados. Se o usuário favoritar um provedor durante a leitura, a estrela acende imediatamente, mas o trilho não pula de posição na tela.
2. **Slots Estáveis:**
   * Cada provedor da fatia ativa ocupa um slot com `ProviderRailSkeleton` pulsante.
   * Quando o evento `provider-result` é recebido, o skeleton daquele provedor se transforma *in-place* no carrossel de obras com transição suave, sem mover os trilhos vizinhos.
   * Quando o evento `provider-skip` é recebido, o skeleton é colapsado suavemente sem saltos bruscos.
3. **Empty State Global:** Se todos os provedores da busca retornarem `provider-skip`, exibe o componente temático `ComicEmptyState` com orientação amigável para o usuário.

### 6.2 Paginação Horizontal Homogênea no Trilho
* O trilho consome `loadProviderPage(slug, offset, limit, signal)`:
  * Chama `scrapingApi.search(query, { providers: slug, limit: 7, offset, language })`.
  * Se o provedor não suportar paginação nativa, o backend atende em < 5ms a partir do cache de fatiamento `search_full`.
  * O botão "Ver mais" / rolagem horizontal continua funcional e responsivo para todos os provedores.

### 6.3 Lotes de Exibição e Infinite Scroll com Prefetch
* **Lote Inicial:** Stream SSE busca até completar **7 provedores com obras visíveis** (`BATCH_VISIBLE = 7`), ou a totalidade dos provedores ativos disponíveis (`totalActiveProviders = Math.min(7, totalActive)`).
* **Encerramento Gracioso:** Como a plataforma conta atualmente com 4 provedores, o stream processa todos eles e marca `exhausted = true` sem aguardar lotes adicionais inexistentes.
* **Prefetch em Segundo Plano:** Conforme novos provedores forem adicionados, o motor acumulará lotes adicionais em memória/cache do TanStack Query para exibição progressiva via sentinela `IntersectionObserver`.

---

## 7. Mapeamento de Arquivos e Componentes

| Arquivo | Camada | Ação | Descrição |
| :--- | :--- | :--- | :--- |
| `apps/backend/prisma/schema.prisma` | Banco | Modificação | Adicionar model `UserFavoriteProvider` e relation em `User` |
| `apps/backend/src/modules/scraping/repositories/user-favorite-provider.repository.ts` | Backend | Criação | Interface e implementação Prisma de favoritos |
| `apps/backend/src/modules/scraping/services/search-cache.service.ts` | Backend | Criação | Cache singleton compartilhado em memória (`search_full` e `search`) com TTL e LRU |
| `apps/backend/src/modules/scraping/use-cases/list-favorite-providers.use-case.ts` | Backend | Criação | Caso de uso de listagem de favoritos |
| `apps/backend/src/modules/scraping/use-cases/toggle-favorite-provider.use-case.ts` | Backend | Criação | Caso de uso de alternar favorito (com suporte a `{ isFavorite }`) |
| `apps/backend/src/modules/scraping/use-cases/search-sources-stream.use-case.ts` | Backend | Criação | Caso de uso de busca streaming SSE com cancelamento ativo, filtro de idioma case-insensitive, abastecimento de `search_full` e favoritos no topo |
| `apps/backend/src/modules/scraping/use-cases/search-sources.use-case.ts` | Backend | Modificação | Integrar cache de fatiamento (`search_full`) singleton para provedores sem paginação nativa e otimizar `findBySlug` |
| `apps/backend/src/modules/scraping/controllers/favorite-providers.controller.ts` | Backend | Criação | Controller para endpoints de favoritos |
| `apps/backend/src/modules/scraping/controllers/search-sources-stream.controller.ts` | Backend | Criação | Controller SSE para `GET /api/conversions/source/search/stream` com `reply.hijack()`, listener de `close` e captura de exceções |
| `apps/backend/src/modules/scraping/scraping.routes.ts` | Backend | Modificação | Registrar rota SSE `/search/stream`, rotas de favoritos, relaxar rate limit da busca para 240/min e aplicar `verifyJwt` |
| `apps/frontend/src/lib/sse.ts` | Frontend | Verificação | Confirmar suporte existente de `credentials: 'include'` e `AbortController` em `createSSEStream` |
| `apps/frontend/src/lib/api.ts` | Frontend | Modificação | Métodos `getFavoriteProviders`, `toggleFavoriteProvider` e `searchStream` |
| `apps/frontend/src/hooks/useFavoriteProviders.ts` | Frontend | Criação | Hook TanStack Query com optimistic updates e rollback |
| `apps/frontend/src/routes/fontes.tsx` | Frontend | Modificação | Botão estrela nos cards + ordenação "Favoritos primeiro" |
| `apps/frontend/src/components/dashboard/HomeSearchBar.tsx` | Frontend | Modificação | Input com `draftQuery`, atalhos `Ctrl+K`/`/`, submit por Enter/Lupa e remoção do debounce automático |
| `apps/frontend/src/components/dashboard/ProviderRailSkeleton.tsx` | Frontend | Criação | Skeleton pop-art de trilho de provedor com transição in-place |
| `apps/frontend/src/components/dashboard/ProviderSearchRail.tsx` | Frontend | Modificação | Adicionar botão de estrela de favorito pop-art no cabeçalho do trilho |
| `apps/frontend/src/hooks/useFederatedSearch.ts` | Frontend | Criação | Motor progressivo SSE com slots estáveis, ordem de sessão congelada, paginação homogênea (`loadProviderPage`) e encerramento gracioso |
| `apps/frontend/src/components/dashboard/HomeSearchResults.tsx` | Frontend | Modificação | Renderização baseada em slots estáveis na ordem prioritária e sentinela `IntersectionObserver` |
| `apps/frontend/src/routes/index.tsx` | Frontend | Modificação | Integração da busca sob demanda e motor progressivo na Home |
| `CLAUDE.md` | Documentação | Modificação | Atualizar documentação do desktop para Tauri v2 e detalhes de autenticação |

---

## 8. Estratégia de Verificação e Testes

1. **Migração do Banco de Dados:**
   * Rodar migration no PostgreSQL e validar constraints de chave única composta (`userId + providerSlug`) e deleção em cascata (`onDelete: Cascade`).
2. **Testes Unitários no Backend (Vitest):**
   * Repositório e use cases de favoritos: adição, remoção, idempotência e isolamento entre usuários.
   * `search-sources-stream.use-case.test.ts`: verificar emissão de frames SSE (`provider-result`, `provider-skip`, `done`), ordenação com favoritos no topo, cancelamento via `AbortSignal` e abastecimento de `search_full`.
   * `search-sources.use-case.test.ts`: validar cache de fatiamento (`offset > 0` fatia da memória sem refazer requisição externa).
   * Proteção JWT: verificar `401 Unauthorized` para acessos não autenticados.
3. **Testes Unitários no Frontend (Vitest):**
   * `HomeSearchBar.test.tsx`: validar que digitar não emite busca; Enter e Lupa disparam busca com $\ge 2$ caracteres; Esc/X limpa; filtros ativos re-disparam busca automaticamente.
   * `useFavoriteProviders.test.ts`: testar listagem, toggle e optimistic updates com rollback.
   * `useFederatedSearch.test.ts`: testar streaming progressivo com slots estáveis sem layout shift, ordem de sessão congelada, paginação horizontal homogênea e encerramento gracioso quando os provedores se esgotam.
4. **Validação no Shell Desktop Tauri v2:**
   * Executar `pnpm desktop:dev` e validar o fluxo completo no shell Tauri v2 (streaming de bytes contínuo via proxy Axum, autenticação e navegação sem erros).
