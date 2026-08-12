import { useQuery } from "@tanstack/react-query";
import { scrapingApi } from "@/lib/api";

export function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: () => scrapingApi.providers(),
    staleTime: 60_000,
  });
}
