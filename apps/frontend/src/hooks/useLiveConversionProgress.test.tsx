import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useLiveConversionProgress } from "./useLiveConversionProgress";

const mocked = vi.hoisted(() => {
  return {
    eventsHandlers: [] as Array<{
      onEvent: (event: string, data: unknown) => void;
      onError?: (e: Error) => void;
      onEnd?: () => void;
    }>,
    closes: [] as Array<ReturnType<typeof vi.fn>>,
    get: vi.fn(),
    events: vi.fn(),
    reset() {
      mocked.eventsHandlers = [];
      mocked.closes = [];
      mocked.get.mockClear();
      mocked.events.mockClear();
    },
  };
});

vi.mock("@/lib/api", () => ({
  conversionsApi: {
    get: (...args: unknown[]) => mocked.get(...args),
    events: (_id: string, handlers: never) => {
      mocked.eventsHandlers.push(handlers);
      const close = vi.fn();
      mocked.closes.push(close);
      return { close };
    },
  },
}));

function makeConversionState(overrides: Record<string, unknown> = {}) {
  return {
    conversionId: "conv-1",
    status: "processing",
    progress: 0,
    totalJobs: 2,
    completedJobs: 0,
    failedJobs: 0,
    runningJobs: 0,
    pendingJobs: 2,
    jobs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: {
      books: [
        { title: "v1", chapters: ["chap_0001", "chap_0002"] },
        { title: "v2", chapters: ["chap_0003", "chap_0004"] },
      ],
    },
    ...overrides,
  };
}

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function emit(index: number, event: string, data: Record<string, unknown> = {}) {
  act(() => {
    mocked.eventsHandlers[index]?.onEvent(event, data);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  mocked.reset();
  mocked.get.mockResolvedValue(makeConversionState());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useLiveConversionProgress", () => {
  it("faz seed inicial via GET e expõe o % da conversão", async () => {
    mocked.get.mockResolvedValue(makeConversionState({ progress: 42 }));

    const { result } = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.get("conv-1")?.overall).toBe(42);
    expect(mocked.eventsHandlers).toHaveLength(1);
  });

  it("job.finished em todos os jobs → done=true, 100% e invalida listagens", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useLiveConversionProgress(["conv-1"]), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // seed
    });

    emit(0, "download.chapter.finished");
    emit(0, "download.chapter.finished");
    emit(0, "conversion.progress", { progress: 80 });
    emit(0, "job.finished");
    emit(0, "download.chapter.finished", { chapterId: "x" }); // job 2
    emit(0, "download.chapter.skipped"); // job 2
    emit(0, "job.finished");

    expect(result.current.get("conv-1")).toMatchObject({
      done: true,
      overall: 100,
      chaptersDone: 4,
      chaptersTotal: 4,
      chaptersFailed: 1,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["conversions"] });
    // A notificação de conclusão aparece na hora no sino — mesmo com SSE delas morto.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
  });

  it("expõe contadores de capítulos em tempo real para download-only", async () => {
    mocked.get.mockResolvedValue(
      makeConversionState({
        progress: 0,
        config: {
          downloadOnly: true,
          books: [{ title: "v1", chapters: ["c1", "c2", "c3"] }],
        },
      }),
    );

    const { result } = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.get("conv-1")).toMatchObject({
      downloadOnly: true,
      chaptersDone: 0,
      chaptersTotal: 3,
      chaptersFailed: 0,
      overall: 0,
    });

    emit(0, "download.chapter.finished");
    expect(result.current.get("conv-1")).toMatchObject({
      chaptersDone: 1,
      chaptersTotal: 3,
      chaptersFailed: 0,
      overall: 33,
    });

    emit(0, "download.chapter.skipped");
    expect(result.current.get("conv-1")).toMatchObject({
      chaptersDone: 2,
      chaptersTotal: 3,
      chaptersFailed: 1,
      overall: 67,
    });
  });

  it("% nunca regride (clamp monotônico)", async () => {
    const { result } = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    emit(0, "download.chapter.finished");
    emit(0, "download.chapter.finished");
    emit(0, "download.chapter.finished");
    emit(0, "download.chapter.finished");
    emit(0, "conversion.progress", { progress: 90 });

    const peak = result.current.get("conv-1")!.overall;

    // Evento "atrasado" com progresso menor não pode derrubar a barra.
    emit(0, "conversion.progress", { progress: 10 });
    expect(result.current.get("conv-1")!.overall).toBeGreaterThanOrEqual(peak);
  });

  it("reconecta com backoff quando o stream cai sem estado terminal", async () => {
    const { result } = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mocked.eventsHandlers).toHaveLength(1);

    // Stream morre → onEnd → retry após 1s (base do backoff).
    act(() => {
      mocked.eventsHandlers[0].onEnd?.();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(mocked.eventsHandlers).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mocked.eventsHandlers).toHaveLength(2);

    // Evento na nova conexão zera o backoff.
    emit(1, "download.chapter.started");

    act(() => {
      mocked.eventsHandlers[1].onEnd?.();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(mocked.eventsHandlers).toHaveLength(2); // ainda dentro do delay zerado
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mocked.eventsHandlers).toHaveLength(3);

    expect(result.current.get("conv-1")?.done).toBe(false);
  });

  it("REGRESSÃO: watchdog da conexão antiga não mata a conexão nova", async () => {
    const { result } = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Conexão #1 sem nenhum evento: dois ticks do watchdog (35s cada) até
    // detectar stall, mais o delay do backoff (1s).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(35_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(36_000);
    });
    expect(mocked.eventsHandlers).toHaveLength(2); // reconectou

    // Conexão #2 saudável: eventos periódicos mantêm seu próprio watchdog
    // alimentado (sem eles, o watchdog da #2 a reciclaria por design).
    // Janela total >> ciclo do watchdog antigo — sem a correção de geração,
    // o watchdog ÓRFÃO da #1 fechava a conexão atual aqui e gerava
    // reconexões extras (handlers.length > 2).
    emit(1, "download.chapter.started");
    let reconnects = mocked.eventsHandlers.length;
    for (let i = 0; i < 8; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      emit(1, "conversion.progress", { progress: 20 });
      reconnects = Math.max(reconnects, mocked.eventsHandlers.length);
      // A conexão atual nunca é fechada pelo watchdog antigo.
      expect(mocked.closes[1].mock.calls.length).toBe(0);
    }

    expect(reconnects).toBe(2); // só a reciclagem legítima da conexão #1
    expect(result.current.get("conv-1")?.done).toBe(false);
  });
});
