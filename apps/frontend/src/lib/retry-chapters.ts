// lib/retry-chapters.ts — seleção de capítulos para o botão "Tentar novamente"

/**
 * Capítulos a reprocessar num retry:
 * 1. Os que tiveram problema (`problemChapterIds`), na ordem dada, sem duplicar;
 * 2. Fallback: TODOS os capítulos originais do config (ex.: job falhou antes
 *    de qualquer evento por capítulo — provider indisponível etc.).
 */
export function pickRetryChapters(
  problemChapterIds: string[],
  originalChapters: string[][],
): string[] {
  const problems = [...new Set(problemChapterIds)];
  if (problems.length > 0) return problems;

  const seen = new Set<string>();
  const all: string[] = [];
  for (const list of originalChapters) {
    for (const id of list ?? []) {
      if (!seen.has(id)) {
        seen.add(id);
        all.push(id);
      }
    }
  }
  return all;
}
