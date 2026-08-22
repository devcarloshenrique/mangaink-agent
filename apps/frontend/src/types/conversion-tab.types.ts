import type {
  ConversionStatus,
  JobStatus,
  ConversionSummary,
  ConversionState,
  JobSummary,
  ConversionConfig,
} from "@/types/conversion";

export interface ConversionVolume {
  id: string;
  vol: string;
  ch: string;
  size: string;
  state: JobStatus;
  pct?: number;
  outputFile?: string;
  outputSize?: number;
  downloadUrl?: string;
  err?: string;
}

export interface ConversionLot {
  id: string;
  title: string;
  device: string;
  format: string;
  status: ConversionStatus;
  createdAt: string;
  totalMB: string;
  live: boolean;
  series: string;
  vols: ConversionVolume[];
}

export function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes <= 0 || isNaN(bytes)) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) {
    const kb = bytes / 1024;
    return `${kb.toFixed(1).replace(".", ",")} KB`;
  }
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}

export function extractSeriesInitials(title?: string): string {
  if (!title || !title.trim()) return "MK";
  const clean = title.replace(/[:\-–—_]/g, " ").trim();
  const words = clean.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Converte um JobSummary de uma ConversionState para um ConversionVolume de visualização.
 */
export function mapJobToVolume(
  job: JobSummary,
  config?: ConversionConfig | null,
): ConversionVolume {
  const volLabel = job.title || `Vol. ${job.index + 1}`;

  // Tenta extrair informações de capítulos do config.books se disponível
  let chLabel = "";
  if (config?.books && config.books[job.index]) {
    const book = config.books[job.index];
    const chs = book.chapters ?? [];
    if (chs.length > 0) {
      const first = chs[0].replace(/^chap_0*/, "").replace(/_/g, ".") || "1";
      const last =
        chs[chs.length - 1].replace(/^chap_0*/, "").replace(/_/g, ".") || String(chs.length);
      chLabel = chs.length === 1 ? `Cap. ${first}` : `Cap. ${first} – ${last}`;
    }
  }

  if (!chLabel) {
    chLabel = `Volume ${job.index + 1}`;
  }

  return {
    id: job.jobId,
    vol: volLabel,
    ch: chLabel,
    size: formatFileSize(job.outputSize),
    state: job.status,
    pct: job.progress,
    outputFile: job.outputFile,
    outputSize: job.outputSize,
    downloadUrl: job.downloadUrl,
    err: job.error,
  };
}

/**
 * Monta o ConversionLot agregando os dados da listagem (summary) e, quando disponível, o detalhe (state).
 */
export function buildConversionLot(
  summary: ConversionSummary,
  state?: ConversionState | null,
  seriesTitleOverride?: string,
): ConversionLot {
  const config = state?.config as ConversionConfig | undefined;
  const format = (summary.output?.format || config?.output?.format || "EPUB").toUpperCase();
  const device = summary.output?.deviceId || config?.output?.deviceId || "—";
  const series = seriesTitleOverride || summary.title || config?.metadata?.title || "";

  const isLive = summary.status === "processing" || summary.status === "queued";

  // Data formatada resumida
  let dateFormatted = "";
  try {
    const d = new Date(summary.createdAt);
    dateFormatted = d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  } catch {
    dateFormatted = summary.createdAt;
  }

  const title = `${format} · ${dateFormatted}`;

  let vols: ConversionVolume[] = [];
  let totalBytes = 0;

  if (state?.jobs && state.jobs.length > 0) {
    vols = state.jobs.map((j) => {
      if (j.outputSize) totalBytes += j.outputSize;
      return mapJobToVolume(j, config);
    });
  } else {
    // Quando ainda não carregou o state completo, gera placeholders leves baseados no totalJobs
    vols = Array.from({ length: summary.totalJobs || 1 }, (_, i) => ({
      id: `${summary.conversionId}-placeholder-${i + 1}`,
      vol: `Vol. ${i + 1}`,
      ch: `Volume ${i + 1}`,
      size: "—",
      state:
        summary.status === "completed"
          ? "completed"
          : summary.status === "failed"
            ? "failed"
            : "queued",
      pct: summary.progress,
    }));
  }

  return {
    id: summary.conversionId,
    title,
    device,
    format,
    status: summary.status,
    createdAt: summary.createdAt,
    totalMB: totalBytes > 0 ? formatFileSize(totalBytes) : "—",
    live: isLive,
    series,
    vols,
  };
}
