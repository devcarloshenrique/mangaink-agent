# manga-detail Specification

## Purpose
Pagina de detalhes ricos para um manga na biblioteca (`/biblioteca/$sourceId`) com layout de duas colunas, abas de navegacao e dados mockados preparados para integracao futura com endpoints reais.

## ADDED Requirements

### Requirement: Layout de Duas Colunas com Capa e Abas

A pagina `/biblioteca/$sourceId` SHALL exibir um layout de duas colunas: a coluna esquerda contem a capa e botoes de acao; a coluna direita contem o titulo e menu de abas com conteudo dinamico.

#### Scenario: Usuario acessa a pagina de detalhes de um manga
- **WHEN** o usuario autenticado navega para `/biblioteca/{sourceId}`
- **THEN** o layout SHALL ser renderizado em grid de duas colunas (`grid md:grid-cols-[320px_1fr]`)
- **AND** a coluna esquerda SHALL conter `MangaCover`, `ReadButton` e `FavoriteButton` em stack vertical
- **AND** a coluna direita SHALL conter o titulo do manga e o menu de abas (`Tabs`)

#### Scenario: Usuario acessa a pagina em dispositivo mobile
- **WHEN** o viewport tem largura inferior a `md` (768px)
- **THEN** as colunas SHALL empilhar verticalmente (`grid-cols-1`)
- **AND** a capa SHALL ter largura maxima de 280px e ser centralizada horizontalmente
- **AND** os botoes de acao SHALL ocupar largura total

---

### Requirement: Exibicao da Capa do Manga com Fallback

A capa do manga SHALL ser exibida com proporcao 2:3 usando a URL de capa disponivel na API. Caso a imagem falhe ao carregar, um fallback visual SHALL ser exibido.

#### Scenario: Capa carrega com sucesso
- **WHEN** `conversionsApi.coverUrl(sourceId, { kind: "original" })` retorna uma URL valida
- **THEN** a imagem SHALL ser renderizada com `aspect-[2/3]` dentro de um container com `border-[3px] border-ink rounded-xl shadow-comic overflow-hidden`
- **AND** a imagem SHALL usar `loading="lazy"`

#### Scenario: Capa falha ao carregar
- **WHEN** a imagem dispara o evento `onError`
- **THEN** um fallback SHALL ser exibido: `ComicPanel bg="halftone"` com icone `BookOpen` centralizado em `opacity-30`

---

### Requirement: Botao Comecar a Ler / Continuar Lendo

O botao primario de leitura SHALL adaptar seu texto e comportamento com base no progresso de leitura mockado.

#### Scenario: Usuario sem progresso de leitura
- **WHEN** `readingProgress` e `null`
- **THEN** o botao SHALL exibir o icone `Play` e o texto "Comecar a ler"
- **AND** o clique SHALL ser noop (sem rota de leitura por capitulo avulso disponivel)

#### Scenario: Usuario com progresso de leitura mockado
- **WHEN** `readingProgress` contem `{ chapterNumber: "5" }`
- **THEN** o botao SHALL exibir o icone `Play` e o texto "Continuar lendo cap 5"
- **AND** o clique SHALL ser noop

#### Scenario: Estilizacao do botao de leitura
- **WHEN** o botao e renderizado
- **THEN** ele SHALL usar `w-full bg-comic-red text-primary-foreground border-[3px] border-ink shadow-comic font-display text-lg py-3 rounded-md hover:-translate-y-0.5 transition-transform`

---

### Requirement: Botao Favoritar com Toggle Mockado

O botao de favoritar SHALL alternar entre estado favoritado e nao-favoritado usando estado local (`useState`), sem persistencia no backend.

#### Scenario: Manga nao esta favoritado
- **WHEN** `isFavorite` e `false`
- **THEN** o botao SHALL exibir o icone `Heart` (outline) e o texto "Favoritar"
- **AND** o botao SHALL usar estilo `bg-card hover:bg-muted`

#### Scenario: Usuario clica para favoritar
- **WHEN** o usuario clica no botao com `isFavorite === false`
- **THEN** `isFavorite` SHALL alternar para `true`
- **AND** o botao SHALL exibir o icone `Heart` com `fill="currentColor"` e o texto "Favoritado"
- **AND** o botao SHALL usar estilo `bg-comic-red text-primary-foreground`

#### Scenario: Usuario clica para desfavoritar
- **WHEN** o usuario clica no botao com `isFavorite === true`
- **THEN** `isFavorite` SHALL alternar para `false`
- **AND** o botao SHALL retornar ao estado visual de nao-favoritado

#### Scenario: Estilizacao do botao de favoritar
- **WHEN** o botao e renderizado
- **THEN** ele SHALL usar `w-full border-[3px] border-ink shadow-comic-sm font-display py-2.5 rounded-md transition-all`

---

### Requirement: Menu de Abas com Navegacao entre Detalhes, Capitulos e Conversoes

O menu de abas SHALL permitir navegacao entre tres secoes: Detalhes (mockado), Capitulos (mockado) e Conversoes (dados reais da API). A aba ativa SHALL ser destacada visualmente com o design system comic.

#### Scenario: Abas sao renderizadas com labels corretos
- **WHEN** a pagina carrega
- **THEN** tres abas SHALL ser exibidas: "Detalhes", "Capitulos (N)", "Conversoes"
- **AND** "Detalhes" SHALL ser a aba ativa por padrao (`defaultValue="detalhes"`)

#### Scenario: Aba ativa tem destaque visual comic
- **WHEN** uma aba esta no estado `data-[state=active]`
- **THEN** ela SHALL usar `bg-comic-red text-primary-foreground shadow-comic-sm border-[2px] border-ink`
- **AND** as abas inativas SHALL usar `hover:bg-muted`

#### Scenario: TabsList tem estilo comic
- **WHEN** o `TabsList` e renderizado
- **THEN** ele SHALL usar `border-[3px] border-ink rounded-lg shadow-comic-sm bg-card p-1 w-full grid grid-cols-3`

#### Scenario: TabsContent anima entrada
- **WHEN** o conteudo de uma aba e exibido
- **THEN** o `TabsContent` SHALL usar `mt-4 animate-slide-up` para transicao suave

#### Scenario: Label de Capitulos exibe contagem mockada
- **WHEN** `MOCK_CACHED_CHAPTERS` contem 8 capitulos
- **THEN** o label da aba SHALL exibir "Capitulos (8)"

---

### Requirement: Aba Detalhes com Dados Mockados

A aba "Detalhes" SHALL exibir informacoes da obra (sinopse, generos, autor, status, ano, rating) oriundas de dados mockados na constante `MOCK_MANGA_DETAILS`, sem chamada a API.

#### Scenario: Sinopse e exibida com toggle expandir/recolher
- **WHEN** o usuario visualiza a aba Detalhes
- **THEN** a sinopse SHALL ser exibida com `line-clamp-4` por padrao
- **AND** um botao "Ver mais" SHALL estar visivel abaixo do texto truncado
- **AND** ao clicar "Ver mais", o texto SHALL expandir completamente e o botao SHALL mudar para "Ver menos"
- **AND** ao clicar "Ver menos", o texto SHALL retornar ao estado truncado

#### Scenario: Generos sao exibidos como badges estilizados
- **WHEN** `MOCK_MANGA_DETAILS.genres` contem `["Acao", "Drama", "Fantasia", "Shounen"]`
- **THEN** cada genero SHALL ser renderizado como um badge com `px-3 py-1 border-[2px] border-ink rounded-full font-display text-xs bg-comic-yellow`
- **AND** os badges SHALL ser dispostos em flex wrap

#### Scenario: Informacoes da obra sao exibidas em grid
- **WHEN** o usuario visualiza a aba Detalhes
- **THEN** um grid de 2 colunas SHALL exibir:
  - Autor (icone `User` + `details.author`)
  - Status (badge colorido: `bg-comic-blue` se completo, `bg-comic-yellow` se em publicacao)
  - Ano (icone `Calendar` + `details.year`)
  - Rating (estrelas mockadas + `details.rating`/10)

#### Scenario: Dados mockados tem estrutura compativel com API futura
- **WHEN** a interface `MangaDetails` e definida
- **THEN** seus campos SHALL corresponder aos campos de `MangaMetadata` do tipo `scraping.ts`
- **AND** cada mock SHALL conter um comentario `// TODO: substituir por chamada API quando endpoint disponivel`

---

### Requirement: Aba Capitulos com Listagem Mockada de Cache

A aba "Capitulos" SHALL exibir uma lista de capitulos em cache oriunda da constante mockada `MOCK_CACHED_CHAPTERS`, sem chamada a API. A lista vazia SHALL exibir mensagem informativa.

#### Scenario: Lista de capitulos e exibida
- **WHEN** `MOCK_CACHED_CHAPTERS` contem 8 capitulos
- **THEN** cada capitulo SHALL ser renderizado dentro de `ComicPanel bg="card" padding="sm"`
- **AND** cada item SHALL exibir: numero em destaque (`font-display text-lg` com fundo `bg-comic-yellow border-ink`), titulo, contagem de paginas e data de cache
- **AND** os itens SHALL ser separados por `border-b-2 border-dashed border-ink/20`

#### Scenario: Contagem de paginas ausente
- **WHEN** um capitulo tem `pages: null`
- **THEN** a contagem de paginas SHALL exibir "—" em vez de um numero

#### Scenario: Data de cache em formato relativo
- **WHEN** um capitulo tem `cachedAt` definido
- **THEN** a data SHALL ser exibida em formato relativo usando o utilitario `relativeTime`

#### Scenario: Lista de capitulos vazia
- **WHEN** `MOCK_CACHED_CHAPTERS` e um array vazio
- **THEN** um `SpeechBubble` SHALL exibir a mensagem "Nenhum capitulo em cache."

---

### Requirement: Aba Conversoes com Dados Reais da API

A aba "Conversoes" SHALL exibir conversoes reais do backend via `useConversionsList({ sourceId })`, reutilizando os hooks e componentes de acao ja existentes (`useConversionActions`).

#### Scenario: Conversoes sao carregadas da API
- **WHEN** o usuario seleciona a aba "Conversoes"
- **THEN** `useConversionsList({ sourceId, limit: 50 })` SHALL ser chamado
- **AND** enquanto carrega, um spinner `Loader2 animate-spin` SHALL ser exibido
- **AND** ao carregar, a lista de `ConversionSummary[]` SHALL ser renderizada com status, progresso, data e acoes

#### Scenario: Acoes de conversao funcionam
- **WHEN** as conversoes sao exibidas
- **THEN** cada card SHALL incluir botoes de acao via `useConversionActions()`: cancelar, remover, reconverter, ver log
- **AND** as acoes SHALL funcionar identicamente a pagina atual de biblioteca

#### Scenario: Nenhuma conversao encontrada
- **WHEN** `useConversionsList` retorna um array vazio
- **THEN** um `SpeechBubble` SHALL exibir a mensagem "Nenhuma conversao encontrada."

---

### Requirement: Navegacao de Volta

O header da pagina SHALL conter um botao de voltar que retorna o usuario a pagina anterior ou a listagem da biblioteca.

#### Scenario: Botao voltar e clicado
- **WHEN** o usuario clica no botao com icone `ArrowLeft`
- **THEN** o usuario SHALL ser redirecionado para a rota `/biblioteca`

---

### Requirement: Isolamento de Dados Mockados

Todos os dados mockados SHALL ser definidos em um arquivo separado (`src/lib/manga-detail-mocks.ts`) com interfaces TypeScript explicitas, facilitando a substituicao futura por chamadas reais de API.

#### Scenario: Mocks estao em arquivo dedicado
- **WHEN** o desenvolvedor inspeciona o codigo
- **THEN** as constantes `MOCK_MANGA_DETAILS` e `MOCK_CACHED_CHAPTERS` SHALL estar definidas exclusivamente em `src/lib/manga-detail-mocks.ts`
- **AND** as interfaces `MangaDetails` e `CachedChapter` SHALL estar definidas em `src/types/manga-detail.ts`
- **AND** cada mock SHALL conter comentarios `// TODO` indicando o endpoint futuro correspondente

#### Scenario: Tipos mockados sao compativeis com tipos reais futuros
- **WHEN** as interfaces mockadas sao definidas
- **THEN** `MangaDetails` SHALL ser estruturalmente identico a `MangaMetadata` do tipo `scraping.ts`
- **AND** `CachedChapter` SHALL conter os campos `id`, `number`, `title`, `pages`, `cachedAt`

---

### Requirement: Consistencia Visual com Design System Comic

Todos os componentes novos SHALL seguir o design system comic-pop-art, utilizando as variaveis CSS (`--comic-*`), classes utilitarias (`border-ink`, `shadow-comic`, `font-display`) e componentes existentes (`ComicPanel`, `SpeechBubble`, `OnomatopoeiaBadge`).

#### Scenario: Componentes usam primitivos do design system
- **WHEN** qualquer componente novo e renderizado
- **THEN** ele SHALL usar `border-ink` para bordas, `shadow-comic` ou `shadow-comic-sm` para sombras
- **AND** textos de destaque SHALL usar `font-display`
- **AND** containers SHALL usar `ComicPanel` ou `bg-card` conforme apropriado

#### Scenario: Botoes tem efeito hover consistente
- **WHEN** o usuario passa o mouse sobre um botao de acao
- **THEN** o botao SHALL aplicar `hover:-translate-y-0.5 transition-transform`
