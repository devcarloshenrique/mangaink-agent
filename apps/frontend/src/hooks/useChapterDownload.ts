import { useEffect, useRef, useState, useCallback } from "react";
import { chaptersApi, tokenStore } from "@/lib/api";
import { createSSEStream } from "@/lib/sse";

type DownloadStatus = "queued" | "downloading" | "ready" | "failed" | "not_downloaded" | "idle";

interface UseChapterDownload {
  status: DownloadStatus;
  totalImages: number;
  downloadedImages: number;
  progress: number;
}

export function useChapterDownload(
  sourceId: string,
  chapterId: string,
  enabled: boolean,
): UseChapterDownload {
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [totalImages, setTotalImages] = useState(0);
  const [downloadedImages, setDownloadedImages] = useState(0);
  const totalRef = useRef(0);
  const downloadedRef = useRef(0);
  const sseRef = useRef<{ close: () => void } | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const isPollingRef = useRef(false);

  const progress = totalImages > 0 ? Math.round((downloadedImages / totalImages) * 100) : 0;

  const cleanup = useCallback(() => {
    sseRef.current?.close();
    sseRef.current = null;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  // Poll que busca totalImages do manifest assim que disponivel.
  // Executa em paralelo com o SSE — se o SSE falhar, o poll garante
  // que totalImages seja populado e que o status chegue a "ready".
  // Dispara a primeira chamada imediatamente (nao espera 2s do setInterval).
  const startPoll = useCallback(
    (initialStatus: DownloadStatus) => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      let attempts = 0;
      const maxAttempts = 15; // 30s

      const tick = async () => {
        if (!mountedRef.current) {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          isPollingRef.current = false;
          return;
        }
        attempts++;
        try {
          const result = await chaptersApi.getDownloadStatus(sourceId, chapterId);
          if (!mountedRef.current) return;

          if (result.status === "ready") {
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            isPollingRef.current = false;
            const t = result.totalImages ?? 0;
            setTotalImages(t);
            setDownloadedImages(result.downloadedImages);
            totalRef.current = t;
            downloadedRef.current = result.downloadedImages;
            setStatus("ready");
            return;
          }
          if (result.status === "downloading" || result.status === "queued") {
            setStatus(result.status);
            if (result.totalImages != null) {
              setTotalImages(result.totalImages);
              totalRef.current = result.totalImages;
            }
            if (result.downloadedImages > 0) {
              setDownloadedImages(result.downloadedImages);
              downloadedRef.current = result.downloadedImages;
            }
          }
          if (result.status === "not_downloaded" && attempts >= 5) {
            if (initialStatus === "failed") {
              setStatus("failed");
            }
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            isPollingRef.current = false;
            return;
          }
          if (attempts >= maxAttempts) {
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            isPollingRef.current = false;
            if (initialStatus === "failed") {
              setStatus("failed");
            }
          }
        } catch {
          if (attempts >= maxAttempts) {
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            isPollingRef.current = false;
            if (initialStatus === "failed") {
              setStatus("failed");
            }
          }
        }
      };

      // Dispara a primeira chamada imediatamente
      tick();

      // Depois continua a cada 2s
      pollIntervalRef.current = setInterval(tick, 2000);
    },
    [sourceId, chapterId],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    if (!enabled || !sourceId || !chapterId) {
      cleanup();
      setStatus("idle");
      setTotalImages(0);
      setDownloadedImages(0);
      totalRef.current = 0;
      downloadedRef.current = 0;
      return;
    }

    // Poll paralelo — busca totalImages do manifest mesmo com SSE ativo
    startPoll("downloading");

    const token = tokenStore.get() ?? undefined;
    const url = chaptersApi.downloadEventsUrl(sourceId, chapterId);

    const sse = createSSEStream(
      url,
      {
        onEvent(event, data) {
          if (!mountedRef.current) return;
          const d = data as Record<string, unknown>;

          if (event === "progress") {
            const total = (d.total as number) ?? 0;
            const downloaded = (d.downloaded as number) ?? 0;
            if (total > 0) {
              setTotalImages(total);
              totalRef.current = total;
            }
            setDownloadedImages(downloaded);
            downloadedRef.current = downloaded;
            setStatus("downloading");
          } else if (event === "completed") {
            const total = (d.totalImages as number) ?? totalRef.current;
            const downloaded = total > 0 ? total : downloadedRef.current;
            if (total > 0) {
              setTotalImages(total);
              totalRef.current = total;
            }
            setDownloadedImages(downloaded);
            downloadedRef.current = downloaded;
            setStatus("ready");
            sseRef.current?.close();
          } else if (event === "failed") {
            sseRef.current?.close();
            startPoll("failed");
          }
        },
        onError(_error) {
          if (!mountedRef.current) return;
          sseRef.current?.close();
          startPoll("downloading");
        },
      },
      token,
    );

    sseRef.current = sse;

    return () => {
      sse.close();
      sseRef.current = null;
    };
  }, [sourceId, chapterId, enabled]); // NÃO incluir totalImages/downloadedImages aqui

  return { status, totalImages, downloadedImages, progress };
}
