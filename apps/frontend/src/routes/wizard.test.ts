import { describe, it, expect } from "vitest";
import type { Chapter } from "@/types/scraping";
import type { Book } from "@/types/conversion";

// ── Funções extraídas do wizard.tsx ────────────────────────────────────

type VolumeMode = "fixed" | "custom";

function computeVolumes(
  chapters: Chapter[],
  mode: VolumeMode,
  fixedSize: number,
  customSizes: number[],
): Chapter[][] {
  if (mode === "fixed") {
    const result: Chapter[][] = [];
    for (let i = 0; i < chapters.length; i += fixedSize) {
      result.push(chapters.slice(i, i + fixedSize));
    }
    return result;
  }
  const result: Chapter[][] = [];
  let offset = 0;
  for (const size of customSizes) {
    result.push(chapters.slice(offset, offset + size));
    offset += size;
  }
  if (offset < chapters.length) result.push(chapters.slice(offset));
  return result.filter((v) => v.length > 0);
}

function buildBooks(
  chapters: Chapter[],
  selectedIds: Set<string>,
  metaTitle: string,
  grouping: "single" | "separate",
  mode: VolumeMode,
  fixedSize: number,
  customSizes: number[],
): Book[] {
  const selected = chapters.filter((c) => selectedIds.has(c.id));

  if (grouping === "single") {
    return [{ title: metaTitle || "Título", chapters: selected.map((c) => c.id) }];
  }

  const volumes = computeVolumes(selected, mode, fixedSize, customSizes);
  const baseTitle = metaTitle || "Título";
  return volumes.map((vChapters, i) => ({
    title: `${baseTitle} - Vol. ${i + 1}`,
    chapters: vChapters.map((c) => c.id),
  }));
}

// ── Helpers ────────────────────────────────────────────────────────────

function makeChapter(id: string): Chapter {
  const num = id.replace("chap_", "");
  return {
    id,
    number: num,
    title: `Capítulo ${num}`,
    url: `https://site/${num}`,
    pages: 20,
    volume: null,
    isDownloaded: false,
    isRead: false,
  };
}

describe("computeVolumes", () => {
  const chapters = Array.from({ length: 15 }, (_, i) =>
    makeChapter(`chap_${String(i + 1).padStart(4, "0")}`),
  );

  it("fixed: agrupa em chunks de tamanho fixo", () => {
    const volumes = computeVolumes(chapters, "fixed", 5, []);
    expect(volumes).toHaveLength(3);
    expect(volumes[0]).toHaveLength(5);
    expect(volumes[1]).toHaveLength(5);
    expect(volumes[2]).toHaveLength(5);
  });

  it("fixed: último volume pode ser menor", () => {
    const volumes = computeVolumes(chapters, "fixed", 8, []);
    expect(volumes).toHaveLength(2);
    expect(volumes[0]).toHaveLength(8);
    expect(volumes[1]).toHaveLength(7);
  });

  it("custom: tamanhos definidos pelo usuário", () => {
    const volumes = computeVolumes(chapters, "custom", 0, [3, 5]);
    expect(volumes).toHaveLength(3);
    expect(volumes[0]).toHaveLength(3);
    expect(volumes[1]).toHaveLength(5);
    expect(volumes[2]).toHaveLength(7);
  });

  it("custom: remove volumes vazios", () => {
    const volumes = computeVolumes(chapters.slice(0, 3), "custom", 0, [5, 5]);
    expect(volumes).toHaveLength(1);
    expect(volumes[0]).toHaveLength(3);
  });
});

describe("buildBooks", () => {
  const chapters = Array.from({ length: 6 }, (_, i) =>
    makeChapter(`chap_${String(i + 1).padStart(4, "0")}`),
  );
  const allIds = new Set(chapters.map((c) => c.id));

  it("single: retorna 1 Book com todos os capítulos", () => {
    const books = buildBooks(chapters, allIds, "Hunter x Hunter", "single", "fixed", 0, []);
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe("Hunter x Hunter");
    expect(books[0].chapters).toHaveLength(6);
  });

  it("separate: retorna N Books por volume", () => {
    const books = buildBooks(chapters, allIds, "Hunter x Hunter", "separate", "fixed", 3, []);
    expect(books).toHaveLength(2);
    expect(books[0].title).toBe("Hunter x Hunter - Vol. 1");
    expect(books[0].chapters).toHaveLength(3);
    expect(books[1].title).toBe("Hunter x Hunter - Vol. 2");
    expect(books[1].chapters).toHaveLength(3);
  });

  it("respeita selectedIds (apenas capítulos marcados)", () => {
    const selected = new Set([chapters[0].id, chapters[2].id, chapters[4].id]);
    const books = buildBooks(chapters, selected, "One Piece", "single", "fixed", 0, []);
    expect(books).toHaveLength(1);
    expect(books[0].chapters).toHaveLength(3);
  });

  it("usa metaTitle padrão quando vazio", () => {
    const books = buildBooks(chapters, allIds, "", "single", "fixed", 0, []);
    expect(books[0].title).toBe("Título");
  });
});

function computeEqualVolumeSizes(total: number, volumeCount: number): number[] {
  if (total <= 0) return [1];
  const count = Math.max(1, Math.min(total, volumeCount));
  const base = Math.floor(total / count);
  const remainder = total % count;
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) {
    sizes.push(base + (i < remainder ? 1 : 0));
  }
  return sizes;
}

describe("computeEqualVolumeSizes", () => {
  it("divide 10 capítulos em 2 volumes por igual", () => {
    expect(computeEqualVolumeSizes(10, 2)).toEqual([5, 5]);
  });

  it("divide 11 capítulos em 2 volumes distribuindo o resto", () => {
    expect(computeEqualVolumeSizes(11, 2)).toEqual([6, 5]);
  });

  it("divide 10 capítulos em 3 volumes", () => {
    expect(computeEqualVolumeSizes(10, 3)).toEqual([4, 3, 3]);
  });

  it("retorna [1] para 0 capítulos", () => {
    expect(computeEqualVolumeSizes(0, 2)).toEqual([1]);
  });

  it("retorna [1] para 1 capítulo com 3 volumes pedidos", () => {
    expect(computeEqualVolumeSizes(1, 3)).toEqual([1]);
  });
});
