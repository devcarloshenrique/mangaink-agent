import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chaptersApi } from "@/lib/api";

export function useDeleteCache(sourceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chapterId: string) => chaptersApi.deleteCache(sourceId, chapterId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["source", sourceId] });
    },
  });
}
