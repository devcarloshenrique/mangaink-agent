/**
 * Fórmula única do % agregado de conversão (página de referência
 * `useConversionProgress` + hook ao vivo `useLiveConversionProgress`).
 *
 * downloadOnly → só capítulos.
 * Caso contrário → capítulos 50% + conversão (KCC) 50%.
 * Sem cap 99 e sem clamp monotônico aqui — cada hook mantém o seu.
 */
export interface ConversionProgressInput {
  processedChapters: number;
  totalChapters: number;
  completedJobs: number;
  totalJobs: number;
  kccProgress: number;
  downloadOnly: boolean;
}

export function computeConversionOverall(input: ConversionProgressInput): number {
  const pctChapters =
    input.totalChapters > 0 ? Math.round((input.processedChapters / input.totalChapters) * 100) : 0;

  if (input.downloadOnly) return Math.min(100, pctChapters);

  const agg =
    input.totalJobs > 0
      ? Math.min(
          100,
          Math.round(
            (input.completedJobs * 100) / input.totalJobs + input.kccProgress / input.totalJobs,
          ),
        )
      : 0;

  if (input.totalChapters <= 0) return 0;

  return Math.min(
    100,
    Math.round((input.processedChapters / input.totalChapters) * 50 + agg * 0.5),
  );
}
