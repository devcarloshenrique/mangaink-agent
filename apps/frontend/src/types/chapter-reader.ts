export interface ChapterDownloadStatus {
  status: "queued" | "downloading" | "ready" | "failed" | "not_downloaded";
  totalImages: number | null;
  downloadedImages: number;
  jobId: string | null;
}

export interface ChapterDownloadResponse {
  jobId: string;
  status: "queued" | "ready";
}
