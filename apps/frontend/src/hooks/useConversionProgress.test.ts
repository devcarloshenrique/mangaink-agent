import { describe, it, expect } from "vitest";

function formatChapterId(chapterId: string): string {
  const match = chapterId.match(/chap_0*(\d+)(?:_(\d+))?/i);
  if (!match) return chapterId;
  const main = parseInt(match[1], 10);
  const sub = match[2] ? `.${match[2]}` : "";
  return `Capítulo ${main}${sub}`;
}

describe("formatChapterId", () => {
  it('converte chap_0001 para "Capítulo 1"', () => {
    expect(formatChapterId("chap_0001")).toBe("Capítulo 1");
  });

  it('converte chap_0010 para "Capítulo 10"', () => {
    expect(formatChapterId("chap_0010")).toBe("Capítulo 10");
  });

  it('converte chap_0001_2 para "Capítulo 1.2"', () => {
    expect(formatChapterId("chap_0001_2")).toBe("Capítulo 1.2");
  });

  it("retorna id original quando formato não reconhecido", () => {
    expect(formatChapterId("unknown_id")).toBe("unknown_id");
  });
});

// ── Teste da lógica de deriveStages (função real importada do hook) ───
import {
  INITIAL_PROGRESS,
  progressReducer,
  problemFromJournalEntry,
  deriveStages,
  type ProgressState,
} from "./useConversionProgress";
import type { SSEJournalEvent } from "@/types/conversion";

function entry(type: string, data: Record<string, unknown>): SSEJournalEvent {
  return { type, data, timestamp: new Date().toISOString() };
}

/** Helper: monta ProgressState + chama a deriveStages REAL do hook. */
const fakeChapter = { id: "chap_0001" } as unknown as NonNullable<ProgressState["currentChapter"]>;

function stagesOf(opts: {
  processedChapters?: number;
  totalChapters?: number;
  hasCurrentChapter?: boolean;
  conversionActive?: boolean;
  completedJobs?: number;
  totalJobs?: number;
  currentJobProgress?: number;
  apiJobs?: string[];
  downloadOnly?: boolean;
}) {
  const {
    processedChapters = 0,
    totalChapters = 0,
    hasCurrentChapter = false,
    conversionActive = false,
    completedJobs = 0,
    totalJobs = 2,
    currentJobProgress = 0,
    apiJobs = ["queued", "queued"],
    downloadOnly = false,
  } = opts;

  const progress: ProgressState = {
    ...INITIAL_PROGRESS,
    processedChapters,
    totalChapters,
    currentChapter: hasCurrentChapter ? fakeChapter : null,
    conversionActive,
    completedJobs,
    totalJobs,
    currentJobConversionProgress: currentJobProgress,
  };

  return deriveStages(
    progress,
    apiJobs.map((status) => ({ status })),
    downloadOnly,
  );
}

describe("deriveStages", () => {
  it("estágios pendentes quando nada aconteceu", () => {
    const stages = stagesOf({});
    expect(stages[0].status).toBe("pending");
    expect(stages[1].status).toBe("pending");
  });

  it("download ativo quando há capítulos em progresso", () => {
    const stages = stagesOf({ processedChapters: 3, totalChapters: 10, hasCurrentChapter: true });
    expect(stages[0].status).toBe("active");
    expect(stages[0].progress).toBe(30);
  });

  it("download completado quando todos os capítulos processados", () => {
    const stages = stagesOf({ processedChapters: 10, totalChapters: 10 });
    expect(stages[0].status).toBe("completed");
  });

  it("download completado quando conversão inteira terminou (allDone)", () => {
    const stages = stagesOf({
      completedJobs: 2,
      totalJobs: 2,
      currentJobProgress: 100,
      apiJobs: ["completed", "completed"],
    });
    expect(stages[0].status).toBe("completed");
  });

  it("conversão ativa quando KCC está rodando", () => {
    const stages = stagesOf({
      processedChapters: 10,
      totalChapters: 10,
      conversionActive: true,
      completedJobs: 1,
      totalJobs: 2,
      currentJobProgress: 50,
      apiJobs: ["completed", "converting"],
    });
    expect(stages[1].status).toBe("active");
    expect(stages[1].progress).toBeGreaterThan(0);
  });

  it("conversão completada quando todos os jobs terminaram", () => {
    const stages = stagesOf({
      processedChapters: 10,
      totalChapters: 10,
      completedJobs: 2,
      totalJobs: 2,
      currentJobProgress: 100,
      apiJobs: ["completed", "completed"],
    });
    expect(stages[1].status).toBe("completed");
  });

  it("exibe APENAS o estágio de download quando download-only (bug das duas barras)", () => {
    const stages = stagesOf({
      processedChapters: 2,
      totalChapters: 4,
      hasCurrentChapter: true,
      apiJobs: ["downloading"],
      downloadOnly: true,
    });
    expect(stages).toHaveLength(1);
    expect(stages[0].id).toBe("downloading");
    expect(stages[0].status).toBe("active");
    expect(stages[0].progress).toBe(50);
  });

  it("download-only completa com estágio único a 100%", () => {
    const stages = stagesOf({
      processedChapters: 4,
      totalChapters: 4,
      apiJobs: ["completed"],
      downloadOnly: true,
    });
    expect(stages).toHaveLength(1);
    expect(stages[0].status).toBe("completed");
    expect(stages[0].progress).toBe(100);
  });
});

describe("progressReducer — RESET / RESTORE / PROBLEM_CHAPTER", () => {
  it("RESET zera tudo, inclusive problemChapters", () => {
    const dirty: ProgressState = {
      ...INITIAL_PROGRESS,
      processedChapters: 5,
      logs: [{ timestamp: "t", type: "info", message: "x" }],
      corruptPages: [{ chapterId: "chap_0001", pageIndex: 1, reason: "r" }],
      problemChapters: [{ chapterId: "chap_0001", reason: "Sem imagens" }],
    };
    expect(progressReducer(dirty, { type: "RESET" })).toEqual(INITIAL_PROGRESS);
  });

  it("RESTORE repinta o snapshot da conversão anterior", () => {
    const snapshot: ProgressState = {
      ...INITIAL_PROGRESS,
      processedChapters: 3,
      problemChapters: [{ chapterId: "chap_0009", reason: "404" }],
    };
    expect(progressReducer(INITIAL_PROGRESS, { type: "RESTORE", state: snapshot })).toBe(snapshot);
  });

  it("PROBLEM_CHAPTER deduplica por chapterId mantendo o primeiro motivo", () => {
    let state = INITIAL_PROGRESS;
    state = progressReducer(state, {
      type: "PROBLEM_CHAPTER",
      chapterId: "chap_0002",
      reason: "Indisponível no site",
    });
    state = progressReducer(state, {
      type: "PROBLEM_CHAPTER",
      chapterId: "chap_0002",
      reason: "outro motivo (deve ser ignorado)",
    });
    state = progressReducer(state, {
      type: "PROBLEM_CHAPTER",
      chapterId: "chap_0003",
      reason: "Erro de rede",
    });
    expect(state.problemChapters).toHaveLength(2);
    expect(state.problemChapters[0]).toEqual({
      chapterId: "chap_0002",
      reason: "Indisponível no site",
    });
  });
});

describe("problemFromJournalEntry", () => {
  it("mapeia download.chapter.skipped com label legível", () => {
    const problem = problemFromJournalEntry(
      entry("download.chapter.skipped", { chapterId: "chap_0007" }),
    );
    expect(problem).toEqual({ chapterId: "chap_0007", reason: expect.any(String) });
    expect(problem!.reason.length).toBeGreaterThan(0);
  });

  it("mapeia download.error com o motivo truncado a 200 chars", () => {
    const longError = "e".repeat(500);
    const problem = problemFromJournalEntry(
      entry("download.error", { chapterId: "chap_0008", error: longError }),
    );
    expect(problem!.chapterId).toBe("chap_0008");
    expect(problem!.reason).toHaveLength(200);
  });

  it("retorna null para eventos irrelevantes ou sem chapterId", () => {
    expect(problemFromJournalEntry(entry("conversion.progress", { progress: 50 }))).toBeNull();
    expect(problemFromJournalEntry(entry("download.error", {}))).toBeNull(); // sem chapterId
  });
});
