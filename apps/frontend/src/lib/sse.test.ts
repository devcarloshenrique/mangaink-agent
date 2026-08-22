import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSSEStream } from "@/lib/sse";

describe("createSSEStream", () => {
  let mockReadable: ReturnType<typeof createMockReadableStream>;

  function createMockReadableStream(data: string[]) {
    let readerIndex = 0;
    const reader = {
      read: vi.fn(() => {
        if (readerIndex < data.length) {
          const chunk = new TextEncoder().encode(data[readerIndex++]);
          return Promise.resolve({ done: false, value: chunk });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
      cancel: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn(),
    };

    return {
      getReader: vi.fn(() => reader),
      reader,
    };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    mockReadable = createMockReadableStream([]);
    const mockResponse = {
      ok: true,
      body: mockReadable,
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse as unknown as Response);
  });

  it("deve chamar onEvent para cada frame SSE", async () => {
    mockReadable = createMockReadableStream([
      'event: progress\ndata: {"stage":"download","progress":50}\n\n',
      'event: completed\ndata: {"sourceId":"src_123"}\n\n',
    ]);
    const mockResponse = { ok: true, body: mockReadable };
    global.fetch = vi.fn().mockResolvedValue(mockResponse as unknown as Response);

    const onEvent = vi.fn();
    const stream = createSSEStream("/test", { onEvent });

    await new Promise((r) => setTimeout(r, 100));

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenCalledWith("progress", { stage: "download", progress: 50 });
    expect(onEvent).toHaveBeenCalledWith("completed", { sourceId: "src_123" });

    stream.close();
  });

  it("deve injetar token como Authorization header", () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, body: createMockReadableStream([]) } as unknown as Response);

    createSSEStream("/test", { onEvent: vi.fn() }, "my-token-123");

    expect(global.fetch).toHaveBeenCalledWith(
      "/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-token-123",
        }),
      }),
    );
  });

  it("deve ignorar keepalive (: keepalive)", async () => {
    mockReadable = createMockReadableStream([
      ": keepalive\n\n",
      'event: test\ndata: {"msg":"hello"}\n\n',
    ]);
    const mockResponse = { ok: true, body: mockReadable };
    global.fetch = vi.fn().mockResolvedValue(mockResponse as unknown as Response);

    const onEvent = vi.fn();
    const stream = createSSEStream("/test", { onEvent });

    await new Promise((r) => setTimeout(r, 100));

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith("test", { msg: "hello" });

    stream.close();
  });

  it("close deve abortar o fetch", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    mockReadable = createMockReadableStream([": keepalive\n\n"]);
    const mockResponse = { ok: true, body: mockReadable };
    global.fetch = vi.fn().mockResolvedValue(mockResponse as unknown as Response);

    const stream = createSSEStream("/test", { onEvent: vi.fn() });

    await new Promise((r) => setTimeout(r, 50));

    stream.close();
    expect(abortSpy).toHaveBeenCalled();
  });

  it("deve chamar onError quando fetch falha", async () => {
    const error = new Error("Network error");
    global.fetch = vi.fn().mockRejectedValue(error);

    const onError = vi.fn();
    createSSEStream("/test", { onEvent: vi.fn(), onError });

    await new Promise((r) => setTimeout(r, 100));

    expect(onError).toHaveBeenCalledWith(error);
  });
});
