export interface ChapterDownloadStatus {
  status: "queued" | "downloading" | "ready" | "failed" | "not_downloaded";
  totalImages: number | null;
  downloadedImages: number;
  jobId: string | null;
  /** Motivo da falha — presente quando status = "failed". */
  error?: string | null;
}

export interface ChapterDownloadResponse {
  jobId: string;
  status: "queued" | "ready";
}
