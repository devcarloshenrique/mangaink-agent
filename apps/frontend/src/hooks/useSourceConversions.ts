import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { conversionsApi } from "@/lib/api";
import type { ConversionSummary, ConversionState } from "@/types/conversion";
import { buildConversionLot, type ConversionLot } from "@/types/conversion-tab.types";

export function useSourceConversions(sourceId: string, seriesTitle?: string) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 1. Listagem de todas as conversões para este sourceId
  const {
    data: listData,
    isLoading: listLoading,
    error: listError,
  } = useQuery({
    queryKey: ["conversions", { sourceId }],
    queryFn: () => conversionsApi.list({ sourceId, limit: 100 }),
    staleTime: 15_000,
    enabled: !!sourceId,
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const hasActive = items.some((c) => c.status === "queued" || c.status === "processing");
      return hasActive ? 3000 : false;
    },
  });

  const conversions = useMemo<ConversionSummary[]>(() => listData?.items ?? [], [listData]);

  // Aquece o detalhe do primeiro lote em paralelo à sincronização do selectedId —
  // evita o waterfall lista → efeito (setSelectedId) → GET de detalhe.
  useEffect(() => {
    const first = conversions[0];
    if (!first) return;
    const key: QueryKey = ["conversion", first.conversionId];
    if (!queryClient.getQueryData(key)) {
      void queryClient.prefetchQuery({
        queryKey: key,
        queryFn: () => conversionsApi.get(first.conversionId),
        staleTime: 10_000,
      });
    }
  }, [conversions, queryClient]);

  // Sincroniza a conversão selecionada se a lista mudar ou se nada estiver selecionado
  useEffect(() => {
    if (conversions.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !conversions.some((c) => c.conversionId === selectedId)) {
      setSelectedId(conversions[0].conversionId);
    }
  }, [conversions, selectedId]);

  // 2. Detalhes completos (com jobs) da conversão selecionada
  const {
    data: selectedConversion,
    isLoading: detailsLoading,
    error: detailsError,
  } = useQuery<ConversionState>({
    queryKey: ["conversion", selectedId],
    queryFn: () => conversionsApi.get(selectedId!),
    enabled: !!selectedId,
    staleTime: 10_000,
    refetchInterval: (query) => {
      const state = query.state.data;
      if (!state) return false;
      const isActive = state.status === "queued" || state.status === "processing";
      return isActive ? 2500 : false;
    },
  });

  // 3. Montagem dos lotes estruturados para a UI
  const lots = useMemo<ConversionLot[]>(() => {
    return conversions.map((summary) => {
      const state =
        summary.conversionId === selectedId && selectedConversion?.conversionId === selectedId
          ? selectedConversion
          : null;
      return buildConversionLot(summary, state, seriesTitle);
    });
  }, [conversions, selectedId, selectedConversion, seriesTitle]);

  const selectedLot = useMemo<ConversionLot | null>(() => {
    if (!selectedId) return lots[0] ?? null;
    return lots.find((l) => l.id === selectedId) ?? lots[0] ?? null;
  }, [lots, selectedId]);

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["conversions", { sourceId }] });
    if (selectedId) {
      queryClient.invalidateQueries({ queryKey: ["conversion", selectedId] });
    }
  };

  const isDetailsLoading =
    detailsLoading || (!!selectedId && selectedConversion?.conversionId !== selectedId);

  return {
    conversions,
    lots,
    selectedLot,
    selectedConversion: selectedConversion ?? null,
    selectedId,
    setSelectedId,
    isLoading: listLoading,
    isDetailsLoading,
    error: (listError || detailsError) as Error | null,
    refetch,
  };
}
