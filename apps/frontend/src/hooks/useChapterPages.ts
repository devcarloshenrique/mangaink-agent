import { useMemo } from "react";
import { chaptersApi } from "@/lib/api";

export function useChapterPages(sourceId: string, chapterId: string, totalPages: number): string[] {
  return useMemo(() => {
    if (!sourceId || !chapterId || totalPages <= 0) return [];
    return Array.from({ length: totalPages }, (_, i) =>
      chaptersApi.pageUrl(sourceId, chapterId, i + 1),
    );
  }, [sourceId, chapterId, totalPages]);
}
