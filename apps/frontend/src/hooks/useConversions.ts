import { useQuery } from "@tanstack/react-query";
import { conversionsApi } from "@/lib/api";
import type { ConversionSummary, ConversionStatus } from "@/types/conversion";

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
  return useConversionsList({ status: activeStatuses, limit: 50 });
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
