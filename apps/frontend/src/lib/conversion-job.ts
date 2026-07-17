// DEPRECATED: Tipos mock de simulação de job. Substituído por tipos reais em @/types/conversion.ts.
// Mantido como referência.
export type JobStage = "downloading" | "converting" | "generating" | "sending";

export type JobStatus = "queued" | "running" | "completed" | "error";

export interface StageInfo {
  id: JobStage;
  label: string;
  status: "pending" | "active" | "completed" | "error";
  progress: number;
}

export interface ConversionJob {
  id: string;
  seriesTitle: string;
  seriesSlug: string;
  seriesHue: number;
  format: string;
  delivery: "download" | "kindle";
  kindleEmail?: string;
  totalChapters: number;
  totalPages: number;
  status: JobStatus;
  overallProgress: number;
  stages: StageInfo[];
  createdAt: number;
  completedAt?: number;
  errorMessage?: string;
}

export const STAGE_LABELS: Record<JobStage, string> = {
  downloading: "Baixando imagens",
  converting: "Convertendo páginas",
  generating: "Gerando arquivo",
  sending: "Enviando pro Kindle",
};

export const STAGE_MESSAGES: Record<JobStage, string> = {
  downloading: "Baixando as imagens dos capítulos…",
  converting: "Aplicando o preset e convertendo as páginas…",
  generating: "Compactando tudo no arquivo final…",
  sending: "Enviando pro seu Kindle…",
};

export const STAGE_ONOMATOPOEIA: Record<JobStage, string> = {
  downloading: "WHOOSH!",
  converting: "BEEP!",
  generating: "ZIP!",
  sending: "SEND!",
};

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return "agora";
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}
