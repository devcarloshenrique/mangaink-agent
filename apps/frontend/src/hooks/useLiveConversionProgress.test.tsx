import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { selectOverallProgress, useLiveConversionProgress } from "./useLiveConversionProgress";
import { useConversionProgress } from "./useConversionProgress";

const mocked = vi.hoisted(() => {
  return {
    eventsHandlers: [] as Array<{
      onEvent: (event: string, data: unknown) => void;
      onError?: (e: Error) => void;
      onEnd?: (info?: { status?: number }) => void;
    }>,
    closes: [] as Array<ReturnType<typeof vi.fn>>,
    get: vi.fn(),
    getLogs: vi.fn(),
    events: vi.fn(),
    reset() {
      mocked.eventsHandlers = [];
      mocked.closes = [];
      mocked.get.mockClear();
      mocked.getLogs.mockClear();
      mocked.events.mockClear();
    },
  };
});

vi.mock("@/lib/api", () => ({
  conversionsApi: {
    get: (...args: unknown[]) => mocked.get(...args),
    getLogs: (...args: unknown[]) => mocked.getLogs(...args),
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
  mocked.getLogs.mockResolvedValue([]);
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  window.sessionStorage.clear();
});

describe("useLiveConversionProgress", () => {
  it("seed usa a fórmula (ignora initial.progress como valor exibido)", async () => {
    // jobs vazio + nada processado → fórmula = 0, mesmo com progress: 42
    // persistido no backend antes do job.finished.
    mocked.get.mockResolvedValue(makeConversionState({ progress: 42 }));

    const { result } = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.get("conv-1")?.overall).toBe(0);
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

  it("não retenta SSE após 401 (auth expirada): fecha a entrada sem backoff", async () => {
    const { result } = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mocked.eventsHandlers).toHaveLength(1);

    act(() => {
      mocked.eventsHandlers[0].onEnd?.({ status: 401 });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    // Sem nova subscrição — o timer de retry nunca foi agendado.
    expect(mocked.eventsHandlers).toHaveLength(1);
    expect(result.current.get("conv-1")?.done).toBe(false);
  });

  it("não retenta SSE após 404 (conversão removida): fecha a entrada sem backoff", async () => {
    const { result } = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mocked.eventsHandlers).toHaveLength(1);

    act(() => {
      mocked.eventsHandlers[0].onEnd?.({ status: 404 });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mocked.eventsHandlers).toHaveLength(1);
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

  it("hidrata estado inicial a partir do sessionStorage (evita barra zerada no F5)", async () => {
    window.sessionStorage.setItem(
      "mangaink:live_prog:conv-1",
      JSON.stringify({
        overall: 45,
        downloadOnly: false,
        chaptersDone: 4,
        chaptersTotal: 10,
        chaptersFailed: 0,
      }),
    );

    // GET demora a responder ou ainda não resolveu
    mocked.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(makeConversionState({ progress: 45 })), 500);
        }),
    );

    const { result } = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });

    // Logo após montar, antes do GET resolver: a barra pinta o overall salvo
    // (sem zerar) e os totais; as CONTAGENS partem de zero e o replay do
    // journal reconstrói o valor exato — restaurar salvos + replay contaria
    // em dobro (divergência capa/sino > página).
    expect(result.current.get("conv-1")).toMatchObject({
      overall: 45,
      chaptersDone: 0,
      chaptersTotal: 10,
      chaptersFailed: 0,
      downloadOnly: false,
      done: false,
    });

    // Replay/eventos reconstroem a contagem exata e o sessionStorage acompanha
    emit(0, "download.chapter.finished", { chapterId: "chap_0001" });
    expect(result.current.get("conv-1")?.chaptersDone).toBe(1);

    const saved = JSON.parse(window.sessionStorage.getItem("mangaink:live_prog:conv-1") ?? "{}");
    expect(saved.chaptersDone).toBe(1);
  });

  it("ignora download.started per-job: totalChapters global do seed é preservado", async () => {
    const { result } = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // Seed via config.books: 2 + 2 = 4 global.
    expect(result.current.get("conv-1")?.chaptersTotal).toBe(4);
    emit(0, "download.started", { totalChapters: 2 });
    expect(result.current.get("conv-1")?.chaptersTotal).toBe(4);
  });

  it("replay do journal conta capítulos/jobs uma vez (reconnect não infla)", async () => {
    const { result } = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Replay integral: os mesmos eventos chegam 2x (reconnect/watchdog).
    emit(0, "download.chapter.finished", { chapterId: "chap_0001" });
    emit(0, "download.chapter.finished", { chapterId: "chap_0001" });
    emit(0, "download.chapter.finished", { chapterId: "chap_0002" });
    emit(0, "download.chapter.finished", { chapterId: "chap_0002" });
    emit(0, "job.finished", { jobId: "job_a" });
    emit(0, "job.finished", { jobId: "job_a" });

    // 2 capítulos + 1 job — sem o gate seriam 4 capítulos + 2 jobs
    // (terminal falso com 100% prematuro). overall 75 = paridade com a
    // página: job.finished sela kcc=100 nos dois (JOB_COMPLETED no reducer).
    expect(result.current.get("conv-1")).toMatchObject({
      chaptersDone: 2,
      chaptersTotal: 4,
      done: false,
      overall: 75,
    });
  });

  it("recriação de entrada (F5/churn) + replay não duplica a contagem", async () => {
    const hookOpts = { wrapper: Wrapper };
    const first = renderHook(() => useLiveConversionProgress(["conv-1"]), hookOpts);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    emit(0, "download.chapter.finished", { chapterId: "chap_0001" });
    emit(0, "download.chapter.finished", { chapterId: "chap_0002" });
    expect(first.result.current.get("conv-1")?.chaptersDone).toBe(2);
    first.unmount(); // entrada some (sem subscribers), sessionStorage fica

    const second = renderHook(() => useLiveConversionProgress(["conv-1"]), hookOpts);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // Replay integral no novo connect: os 2 capítulos voltam + 1 novo.
    // O remount abre um NOVO handler SSE — o índice 0 é da conexão morta.
    const fresh = mocked.eventsHandlers.length - 1;
    emit(fresh, "download.chapter.finished", { chapterId: "chap_0001" });
    emit(fresh, "download.chapter.finished", { chapterId: "chap_0002" });
    emit(fresh, "download.chapter.finished", { chapterId: "chap_0003" });

    // Sem o fix: salvos (2) + replay (3) = 5. Com o fix: 3.
    expect(second.result.current.get("conv-1")?.chaptersDone).toBe(3);
    expect(second.result.current.get("conv-1")?.chaptersTotal).toBe(4);
    second.unmount();
  });

  it("limpa sessionStorage ao atingir estado terminal ou quando GET retorna status final", async () => {
    window.sessionStorage.setItem(
      "mangaink:live_prog:conv-1",
      JSON.stringify({
        overall: 80,
        downloadOnly: false,
        chaptersDone: 8,
        chaptersTotal: 10,
        chaptersFailed: 0,
      }),
    );

    const { result } = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(window.sessionStorage.getItem("mangaink:live_prog:conv-1")).not.toBeNull();

    emit(0, "download.chapter.finished");
    emit(0, "job.finished");
    emit(0, "job.finished"); // 2 totalJobs finalizados

    expect(result.current.get("conv-1")?.done).toBe(true);
    expect(window.sessionStorage.getItem("mangaink:live_prog:conv-1")).toBeNull();
  });

  it("limpa sessionStorage quando o seed inicial já detecta status completed/failed/cancelled", async () => {
    window.sessionStorage.setItem(
      "mangaink:live_prog:conv-1",
      JSON.stringify({
        overall: 90,
        downloadOnly: false,
        chaptersDone: 9,
        chaptersTotal: 10,
        chaptersFailed: 0,
      }),
    );

    mocked.get.mockResolvedValue(makeConversionState({ status: "completed", progress: 100 }));

    renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(window.sessionStorage.getItem("mangaink:live_prog:conv-1")).toBeNull();
  });

  it("dois subscribers do mesmo id compartilham UM sse e o mesmo % (capa = sino)", async () => {
    mocked.get.mockResolvedValue(makeConversionState({ totalJobs: 1 }));

    const hookA = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    const hookB = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Um SSE por conversão — o segundo subscriber só escuta, nunca re-seeda.
    expect(mocked.eventsHandlers).toHaveLength(1);
    expect(mocked.get).toHaveBeenCalledTimes(1);

    emit(0, "download.started", { totalChapters: 4 });
    emit(0, "download.chapter.finished");
    emit(0, "download.chapter.finished");
    emit(0, "conversion.progress", { progress: 50 });

    const a = hookA.result.current.get("conv-1")?.overall;
    const b = hookB.result.current.get("conv-1")?.overall;
    expect(a).toBeDefined();
    expect(b).toBe(a);
  });

  it("cauda pré-terminal iguala a referência (capítulos + KCC completos = 100, sem cap 99)", async () => {
    mocked.get.mockResolvedValue(
      makeConversionState({
        totalJobs: 1,
        config: { books: [{ title: "v1", chapters: ["c1", "c2", "c3", "c4"] }] },
      }),
    );

    const hookA = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    const hookB = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    emit(0, "download.started", { totalChapters: 4 });
    emit(0, "download.chapter.finished");
    emit(0, "download.chapter.finished");
    emit(0, "download.chapter.finished");
    emit(0, "download.chapter.finished");
    emit(0, "conversion.finished"); // kccProgress=100 sem job.finished

    // Sem cap: 100 exatamente quando a página exibe 100 (igualdade com a
    // referência, não antecipação isolada — a página calcula o mesmo).
    const a = hookA.result.current.get("conv-1");
    const b = hookB.result.current.get("conv-1");
    expect(a?.done).toBe(false);
    expect(a?.overall).toBe(100);
    expect(b?.overall).toBe(a?.overall);

    emit(0, "job.finished");

    expect(hookA.result.current.get("conv-1")).toMatchObject({ done: true, overall: 100 });
    expect(hookB.result.current.get("conv-1")).toMatchObject({ done: true, overall: 100 });
  });

  it("seed com progress 100 e status processing usa a fórmula (jobs vazio → 0)", async () => {
    mocked.get.mockResolvedValue(makeConversionState({ status: "processing", progress: 100 }));

    const { result } = renderHook(() => useLiveConversionProgress(["conv-1"]), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.get("conv-1")?.overall).toBe(0);
    expect(result.current.get("conv-1")?.done).toBe(false);
  });
});

describe("paridade capa/sino = página (useLiveConversionProgress × useConversionProgress)", () => {
  function emitAll(event: string, data: Record<string, unknown> = {}) {
    act(() => {
      for (const h of mocked.eventsHandlers) h.onEvent(event, data);
    });
  }

  it("overall idênticos após cada evento: piso 5, reset por job, download.started per-job, cauda e totalChapters=0", async () => {
    mocked.get.mockResolvedValue(makeConversionState());

    const { result } = renderHook(
      () => {
        const live = useLiveConversionProgress(["conv-parity"]);
        const page = useConversionProgress("conv-parity");
        return { live, page };
      },
      { wrapper: Wrapper },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(mocked.eventsHandlers).toHaveLength(2);

    const overall = () => ({
      live: result.current.live.get("conv-parity")?.overall ?? -1,
      page: result.current.page.overallProgress,
    });
    const seen: number[] = [];
    const expectEqual = () => {
      const { live, page } = overall();
      expect(live).toBe(page);
      expect(live).toBeLessThanOrEqual(100);
      expect(page).toBeLessThanOrEqual(100);
      seen.push(live);
    };

    expectEqual(); // seed: 0 nos dois
    expect(overall().page).toBe(0);

    // download.started anuncia N per-job (2) — o total global do seed (4) prevalece.
    emitAll("download.started", { totalChapters: 2 });
    expect(result.current.live.get("conv-parity")?.chaptersTotal).toBe(4);
    expectEqual();

    emitAll("download.chapter.finished", { chapterId: "chap_0001" });
    emitAll("download.chapter.finished", { chapterId: "chap_0002" });
    expectEqual();
    expect(overall().page).toBe(25);

    // Piso 5 no início do KCC (conversion.started) nos dois.
    emitAll("conversion.started", { deviceId: "d", format: "f" });
    expectEqual();

    emitAll("conversion.progress", { progress: 40 });
    expectEqual();
    expect(overall().page).toBe(35);

    emitAll("conversion.finished");
    expectEqual();
    expect(overall().page).toBe(50);

    emitAll("job.finished");
    expectEqual();
    expect(overall().page).toBe(75);

    // Troca de job zera o KCC nos dois (clamp monotônico segura o overall).
    emitAll("job.started");
    expectEqual();

    // Job 2 também anuncia download.started per-job — total segue global.
    emitAll("download.started", { totalChapters: 2 });
    expect(result.current.live.get("conv-parity")?.chaptersTotal).toBe(4);
    expectEqual();

    emitAll("download.chapter.finished", { chapterId: "chap_0003" });
    emitAll("download.chapter.finished", { chapterId: "chap_0004" });
    expectEqual();

    emitAll("conversion.started", { deviceId: "d", format: "f" });
    expectEqual();

    emitAll("conversion.progress", { progress: 80 });
    expectEqual();
    expect(overall().page).toBe(95);

    // Cauda: capítulos + KCC completos antes do job.finished — iguais.
    emitAll("conversion.finished");
    expectEqual();
    expect(overall().page).toBe(100);
    expect(overall().live).toBe(100);

    emitAll("job.finished");
    expectEqual();
    expect(result.current.live.get("conv-parity")).toMatchObject({ done: true, overall: 100 });
    expect(result.current.page.overallProgress).toBe(100);

    // Bug anterior (totalChapters sobrescrito pelo per-job) grudava o overall
    // em 100 já no fim do job 1 — nunca pode exceder 100 em nenhum ponto.
    expect(Math.max(...seen)).toBeLessThanOrEqual(100);
  });

  it("multi-volume: download.started per-job não corrompe totalChapters global", async () => {
    // Seed: 2 jobs, config.books com 2 capítulos cada (total global = 4).
    mocked.get.mockResolvedValue(makeConversionState());

    const { result } = renderHook(
      () => {
        const live = useLiveConversionProgress(["conv-multi"]);
        const page = useConversionProgress("conv-multi");
        return { live, page };
      },
      { wrapper: Wrapper },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(mocked.eventsHandlers).toHaveLength(2);

    // Sequência completa dos 2 jobs com download.started per-job em cada.
    const steps: Array<[string, Record<string, unknown>]> = [
      ["download.started", { totalChapters: 2 }],
      ["download.chapter.finished", { chapterId: "chap_0001" }],
      ["download.chapter.finished", { chapterId: "chap_0002" }],
      ["conversion.started", { deviceId: "d", format: "f" }],
      ["conversion.progress", { progress: 40 }],
      ["conversion.finished", {}],
      ["job.finished", {}],
      ["job.started", {}],
      ["download.started", { totalChapters: 2 }],
      ["download.chapter.finished", { chapterId: "chap_0003" }],
      ["download.chapter.finished", { chapterId: "chap_0004" }],
      ["conversion.started", { deviceId: "d", format: "f" }],
      ["conversion.progress", { progress: 80 }],
      ["conversion.finished", {}],
      ["job.finished", {}],
    ];

    for (const [event, data] of steps) {
      emitAll(event, data);
      const live = result.current.live.get("conv-multi");
      const page = result.current.page.overallProgress;
      // Total global preservado após cada evento, overall idêntico e ≤ 100.
      expect(live?.chaptersTotal).toBe(4);
      expect(live?.overall).toBe(page);
      expect(live?.overall).toBeLessThanOrEqual(100);
      expect(page).toBeLessThanOrEqual(100);
    }

    expect(result.current.live.get("conv-multi")).toMatchObject({ done: true, overall: 100 });
    expect(result.current.page.overallProgress).toBe(100);
  });

  it("replay integral no meio da conversão mantém paridade capa/sino = página", async () => {
    mocked.get.mockResolvedValue(makeConversionState());

    const { result } = renderHook(
      () => {
        const live = useLiveConversionProgress(["conv-replay"]);
        const page = useConversionProgress("conv-replay");
        return { live, page };
      },
      { wrapper: Wrapper },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(mocked.eventsHandlers).toHaveLength(2);

    const overall = () => ({
      live: result.current.live.get("conv-replay")?.overall ?? -1,
      page: result.current.page.overallProgress,
    });
    const expectEqual = () => {
      const { live, page } = overall();
      expect(live).toBe(page);
      expect(live).toBeLessThanOrEqual(100);
    };

    // Job 1 completo.
    const job1: Array<[string, Record<string, unknown>]> = [
      ["download.chapter.finished", { chapterId: "chap_0001" }],
      ["download.chapter.finished", { chapterId: "chap_0002" }],
      ["conversion.started", { deviceId: "d", format: "f" }],
      ["conversion.progress", { progress: 40 }],
      ["conversion.finished", {}],
      ["job.finished", { jobId: "job_1" }],
    ];
    for (const [event, data] of job1) emitAll(event, data);
    expectEqual();
    const afterJob1 = overall();
    expect(afterJob1.page).toBe(75);

    // Reconnect em um dos streams: o journal inteiro do job 1 volta.
    // Sem dedupe, capítulos/jobs contariam em dobro e as barras divergiriam.
    for (const [event, data] of job1) emitAll(event, data);
    expectEqual();
    expect(overall()).toEqual(afterJob1);
    expect(result.current.live.get("conv-replay")?.chaptersDone).toBe(2);

    // Job 2 fecha 100% nos dois.
    emitAll("job.started", {});
    emitAll("download.chapter.finished", { chapterId: "chap_0003" });
    emitAll("download.chapter.finished", { chapterId: "chap_0004" });
    emitAll("conversion.finished", {});
    emitAll("job.finished", { jobId: "job_2" });
    expectEqual();
    expect(result.current.live.get("conv-replay")).toMatchObject({ done: true, overall: 100 });
  });

  it("job.finished sem conversion.finished prévio mantém paridade (kcc=100 nos dois)", async () => {
    mocked.get.mockResolvedValue(makeConversionState());

    const { result } = renderHook(
      () => {
        const live = useLiveConversionProgress(["conv-kcc"]);
        const page = useConversionProgress("conv-kcc");
        return { live, page };
      },
      { wrapper: Wrapper },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const overall = () => ({
      live: result.current.live.get("conv-kcc")?.overall ?? -1,
      page: result.current.page.overallProgress,
    });
    const expectEqual = () => {
      const { live, page } = overall();
      expect(live).toBe(page);
    };

    // downloadOnly / falha rápida: job.finished chega sem conversion.finished.
    emitAll("download.chapter.finished", { chapterId: "chap_0001" });
    emitAll("download.chapter.finished", { chapterId: "chap_0002" });
    emitAll("job.finished", { jobId: "job_1" });
    expectEqual();
    // 2/4 capítulos + 1/2 jobs com kcc selado = 75 nos dois (sem o fix o
    // live ficava em 50 até o próximo evento).
    expect(overall().page).toBe(75);
    expect(overall().live).toBe(75);
  });

  it("error(chap) → finished(chap) de retentativa conta e mantém paridade", async () => {
    mocked.get.mockResolvedValue(makeConversionState());

    const { result } = renderHook(
      () => {
        const live = useLiveConversionProgress(["conv-retry"]);
        const page = useConversionProgress("conv-retry");
        return { live, page };
      },
      { wrapper: Wrapper },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const overall = () => ({
      live: result.current.live.get("conv-retry")?.overall ?? -1,
      page: result.current.page.overallProgress,
    });
    const expectEqual = () => {
      const { live, page } = overall();
      expect(live).toBe(page);
    };

    // error conta mas NÃO sela — o finished da retentativa avança.
    emitAll("download.error", { chapterId: "chap_0001", error: "timeout" });
    expectEqual();
    expect(result.current.live.get("conv-retry")?.chaptersDone).toBe(1);
    emitAll("download.chapter.finished", { chapterId: "chap_0001" });
    expectEqual();
    expect(result.current.live.get("conv-retry")?.chaptersDone).toBe(2);

    // Ordem inversa: finished sela, replay de error antigo é dedupado.
    emitAll("download.chapter.finished", { chapterId: "chap_0002" });
    expectEqual();
    emitAll("download.error", { chapterId: "chap_0002", error: "timeout tardio" });
    expectEqual();
    expect(result.current.live.get("conv-retry")?.chaptersDone).toBe(3);
  });

  it("página reconecta após onEnd: nova subscrição + replay sem contar em dobro", async () => {
    mocked.get.mockResolvedValue(makeConversionState());

    const { result } = renderHook(
      () => {
        const live = useLiveConversionProgress(["conv-resub"]);
        const page = useConversionProgress("conv-resub");
        return { live, page };
      },
      { wrapper: Wrapper },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(mocked.eventsHandlers).toHaveLength(2);

    emitAll("download.chapter.finished", { chapterId: "chap_0001" });
    emitAll("download.chapter.finished", { chapterId: "chap_0002" });
    expect(result.current.page.overallProgress).toBe(25);

    // Stream da página cai sem estado terminal → backoff 1s → resubscribe.
    act(() => {
      mocked.eventsHandlers[1].onEnd?.();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(mocked.eventsHandlers).toHaveLength(3);

    // Replay integral na nova subscrição (gates do mesmo closure dedupam
    // chap_0001/chap_0002) + 1 capítulo novo.
    const fresh = mocked.eventsHandlers.length - 1;
    const emitFresh = (event: string, data: Record<string, unknown> = {}) => {
      act(() => {
        mocked.eventsHandlers[fresh]?.onEvent(event, data);
      });
    };
    emitFresh("download.chapter.finished", { chapterId: "chap_0001" });
    emitFresh("download.chapter.finished", { chapterId: "chap_0002" });
    emitFresh("download.chapter.finished", { chapterId: "chap_0003" });
    // 3/4 capítulos = 38; com contagem em dobro seria 63.
    expect(result.current.page.overallProgress).toBe(38);
  });
  it("totalChapters=0 → ambos 0 após qualquer evento", async () => {
    mocked.get.mockResolvedValue(makeConversionState({ config: { books: [] } }));

    const { result } = renderHook(
      () => {
        const live = useLiveConversionProgress(["conv-zero"]);
        const page = useConversionProgress("conv-zero");
        return { live, page };
      },
      { wrapper: Wrapper },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const overall = () => ({
      live: result.current.live.get("conv-zero")?.overall ?? -1,
      page: result.current.page.overallProgress,
    });

    emitAll("conversion.started", { deviceId: "d", format: "f" });
    emitAll("conversion.progress", { progress: 60 });
    emitAll("conversion.finished");

    expect(overall().live).toBe(0);
    expect(overall().page).toBe(0);
  });
});

describe("selectOverallProgress", () => {
  it("arredonda e limita a 0–100 com fallback", () => {
    expect(selectOverallProgress(42.6, 10)).toBe(43);
    expect(selectOverallProgress(undefined, 37.4)).toBe(37);
    expect(selectOverallProgress(undefined, undefined)).toBe(0);
    expect(selectOverallProgress(150, 0)).toBe(100);
    expect(selectOverallProgress(-5, 0)).toBe(0);
  });
});
