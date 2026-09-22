import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { scrapingApi } from "@/lib/api";
import { useDebounce } from "./useDebounce";
import type { SearchSourcesResponse } from "@/types/scraping";

export function loadProviderPage(
  query: string,
  slug: string,
  offset: number,
  limit: number,
  signal?: AbortSignal,
): Promise<SearchSourcesResponse> {
  return scrapingApi.search(query, { providers: slug, limit, offset }, signal);
}

export function useProviderSearch() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query.trim(), 300);

  const searchQuery = useQuery<SearchSourcesResponse, Error>({
    queryKey: ["scraping", "search", debouncedQuery],
    queryFn: ({ signal }) => scrapingApi.search(debouncedQuery, undefined, signal),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  });

  const loadProviderPageForQuery = useCallback(
    (slug: string, offset: number, limit: number, signal?: AbortSignal) => {
      return scrapingApi.search(debouncedQuery, { providers: slug, limit, offset }, signal);
    },
    [debouncedQuery],
  );

  return {
    query,
    setQuery,
    debouncedQuery,
    data: searchQuery.data,
    isFetching: searchQuery.isFetching,
    error: searchQuery.error as Error | null,
    refetch: () => void searchQuery.refetch(),
    loadProviderPage: loadProviderPageForQuery,
  };
}
