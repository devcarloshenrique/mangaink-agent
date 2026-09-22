import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scrapingApi } from "@/lib/api";
import { useScraping } from "./useScraping";
import type { SourceInspectResponse } from "@/types/scraping";

vi.mock("@/lib/api", () => ({
  scrapingApi: {
    inspect: vi.fn(),
    getSource: vi.fn(),
    inspectEvents: vi.fn(),
  },
}));

const mockMetadata: SourceInspectResponse = {
  sourceId: "source-123",
  status: "ready",
  provider: {
    slug: "mangadex",
    name: "MangaDex",
    engine: "api",
  },
  source: {
    url: "https://mangadex.org/title/123",
    language: "pt-br",
  },
  metadata: {
    title: "Test Manga",
    author: "Autor Teste",
    description: "Sinopse teste",
    status: "ongoing",
    genres: ["Ação"],
  },
  chapters: [],
  covers: [],
  statistics: {
    chapters: 0,
    covers: 0,
  },
};

describe("useScraping", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna metadados diretamente quando o status inicial for ready (cache hit)", async () => {
    vi.mocked(scrapingApi.inspect).mockResolvedValueOnce({
      sourceId: "source-123",
      status: "ready",
    });
    vi.mocked(scrapingApi.getSource).mockResolvedValueOnce(mockMetadata);

    const { result } = renderHook(() => useScraping());

    await act(async () => {
      await result.current.inspect("https://mangadex.org/title/123");
    });

    expect(result.current.state.status).toBe("ready");
    expect(result.current.state.sourceId).toBe("source-123");
    expect(result.current.state.metadata?.metadata.title).toBe("Test Manga");
    expect(result.current.state.progress).toBe(100);
  });

  it("abre SSE e completa com onCompleted quando o status for processing", async () => {
    vi.mocked(scrapingApi.inspect).mockResolvedValueOnce({
      sourceId: "source-123",
      status: "processing",
    });
    vi.mocked(scrapingApi.getSource).mockResolvedValue(mockMetadata);

    let capturedCallbacks: Parameters<typeof scrapingApi.inspectEvents>[1] | null = null;
    vi.mocked(scrapingApi.inspectEvents).mockImplementationOnce((_id, callbacks) => {
      capturedCallbacks = callbacks;
      return { close: vi.fn() };
    });

    const { result } = renderHook(() => useScraping());

    await act(async () => {
      await result.current.inspect("https://mangadex.org/title/123");
    });

    expect(result.current.state.status).toBe("processing");
    expect(capturedCallbacks).not.toBeNull();

    // Simula progresso SSE
    act(() => {
      capturedCallbacks?.onProgress?.({
        stage: "fetch_metadata" as never,
        message: "Carregando metadados...",
        progress: 50,
      });
    });
    expect(result.current.state.progress).toBe(50);
    expect(result.current.state.message).toBe("Carregando metadados...");

    // Simula conclusão SSE
    await act(async () => {
      await capturedCallbacks?.onCompleted?.({ sourceId: "source-123" });
    });

    expect(result.current.state.status).toBe("ready");
    expect(result.current.state.metadata?.metadata.title).toBe("Test Manga");
  });

  it("recupera resultado via polling se o SSE não enviar completed", async () => {
    vi.mocked(scrapingApi.inspect).mockResolvedValueOnce({
      sourceId: "source-123",
      status: "processing",
    });
    // getSource inicialmente falha e depois retorna o metadata
    vi.mocked(scrapingApi.getSource)
      .mockRejectedValueOnce(new Error("Not ready"))
      .mockResolvedValueOnce(mockMetadata);

    vi.mocked(scrapingApi.inspectEvents).mockReturnValueOnce({ close: vi.fn() });

    const { result } = renderHook(() => useScraping());

    await act(async () => {
      await result.current.inspect("https://mangadex.org/title/123");
    });

    expect(result.current.state.status).toBe("processing");

    // Avança 2 segundos (1º tick do polling)
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Avança mais 2 segundos (2º tick do polling)
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.state.status).toBe("ready");
    expect(result.current.state.metadata?.metadata.title).toBe("Test Manga");
  });

  it("marca erro se exceder o timeout de 60s", async () => {
    vi.mocked(scrapingApi.inspect).mockResolvedValueOnce({
      sourceId: "source-123",
      status: "processing",
    });
    vi.mocked(scrapingApi.getSource).mockRejectedValue(new Error("Still pending"));
    vi.mocked(scrapingApi.inspectEvents).mockReturnValueOnce({ close: vi.fn() });

    const { result } = renderHook(() => useScraping());

    await act(async () => {
      await result.current.inspect("https://mangadex.org/title/123");
    });

    expect(result.current.state.status).toBe("processing");

    // Avança 60 segundos
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.error).toContain("Tempo limite excedido");
  });
});
