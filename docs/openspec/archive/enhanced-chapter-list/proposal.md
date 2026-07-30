# Enhanced Chapter List — Proposta

> **Status:** COMPLETED
> **Data:** 2026-07-28
> **Módulo:** `reading` (novo) + `scraping` + `frontend`

---

## 1. Problema

A aba "Capítulos" da página de detalhes do mangá (`biblioteca.$sourceId`) oferece apenas:
- Número e título do capítulo com busca textual
- Indicador binário de download (CheckCircle verde / CloudOff cinza)
- Clique para ler (se baixado) ou dialog de download

Não há tracking de leitura, ações em lote, ordenação, filtros rápidos, nem gestão de cache por capítulo. O botão "Começar a ler" é um no-op visual.

---

## 2. Solução Proposta

### 2.1. Tracking de Leitura (Backend)

Nova tabela `user_chapter_progress` que registra quais capítulos o usuário já leu:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `userId` | UUID | FK → users.id |
| `sourceId` | VARCHAR(255) | FK → sources.source_id |
| `chapterId` | VARCHAR(100) | FK → chapters.chapter_id |
| `readAt` | Timestamptz | Quando foi marcado como lido |
| `createdAt` | Timestamptz | Criado em |

Constraint única: `@@unique([userId, sourceId, chapterId])`

**Novos endpoints:**

| Método | Path | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api/reading/:sourceId/chapters/:chapterId` | Sim | Marca capítulo como lido |
| `DELETE` | `/api/reading/:sourceId/chapters/:chapterId` | Sim | Desmarca capítulo como lido |
| `GET` | `/api/reading/:sourceId` | Sim | Lista progresso: `{ readChapterIds: string[] }` |
| `PUT` | `/api/reading/:sourceId/batch` | Sim | Marca/desmarca múltiplos capítulos |

> **Decisão de design:** Marcar e desmarcar são operações separadas (`POST` + `DELETE`) em vez de um toggle único via `PUT`. Isso garante idempotência HTTP: marcar duas vezes o mesmo capítulo é seguro (retorna 200 com `isRead: true`), e desmarcar duas vezes também (retorna 200 com `isRead: false`).

`GET /api/conversions/source/inspect/:sourceId` retorna `isRead: boolean` por capítulo (injetado pelo `GetSourceUseCase` cruzando com `user_chapter_progress`).

### 2.2. Indicadores Visuais (Frontend — TabCapitulos)

- Capítulos lidos: texto acinzentado (`text-muted-foreground`), opacidade reduzida
- Capítulos não lidos: texto normal, título em **negrito** (`font-semibold`)
- Ícone de "olho" (`Eye`/`EyeOff`) na linha para toggle rápido de leitura

### 2.3. Botão "Continuar Leitura" (Frontend)

`ReadButton` deixa de ser no-op. Ao carregar a página, busca `GET /api/reading/:sourceId`:
- Se houver capítulos lidos → botão "Continuar lendo cap X" navega para o primeiro capítulo **não lido que esteja baixado**
- Se todos lidos → botão "Re-ler cap 1"
- Se nenhum lido → botão "Começar a ler" → vai para o capítulo 1
- Estado de loading com `Loader2` enquanto a API responde

> **Importante:** O "primeiro não lido" considera apenas capítulos já baixados (`isDownloaded: true`). Isso evita que o usuário seja levado a um capítulo que precisa ser baixado primeiro, o que seria confuso no contexto de "continuar lendo".

### 2.4. Ordenação Crescente/Decrescente (Frontend — TabCapitulos)

Botão toggle no topo da lista (ícone `ArrowUpDown` / `ArrowDownUp`):
- Estado local `useState<'asc' | 'desc'>('asc')`
- `asc`: capítulo 1 → N (padrão)
- `desc`: capítulo N → 1 (útil para quem acompanha lançamentos)

### 2.5. Filtros Rápidos (Frontend — TabCapitulos)

Chips/clique horizontal entre a barra de busca e a lista:

| Filtro | Label | Lógica |
|---|---|---|
| Todos | "Todos (N)" | Sem filtro |
| Não Lidos | "Não lidos (M)" | `chapter.isRead === false` — **depende do tracking** |
| Baixados | "Baixados (K)" | `chapter.isDownloaded === true` — **funciona hoje** |

Badge com contagem ao lado de cada label. Animação de transição entre filtros.

### 2.6. Gerenciamento de Download por Capítulo (Backend + Frontend)

**Novo endpoint:**

| Método | Path | Auth | Descrição |
|---|---|---|---|
| `DELETE` | `/api/sources/:sourceId/chapters/:chapterId/cache` | Sim | Remove imagens do disco |

**Frontend:** Clique no ícone de download (CheckCircle) abre um menu dropdown com:
- "Abrir" → navega para o reader
- "Apagar do disco" → chama DELETE, recarrega `isDownloaded`

### 2.7. Seleção Múltipla + Ações em Lote (Frontend + Backend)

**Frontend:** Checkbox na linha de cada capítulo. Modo seleção ativado por:
- **Desktop:** Botão "Selecionar" no cabeçalho da lista
- **Mobile:** Long-press (>500ms) em qualquer linha de capítulo **ou** botão "Selecionar"

Checkbox "Selecionar todos" no cabeçalho.

Barra de ações flutuante (sticky bottom) quando há itens selecionados:
- "Marcar N como lidos" → `PUT /api/reading/:sourceId/batch`
- "Baixar N capítulos" → loop `chaptersApi.download()` (com feedback de progresso via toast)
- "Apagar N do disco" → loop `DELETE .../cache`

Sai do modo seleção ao clicar em "Cancelar" ou após ação concluída.

> **Feedback visual:** Ações em lote usam `toast.loading()` com atualização progressiva (ex: "Baixando 3/10 capítulos...") e finalizam com `toast.success()` ou `toast.error()` com contagem de falhas parciais.

### 2.8. Refatoração do `isRead` no Capítulo

`TabCapitulos` recebe `readChapterIds: Set<string>` como prop. A página `biblioteca.$sourceId` busca `GET /api/reading/:sourceId` e deriva esse Set. O `TabCapitulos` cruza internamente para decidir cor/ícone.

---

## 3. Fluxo Completo

```
/biblioteca/$sourceId → Aba "Capítulos"
│
├─ GET /api/reading/:sourceId → { readChapterIds: [...] }
├─ GET /api/conversions/source/inspect/:sourceId → { chapters: [...], isDownloaded, isRead }
│
├─ ReadButton funcional
│   ├─ Nenhum lido → "Começar a ler" → reader cap 1
│   ├─ Alguns lidos → "Continuar lendo cap X" → primeiro não lido E baixado
│   └─ Todos lidos → "Re-ler cap 1" → reader cap 1
│
├─ Filtros: [Todos (N)] [Não lidos (M)] [Baixados (K)]
├─ Ordenação: asc ↔ desc toggle
├─ Barra de busca (existente)
│
├─ Lista de capítulos (cada linha):
│   ├─ [checkbox] (modo seleção)
│   ├─ Número (badge amarelo)
│   ├─ Título (acinzentado se lido, bold se não)
│   ├─ Páginas
│   ├─ [👁 toggle lido/não lido] → POST/DELETE /api/reading/...
│   └─ [📥 status download] → menu dropdown (abrir / apagar do disco)
│
└─ Barra de ações em lote (sticky, condicional):
    ├─ "Marcar N como lidos"
    ├─ "Baixar N capítulos" (com toast progressivo)
    └─ "Apagar N do disco"
```

---

## 4. Escopo

### Incluído
- [ ] Tabela `user_chapter_progress` + migration Prisma
- [ ] `UserChapterProgressRepository` (Prisma)
- [ ] `POST /api/reading/:sourceId/chapters/:chapterId` (marcar como lido)
- [ ] `DELETE /api/reading/:sourceId/chapters/:chapterId` (desmarcar)
- [ ] `GET /api/reading/:sourceId` (listar progresso)
- [ ] `PUT /api/reading/:sourceId/batch` (marcar/desmarcar em lote)
- [ ] Middleware `verifyJwtOptional` para GET source público com `isRead` condicional
- [ ] Injeção de `isRead` no `GetSourceUseCase` (refatorado com DI via construtor)
- [ ] `isRead: z.boolean()` no `chapterSchema` Zod do `scraping.routes.ts`
- [ ] `DELETE /api/sources/:sourceId/chapters/:chapterId/cache` (via `ChapterImageService.deleteCache()`)
- [ ] `ReadButton` funcional com loading e estados
- [ ] Indicadores visuais de lido/não lido no `TabCapitulos`
- [ ] Ícone toggle "marcar como lido" por capítulo (POST/DELETE)
- [ ] Ordenação crescente/decrescente
- [ ] Chips de filtro: "Todos", "Não Lidos", "Baixados"
- [ ] Menu dropdown no ícone de download (abrir/apagar)
- [ ] Seleção múltipla com checkboxes
- [ ] Barra de ações em lote (marcar lidos, baixar, apagar) com toast progressivo
- [ ] Hook `useReadingProgress` para TanStack Query (com optimistic update + rollback)
- [ ] TypeScript types para `Chapter.isRead`
- [ ] Acessibilidade: aria-labels em checkboxes, toggles, filtros e dropdowns

### Excluído
- [ ] Atalho de conversão por capítulo (ReconvertDialog supre)
- [ ] Data de adição do capítulo (conceito não mapeia bem)
- [ ] Favoritos (fora de escopo — já existe mockado)
- [ ] Sincronização de leitura entre dispositivos
- [ ] Analytics de leitura (tempo, heatmap, etc.)
- [ ] Modo noturno só para o reader
- [ ] Virtualização para listas >500 capítulos (futuro)

---

## 5. Critérios de Aceitação

1. Capítulos lidos aparecem visualmente diferentes (acinzentados) dos não lidos
2. Clicar no ícone de olho marca/desmarca o capítulo com optimistic update e rollback em caso de erro
3. `ReadButton` mostra "Começar a ler" quando zero lidos; "Continuar lendo cap X" quando há progresso (navega para primeiro não lido **e baixado**); "Re-ler" quando todos lidos
4. Ordenação asc/desc funciona e persiste durante a sessão (não precisa sobreviver a refresh)
5. Filtro "Baixados" mostra apenas capítulos com `isDownloaded: true` — funciona sem backend
6. Filtro "Não Lidos" mostra apenas capítulos com `isRead: false` — funciona após tracking implementado
7. Clicar no ícone CheckCircle abre menu com "Abrir" e "Apagar do disco"
8. "Apagar do disco" remove imagens e atualiza o ícone para CloudOff
9. Modo seleção: checkboxes aparecem, selecionar itens mostra barra de ações flutuante
10. Ação "Marcar N como lidos" chama batch endpoint e atualiza UI
11. Batch download exibe toast progressivo e reporta falhas parciais
12. Migration roda sem erros em banco limpo e com dados existentes
13. `GET /api/conversions/source/inspect/:sourceId` retorna `isRead` por capítulo (campo novo)
14. Requests anônimos ao GET source continuam funcionando (isRead: false para todos)
15. Todos os componentes interativos têm aria-labels apropriados

---

## 6. Dependências

- **Prisma** (migration + modelo novo)
- **Redis** (não usado — tracking é via PostgreSQL direto)
- **BullMQ** (não usado — downloads individuais já têm fila)
- **TanStack Query** (novo hook `useReadingProgress`)
- `TabCapitulos` (modificado)
- `ReadButton` (modificado)
- `biblioteca.$sourceId` (modificado)
- `GetSourceUseCase` (refatorado — DI via construtor + injeta `isRead`)
- `ChapterImageService` (modificado — novo método `deleteCache`)
- `verify-jwt.ts` (modificado — novo `verifyJwtOptional`)
