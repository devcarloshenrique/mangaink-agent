# Manga Detail Page — Tasks de Implementação

> **Status:** IMPLEMENTED
> **Data:** 2026-07-21

---

## 1. Dados Mockados e Tipos

- [x] 1.1 Criar `src/lib/manga-detail-mocks.ts` com constantes mockadas:
  - `MOCK_MANGA_DETAILS: MangaDetails` — título, autor ("Hajime Isayama"), sinopse (2–3 parágrafos), gêneros (["Ação", "Drama", "Fantasia", "Shounen"]), status ("Em publicação"), ano (2009), rating (8.5), alternativeTitles.
  - `MOCK_CACHED_CHAPTERS: CachedChapter[]` — 8 capítulos de exemplo com id, number ("1"–"8"), title, pages (18–25), cachedAt (datas ISO variadas).
- [x] 1.2 Definir interfaces no mesmo arquivo (ou `src/types/manga-detail.ts`):
  ```typescript
  interface MangaDetails {
    title: string;
    author: string | null;
    description: string | null;
    status: string | null;
    genres: string[];
    alternativeTitles: string[];
    year: number | null;
    rating: number | null;
  }

  interface CachedChapter {
    id: string;
    number: string;
    title: string;
    pages: number | null;
    cachedAt: string;
  }
  ```
- [x] 1.3 Adicionar comentários `// TODO: substituir por chamada API quando endpoint disponível` em cada mock.

## 2. Componentes da Coluna Esquerda

### MangaCover

- [x] 2.1 Criar `src/components/biblioteca/MangaCover.tsx`:
  - Props: `sourceId: string`, `className?: string`
  - Renderizar imagem via `conversionsApi.coverUrl(sourceId, { kind: "original" })`
  - Container com `aspect-[2/3]`, `border-[3px] border-ink`, `rounded-xl`, `shadow-comic`, `overflow-hidden`
  - Fallback: `ComicPanel bg="halftone"` com ícone `BookOpen` centralizado em `opacity-30`
  - `onError` na `<img>` para exibir fallback
  - Lazy loading: `loading="lazy"`

### ReadButton

- [x] 2.2 Criar `src/components/biblioteca/ReadButton.tsx`:
  - Props: `readingProgress: { chapterNumber: string } | null`, `sourceId: string`
  - Sem progresso: exibir `<Play className="h-5 w-5" /> Começar a ler`
  - Com progresso: exibir `<Play className="h-5 w-5" /> Continuar lendo cap {chapterNumber}`
  - Estilização: `w-full bg-comic-red text-primary-foreground border-[3px] border-ink shadow-comic font-display text-lg py-3 rounded-md hover:-translate-y-0.5 transition-transform`
  - Link/onClick: **noop** por enquanto (sem rota de leitura por capítulo avulso)

### FavoriteButton

- [x] 2.3 Criar `src/components/biblioteca/FavoriteButton.tsx`:
  - Props: `isFavorite: boolean`, `onToggle: () => void`
  - Ícone: `Heart` (outline) quando false, `Heart` com `fill="currentColor"` quando true
  - Label: "Favoritar" / "Favoritado"
  - Estilização: `w-full border-[3px] border-ink shadow-comic-sm font-display py-2.5 rounded-md transition-all`
  - Cor ativa: `bg-comic-red text-primary-foreground`; inativa: `bg-card hover:bg-muted`

## 3. Componentes das Abas

### TabDetalhes

- [x] 3.1 Criar `src/components/biblioteca/TabDetalhes.tsx`:
  - Props: `details: MangaDetails`
  - **Sinopse:** 
    - Texto com `line-clamp-4` por padrão
    - Botão "Ver mais" / "Ver menos" para expandir/recolher (`useState<boolean>(false)`)
    - Ícone `ScrollText` ao lado do heading "Sinopse"
  - **Gêneros:** 
    - Flex wrap de badges com estilo `px-3 py-1 border-[2px] border-ink rounded-full font-display text-xs bg-comic-yellow`
  - **Informações:**
    - Grid de 2 colunas com:
      - Autor: ícone `User` + `details.author`
      - Status: badge colorido (`bg-comic-blue` se completo, `bg-comic-yellow` se em publicação)
      - Ano: ícone `Calendar` + `details.year`
      - Rating: estrelas mockadas + `details.rating`/10

### TabCapitulos

- [x] 3.2 Criar `src/components/biblioteca/TabCapitulos.tsx`:
  - Props: `chapters: CachedChapter[]`
  - Lista dentro de `ComicPanel bg="card" padding="sm"`
  - Cada item:
    - Número em destaque: `font-display text-lg` com fundo `bg-comic-yellow border-ink border-[2px] rounded-md px-2`
    - Título: `text-sm font-medium truncate`
    - Páginas: `text-xs text-muted-foreground` — "18 pgs" ou "—" se null
    - Data cache: `text-xs text-muted-foreground` — formato relativo (reutilizar `relativeTime`)
  - Separador: `border-b-2 border-dashed border-ink/20` entre itens
  - Se lista vazia: `SpeechBubble` "Nenhum capítulo em cache."

### TabConversoes

- [x] 3.3 Criar `src/components/biblioteca/TabConversoes.tsx`:
  - Props: `sourceId: string`
  - Mover a lógica existente de `biblioteca.$sourceId.tsx` para este componente:
    - `useConversionsList({ sourceId, limit: 50 })`
    - `useConversionActions()`
    - Renderização de `ConversionSummary[]` com status, progresso, ações
  - Loading: `Loader2 animate-spin`
  - Vazio: `SpeechBubble` "Nenhuma conversão encontrada."
  - Cada conversão: mesmo card da página atual com cover thumb, título, status badge, contadores, ações (ver log, cancelar, remover)

## 4. Página Principal — `biblioteca.$sourceId.tsx`

- [x] 4.1 Reescrever `routes/biblioteca.$sourceId.tsx` com novo layout:
  - Header: botão voltar (`ArrowLeft`) + título da série (derivado das conversões ou mock)
  - Grid de duas colunas: `grid md:grid-cols-[320px_1fr] gap-8`
  - Coluna esquerda: `MangaCover` + `ReadButton` + `FavoriteButton` (stack vertical `space-y-4`)
  - Coluna direita:
    - Título com `font-display text-3xl md:text-4xl uppercase text-center`
    - `Tabs defaultValue="detalhes"`:
      - `TabsList` estilizado com `border-[3px] border-ink rounded-lg shadow-comic-sm bg-muted w-full`
      - `TabsTrigger` para cada aba com estilo comic:
        - Ativa: `bg-comic-red text-primary-foreground`
        - Inativa: `hover:bg-muted`
        - `font-display text-sm`
      - `TabsContent value="detalhes"` → `<TabDetalhes details={mockDetails} />`
      - `TabsContent value="capitulos"` → `<TabCapitulos chapters={mockChapters} />`
      - `TabsContent value="conversoes"` → `<TabConversoes sourceId={sourceId} />`
- [x] 4.2 Estado local:
  ```typescript
  const [isFavorite, setIsFavorite] = useState(false);
  const [readingProgress] = useState<{ chapterNumber: string } | null>(null);
  ```
- [x] 4.3 Responsividade mobile:
  - Em `< md`: `grid-cols-1`, capa com `max-w-[280px] mx-auto`
  - Tabs em full-width
  - Botões de ação em full-width

## 5. Estilização das Tabs (Override Comic)

- [x] 5.1 Aplicar override de estilo nas Tabs para consistência com design system:
  - `TabsList`: `border-[3px] border-ink rounded-lg shadow-comic-sm bg-card p-1 w-full grid grid-cols-3`
  - `TabsTrigger`: Override via className para remover estilos default do Radix e aplicar:
    - `font-display text-sm uppercase py-2 rounded-md transition-all`
    - `data-[state=active]:bg-comic-red data-[state=active]:text-primary-foreground data-[state=active]:shadow-comic-sm data-[state=active]:border-[2px] data-[state=active]:border-ink`
  - `TabsContent`: `mt-4 animate-slide-up` para animação suave de entrada

## 6. Limpeza e Integração

- [x] 6.1 Remover o código antigo de `biblioteca.$sourceId.tsx` que será substituído (listagem flat de conversões)
- [x] 6.2 Manter os imports e helpers reutilizáveis (`statusLabel`, `statusColor`, `relativeTime`, `coverUrl`)
- [x] 6.3 Verificar que `routeTree.gen.ts` continua válido (TanStack Router auto-genera)

## 7. Verificação

- [x] 7.1 `pnpm lint` passa sem erros
- [x] 7.2 `pnpm build` (frontend) compila sem erros TypeScript
- [x] 7.3 Teste manual:
  1. Acessar `/biblioteca` → clicar em uma série existente → ver nova página de detalhes
  2. Verificar layout de duas colunas com capa + ações à esquerda
  3. Clicar em cada aba e verificar transição suave do conteúdo
  4. Aba "Detalhes": sinopse expandível, gêneros em badges, informações formatadas
  5. Aba "Capítulos": lista mockada com N capítulos exibidos
  6. Aba "Conversões": conversões reais carregam do backend com ações funcionais
  7. Botão "Favoritar": toggle funciona visualmente
  8. Responsividade: redimensionar para mobile → colunas empilham
  9. Botão voltar funciona
- [x] 7.4 Verificar acessibilidade:
  - Tabs navegáveis por teclado (Arrow Left/Right)
  - Aria labels nos botões

---

## Ordem de Implementação

```
1 (tipos e mocks) → 2 (componentes coluna esquerda)
  → 3 (componentes das abas) → 4 (página principal)
  → 5 (estilização tabs) → 6 (limpeza) → 7 (verificação)
```

---

## Arquivos Criados/Modificados

| Ação | Arquivo |
|------|---------|
| **CRIAR** | `src/lib/manga-detail-mocks.ts` |
| **CRIAR** | `src/types/manga-detail.ts` |
| **CRIAR** | `src/components/biblioteca/MangaCover.tsx` |
| **CRIAR** | `src/components/biblioteca/ReadButton.tsx` |
| **CRIAR** | `src/components/biblioteca/FavoriteButton.tsx` |
| **CRIAR** | `src/components/biblioteca/TabDetalhes.tsx` |
| **CRIAR** | `src/components/biblioteca/TabCapitulos.tsx` |
| **CRIAR** | `src/components/biblioteca/TabConversoes.tsx` |
| **MODIFICAR** | `src/routes/biblioteca.$sourceId.tsx` (reescrita completa) |
| **MODIFICAR** | `src/lib/utils.ts` (extrair `relativeTime`) |
| **MODIFICAR** | `src/routes/biblioteca.index.tsx` (usar `relativeTime` de utils) |
