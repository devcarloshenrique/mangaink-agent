# Chapter Status Indicators — Proposta

> **Status:** DRAFT
> **Data:** 2026-07-29
> **Módulos:** `scraping` + `reading` + `frontend`

---

## 1. Problema

### 1.1. Capítulos com páginas quebradas são invisíveis

Capítulos baixados podem ter páginas corrompidas ou ausentes (ex: capítulo 1 de Boruto Two Blue Vortex no MangaLivre não possui imagens). Hoje o usuário só descobre o problema ao abrir o reader e ver "Página indisponível". Não há indicador visual na lista de capítulos que antecipe essa informação.

### 1.2. Marcação de leitura é manual

O usuário precisa clicar no ícone de olho (`Eye`/`EyeOff`) para marcar cada capítulo como lido. Isso é inconveniente — a maioria dos apps de leitura marca automaticamente ao terminar de ler.

---

## 2. Solução Proposta

### 2.1. Indicador de qualidade por capítulo (Backend + Frontend)

**Backend:**
- Adicionar campo `brokenPageCount: number` ao tipo `Chapter`
- `GetSourceUseCase` computa via `sourceRepository.getPlaceholderIndices(sourceId, chapterId).length` (lê de `chapters.placeholder_page_indices` no PostgreSQL)
- Campo exposto no `chapterSchema` Zod da API

**Frontend — 3 estados visuais no `TabCapitulos`:**

| Estado | Condição | Ícone | Cor | Tooltip |
|--------|----------|-------|-----|---------|
| OK | `isDownloaded && brokenCount === 0` | `CheckCircle` | Verde | "Completo" |
| Parcial | `isDownloaded && 0 < brokenCount < (pages \|\| 1)` | `AlertTriangle` | Amarelo/âmbar | "X de Y páginas quebradas" |
| Quebrado | `isDownloaded && brokenCount >= (pages \|\| 1)` | `AlertCircle` | Vermelho | "Capítulo ilegível — X páginas quebradas" |
| Não baixado | `!isDownloaded` | `CloudOff` | Cinza | "Não baixado" |

### 2.2. Auto-marcação de leitura (Frontend)

- No `ChapterReader`, ao atingir a última página (`currentPage >= effectiveTotal - 1`):
  - Dispara `POST /api/reading/:sourceId/chapters/:chapterId` automaticamente
  - Fire-and-forget silencioso (sem toast, sem bloqueio de UI)
  - Usa `useRef` para garantir que dispara apenas 1x por sessão de leitura

---

## 3. Fluxo

```
/biblioteca/$sourceId → Aba "Capítulos"
│
├─ GET source/inspect/:sourceId → chapters: [{ ...chapter, brokenPageCount }]
│
├─ Lista de capítulos (cada linha):
│   ├─ ... (número, título, páginas — existente)
│   ├─ [👁 toggle lido] (existente)
│   └─ [índice de qualidade]:
│       ├─ CheckCircle verde → completo
│       ├─ AlertTriangle amarelo → parcial (tooltip: "X de Y páginas quebradas")
│       └─ AlertCircle vermelho → quebrado (tooltip: "ilegível")
│
└─ Reader (biblioteca.reader-chapter.$sourceId):
    ├─ Usuário navega entre páginas (existente)
    └─ Ao chegar na última página:
        └─ POST /api/reading/:sourceId/chapters/:chapterId (silencioso, 1x)
```

---

## 4. Escopo

### Incluído
- [ ] `brokenPageCount: number` no tipo `Chapter` (backend + frontend)
- [ ] `GetSourceUseCase` computa `brokenPageCount` via `sourceRepository.getPlaceholderIndices()`
- [ ] `chapterSchema` Zod atualizado com `brokenPageCount: z.number()`
- [ ] `TabCapitulos`: 4 estados de ícone (OK, parcial, quebrado, não baixado) com tooltip
- [ ] `ChapterReader`: auto-mark-read ao atingir última página (fire-and-forget)
- [ ] Testes unitários atualizados para `GetSourceUseCase`, `TabCapitulos`

### Excluído
- [ ] Re-download automático de páginas quebradas
- [ ] Indicador de qualidade na aba "Conversões"
- [ ] Sincronização do estado de leitura entre abas em tempo real
- [ ] Analytics de páginas quebradas

---

## 5. Critérios de Aceitação

1. Capítulos totalmente OK mostram `CheckCircle` verde
2. Capítulos com algumas páginas quebradas mostram `AlertTriangle` âmbar com tooltip "X de Y páginas quebradas"
3. Capítulos com todas as páginas quebradas mostram `AlertCircle` vermelho com tooltip "Capítulo ilegível"
4. `GET /api/conversions/source/inspect/:sourceId` retorna `brokenPageCount` por capítulo
5. Ao chegar na última página do reader, capítulo é marcado como lido automaticamente
6. Auto-marcação não gera toast de erro ou sucesso (silenciosa)
7. Auto-marcação dispara apenas 1x por capítulo por sessão de leitura

---

## 6. Dependências

- `SourceCacheRepository.getPlaceholderIndices()` (já existe — `PrismaSourceRepository`)
- `readingApi.markRead()` (já implementado — módulo `reading`)
- `ChapterReader.tsx` (já tem `currentPage`, `effectiveTotal`)
- `lucide-react` (já instalado — ícones `AlertCircle`, `AlertTriangle`)
