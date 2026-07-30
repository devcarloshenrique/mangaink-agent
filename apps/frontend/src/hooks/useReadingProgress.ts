import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { readingApi } from "@/lib/api";
import type { ReadingProgress, MarkReadResponse, UnmarkReadResponse } from "@/types/reading";
import type { SourceInspectResponse } from "@/types/scraping";

export function useReadingProgress(sourceId: string) {
  return useQuery<ReadingProgress>({
    queryKey: ["reading-progress", sourceId],
    queryFn: () => readingApi.getProgress(sourceId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: !!sourceId,
  });
}

export function useToggleRead(sourceId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    MarkReadResponse | UnmarkReadResponse,
    Error,
    { chapterId: string; isRead: boolean },
    | {
        previousProgress: ReadingProgress | undefined;
        previousSource: SourceInspectResponse | undefined;
      }
    | undefined
  >({
    mutationFn: ({ chapterId, isRead }) =>
      isRead
        ? readingApi.markRead(sourceId, chapterId)
        : readingApi.unmarkRead(sourceId, chapterId),
    onMutate: async ({ chapterId, isRead }) => {
      await queryClient.cancelQueries({ queryKey: ["reading-progress", sourceId] });
      await queryClient.cancelQueries({ queryKey: ["source", sourceId] });

      const previousProgress = queryClient.getQueryData<ReadingProgress>([
        "reading-progress",
        sourceId,
      ]);
      const previousSource = queryClient.getQueryData<SourceInspectResponse>(["source", sourceId]);

      queryClient.setQueryData<ReadingProgress>(["reading-progress", sourceId], (old) => {
        if (!old) return old;
        const ids = new Set(old.readChapterIds);
        if (isRead) ids.add(chapterId);
        else ids.delete(chapterId);
        return { ...old, readChapterIds: [...ids], totalRead: ids.size };
      });

      queryClient.setQueryData<SourceInspectResponse>(["source", sourceId], (old) => {
        if (!old) return old;
        return {
          ...old,
          chapters: old.chapters.map((ch) => (ch.id === chapterId ? { ...ch, isRead } : ch)),
        };
      });

      return { previousProgress, previousSource };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProgress) {
        queryClient.setQueryData(["reading-progress", sourceId], context.previousProgress);
      }
      if (context?.previousSource) {
        queryClient.setQueryData(["source", sourceId], context.previousSource);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["reading-progress", sourceId] });
      queryClient.invalidateQueries({ queryKey: ["source", sourceId] });
    },
  });
}

export function useBatchMarkRead(sourceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ chapterIds, markAsRead }: { chapterIds: string[]; markAsRead: boolean }) =>
      readingApi.batchMarkRead(sourceId, { chapterIds, markAsRead }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["reading-progress", sourceId] });
      queryClient.invalidateQueries({ queryKey: ["source", sourceId] });
    },
  });
}
