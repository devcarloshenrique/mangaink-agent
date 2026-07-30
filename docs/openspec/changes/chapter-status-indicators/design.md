# Chapter Status Indicators — Design de Arquitetura

> **Status:** DRAFT
> **Data:** 2026-07-29

---

## 1. Motivação

Duas melhorias de UX complementares: (a) informar o usuário sobre capítulos com problemas de download **antes** de abrir o reader, e (b) eliminar o passo manual de marcar capítulos como lidos.

---

## 2. Modelo de Dados

### 2.1. Campo `brokenPageCount` no tipo `Chapter`

```typescript
// Backend: scraping/types/source.types.ts
export interface Chapter {
  id: string
  number: string
  title: string
  url: string
  pages: number | null
  volume: number | null
  isDownloaded: boolean
  isRead: boolean
  brokenPageCount: number       // NOVO — 0 = sem problemas
}

// Frontend: types/scraping.ts — idêntico
export interface Chapter {
  // ...
  isDownloaded: boolean
  isRead: boolean
  brokenPageCount: number       // NOVO
}
```

A fonte de dados é `Chapter.placeholderPageIndices` (coluna JSONB no PostgreSQL), populada pelo worker de download (`conversion-job.worker.ts`) e pelo worker de download-only (`chapter-download.worker.ts`) quando detectam páginas corrompidas.

### 2.2. Computação no `GetSourceUseCase`

```typescript
async execute(sourceId: string, userId?: string): Promise<SourceInspectResponse> {
  // ... carrega metadata, computa isDownloaded, computa readSet ...

  const chapters: Chapter[] = await Promise.all(
    metadata.chapters.map(async (ch) => {
      const [isDownloaded, brokenPageCount] = await Promise.all([
        isChapterDownloaded(sourceId, ch.id),
        this.sourceRepository
          .getPlaceholderIndices(sourceId, ch.id)
          .then((indices) => indices.length)
          .catch(() => 0),
      ])

      return {
        ...ch,
        isDownloaded,
        isRead: readSet.has(ch.id),
        brokenPageCount,
      }
    }),
  )

  // ...
}
```

**Decisão (D1):** `getPlaceholderIndices` chamado por capítulo em paralelo via `Promise.all`. Obras típicas têm < 500 capítulos; queries são por PK composta (`sourceId + chapterId`), portanto rápidas. Alternativa rejeitada: pré-carregar batch de todos os capítulos do source (exigiria novo método no repositório, sem ganho significativo).

**Decisão (D2):** `.catch(() => 0)` como fallback seguro. Se `placeholderPageIndices` for `null` no banco ou a query falhar, `brokenPageCount = 0` (sem falsos positivos).

---

## 3. API

### 3.1. `GET /api/conversions/source/inspect/:sourceId`

Adiciona `brokenPageCount: z.number()` ao `chapterSchema`:

```json
{
  "chapters": [
    {
      "id": "chap_0001",
      "number": "1",
      "title": "O Começo",
      "url": "https://...",
      "pages": 22,
      "volume": null,
      "isDownloaded": true,
      "isRead": false,
      "brokenPageCount": 3
    }
  ]
}
```

**Schema Zod atualizado:**
```typescript
const chapterSchema = z.object({
  id: z.string(),
  number: z.string(),
  title: z.string(),
  url: z.string(),
  pages: z.number().nullable(),
  volume: z.number().nullable(),
  isDownloaded: z.boolean(),
  isRead: z.boolean(),
  brokenPageCount: z.number(),   // NOVO
})
```

---

## 4. Frontend

### 4.1. Indicadores de qualidade no `TabCapitulos`

Função utilitária:

```typescript
import { CheckCircle, CloudOff, AlertTriangle, AlertCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type QualityState = {
  icon: LucideIcon
  color: string
  tooltip: string
}

function getQualityState(chapter: Chapter): QualityState {
  if (!chapter.isDownloaded) {
    return {
      icon: CloudOff,
      color: 'text-muted-foreground',
      tooltip: 'Não baixado',
    }
  }

  const broken = chapter.brokenPageCount
  const total = chapter.pages ?? 0

  if (total > 0 && broken >= total) {
    return {
      icon: AlertCircle,
      color: 'text-red-500',
      tooltip: `Capítulo ilegível — ${broken} páginas quebradas`,
    }
  }

  if (broken > 0) {
    return {
      icon: AlertTriangle,
      color: 'text-amber-500',
      tooltip: `${broken} de ${total} páginas quebradas`,
    }
  }

  return {
    icon: CheckCircle,
    color: 'text-green-500',
    tooltip: 'Completo',
  }
}
```

Renderização na linha do capítulo (dentro do `DropdownMenu` trigger):

```tsx
const quality = getQualityState(chapter)

<DropdownMenuTrigger
  className="shrink-0"
  aria-label={`Qualidade do capítulo ${chapter.number}: ${quality.tooltip}`}
>
  <quality.icon className={`w-5 h-5 ${quality.color}`} title={quality.tooltip} />
</DropdownMenuTrigger>
```

**Decisão (D3):** `AlertTriangle` (âmbar) para parcial, `AlertCircle` (vermelho) para quebrado total. Diferença semântica: amarelo = "ainda legível mas com falhas", vermelho = "não vale a pena abrir". O tooltip explica a situação exata.

### 4.2. Auto-mark-read no `ChapterReader`

O componente `ChapterReader` (`components/reader/ChapterReader.tsx`) já tem as dependências necessárias:
- `currentPage` — índice da página atual (state)
- `effectiveTotal` — total de páginas (derivado de cache/SSE/metadata)

Modificação:

```typescript
import { useRef, useEffect } from 'react'
import { readingApi } from '@/lib/api'

// Dentro do componente ChapterReader:
const markReadCalled = useRef(false)

// Marca como lido ao atingir a última página
useEffect(() => {
  if (
    currentPage >= effectiveTotal - 1 &&
    effectiveTotal > 0 &&
    !markReadCalled.current
  ) {
    markReadCalled.current = true
    readingApi.markRead(sourceId, chapterId).catch(() => {
      // Silencioso — falha não interrompe a leitura
    })
  }
}, [currentPage, effectiveTotal, sourceId, chapterId])

// Reset ao mudar de capítulo
useEffect(() => {
  markReadCalled.current = false
}, [chapterId])
```

**Decisão (D4):** `readingApi.markRead()` direto, sem TanStack Query. Motivo:
- Operação fire-and-forget — sem necessidade de cache update imediato
- O cache será atualizado na próxima visita a `biblioteca.$sourceId` via `refetchOnWindowFocus: true` (já configurado no hook `useReadingProgress`)
- Sem TanStack Query = sem dependência extra do `QueryClient` no reader

**Decisão (D5):** `useRef` impede múltiplos disparos:
- Garante que marca apenas 1x por sessão de leitura
- Reseta ao trocar de capítulo (`chapterId` muda)

---

## 5. Estrutura de Arquivos

```
Modificados:
├── apps/backend/src/
│   ├── modules/scraping/
│   │   ├── types/source.types.ts                ← + brokenPageCount
│   │   ├── scraping.routes.ts                   ← chapterSchema + brokenPageCount
│   │   └── use-cases/get-source.use-case.ts     ← + getPlaceholderIndices()
├── apps/frontend/src/
│   ├── types/scraping.ts                        ← + brokenPageCount
│   ├── components/biblioteca/TabCapitulos.tsx    ← indicadores de qualidade
│   └── components/reader/ChapterReader.tsx       ← auto-mark-read
```

---

## 6. Decisões de Design

| ID | Decisão | Justificativa |
|----|---------|---------------|
| D1 | `getPlaceholderIndices` por capítulo (N queries paralelas) | Simples; < 500 caps por obra; PK queries são O(1) |
| D2 | `.catch(() => 0)` como fallback | Evita que `null` no banco gere erro na listagem |
| D3 | `AlertTriangle` âmbar para parcial, `AlertCircle` vermelho para total | Distinção semântica clara; tooltip complementa |
| D4 | `readingApi.markRead()` direto, sem TanStack Query | Fire-and-forget; cache atualiza na próxima navegação |
| D5 | `useRef` para garantir 1 disparo por capítulo | Evita chamadas duplicadas em re-renders |

---

## 7. Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| N queries para obras com 500+ caps | Latência na listagem | `Promise.all` paraleliza; PK queries são O(1) |
| `placeholderPageIndices` null no banco | `brokenPageCount` incorreto | `.catch(() => 0)` fallback |
| Auto-mark-read antes da última imagem carregar | Marca como lido sem ver a página | `effectiveTotal` só é populado após carregamento |
| Usuário sai antes da última página | Capítulo não marcado | Esperado — só marca se terminou |
