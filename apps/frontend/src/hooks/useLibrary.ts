import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  libraryApi,
  type LibraryItem,
  type LibraryListResponse,
  type UserLibrary,
} from "@/lib/api";
import type { RemoveFromLibraryResponse } from "@mangaink/shared";

export interface UseLibraryOptions {
  isFavorite?: boolean;
  query?: string;
}

export function useLibrary(options?: UseLibraryOptions) {
  return useQuery<LibraryListResponse>({
    queryKey: ["library", options],
    queryFn: () => libraryApi.list(options),
    staleTime: 30_000,
  });
}

export function useAddToLibrary() {
  const queryClient = useQueryClient();

  return useMutation<UserLibrary, Error, string>({
    mutationFn: (sourceId: string) => libraryApi.add(sourceId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}

export function useRemoveFromLibrary() {
  const queryClient = useQueryClient();

  return useMutation<RemoveFromLibraryResponse, Error, string>({
    mutationFn: (sourceId: string) => libraryApi.remove(sourceId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation<
    UserLibrary,
    Error,
    { sourceId: string; isFavorite?: boolean },
    { previousQueries: [readonly unknown[], LibraryListResponse | undefined][] } | undefined
  >({
    mutationFn: ({ sourceId, isFavorite }) => libraryApi.toggleFavorite(sourceId, isFavorite),
    onMutate: async ({ sourceId, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: ["library"] });

      const matchingQueries = queryClient.getQueriesData<LibraryListResponse>({
        queryKey: ["library"],
      });

      const previousQueries = matchingQueries.map(([key, data]) => [key, data] as const);

      for (const [key, data] of matchingQueries) {
        if (!data) continue;
        queryClient.setQueryData<LibraryListResponse>(key, {
          ...data,
          items: data.items.map((item: LibraryItem) => {
            if (item.sourceId === sourceId) {
              const newFav = isFavorite !== undefined ? isFavorite : !item.isFavorite;
              return { ...item, isFavorite: newFav };
            }
            return item;
          }),
        });
      }

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}
