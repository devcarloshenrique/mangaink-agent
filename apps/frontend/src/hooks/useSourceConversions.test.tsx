import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { conversionsApi } from "@/lib/api";
import type { ConversionState, ConversionSummary } from "@/types/conversion";
import { useSourceConversions } from "./useSourceConversions";

vi.mock("@/lib/api", () => ({
  conversionsApi: {
    list: vi.fn(),
    get: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useSourceConversions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve retornar estado vazio quando não houver conversões", async () => {
    vi.mocked(conversionsApi.list).mockResolvedValue({ items: [], total: 0 });

    const { result } = renderHook(() => useSourceConversions("src-empty", "Série Teste"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.conversions).toEqual([]);
    expect(result.current.lots).toEqual([]);
    expect(result.current.selectedLot).toBeNull();
    expect(result.current.selectedId).toBeNull();
  });

  it("deve buscar listagem e aquecer o detalhe do primeiro lote", async () => {
    const mockList = {
      items: [
        {
          conversionId: "conv-1",
          sourceId: "src-1",
          title: "Volume 1",
          status: "completed" as const,
          progress: 100,
          totalJobs: 1,
          completedJobs: 1,
          failedJobs: 0,
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        } satisfies ConversionSummary,
        {
          conversionId: "conv-2",
          sourceId: "src-1",
          title: "Volume 2",
          status: "completed" as const,
          progress: 100,
          totalJobs: 1,
          completedJobs: 1,
          failedJobs: 0,
          createdAt: "2026-08-02T00:00:00Z",
          updatedAt: "2026-08-02T00:00:00Z",
        } satisfies ConversionSummary,
      ],
      total: 2,
    };

    const mockDetail: ConversionState = {
      conversionId: "conv-1",
      sourceId: "src-1",
      status: "completed",
      progress: 100,
      totalJobs: 1,
      completedJobs: 1,
      failedJobs: 0,
      runningJobs: 0,
      pendingJobs: 0,
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
      jobs: [],
      config: {},
    };

    vi.mocked(conversionsApi.list).mockResolvedValue(mockList);
    vi.mocked(conversionsApi.get).mockResolvedValue(mockDetail);

    const { result } = renderHook(() => useSourceConversions("src-1", "Mushoku Tensei"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.conversions.length).toBe(2);
    });

    expect(result.current.selectedId).toBe("conv-1");
    expect(conversionsApi.list).toHaveBeenCalledWith({ sourceId: "src-1", limit: 100 });
    expect(conversionsApi.get).toHaveBeenCalledWith("conv-1");
  });

  it("deve permitir alterar o selectedId e carregar o novo detalhe", async () => {
    const mockList = {
      items: [
        {
          conversionId: "conv-1",
          sourceId: "src-1",
          title: "Volume 1",
          status: "completed" as const,
          progress: 100,
          totalJobs: 1,
          completedJobs: 1,
          failedJobs: 0,
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        } satisfies ConversionSummary,
        {
          conversionId: "conv-2",
          sourceId: "src-1",
          title: "Volume 2",
          status: "completed" as const,
          progress: 100,
          totalJobs: 1,
          completedJobs: 1,
          failedJobs: 0,
          createdAt: "2026-08-02T00:00:00Z",
          updatedAt: "2026-08-02T00:00:00Z",
        } satisfies ConversionSummary,
      ],
      total: 2,
    };

    vi.mocked(conversionsApi.list).mockResolvedValue(mockList);
    vi.mocked(conversionsApi.get).mockImplementation(
      async (id: string): Promise<ConversionState> => ({
        conversionId: id,
        sourceId: "src-1",
        status: "completed",
        progress: 100,
        totalJobs: 1,
        completedJobs: 1,
        failedJobs: 0,
        runningJobs: 0,
        pendingJobs: 0,
        createdAt: "2026-08-01T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
        jobs: [],
        config: {},
      }),
    );

    const { result } = renderHook(() => useSourceConversions("src-1", "Mushoku Tensei"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.selectedId).toBe("conv-1");
    });

    act(() => {
      result.current.setSelectedId("conv-2");
    });

    await waitFor(() => {
      expect(result.current.selectedId).toBe("conv-2");
      expect(conversionsApi.get).toHaveBeenCalledWith("conv-2");
    });
  });
});
