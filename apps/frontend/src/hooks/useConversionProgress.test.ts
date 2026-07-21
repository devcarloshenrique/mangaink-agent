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

// ── Teste da lógica de deriveStages (função pura, sem React) ──────────
type StageStatus = "pending" | "active" | "completed";
type StageId = "downloading" | "converting";

interface StageInfo {
  id: StageId;
  label: string;
  status: StageStatus;
  progress: number;
}

function deriveStages(
  processedChapters: number,
  totalChapters: number,
  hasCurrentChapter: boolean,
  isConversionActive: boolean,
  completedJobs: number,
  totalJobs: number,
  currentJobProgress: number,
  apiJobs: string[],
): StageInfo[] {
  const allDone =
    apiJobs.length > 0 && apiJobs.every((j) => ["completed", "failed", "cancelled"].includes(j));

  const downloadDone = allDone || (totalChapters > 0 && processedChapters >= totalChapters);
  const downloadActive = !downloadDone && (processedChapters > 0 || hasCurrentChapter);
  const downloadProgress =
    totalChapters > 0 ? Math.round((processedChapters / totalChapters) * 100) : 0;

  const conversionDone = allDone;
  const convActive = isConversionActive && !conversionDone;
  const conversionProgress =
    totalJobs > 0
      ? Math.min(
          100,
          Math.round((completedJobs * 100) / totalJobs + currentJobProgress / totalJobs),
        )
      : isConversionActive
        ? currentJobProgress
        : 0;

  return [
    {
      id: "downloading" as StageId,
      label: "Baixando imagens",
      status: downloadDone ? "completed" : downloadActive ? "active" : "pending",
      progress: downloadProgress,
    },
    {
      id: "converting" as StageId,
      label: "Convertendo páginas",
      status: conversionDone ? "completed" : convActive ? "active" : "pending",
      progress: conversionProgress,
    },
  ];
}

describe("deriveStages", () => {
  it("estágios pendentes quando nada aconteceu", () => {
    const stages = deriveStages(0, 10, false, false, 0, 2, 0, ["queued", "queued"]);
    expect(stages[0].status).toBe("pending");
    expect(stages[1].status).toBe("pending");
  });

  it("download ativo quando há capítulos em progresso", () => {
    const stages = deriveStages(3, 10, true, false, 0, 2, 0, ["downloading", "queued"]);
    expect(stages[0].status).toBe("active");
    expect(stages[0].progress).toBe(30);
  });

  it("download completado quando todos os capítulos processados", () => {
    const stages = deriveStages(10, 10, false, true, 0, 2, 0, ["downloading", "queued"]);
    expect(stages[0].status).toBe("completed");
  });

  it("download completado quando conversão inteira terminou (allDone)", () => {
    const stages = deriveStages(0, 10, false, true, 2, 2, 100, ["completed", "completed"]);
    expect(stages[0].status).toBe("completed");
  });

  it("conversão ativa quando KCC está rodando", () => {
    const stages = deriveStages(10, 10, false, true, 1, 2, 50, ["completed", "converting"]);
    expect(stages[1].status).toBe("active");
    expect(stages[1].progress).toBeGreaterThan(0);
  });

  it("conversão completada quando todos os jobs terminaram", () => {
    const stages = deriveStages(10, 10, false, false, 2, 2, 100, ["completed", "completed"]);
    expect(stages[1].status).toBe("completed");
  });
});
