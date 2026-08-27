import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mocked = vi.hoisted(() => ({
  activeItems: [] as Array<{
    conversionId: string;
    sourceId: string;
    status: string;
  }>,
  conversionGet: vi.fn(),
  conversionEvents: vi.fn(),
}));

vi.mock("@/hooks/useConversions", () => ({
  useActiveConversions: () => ({ data: { items: mocked.activeItems } }),
  useConversionsList: () => ({ data: { items: [] } }),
}));

vi.mock("@/lib/api", () => ({
  conversionsApi: {
    get: (id: string) => mocked.conversionGet(id),
    events: (id: string, handlers: { onEvent: (ev: string, data: unknown) => void }) =>
      mocked.conversionEvents(id, handlers),
  },
}));

import { useSourceActiveDownloads } from "@/hooks/useSourceActiveDownloads";
import type { SourceInspectResponse } from "@/types/scraping";

describe("useSourceActiveDownloads", () => {
  let queryClient: QueryClient;
  let eventHandler: (event: string, data: unknown) => void;

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocked.activeItems = [];
    mocked.conversionEvents.mockImplementation((_id, handlers) => {
      eventHandler = handlers.onEvent;
      return { close: vi.fn() };
    });
    mocked.conversionGet.mockResolvedValue({
      config: { books: [{ chapters: ["ch1", "ch2"] }] },
    });
  });

  it("deve inicializar com listas vazias quando não houver conversões ativas", () => {
    const { result } = renderHook(() => useSourceActiveDownloads("src-1"), { wrapper: Wrapper });

    expect(result.current.downloadingChapterIds.size).toBe(0);
    expect(result.current.failedChapterMap.size).toBe(0);
  });

  it("deve reagir a eventos de download.chapter.started, finished e skipped", async () => {
    mocked.activeItems = [{ conversionId: "conv-1", sourceId: "src-1", status: "processing" }];

    queryClient.setQueryData<Partial<SourceInspectResponse>>(["source", "src-1"], {
      sourceId: "src-1",
      chapters: [
        {
          id: "ch1",
          number: "1",
          title: "Cap 1",
          url: "http://test.com",
          pages: 10,
          volume: null,
          isDownloaded: false,
          isRead: false,
        },
      ],
    });

    const { result } = renderHook(() => useSourceActiveDownloads("src-1"), { wrapper: Wrapper });

    // Dispara download.chapter.started
    act(() => {
      eventHandler?.("download.chapter.started", { chapterId: "ch1" });
    });
    expect(result.current.downloadingChapterIds.has("ch1")).toBe(true);

    // Dispara download.chapter.finished -> atualiza cache
    act(() => {
      eventHandler?.("download.chapter.finished", { chapterId: "ch1" });
    });
    expect(result.current.downloadingChapterIds.has("ch1")).toBe(false);

    const sourceData = queryClient.getQueryData<SourceInspectResponse>(["source", "src-1"]);
    expect(sourceData?.chapters.find((c) => c.id === "ch1")?.isDownloaded).toBe(true);

    // Dispara download.chapter.skipped -> registra falha
    act(() => {
      eventHandler?.("download.chapter.skipped", {
        chapterId: "ch2",
        reason: "no_images_available",
      });
    });
    expect(result.current.failedChapterMap.get("ch2")).toBe("Indisponível na fonte");
  });
});
