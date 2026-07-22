# Manga Detail Page — Proposta

> **Status:** DRAFT
> **Data:** 2026-07-21
> **Módulo:** `frontend` (página de detalhes do mangá)

---

## 1. Problema

Atualmente, a rota `/biblioteca/$sourceId` exibe apenas uma listagem plana de conversões agrupadas por `sourceId`. Não existe uma **página de detalhes rica** para um mangá específico que permita ao usuário:

- Visualizar a capa em destaque e informações completas da obra (sinopse, gêneros, autor).
- Acessar rapidamente os capítulos disponíveis em cache.
- Ver o histórico de jobs de conversão independentemente do status.
- Ter ações rápidas como "Começar a ler" / "Continuar lendo" e "Favoritar".

A página atual (`biblioteca.$sourceId.tsx`) funciona como um histórico de conversões, mas não oferece a experiência de uma **ficha de mangá** completa com navegação por abas.

### O que falta no backend

> [!IMPORTANT]
> As seguintes informações **não estão disponíveis via API** no momento e devem ser **inteiramente mockadas** no frontend:

1. **Metadados completos da obra por `sourceId`** — O endpoint `GET /api/conversions/source/inspect/:sourceId` retorna metadados do scraping (`MangaMetadata`: title, author, description, genres, status), mas **só existe no contexto de inspeção** e pode não estar em cache para sources já processadas anteriormente. A interface deve assumir que esses dados podem não existir e fornecer fallbacks mockados.

2. **Listagem de capítulos em cache** — Não existe um endpoint dedicado que retorne "capítulos disponíveis em cache para um sourceId". O scraping retorna `chapters[]` durante a inspeção, mas não há uma API de consulta posterior. **Essa listagem deve ser mockada.**

3. **Progresso de leitura do usuário** — Não existe rastreamento de leitura no backend. O botão "Continuar lendo cap X" deve usar dados **mockados** em estado local.

4. **Sistema de favoritos** — Não existe endpoint de favoritos. O toggle deve ser mantido em **estado local mockado**.

---

## 2. Solução Proposta

### 2.1. Nova Rota / Substituição de Página

Substituir o conteúdo de `biblioteca.$sourceId.tsx` pela nova página de detalhes com layout de duas colunas. A rota permanece `/biblioteca/$sourceId`.

### 2.2. Layout de Duas Colunas

```
┌─────────────────────────────────────────────────────────────┐
│  COLUNA ESQUERDA          │  COLUNA DIREITA                 │
│  ┌─────────────────────┐  │  ┌───────────────────────────┐  │
│  │                     │  │  │   TÍTULO DO MANGÁ         │  │
│  │    CAPA (aspect     │  │  └───────────────────────────┘  │
│  │    2:3, destaque)   │  │  ┌───┬──────────┬────────────┐  │
│  │                     │  │  │Det│ Caps (N) │ Conversões │  │
│  │                     │  │  └───┴──────────┴────────────┘  │
│  └─────────────────────┘  │  ┌───────────────────────────┐  │
│  ┌─────────────────────┐  │  │                           │  │
│  │ ▶ Começar a ler     │  │  │  CONTEÚDO DINÂMICO        │  │
│  └─────────────────────┘  │  │  (muda conforme aba)      │  │
│  ┌─────────────────────┐  │  │                           │  │
│  │ ♥ Favoritar         │  │  │                           │  │
│  └─────────────────────┘  │  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Responsividade:** Em telas `< md`, empilhar as colunas verticalmente (capa em cima, informações embaixo).

### 2.3. Coluna Esquerda — Mídia e Ações

- **Capa:** Reutilizar `conversionsApi.coverUrl(sourceId, { kind: "original" })` para exibir a capa. Fallback para ícone `BookOpen` em `ComicPanel` caso a imagem falhe.
- **Botão primário "Começar a ler" / "Continuar lendo cap X":**
  - Lógica de progresso **mockada** em estado local (`useState`).
  - Sem progresso: exibir "Começar a ler" → link para o primeiro capítulo convertido (via rota reader se existir).
  - Com progresso mockado: exibir "Continuar lendo cap X".
  - Estilização: botão `comic-red`, `border-ink`, `shadow-comic`, `font-display`.
- **Botão "Favoritar":**
  - Toggle com `Heart` / `HeartFilled` de lucide-react.
  - Estado **mockado** em `useState<boolean>(false)`.
  - Estilização: botão outline com `border-ink`, `shadow-comic-sm`.

### 2.4. Coluna Direita — Informações e Abas

#### Título
- `font-display text-3xl md:text-4xl uppercase`, centralizado na coluna direita.

#### Menu de Abas (Tabs)
Utilizar o componente `Tabs` do Radix UI já existente em `@/components/ui/tabs`, estilizado com o design system comic:

| Aba | Label | Conteúdo |
|-----|-------|----------|
| `detalhes` | Detalhes | Sinopse, gêneros, autor, status da obra |
| `capitulos` | Capítulos (N) | Lista de capítulos em cache — **mockado** |
| `conversoes` | Conversões | Lista de Jobs de conversão (via API real `useConversionsList`) |

#### Aba "Detalhes" (MOCKADA)

Dados mockados em um objeto `MOCK_MANGA_DETAILS` estruturado para fácil substituição futura:

```typescript
interface MangaDetails {
  title: string;
  author: string | null;
  description: string | null;
  status: string | null;       // "Em publicação", "Completo", etc.
  genres: string[];
  alternativeTitles: string[];
  year: number | null;
  rating: number | null;       // 0–10
}
```

Renderização:
- **Sinopse:** Texto completo com `line-clamp` expandível (toggle "Ver mais / Ver menos").
- **Gêneros:** Badges estilo `OnomatopoeiaBadge` ou chips com `border-ink`.
- **Autor:** Ícone `User` + texto.
- **Status:** Badge colorido (verde para "Em publicação", azul para "Completo").
- **Informações extras:** ano de publicação, rating (estrelas mockado).

> [!WARNING]
> **Toda esta aba usa dados mockados.** A estrutura do `MangaDetails` deve ser idêntica ao `MangaMetadata` do tipo `scraping.ts` para facilitar a integração futura com `GET /api/conversions/source/inspect/:sourceId`.

#### Aba "Capítulos" (MOCKADA)

Lista de capítulos em cache — **inteiramente mockada** pois não existe endpoint de consulta de cache:

```typescript
interface CachedChapter {
  id: string;
  number: string;
  title: string;
  pages: number | null;
  cachedAt: string; // ISO date
}
```

Dados mockados em `MOCK_CACHED_CHAPTERS: CachedChapter[]` com 5–10 capítulos de exemplo.

Renderização:
- Lista dentro de `ComicPanel bg="card"`.
- Cada capítulo: número em destaque (`font-display`), título, contagem de páginas, data de cache.
- Badge no label da aba: `Capítulos (N)` onde `N` é o total de itens mockados.

#### Aba "Conversões" (DADOS REAIS)

Reutilizar a lógica **já existente** de `biblioteca.$sourceId.tsx`:
- `useConversionsList({ sourceId, limit: 50 })` para carregar conversões reais.
- `useConversionActions()` para ações de cancel/remove/download/reconvert.
- Renderização: lista de `ConversionSummary` com status, progresso, data, ações (mesma UI atual mas dentro da aba).

### 2.5. Gerenciamento de Estado

```typescript
// Estado da aba ativa
const [activeTab, setActiveTab] = useState<"detalhes" | "capitulos" | "conversoes">("detalhes");

// Estado mockado de favorito
const [isFavorite, setIsFavorite] = useState(false);

// Estado mockado de progresso de leitura
const [readingProgress, setReadingProgress] = useState<{ chapterNumber: string } | null>(null);
```

O componente `Tabs` do Radix gerencia internamente a exibição condicional via `TabsContent`.

---

## 3. Escopo

### Incluído

- [x] Novo layout de duas colunas para `biblioteca.$sourceId.tsx`
- [x] Capa em destaque com fallback
- [x] Botão "Começar a ler" / "Continuar lendo" com estado **mockado** local
- [x] Botão "Favoritar" com toggle **mockado** local
- [x] Menu de abas com Radix Tabs estilizado no design system comic
- [x] Aba "Detalhes": sinopse, gêneros, autor, status — dados **mockados** (`MOCK_MANGA_DETAILS`)
- [x] Aba "Capítulos": listagem de capítulos em cache — dados **mockados** (`MOCK_CACHED_CHAPTERS`)
- [x] Aba "Conversões": listagem de conversões reais via `useConversionsList` (migração da UI existente)
- [x] Responsividade mobile (colunas empilhadas em telas `< md`)
- [x] Consistência visual com design system comic (border-ink, shadow-comic, font-display, etc.)
- [x] Estrutura de dados mockados com interfaces TypeScript preparadas para fácil plug da API real

### Fora de Escopo (futuro)

- [ ] Endpoint de consulta de capítulos em cache (`GET /api/sources/:sourceId/chapters`)
- [ ] Endpoint de metadados da obra por sourceId (sem exigir re-inspeção)
- [ ] Rastreamento de progresso de leitura no backend
- [ ] Sistema de favoritos no backend (endpoint `POST /api/favorites`)
- [ ] Download de capítulos individuais
- [ ] Leitura online de capítulos
- [ ] Edição de metadados da obra pelo usuário

---

## 4. Critérios de Aceitação

1. **Layout:** Ao acessar `/biblioteca/$sourceId`, a página exibe duas colunas (esquerda: capa + ações; direita: título + abas).
2. **Capa:** A capa do mangá é exibida em proporção 2:3 usando `coverUrl(sourceId, { kind: "original" })`. Se falhar, exibe fallback com ícone.
3. **Botão Ler:** O botão primário exibe "Começar a ler" por padrão. Se `readingProgress` mockado existir, exibe "Continuar lendo cap X".
4. **Favoritar:** O botão "Favoritar" alterna entre estados ♡ / ♥ em estado local (sem persistência).
5. **Aba Detalhes:** Exibe sinopse mockada expandível, lista de gêneros em badges, autor e status da obra. Os dados vêm de `MOCK_MANGA_DETAILS`.
6. **Aba Capítulos:** Exibe lista de N capítulos mockados. O label da aba exibe `Capítulos (N)`.
7. **Aba Conversões:** Exibe conversões reais do backend via `useConversionsList({ sourceId })`. Ações de cancelar/remover funcionam como na página atual.
8. **Responsividade:** Em telas `< md`, as colunas empilham verticalmente.
9. **Navegação:** O botão de voltar (`ArrowLeft`) continua funcionando.
10. **Consistência visual:** Todos os componentes usam `border-ink`, `shadow-comic`, `font-display` e a paleta comic do design system.

---

## 5. Interfaces Mockadas — Resumo

> [!CAUTION]
> As interfaces abaixo **não possuem backend correspondente** e devem ser implementadas como constantes mockadas no frontend até que os endpoints estejam disponíveis.

| Interface | Dados | Local do Mock | Backend Futuro |
|-----------|-------|---------------|----------------|
| `MangaDetails` | Sinopse, gêneros, autor, status, ano | `MOCK_MANGA_DETAILS` constante | `GET /api/sources/:sourceId/metadata` |
| `CachedChapter[]` | Capítulos em cache | `MOCK_CACHED_CHAPTERS` constante | `GET /api/sources/:sourceId/chapters` |
| Progresso de leitura | Capítulo atual | `useState` local | `GET /api/reading-progress/:sourceId` |
| Favorito | boolean | `useState` local | `POST /api/favorites/:sourceId` |

Os mocks devem ser definidos em um arquivo separado `lib/manga-detail-mocks.ts` para facilitar a remoção quando os endpoints estiverem prontos.

---

## 6. Dependências

- **`useConversionsList`** (já implementado) — listagem de conversões por sourceId.
- **`useConversionActions`** (já implementado) — cancel, remove, reconvert.
- **`conversionsApi.coverUrl()`** (já implementado) — URL da capa.
- **`Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`** (já existe) — Radix UI tabs em `@/components/ui/tabs`.
- **`ComicPanel`** (já existe) — painéis estilizados comic.
- **`OnomatopoeiaBadge`** (já existe) — badges estilizados.
- **`SpeechBubble`** (já existe) — balões de fala para mensagens.
- **Lucide React** (já instalado) — ícones (`Heart`, `BookOpen`, `ArrowLeft`, `Play`, etc.).

---

## 7. Stack e Convenções

- **Framework:** React + TanStack Router (rota `createFileRoute`)
- **State:** `useState` para estado local; TanStack Query para dados do backend
- **Estilização:** Tailwind CSS v4 + design system comic-pop-art (variáveis CSS `--comic-*`)
- **Componentes:** Reutilizar primitivos UI de `@/components/ui` e comic de `@/components/comic`
- **Tipagem:** TypeScript estrito; interfaces em `@/types/` ou inline quando mockadas
