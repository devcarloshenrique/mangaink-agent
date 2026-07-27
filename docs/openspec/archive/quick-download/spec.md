# Quick Download — Especificação

> **Status:** DRAFT
> **Data:** 2026-07-25
> **Módulo:** `conversion`

---

## Purpose

Permitir que o usuário baixe imagens de capítulos de mangá para o cache local sem gerar arquivos de e-reader. O fluxo é acionado a partir da biblioteca via barra de URL inline expansível, seguido de um modal com layout em 2 colunas para seleção de capítulos.

---

## Requirements

### Requirement: Botão "Adicionar obra" na biblioteca
The system MUST display an "Adicionar obra" button next to the existing "Converter novo" button.

#### Scenario: Botão visível
- **WHEN** o usuário acessa `/biblioteca`
- **THEN** o botão "Adicionar obra" é exibido ao lado do botão "Converter novo"
- **THEN** o botão usa cor azul (`bg-comic-blue`) e ícone `BookPlus`

#### Scenario: Clique expande barra de URL
- **WHEN** o usuário clica em "Adicionar obra"
- **THEN** uma barra de URL inline (`InlineUrlBar`) expande abaixo do cabeçalho
- **THEN** exibe campo de input para URL + botão "Buscar"

### Requirement: Barra de URL inline
The system MUST provide an expandable URL input bar for scraping.

#### Scenario: Input de URL
- **WHEN** a barra está expandida
- **THEN** exibe input de URL com placeholder
- **THEN** exibe botão "Buscar"

#### Scenario: Scraping em andamento
- **WHEN** o usuário clica em "Buscar" com URL válida
- **THEN** chama `scrapingApi.inspect(url)`
- **THEN** exibe `SpeechBubble` com progresso do scraping

#### Scenario: Cache hit
- **WHEN** o scraping retorna `status: "ready"` (HTTP 200)
- **THEN** o modal `AddMangaDialog` abre com os metadados carregados
- **THEN** exibe layout 2 colunas: capa/metadados à esquerda, capítulos à direita

#### Scenario: Cache miss
- **WHEN** o scraping retorna `status: "processing"` (HTTP 202)
- **THEN** a barra abre SSE para acompanhar progresso
- **THEN** ao receber `completed`, carrega metadados e abre `AddMangaDialog`
- **THEN** ao receber `failed`, exibe mensagem de erro na barra

#### Scenario: Erro no scraping
- **WHEN** o scraping falha
- **THEN** exibe `SpeechBubble` vermelho com mensagem de erro na barra inline
- **THEN** exibe botão "Tentar novamente"

#### Scenario: Fechar barra
- **WHEN** o usuário clica novamente em "Adicionar obra" ou em um botão de fechar
- **THEN** a barra de URL colapsa

### Requirement: Modal de adição de obra
The system MUST present a modal dialog with a two-column layout for chapter selection.

#### Scenario: Layout 2 colunas
- **WHEN** o modal abre
- **THEN** coluna esquerda exibe: capa da obra, autor, ano, status, nota
- **THEN** coluna direita exibe: título, título alternativo, gêneros, sinopse
- **THEN** abaixo da sinopse: busca de capítulos e lista selecionável

#### Scenario: Busca de capítulos
- **WHEN** o modal está aberto
- **THEN** exibe campo de busca "Buscar capítulo…" com ícone de lupa
- **THEN** filtrar atualiza a lista em tempo real
- **THEN** capítulo sem match é ocultado

#### Scenario: Lista de capítulos
- **WHEN** a lista é exibida
- **THEN** cada item mostra: checkbox + badge com número + título + contagem de páginas
- **THEN** botão "Selecionar todos" / "Limpar seleção" no topo da lista
- **THEN** lista com scroll (max-height 300px) e bordas tracejadas entre itens

#### Scenario: Seleção de capítulos
- **WHEN** o usuário seleciona/deseleciona capítulos
- **THEN** o rodapé atualiza badge: "N SELECIONADOS" com variante azul
- **THEN** rodapé mostra total estimado de páginas: "~N páginas"
- **THEN** checkbox selecionado fica azul com ícone de check

#### Scenario: Confirmar download
- **WHEN** o usuário seleciona capítulos e clica "Baixar capítulos"
- **THEN** o sistema chama `POST /api/conversions` com `downloadOnly: true`
- **THEN** ao receber `202 { conversionId }`, o modal fecha
- **THEN** o usuário é redirecionado para `/biblioteca/converter/$conversionId`

#### Scenario: Botão desabilitado sem seleção
- **WHEN** nenhum capítulo está selecionado
- **THEN** o botão "Baixar capítulos" fica disabled

### Requirement: API de criação com downloadOnly
The `POST /api/conversions` endpoint MUST support download-only conversions.

#### Scenario: Criação download-only bem-sucedida
- **WHEN** o frontend envia `sourceId`, `downloadOnly: true`, `books: [{ title, chapters }]` e `errorHandlingStrategy`
- **THEN** o Planner valida `sourceId`
- **THEN** o Planner valida que todos os capítulos existem
- **THEN** o Planner não exige `output` (deviceId/format)
- **THEN** cria uma `Conversion` com `downloadOnly: true`
- **THEN** gera 1 `ConversionJob` com `downloadOnly: true`
- **THEN** enfileira o job na fila `download-only`
- **THEN** retorna `202` com `conversionId`, `status: "queued"`, `totalJobs: 1`

#### Scenario: Criação normal continua funcionando
- **WHEN** o frontend envia `downloadOnly: false` ou ausente
- **THEN** o comportamento é idêntico ao atual
- **THEN** `output` continua obrigatório
- **THEN** o job é enfileirado na fila `conversion-job`

#### Scenario: SourceId inexistente
- **WHEN** `sourceId` não existe
- **THEN** retorna `404` com `SourceNotFoundError`

#### Scenario: Capítulo inexistente
- **WHEN** um `chapterId` não existe nos metadados
- **THEN** retorna `404` com `ChapterNotFoundError`

#### Scenario: Books vazio
- **WHEN** `books` está vazio ou todo book tem `chapters` vazio
- **THEN** retorna `400` com erro de validação

#### Scenario: output obrigatório para conversão normal
- **WHEN** `downloadOnly` é false/ausente e `output` não é enviado
- **THEN** retorna `400` com erro de validação

### Requirement: Fila e worker dedicados
The system MUST use a dedicated BullMQ queue for download-only jobs.

#### Scenario: Fila download-only existe
- **WHEN** o backend inicia
- **THEN** a fila `download-only` é registrada e seu worker é iniciado
- **THEN** a fila usa `concurrency: 3` (diferente da fila `conversion-job`)

#### Scenario: Job enfileirado na fila correta
- **WHEN** uma conversion download-only é criada
- **THEN** o job é adicionado à fila `download-only`
- **THEN** NÃO é adicionado à fila `conversion-job`

#### Scenario: Cancelamento funciona
- **WHEN** o usuário cancela uma conversion download-only
- **THEN** o job é removido da fila `download-only` ou marcado como cancelado
- **THEN** status da conversion é atualizado

### Requirement: Worker download-only executa apenas downloads
The download-only worker MUST download images and skip conversion phases.

#### Scenario: Worker executa apenas fase de download
- **WHEN** o worker processa um job `downloadOnly: true`
- **THEN** executa download dos capítulos selecionados
- **THEN** emite eventos `download.chapter.started`, `download.progress`, `download.chapter.finished`
- **THEN** NÃO executa hard links, ComicInfo.xml, KCC, packaging
- **THEN** NÃO emite eventos `conversion.started`, `conversion.progress`, `conversion.finished`
- **THEN** ao concluir, emite `job.finished` com `downloadOnly: true`
- **THEN** marca o job como `completed`

#### Scenario: Worker trata capítulos corrompidos
- **WHEN** `errorHandlingStrategy` é `"ignore"`
- **THEN** gera placeholders e continua
- **WHEN** `errorHandlingStrategy` é `"skip_chapter"`
- **THEN** pula o capítulo e continua
- **WHEN** `errorHandlingStrategy` é `"abort"`
- **THEN** cancela o job com erro

#### Scenario: Capítulo indisponível
- **WHEN** um capítulo retorna 404 ou não tem imagens
- **THEN** o capítulo é marcado como skipped
- **THEN** o job continua com os capítulos disponíveis
- **THEN** se nenhum capítulo puder ser baixado, o job falha

### Requirement: Página de progresso adaptada
The conversion progress page MUST show only the download stage for download-only conversions.

#### Scenario: Apenas 1 stage card
- **WHEN** o usuário acessa progresso de uma conversion download-only
- **THEN** exibe apenas o stage card "Baixando capítulos"
- **THEN** NÃO exibe stage card "Convertendo páginas"

#### Scenario: Barra de progresso 0-100%
- **WHEN** o download está em andamento
- **THEN** a barra geral reflete `processedChapters / totalChapters * 100`
- **THEN** não há split 50/50

#### Scenario: SpeechBubble com detalhes
- **WHEN** um capítulo está sendo baixado
- **THEN** exibe "Baixando Capítulo N — X/Y imagens"

#### Scenario: Fila de capítulos
- **WHEN** a página de progresso é exibida
- **THEN** mostra lista de capítulos com ícones de status:
  - CheckCircle2 (verde): concluído
  - Loader2 (animado): em andamento
  - Clock (cinza): pendente

#### Scenario: Terminal de logs
- **WHEN** o usuário abre o terminal
- **THEN** exibe eventos de download
- **THEN** NÃO exibe eventos de KCC/conversão

#### Scenario: Estado concluído
- **WHEN** todos os capítulos são baixados
- **THEN** barra atinge 100%
- **THEN** exibe badge "DONE!"
- **THEN** botão "Ver na biblioteca" redireciona para `/biblioteca`

### Requirement: Integração com a biblioteca
Download-only conversions MUST appear in the library listing.

#### Scenario: Aparece na listagem
- **WHEN** um download-only é concluído
- **THEN** a obra aparece na biblioteca agrupada por `sourceId`
- **THEN** o grupo pode conter tanto downloads quanto conversões normais

#### Scenario: Tabs funcionam
- **WHEN** um download-only está em andamento
- **THEN** aparece na tab "Em Andamento"
- **WHEN** concluído
- **THEN** aparece na tab "Concluídas"

#### Scenario: Navegação para detalhe
- **WHEN** o usuário clica na obra
- **THEN** navega para `/biblioteca/$sourceId`
- **THEN** a aba "Capítulos" mostra os capítulos baixados

---

## NOT YET IMPLEMENTED (Future Enhancements)

- Seleção de errorHandlingStrategy no modal
- Indicador visual de capítulos já em cache antes de iniciar
- Ação de re-download de capítulos específicos
- Botão de "Ler agora" diretamente após download
