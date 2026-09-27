# Plano de Implementação: Busca Federada com Favoritos no PostgreSQL e Streaming Progressivo

## 1. Visão Geral e Objetivos

Este documento especifica a evolução arquitetural do sistema de busca do MangaInk de uma consulta síncrona agregada para uma **arquitetura federada progressiva com persistência relacional no PostgreSQL e transporte contínuo via Server-Sent Events (Estratégia C — Streaming SSE com Fila Prioritária sem Barreira)**:

1. **Favoritos no Banco de Dados:** Provedores favoritos persistidos por usuário na tabela `user_favorite_providers` do PostgreSQL via Prisma.
2. **Autenticação Obrigatória Global (JWT):** Todas as rotas de busca e provedores (`GET /search/stream`, `GET /search`, `GET /providers`, `GET /providers/favorites`, `POST /providers/:slug/favorite`) passam a exigir `verifyJwt`. Usuários não autenticados são redirecionados para a tela de login (`/login`) via guards `beforeLoad` do TanStack Router.
3. **Transporte Único via Streaming SSE (Solução do Rate Limit):** A busca federada progressiva utiliza **uma única conexão HTTP persistente** via Server-Sent Events (`GET /api/conversions/source/search/stream`). Elimina o disparo de dezenas de conexões REST simultâneas, preservando a cota de rate limit de 20 buscas/minuto por usuário com zero overhead de handshakes TLS.
4. **Disparo de Busca Sob Demanda:** O input de busca não altera a Home nem dispara requisições enquanto o usuário digita (remove debounce de digitação). O disparo ocorre estritamente via tecla **Enter** ou clique no **botão de lupa** (`>= 2` caracteres). Pressionar `Escape` ou clicar no `X` limpa e retorna ao dashboard normal.
5. **Priorização por Favoritos sem Bloqueio (Render on-Arrival):** O backend consulta os favoritos do usuário no PostgreSQL e ordena a fila (favoritos no topo, depois alfabética). O fan-out opera com concorrência controlada (`SEARCH_CONCURRENCY = 3`). Provedores rápidos (ex.: 200ms) emitem eventos `provider-result` imediatamente pelo canal SSE, sem esperar provedores lentos (4–7s) que também estejam nos favoritos.
6. **Ocultação Silenciosa de Trilhos Vazios e Erros de Scraping:** Fontes que retornarem 0 resultados (`results: []`) ou que falharem no scraping emitem evento `provider-skip` e são **automaticamente ocultadas**, sem trilho de erro visual na interface. Falhas são registradas apenas em log/telemetria. Erros críticos (401 de sessão ou rede global) continuam tratados com redirecionamento para login ou toast.
7. **Meta de 7 Provedores Visíveis com Auto-Preenchimento:** O stream avança consumindo a fila prioritária até totalizar **7 provedores com obras visíveis** (`BATCH_VISIBLE = 7`). Se a fila de provedores cadastrados se esgotar antes (ex.: 4 provedores no estado atual), o motor assume estado `exhausted = true` com encerramento gracioso (sem loop infinito).
8. **Prefetch em Segundo Plano (+7 Fontes):** Assim que 7 provedores com resultados são renderizados, o motor continua em background acumulando até mais **7 provedores com resultados** (`BATCH_PREFETCH = 7`) em cache de memória TanStack Query (`staleTime: 5min`, `gcTime: 10min`).
9. **Rolagem Automática (Infinite Scroll com Sentinela):** Ao atingir o fim da página, as fontes pré-carregadas entram na tela instantaneamente (0ms de espera) e o motor retoma o prefetch do lote seguinte. Quando `exhausted = true`, a sentinela não rearma.
10. **Desktop Tauri v2:** Alinhamento estrito com o shell desktop Tauri v2 (dispensa dependências legadas de Electron/Playwright).
11. **Zero Dependências Novas:** Utiliza `createSSEStream` (fetch streaming com `TextDecoder`), `IntersectionObserver` e `AbortController` nativos do browser + TanStack Query `^5.83.0` já presente no projeto.

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
  * `toggle(userId: string, providerSlug: string): Promise<{ isFavorite: boolean }>` — adiciona ou remove atomicamente o registro.
* **Implementação Prisma `PrismaUserFavoriteProviderRepository`:**
  * Implementa queries seguras com transação ou `findUnique` + `create`/`delete`.

### 3.2 Casos de Uso
* `ListFavoriteProvidersUseCase`: consulta e retorna `{ favorites: string[] }` para o usuário autenticado.
* `ToggleFavoriteProviderUseCase`:
  * Valida se `providerSlug` é um provedor existente e suportado (validação no DB com fallback seed).
  * Alterna o estado no banco de dados e retorna `{ slug: string, isFavorite: boolean }`.
* **`SearchSourcesStreamUseCase` (Novo — Streaming Federado SSE):**
  * Executa a busca federada com emissão contínua de eventos SSE para o cliente HTTP.
  * Recebe: `userId: string`, `query: string`, `language?: string`, `providers?: string[]`, `limitPerProvider?: number`.
  * Consulta os favoritos do usuário autenticado no PostgreSQL via `UserFavoriteProviderRepository`.
  * Determina os provedores elegíveis a partir do `ProviderResolver`, aplicando os filtros de status e language/providers.
  * Monta a fila prioritária única: favoritos elegíveis no topo, seguidos pelos demais elegíveis em ordem alfabética.
  * Executa o fan-out com concorrência 3 (`SEARCH_CONCURRENCY = 3`), invocando `strategy.search` individualmente com timeout de 6s.
  * Emite eventos em tempo real conforme cada provider resolve:
    * `provider-result`: `{ providerSlug, title, engine, results: [...] }` (quando há $\ge 1$ obra).
    * `provider-skip`: `{ providerSlug, reason: 'empty' | 'error' }` (quando há 0 obras ou ocorre falha de scraping/timeout).
    * `done`: `{ totalFound: number, exhausted: boolean }` (ao concluir todos os providers da fila).
  * Recebe `signal: AbortSignal` para cancelar o scraping externo imediatamente se o socket do cliente for fechado.
* **Otimização no `SearchSourcesUseCase` (REST — Problemas 8 e 9):**
  * **Otimização de Query (Ponto 8):** Eliminar a execução de `repository.findAll()` a cada requisição individual. Quando `providers` contiver apenas 1 slug (ex.: paginação horizontal de um trilho), utilizar `repository.findBySlug(slug)` ou cache em memória com TTL curto (1–2 min) do status dos provedores.
  * **Expansão do Cache em Memória (Ponto 9):** Aumentar `SEARCH_CACHE_MAX_ENTRIES` de 200 para **2.000 entradas** no `SearchSourcesUseCase`, suportando o churn de chaves individuais sem evacuação prematura.

### 3.3 Rotas HTTP (`scraping.routes.ts`) — Protegidas por JWT
* **Ordem de Registro:** `GET /providers/favorites` DEVE ser registrado ANTES de qualquer rota de parâmetro `/:slug`.
* **Nova Rota de Streaming SSE (Solução do Rate Limit — Ponto 1):**
  * **`GET /api/conversions/source/search/stream`**
    * Middleware: `onRequest: [verifyJwt]`.
    * Rate Limit: Mantém `SEARCH_RATE_LIMIT_MAX = 20` e `SEARCH_RATE_LIMIT_WINDOW = '1 minute'` (perfeito, pois 1 busca = 1 conexão persistente; não há estouro de 429).
    * Headers SSE: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` via `reply.hijack()`.
    * Lifecycle & Abort: Escuta `request.raw.on('close')`. Se o cliente fechar a aba ou submeter nova busca, dispara `abortController.abort()` interrompendo qualquer scraping em voo no servidor.
* **Endpoints de Favoritos:**
  * **`GET /api/conversions/source/providers/favorites`**
    * Middleware: `onRequest: [verifyJwt]` (qualquer usuário autenticado).
    * Retorna: `{ favorites: string[] }`
  * **`POST /api/conversions/source/providers/:slug/favorite`**
    * Middleware: `onRequest: [verifyJwt]` (qualquer usuário autenticado; diferente do `PATCH /providers/:slug` que exige `ADMIN`).
    * Retorna: `{ slug: string, isFavorite: boolean }`
* **Fechamento de Rotas Públicas com JWT (Breaking Change Intencional):**
  * `GET /api/conversions/source/search` e `GET /api/conversions/source/providers` passam a ter `onRequest: [verifyJwt]`.
  * Requisições não autenticadas retornam `401 Unauthorized` e são interceptadas pelo frontend via `beforeLoad` do TanStack Router para redirecionamento imediato a `/login`.
  * A rota REST `GET /api/conversions/source/search` é mantida para atender à paginação horizontal interna de 10 em 10 itens dos trilhos (`loadProviderPage`).

---

## 4. Frontend: Gerenciamento de Favoritos

### 4.1 Cliente de API (`apps/frontend/src/lib/api.ts`)
* `scrapingApi.getFavoriteProviders(): Promise<{ favorites: string[] }>`
* `scrapingApi.toggleFavoriteProvider(slug: string): Promise<{ slug: string; isFavorite: boolean }>`
* **`scrapingApi.searchStream(query, options, handlers): { close: () => void }` (Novo — Streaming SSE):**
  * Conecta a `GET /api/conversions/source/search/stream?q=...&language=...&providers=...` utilizando o utilitário nativo `createSSEStream` de `apps/frontend/src/lib/sse.ts`.
  * Envia credenciais/cookie httpOnly e token em memória no header `Authorization: Bearer <token>`.
  * Escuta os eventos:
    * `provider-result` -> `handlers.onProviderResult(data)`
    * `provider-skip` -> `handlers.onProviderSkip(data.providerSlug)`
    * `done` -> `handlers.onDone(summary)`
    * Erro de conexão/status -> `handlers.onError(error)`
  * Retorna `{ close: () => void }` para fechamento instantâneo do stream.
* `scrapingApi.search(query, options, signal?): Promise<SearchSourcesResponse>` mantido para paginação horizontal REST de trilho individual (`onLoadMore`).

### 4.2 Hook `useFavoriteProviders` (`apps/frontend/src/hooks/useFavoriteProviders.ts`)
* Integração com TanStack Query sob a chave `["providers", "favorites"]`.
* **Atualizações Otimistas (Optimistic Updates):** Ao clicar no botão de favoritar, a UI reflete a mudança em 0ms; se a requisição falhar, reverte com notificação toast de erro.
* Expõe:
  * `favoriteSlugs: string[]`
  * `isFavorite(slug: string): boolean`
  * `toggleFavorite(slug: string): void`
  * `isLoading: boolean`

### 4.3 Interface em `/fontes` (`apps/frontend/src/routes/fontes.tsx`)
* Botão de estrela pop-art em cada card de provedor (`ComicPanel`):
  * Ícone `<Star />` preenchido de amarelo quando favorito (`fill-comic-yellow text-comic-yellow`); contorno com hover quando desfavoritado.
* Seletor de ordenação:
  * Nova opção no dropdown de ordenação: `"Favoritos primeiro"`.

---

## 5. Frontend: Barra de Busca Sob Demanda

### 5.1 Estado Desacoplado no `HomeSearchBar.tsx`
* Gerenciamento de estado de digitação local (`draftQuery`).
* O input não notifica a rota nem altera o estado `isSearching` enquanto o usuário digita.
* Remoção completa do debounce automático de 300ms do caminho de disparo de busca.

### 5.2 Disparo por Enter e Botão de Lupa
* O ícone de lupa na extremidade esquerda é envolvido por um `<button type="submit">` acessível.
* Formulário com `<form onSubmit={...}>` intercepta o envio ao pressionar Enter ou clicar na lupa.
* Apenas termos com $\ge 2$ caracteres disparam a busca (`onSearch(committedQuery)`).
* Pressionar `Escape` ou clicar no botão `X` limpa o input e fecha a visualização de busca, retornando a Home para o dashboard normal.

### 5.3 Reatividade de Filtros na Busca Ativa (Ajuste 3)
* A restrição de acionamento estrito por Enter/Lupa aplica-se exclusivamente à **digitação de texto** no input (`draftQuery`).
* Se a busca já estiver ativa na tela (`committedQuery.length >= 2`), qualquer alteração de filtros no `LanguageSelectorPopover` (idioma) ou no `SearchFilterDrawer` (motores/provedores ativados):
  * Cancela o stream SSE em andamento imediatamente.
  * Dispara nova busca automática em streaming para o mesmo `committedQuery` com a nova lista de `effectiveProviders`, sem exigir que o usuário pressione Enter novamente.

---

## 6. Frontend: Motor de Busca Progressiva & Lotes (`useFederatedSearch`)

### 6.1 Fila Prioritária Unificada com Filtros Ativos (Ponto 7)
1. **Interseção com Filtros da Home:** A fila de busca não consulta provedores favoritados às cegas. Primeiro, obtém-se a lista de provedores elegíveis (`effectiveProviders`) via `resolveEffectiveProviders(filters, providers)`, respeitando os filtros ativos de idioma, engines e provedores ativados no `SearchFilterDrawer`.
2. **Ordenação Prioritária:** A fila unificada posiciona **os provedores de `effectiveProviders` favoritados no banco no topo**, seguidos pelos demais provedores de `effectiveProviders` ordenados alfabeticamente.
3. Não há barreira de sincronização ou "fase 1" bloqueante para favoritos: a lista prioritária é percorrida de forma contínua pelo motor.

### 6.2 Execução Contínua via Streaming SSE com Slots Estáveis (Estratégia C — Pontos 1, 3, 4, 6 e Ajuste 4)
* **Conexão Única Persistente (Solução do Rate Limit):** O motor abre 1 única conexão SSE via `scrapingApi.searchStream(query, { language, providers: targetSlice }, handlers)`:
  `GET /api/conversions/source/search/stream?q=...&language=...&providers=...`
* **Controle de Sessão contra Race Conditions (Ponto 6):** Uma referência `searchSessionIdRef = useRef(0)` é incrementada a cada nova busca comitada (`onSearch`). Se o usuário submeter uma nova busca ou alterar filtros, o stream SSE anterior é fechado imediatamente via `activeStreamRef.current?.close()`, e qualquer evento residual é ignorado.
* **Slots Estáveis contra Layout Shift / CLS (Ponto 3):**
  * A UI inicializa **slots estáveis baseados na ordem pré-calculada da fila prioritária** (favoritos no topo, depois alfabética de ativos).
  * Cada provedor em processamento mantém seu `ProviderRailSkeleton` na sua posição fixa de slot.
  * Ao receber o evento `provider-result`, o provedor substitui seu próprio skeleton *in-place* mantendo a estabilidade visual (zero salto de tela).
  * Ao receber o evento `provider-skip`, o skeleton daquele provedor é desmontado suavemente, cedendo espaço para os provedores seguintes da fila.
  * O componente `HomeSearchResults` renderiza os trilhos na ordem exata da fila prioritária (eliminando a reordenação alfabética forçada via `localeCompare` do componente legado).
* **Paginação Horizontal do Trilho Preservada (Ponto 4):**
  * O hook `useFederatedSearch` exporta `loadProviderPage(slug, offset, limit, signal)` consumindo `scrapingApi.search(query, { providers: slug, limit, offset, language }, signal)`. Isso preserva o botão "Carregar mais" horizontal de 10 em 10 itens dentro de cada trilho.
* **Bridge SSE (Push) para TanStack Query (Ajuste 4):**
  * O hook `useFederatedSearch` gerencia o estado da lista em renderização e popula o cache do React Query via `queryClient.setQueryData(["scraping", "search", query, providerSlug, language], data)` a cada evento `provider-result`.
  * **Otimização de 0ms em Buscas Repetidas:** Antes de disparar uma conexão de rede SSE para uma fatia de provedores, o hook consulta o cache em memória com `queryClient.getQueryData(...)`. Provedores com dados quentes (`staleTime < 5min`) renderizam imediatamente na tela em 0ms; o stream SSE só é aberto para os provedores ausentes ou expirados.

### 6.3 Ocultação Seletiva de Trilhos Vazios, Erros de Scraping e Empty State Global (Ponto 2 e Ajuste 2)
* **Descarte Silencioso Estrito:** Apenas resultados sem obras (`results: []`) e falhas de scraping do provedor (`errors: [{ providerSlug, message }]` ou status 502) são descartados silenciosamente da visualização, com o skeleton correspondente sendo desmontado suavemente. Falhas de scraping são registradas via `console.debug`.
* **Tratamento de Erros Críticos (Não Ocultados):**
  * **Erros de Autenticação (`401 Unauthorized`):** Não são silenciados; disparam o interceptor de sessão e redirecionam imediatamente o usuário para `/login`.
  * **Erros Globais de Rede:** Falha total de conexão com o backend exibe toast de conectividade ("Sem conexão com o servidor").
* **Preenchimento até 7 Obras Visíveis:** O motor avança preenchendo os slots da fila prioritária até totalizar **7 fontes com obras visíveis** (`BATCH_VISIBLE = 7`).
* **Tratamento de Fila Esgotada (`exhausted = true`):** Quando a lista de provedores ativos terminar antes de alcançar 7 (caso atual: 4 provedores em desenvolvimento), o motor encerra a iteração graciosamente com o que houver, marcando `exhausted = true` (evita loops infinitos de busca).
* **Empty State Global (Ajuste 2):** Se ao final do processamento (`isDone` ou `exhausted`) nenhum provedor da fila retornar obras (`visibleRailsCount === 0`), a tela não fica vazia. O componente `HomeSearchResults` renderiza o estado temático de busca sem resultados:
  * `<ComicEmptyState emoji="🔍" title="Nenhum resultado encontrado" text="Não encontramos obras para '{committedQuery}'. Tente outros termos ou ajuste os filtros." />`

### 6.4 Prefetch em Background e Fatiamento de Lotes SSE (Ajuste 1)
* O frontend orquestra a fila prioritária `effectiveProviders` em fatias (batches) de provedores:
  * **Lote Inicial (Visíveis + Prefetch):** O stream SSE é aberto solicitando os primeiros provedores da fila: `GET /search/stream?q=...&providers=slug1,slug2...slug14`.
  * Os primeiros 7 provedores com obras preenchem a tela (`visibleRails`); os 7 seguintes com obras são acumulados no buffer de prefetch (`prefetchedRails`) e no cache do React Query.
  * Ao completar 7 visíveis + 7 pré-carregados (ou esgotar a fatia solicitada), o stream fecha a conexão HTTP, liberando os recursos do servidor.

### 6.5 Rolagem Automática (Infinite Scroll) e Próxima Fatia SSE (Ajuste 1 e 5)
* Elemento sentinela com `IntersectionObserver` no rodapé da página de busca.
* **Guardas Estritas contra Disparo em Cascata (Ponto 5):** Em telas grandes (1080p/1440p) ou com poucos provedores, a sentinela só consome o lote pré-carregado se:
  1. `!isLoadingInitial` (o lote inicial de exibição concluiu o preenchimento);
  2. `!isPrefetching` (não está executando prefetch ativamente);
  3. `!exhausted` (ainda há provedores a consultar);
  4. `prefetchedCount > 0` (há provedores pré-carregados prontos no cache);
  5. `hasUserScrolled` (houve interação real de rolagem pelo usuário, evitando disparo instantâneo no mount).
* **Consumo e Reabertura do Próximo Lote (Ajuste 1):**
  * Ao rolar até o final e passar nas guardas:
    1. Os 7 provedores já pré-carregados entram na tela instantaneamente (0ms de espera).
    2. O motor calcula a próxima fatia da fila de provedores pendentes (ex.: `effectiveProviders.slice(14, 28)`).
    3. Abre um novo stream SSE passando a nova fatia: `GET /search/stream?q=...&providers=slug15,slug16...slug28`.
    4. Esse novo stream acumula o próximo lote de prefetch em segundo plano.
* Se a fila `effectiveProviders` não contiver mais provedores pendentes, marca `exhausted = true` e a sentinela não rearma.

---

## 7. Mapeamento de Arquivos e Componentes

| Arquivo | Camada | Ação | Descrição |
| :--- | :--- | :--- | :--- |
| `apps/backend/prisma/schema.prisma` | Banco | Modificação | Adicionar model `UserFavoriteProvider` e relação em `User` |
| `apps/backend/src/modules/scraping/repositories/user-favorite-provider.repository.ts` | Backend | Criação | Interface e implementação Prisma de favoritos |
| `apps/backend/src/modules/scraping/use-cases/list-favorite-providers.use-case.ts` | Backend | Criação | Caso de uso de listagem de favoritos |
| `apps/backend/src/modules/scraping/use-cases/toggle-favorite-provider.use-case.ts` | Backend | Criação | Caso de uso de alternar favorito (valida slug no DB com fallback seed) |
| `apps/backend/src/modules/scraping/use-cases/search-sources-stream.use-case.ts` | Backend | Criação | Caso de uso de busca federada progressiva com emissão SSE (`provider-result`, `provider-skip`, `done`) e abort |
| `apps/backend/src/modules/scraping/use-cases/search-sources.use-case.ts` | Backend | Modificação | Otimizar consulta única com `findBySlug`/cache (Ponto 8) e expandir `SEARCH_CACHE_MAX_ENTRIES` para 2.000 (Ponto 9) para a rota REST de paginação |
| `apps/backend/src/modules/scraping/controllers/favorite-providers.controller.ts` | Backend | Criação | Controller para endpoints de favoritos |
| `apps/backend/src/modules/scraping/controllers/search-sources-stream.controller.ts` | Backend | Criação | Controller SSE para `GET /api/conversions/source/search/stream` com `reply.hijack()` e listener de `close` |
| `apps/backend/src/modules/scraping/scraping.routes.ts` | Backend | Modificação | Registrar rota SSE `/search/stream`, rotas de favoritos e aplicar proteção `verifyJwt` em todas as rotas de busca e providers |
| `apps/frontend/src/lib/api.ts` | Frontend | Modificação | Métodos `getFavoriteProviders`, `toggleFavoriteProvider` e `searchStream` (usando `createSSEStream`) |
| `apps/frontend/src/hooks/useFavoriteProviders.ts` | Frontend | Criação | Hook TanStack Query com optimistic updates e rollback |
| `apps/frontend/src/routes/fontes.tsx` | Frontend | Modificação | Botão estrela nos cards + ordenação "Favoritos primeiro" |
| `apps/frontend/src/components/dashboard/HomeSearchBar.tsx` | Frontend | Modificação | Input com `draftQuery`, botão de lupa submit e remoção do debounce de busca |
| `apps/frontend/src/components/dashboard/ProviderRailSkeleton.tsx` | Frontend | Criação | Skeleton pop-art de trilho de provedor em carregamento |
| `apps/frontend/src/hooks/useFederatedSearch.ts` | Frontend | Criação | Motor progressivo SSE (Estratégia C): consumo do stream, slots estáveis, `searchSessionId`, descarte seletivo de vazios/erros, paginação horizontal `loadProviderPage` REST e prefetch 7+7 |
| `apps/frontend/src/components/dashboard/HomeSearchResults.tsx` | Frontend | Modificação | Renderização baseada em slots estáveis respeitando a fila prioritária e sentinela `IntersectionObserver` com guardas de rolagem |
| `apps/frontend/src/routes/index.tsx` | Frontend | Modificação | Integração da busca sob demanda e motor progressivo |
| `CLAUDE.md` | Documentação | Modificação | Atualizar documentação do desktop para Tauri v2 e rotas com JWT |

---

## 8. Estratégia de Verificação e Testes

1. **Migração do Banco de Dados:**
   * Rodar migration no PostgreSQL e validar constraints de chave única composta (`userId + providerSlug`) e deleção em cascata (`onDelete: Cascade`).
2. **Testes Unitários no Backend (Vitest):**
   * Repositório de favoritos: inserção, remoção (toggle idempotente) e listagem por usuário.
   * Use cases de favoritos: validação de slug existente, toggle, listagem e garantia de isolamento entre usuários.
   * `search-sources-stream.use-case.test.ts`: verificar emissão correta de frames SSE (`provider-result` com obras, `provider-skip` para vazios ou erros de scraping, `done` final), ordenação com favoritos no topo e cancelamento imediato ao acionar o `AbortSignal`.
   * Proteção JWT: verificar retorno `401 Unauthorized` para `GET /search/stream`, `GET /search`, `GET /providers` e favoritos sem Bearer token válido.
3. **Testes Unitários no Frontend (Vitest):**
   * `HomeSearchBar.test.tsx`: validar que digitar altera apenas `draftQuery` local (não emite busca) e que pressionar Enter ou clicar na lupa aciona `onSearch` com $\ge 2$ caracteres; Esc/X limpa e fecha; alteração de idioma/filtros com busca ativa dispara re-busca automática.
   * `useFavoriteProviders.test.ts`: testar listagem, toggle e optimistic updates com rollback em caso de falha.
   * `useFederatedSearch.test.ts`: testar streaming progressivo com slots estáveis via stream SSE mockado, preenchimento de trilhos *on-arrival*, descarte suave de `provider-skip`, exibição do `ComicEmptyState` quando todos os provedores forem vazios, fatiamento de lotes de prefetch (`slice`), cancelamento via `searchSessionIdRef`, preservação de `loadProviderPage` REST e terminação com `exhausted=true`.
4. **Validação Smoke no App Desktop Tauri (sem Electron/Playwright):**
   * Executar `pnpm desktop:dev` e validar o fluxo completo no shell Tauri v2:
     * Acessar `/login` e autenticar como admin.
     * Ir para `/fontes` e favoritar um provedor (ex.: `MangaDex`).
     * Voltar para `/` e digitar termo sem disparo automático.
     * Pressionar Enter e validar:
       * Provedores favoritos aparecem no topo assim que respondem via SSE (render on-arrival).
       * Skeletons estáveis aparecem para os provedores pendentes sem Layout Shift.
       * Provedores vazios ou com erro não renderizam trilhos.
       * Rolar a página até o fim e conferir o consumo do lote pré-carregado.
