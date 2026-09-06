import { useQuery } from "@tanstack/react-query";
import { conversionsApi } from "@/lib/api";
import type { ConversionSummary, ConversionStatus } from "@/types/conversion";
import type { LibraryItemDTO } from "@mangaink/shared";

export interface UseConversionsParams {
  page?: number;
  limit?: number;
  status?: ConversionStatus[];
  sourceId?: string;
}

export function useConversionsList(params: UseConversionsParams = {}) {
  return useQuery({
    queryKey: ["conversions", params],
    queryFn: () => conversionsApi.list(params),
    staleTime: 30_000,
  });
}

export function useActiveConversions() {
  const activeStatuses: ConversionStatus[] = ["queued", "processing"];
  return useQuery({
    queryKey: ["conversions", { status: activeStatuses, limit: 50 }],
    queryFn: () => conversionsApi.list({ status: activeStatuses, limit: 50 }),
    // Barras ao vivo (sino do header / aba convertendo): poll rápido enquanto
    // há itens ativos; heartbeat lento quando vazio (rede de segurança para
    // transições que não invalidam explicitamente — ex.: conversão criada
    // por outro dispositivo/aba).
    refetchInterval: (query) => {
      const count = query.state.data?.items?.length ?? 0;
      return count > 0 ? 5_000 : 30_000;
    },
    staleTime: 5_000,
  });
}

export interface SeriesGroup {
  sourceId: string;
  title: string;
  conversionCount: number;
  lastActivity: string;
  status: "active" | "completed" | "mixed";
  items: ConversionSummary[];
}

export function groupConversionsBySource(items: ConversionSummary[]): SeriesGroup[] {
  const map = new Map<string, { title: string; items: ConversionSummary[] }>();

  for (const item of items) {
    const entry = map.get(item.sourceId);
    if (entry) {
      entry.items.push(item);
      if (item.title && item.title !== entry.title) {
        entry.title = item.title;
      }
    } else {
      map.set(item.sourceId, { title: item.title || item.sourceId, items: [item] });
    }
  }

  const groups: SeriesGroup[] = [];
  for (const [sourceId, { title, items }] of map) {
    const sorted = items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const allCompleted = sorted.every((i) => i.status === "completed");
    const anyActive = sorted.some((i) => i.status === "queued" || i.status === "processing");
    groups.push({
      sourceId,
      title,
      conversionCount: items.length,
      lastActivity: sorted[0].updatedAt,
      status: allCompleted ? "completed" : anyActive ? "active" : "mixed",
      items,
    });
  }

  return groups.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

export function consolidateLibraryWithConversions(
  libraryItems: LibraryItemDTO[] = [],
  conversions: ConversionSummary[] = [],
): SeriesGroup[] {
  const conversionsMap = new Map<string, { title: string; items: ConversionSummary[] }>();

  for (const item of conversions) {
    const entry = conversionsMap.get(item.sourceId);
    if (entry) {
      entry.items.push(item);
      if (item.title && item.title !== entry.title) {
        entry.title = item.title;
      }
    } else {
      conversionsMap.set(item.sourceId, { title: item.title || item.sourceId, items: [item] });
    }
  }

  const processedSourceIds = new Set<string>();
  const groups: SeriesGroup[] = [];

  // 1. Processa todas as obras salvas na biblioteca
  for (const libItem of libraryItems) {
    processedSourceIds.add(libItem.sourceId);
    const convEntry = conversionsMap.get(libItem.sourceId);

    if (convEntry && convEntry.items.length > 0) {
      const sorted = [...convEntry.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const allCompleted = sorted.every((i) => i.status === "completed");
      const anyActive = sorted.some((i) => i.status === "queued" || i.status === "processing");
      const lastConvDate = sorted[0].updatedAt || sorted[0].createdAt;
      const libDate = libItem.updatedAt || libItem.createdAt;
      const lastActivity = lastConvDate > libDate ? lastConvDate : libDate;

      groups.push({
        sourceId: libItem.sourceId,
        title: libItem.title || convEntry.title || libItem.sourceId,
        conversionCount: sorted.length,
        lastActivity,
        status: allCompleted ? "completed" : anyActive ? "active" : "mixed",
        items: sorted,
      });
    } else {
      groups.push({
        sourceId: libItem.sourceId,
        title: libItem.title || libItem.sourceId,
        conversionCount: 0,
        lastActivity: libItem.updatedAt || libItem.createdAt || new Date().toISOString(),
        status: "completed",
        items: [],
      });
    }
  }

  // 2. Processa conversões avulsas cujas obras ainda não estão na biblioteca
  for (const [sourceId, { title, items }] of conversionsMap) {
    if (!processedSourceIds.has(sourceId)) {
      const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const allCompleted = sorted.every((i) => i.status === "completed");
      const anyActive = sorted.some((i) => i.status === "queued" || i.status === "processing");

      groups.push({
        sourceId,
        title,
        conversionCount: sorted.length,
        lastActivity: sorted[0].updatedAt || sorted[0].createdAt,
        status: allCompleted ? "completed" : anyActive ? "active" : "mixed",
        items: sorted,
      });
    }
  }

  return groups.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}
