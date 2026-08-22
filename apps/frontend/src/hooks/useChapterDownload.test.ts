import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChapterDownload } from "@/hooks/useChapterDownload";

const mockSseClose = vi.fn();
const mockCreateSSEStream = vi.fn();
const mockGetDownloadStatus = vi.fn();
const mockToken = "test-token-123";

vi.mock("@/lib/sse", () => ({
  createSSEStream: (...args: unknown[]) => mockCreateSSEStream(...args),
}));

vi.mock("@/lib/api", () => ({
  chaptersApi: {
    downloadEventsUrl: (sourceId: string, chapterId: string) =>
      `/api/sources/${sourceId}/chapters/${chapterId}/download/events`,
    getDownloadStatus: (...args: unknown[]) => mockGetDownloadStatus(...args),
  },
  tokenStore: {
    get: () => mockToken,
  },
}));

describe("useChapterDownload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSSEStream.mockReturnValue({ close: mockSseClose });
    mockGetDownloadStatus.mockResolvedValue({
      status: "not_downloaded",
      totalImages: null,
      downloadedImages: 0,
      jobId: null,
    });
  });

  it("deve inicializar com status idle quando enabled=false", () => {
    const { result } = renderHook(() => useChapterDownload("src", "ch", false));

    expect(result.current.status).toBe("idle");
    expect(result.current.totalImages).toBe(0);
    expect(result.current.downloadedImages).toBe(0);
  });

  it("deve conectar SSE quando enabled=true", () => {
    renderHook(() => useChapterDownload("src-test", "chap-001", true));

    expect(mockCreateSSEStream).toHaveBeenCalled();
    const call = mockCreateSSEStream.mock.calls[0];
    expect(call[0]).toContain("/api/sources/src-test/chapters/chap-001/download/events");
    expect(call[2]).toBe(mockToken);
  });

  it("deve atualizar estado com evento progress", async () => {
    let onEvent: (event: string, data: unknown) => void = () => {};

    mockCreateSSEStream.mockImplementation(
      (
        _url: string,
        handlers: { onEvent: (event: string, data: unknown) => void },
        _token?: string,
      ) => {
        onEvent = handlers.onEvent;
        return { close: mockSseClose };
      },
    );

    const { result } = renderHook(() => useChapterDownload("src", "ch", true));

    await act(async () => {
      onEvent("progress", { downloaded: 5, total: 20 });
    });

    await waitFor(() => {
      expect(result.current.status).toBe("downloading");
      expect(result.current.totalImages).toBe(20);
      expect(result.current.downloadedImages).toBe(5);
    });
  });

  it("deve atualizar estado com evento completed", async () => {
    let onEvent: (event: string, data: unknown) => void = () => {};

    mockCreateSSEStream.mockImplementation(
      (
        _url: string,
        handlers: { onEvent: (event: string, data: unknown) => void },
        _token?: string,
      ) => {
        onEvent = handlers.onEvent;
        return { close: mockSseClose };
      },
    );

    const { result } = renderHook(() => useChapterDownload("src", "ch", true));

    await act(async () => {
      onEvent("completed", { totalImages: 20, downloaded: 20 });
    });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
      expect(result.current.totalImages).toBe(20);
    });
  });

  it("deve limpar SSE no unmount", () => {
    const { unmount } = renderHook(() => useChapterDownload("src", "ch", true));

    unmount();

    expect(mockSseClose).toHaveBeenCalled();
  });

  it("deve iniciar poll fallback quando SSE onError é chamado", () => {
    let onError: (error: Error) => void = () => {};

    mockCreateSSEStream.mockImplementation(
      (_url: string, handlers: { onError: (error: Error) => void }, _token?: string) => {
        onError = handlers.onError;
        return { close: mockSseClose };
      },
    );

    renderHook(() => useChapterDownload("src", "ch", true));

    act(() => {
      onError(new Error("Connection failed"));
    });

    // O poll deve iniciar — verificamos que getDownloadStatus foi chamado
    expect(mockGetDownloadStatus).toHaveBeenCalledWith("src", "ch");
  });
});
