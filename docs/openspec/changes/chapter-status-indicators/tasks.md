# Chapter Status Indicators — Tasks de Implementação

> **Status:** DRAFT
> **Data:** 2026-07-29

---

## Ordem de Implementação

1. Backend: `brokenPageCount` no tipo Chapter + GetSourceUseCase
2. Backend: Atualizar chapterSchema Zod + scraping routes
3. Frontend: Tipos + indicadores de qualidade no TabCapitulos
4. Frontend: Auto-mark-read no ChapterReader
5. Testes

---

## 1. Backend — `brokenPageCount` no Chapter

- [ ] 1.1 `scraping/types/source.types.ts` — Adicionar `brokenPageCount: number` ao tipo `Chapter`
- [ ] 1.2 `scraping/use-cases/get-source.use-case.ts` — No `Promise.all` do map de capítulos, adicionar `brokenPageCount` via `this.sourceRepository.getPlaceholderIndices(sourceId, ch.id).then(i => i.length).catch(() => 0)`
- [ ] 1.3 `scraping/scraping.routes.ts` — Adicionar `brokenPageCount: z.number()` ao `chapterSchema` Zod
- [ ] 1.4 Rodar `pnpm test` — verificar que `get-source.use-case.test.ts` e scraping E2E passam

## 2. Frontend — Tipos + Indicadores no TabCapitulos

- [ ] 2.1 `types/scraping.ts` — Adicionar `brokenPageCount: number` à interface `Chapter`
- [ ] 2.2 `components/biblioteca/TabCapitulos.tsx` — Criar função `getQualityState(chapter)` que retorna `{ icon, color, tooltip }` para 4 estados:
  - `CloudOff` cinza (não baixado)
  - `CheckCircle` verde (completo)
  - `AlertTriangle` amarelo (parcial)
  - `AlertCircle` vermelho (quebrado)
- [ ] 2.3 `TabCapitulos.tsx` — Substituir o `DropdownMenuTrigger` atual (que renderiza `CheckCircle`/`CloudOff` fixos) para usar `getQualityState(chapter)`
- [ ] 2.4 `TabCapitulos.tsx` — Ajustar opções do dropdown: manter "Abrir" e "Apagar do disco" também para capítulos com problemas (usuário pode querer re-baixar)
- [ ] 2.5 Adicionar tooltip via atributo `title` no ícone (simples, sem dependência extra)

## 3. Frontend — Auto-mark-read

- [ ] 3.1 `components/reader/ChapterReader.tsx` — Adicionar imports: `useRef`, `useEffect` de React e `readingApi` de `@/lib/api`
- [ ] 3.2 `ChapterReader.tsx` — Adicionar `const markReadCalled = useRef(false)` no corpo do componente
- [ ] 3.3 `ChapterReader.tsx` — Adicionar `useEffect` que detecta `currentPage >= effectiveTotal - 1 && effectiveTotal > 0 && !markReadCalled.current`:
  - Seta `markReadCalled.current = true`
  - Chama `readingApi.markRead(sourceId, chapterId).catch(() => {})`
- [ ] 3.4 `ChapterReader.tsx` — Adicionar `useEffect` que reseta `markReadCalled.current = false` quando `chapterId` muda
- [ ] 3.5 Verificar que `sourceId` e `chapterId` já são recebidos como props pelo `ChapterReader`

## 4. Testes

- [ ] 4.1 Backend: Atualizar `get-source.use-case.test.ts` — mockar `getPlaceholderIndices` e verificar `brokenPageCount` no resultado
- [ ] 4.2 Frontend: Atualizar `TabCapitulos.test.tsx` — mockar `brokenPageCount` nos `makeChapter()` e verificar renderização dos ícones corretos
- [ ] 4.3 Rodar `pnpm test` (backend) — todos passam
- [ ] 4.4 Rodar `pnpm test` (frontend) — todos passam

---

## Resumo

| Camada | Arquivos Modificados |
|--------|---------------------|
| Backend | 3 (`source.types.ts`, `get-source.use-case.ts`, `scraping.routes.ts`) |
| Frontend | 3 (`scraping.ts`, `TabCapitulos.tsx`, `ChapterReader.tsx`) |
| Testes | 2 (`get-source.use-case.test.ts`, `TabCapitulos.test.tsx`) |
| **Total** | **8** |
