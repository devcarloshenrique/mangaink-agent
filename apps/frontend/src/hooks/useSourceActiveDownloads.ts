import { useEffect, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { conversionsApi } from "@/lib/api";
import { useActiveConversions } from "@/hooks/useConversions";
import type { SourceInspectResponse } from "@/types/scraping";

export interface ActiveDownloadsState {
  /** IDs de capítulos atualmente na fila ou baixando */
  downloadingChapterIds: Set<string>;
  /** Mapa de capítuloId -> motivo da falha / indisponibilidade */
  failedChapterMap: Map<string, string>;
}

/**
 * Monitora em tempo real os downloads ativos da obra (via SSE das conversões download-only)
 * e atualiza o cache de `["source", sourceId]` instantaneamente quando um capítulo
 * termina de ser baixado ou é pulado, persistindo o estado na interface.
 */
export function useSourceActiveDownloads(sourceId: string): ActiveDownloadsState {
  const queryClient = useQueryClient();
  const [downloadingChapterIds, setDownloadingChapterIds] = useState<Set<string>>(new Set());
  const [liveFailedMap, setLiveFailedMap] = useState<Map<string, string>>(new Map());

  // 1. Monitora conversões ativas gerais
  const { data: activeConversionsData } = useActiveConversions();
  const activeItems = activeConversionsData?.items ?? [];

  // Filtra as conversões ativas para este sourceId
  const activeForSource = useMemo(() => {
    return activeItems.filter((c) => c.sourceId === sourceId);
  }, [activeItems, sourceId]);

  const activeIdsKey = useMemo(() => {
    return activeForSource
      .map((c) => c.conversionId)
      .sort()
      .join(",");
  }, [activeForSource]);

  // 2. Conexão SSE para cada conversão ativa desta obra
  useEffect(() => {
    if (!activeIdsKey) {
      setDownloadingChapterIds(new Set());
      return;
    }

    const convIds = activeIdsKey.split(",").filter(Boolean);
    const sseStreams: Array<{ close: () => void }> = [];

    for (const convId of convIds) {
      const stream = conversionsApi.events(convId, {
        onEvent(event, rawData) {
          const data = rawData as Record<string, unknown>;
          const chapterId = data?.chapterId as string | undefined;

          if (event === "download.chapter.started" && chapterId) {
            setDownloadingChapterIds((prev) => new Set(prev).add(chapterId));
            setLiveFailedMap((prev) => {
              if (prev.has(chapterId)) {
                const next = new Map(prev);
                next.delete(chapterId);
                return next;
              }
              return prev;
            });
          } else if (event === "download.chapter.finished" && chapterId) {
            setDownloadingChapterIds((prev) => {
              const next = new Set(prev);
              next.delete(chapterId);
              return next;
            });
            setLiveFailedMap((prev) => {
              if (prev.has(chapterId)) {
                const next = new Map(prev);
                next.delete(chapterId);
                return next;
              }
              return prev;
            });

            // ATUALIZAÇÃO IMEDIATA DO CACHE: marca isDownloaded = true e limpa unavailableReason
            queryClient.setQueryData<SourceInspectResponse>(["source", sourceId], (old) => {
              if (!old) return old;
              return {
                ...old,
                chapters: old.chapters.map((ch) =>
                  ch.id === chapterId ? { ...ch, isDownloaded: true, unavailableReason: null } : ch,
                ),
              };
            });
          } else if (event === "download.chapter.skipped" && chapterId) {
            setDownloadingChapterIds((prev) => {
              const next = new Set(prev);
              next.delete(chapterId);
              return next;
            });

            const reasonCode = (data?.reason as string) ?? "unavailable";
            const reasonText =
              reasonCode === "no_images_available" || reasonCode === "all_corrupt"
                ? "Indisponível na fonte"
                : "Falha no download";

            setLiveFailedMap((prev) => new Map(prev).set(chapterId, reasonText));

            // Atualiza cache com o motivo de indisponibilidade
            queryClient.setQueryData<SourceInspectResponse>(["source", sourceId], (old) => {
              if (!old) return old;
              return {
                ...old,
                chapters: old.chapters.map((ch) =>
                  ch.id === chapterId
                    ? { ...ch, isDownloaded: false, unavailableReason: reasonText }
                    : ch,
                ),
              };
            });
          } else if (event === "job.finished" || event === "conversion.completed") {
            setDownloadingChapterIds(new Set());
            // Sincroniza em background para consistência total com o banco/disco
            void queryClient.invalidateQueries({ queryKey: ["source", sourceId] });
            void queryClient.invalidateQueries({ queryKey: ["conversions"] });
          }
        },
      });

      sseStreams.push(stream);
    }

    return () => {
      for (const s of sseStreams) s.close();
    };
  }, [activeIdsKey, sourceId, queryClient]);

  return {
    downloadingChapterIds,
    failedChapterMap: liveFailedMap,
  };
}
