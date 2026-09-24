import { useState, useCallback, useMemo } from "react";
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

export function useProviderSearch(providerSlugs?: string[], language?: string) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query.trim(), 300);
  const slugsKey = useMemo(() => providerSlugs?.join(",") ?? "", [providerSlugs]);
  const langKey = language ?? "";

  const isEnabled =
    debouncedQuery.length >= 2 && (providerSlugs === undefined || providerSlugs.length > 0);

  const searchQuery = useQuery<SearchSourcesResponse, Error>({
    queryKey: ["scraping", "search", debouncedQuery, slugsKey, langKey],
    queryFn: ({ signal }) => {
      const opts =
        slugsKey || (language && language !== "all")
          ? {
              providers: slugsKey || undefined,
              language: language && language !== "all" ? language : undefined,
            }
          : undefined;
      return scrapingApi.search(debouncedQuery, opts, signal);
    },
    enabled: isEnabled,
    staleTime: 60_000,
  });

  const loadProviderPageForQuery = useCallback(
    (slug: string, offset: number, limit: number, signal?: AbortSignal) => {
      const opts = {
        providers: slug,
        limit,
        offset,
        ...(language && language !== "all" ? { language } : {}),
      };
      return scrapingApi.search(debouncedQuery, opts, signal);
    },
    [debouncedQuery, language],
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
