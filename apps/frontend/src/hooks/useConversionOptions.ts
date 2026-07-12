import { useQuery } from "@tanstack/react-query";
import { conversionsApi } from "@/lib/api";
import type { ConversionOptions } from "@/types/conversion";

export interface UseConversionOptions {
  data: ConversionOptions | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Hook para carregar o catálogo de opções de conversão.
 * Usa TanStack Query com staleTime: Infinity (o catálogo raramente muda).
 * Endpoint público — sem necessidade de JWT.
 */
export function useConversionOptions(): UseConversionOptions {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["conversion-options"],
    queryFn: () => conversionsApi.getOptions(),
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000, // 1h
  });

  return {
    data: data ?? null,
    isLoading,
    isError,
  };
}
