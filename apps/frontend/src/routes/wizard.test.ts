import { describe, it, expect } from "vitest";
import type { Chapter, SourceInspectResponse } from "@/types/scraping";
import type { Book, CoverRef } from "@/types/conversion";

// ── Funções extraídas do wizard.tsx ────────────────────────────────────

type VolumeMode = "fixed" | "custom";
type CoverMode = "single" | "per-volume";

interface WizardData {
  url: string;
  sourceId: string | null;
  inspectData: SourceInspectResponse | null;
  selectedChapters: Set<string>;
  grouping: "single" | "separate";
  volumeSize: number;
  volumeMode: VolumeMode;
  volumeSizes: number[];
  coverMode: CoverMode;
  coverAssignments: Record<string, CoverRef>;
  device: string;
  format: string;
  preset: string;
  fieldOptions: Record<string, string | number | boolean>;
  meta: { title: string; author: string };
  errorHandlingStrategy: "ignore" | "skip_chapter" | "abort";
  delivery: "download" | "kindle";
  kindleEmail: string;
}

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

function buildBooks(data: WizardData): Book[] {
  const chapters = data.inspectData!.chapters.filter((c) => data.selectedChapters.has(c.id));

  if (data.grouping === "single") {
    return [
      {
        title: data.meta.title || data.inspectData!.metadata.title,
        chapters: chapters.map((c) => c.id),
        cover:
          data.coverMode === "single"
            ? (data.coverAssignments["all"] ?? { kind: "original" })
            : (data.coverAssignments["vol-1"] ?? { kind: "original" }),
      },
    ];
  }

  const volumes = computeVolumes(chapters, data.volumeMode, data.volumeSize, data.volumeSizes);
  const baseTitle = data.meta.title || data.inspectData!.metadata.title;
  return volumes.map((vChapters, i) => {
    const volKey = `vol-${i + 1}`;
    const cover =
      data.coverMode === "per-volume"
        ? (data.coverAssignments[volKey] ?? { kind: "original" })
        : (data.coverAssignments["all"] ?? { kind: "original" });

    return {
      title: `${baseTitle} - Vol. ${i + 1}`,
      chapters: vChapters.map((c) => c.id),
      cover,
    };
  });
}

function coverModeLabel(m: CoverMode): string {
  return m === "single" ? "Capa única" : "Por volume";
}

function computeCoverTargets(
  usedChapters: Chapter[],
  grouping: "single" | "separate",
  volumeMode: VolumeMode,
  volumeSize: number,
  volumeSizes: number[],
  mode: CoverMode,
): { key: string; label: string }[] {
  if (mode === "single") {
    return [{ key: "all", label: "Todos os volumes" }];
  }

  const volumes =
    grouping === "single"
      ? [usedChapters]
      : computeVolumes(usedChapters, volumeMode, volumeSize, volumeSizes);

  return volumes.map((vChapters, i) => ({
    key: `vol-${i + 1}`,
    label: `Volume ${i + 1} (${vChapters.length} cap${vChapters.length > 1 ? "s" : ""})`,
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

function makeInspectData(chapters: Chapter[]): SourceInspectResponse {
  return {
    sourceId: "src_test123",
    status: "ready",
    provider: {
      slug: "mangalivre",
      name: "Manga Livre",
      engine: "cheerio",
    },
    source: {
      url: "https://site/manga/test",
      language: "pt-BR",
    },
    metadata: {
      title: "Test Manga",
      author: "Test Author",
      description: "Description",
      genres: ["Action"],
      status: "ongoing",
    },
    chapters,
    covers: [
      { id: "cov_1", imageUrl: "https://site/cov1.jpg", label: "Volume 1", type: "gallery" },
      { id: "cov_2", imageUrl: "https://site/cov2.jpg", label: "Volume 2", type: "gallery" },
    ],
    statistics: {
      chapters: chapters.length,
      covers: 2,
    },
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
  const inspectData = makeInspectData(chapters);
  const allIds = new Set(chapters.map((c) => c.id));

  const baseWizardData: WizardData = {
    url: "https://site/manga/test",
    sourceId: "src_test123",
    inspectData,
    selectedChapters: allIds,
    grouping: "single",
    volumeSize: 3,
    volumeMode: "fixed",
    volumeSizes: [],
    coverMode: "single",
    coverAssignments: {},
    device: "kpw_11",
    format: "EPUB",
    preset: "",
    fieldOptions: {},
    meta: { title: "Hunter x Hunter", author: "Togashi" },
    errorHandlingStrategy: "ignore",
    delivery: "download",
    kindleEmail: "",
  };

  it("single: retorna 1 Book com todos os capítulos e capa default original", () => {
    const books = buildBooks({
      ...baseWizardData,
      grouping: "single",
      coverMode: "single",
    });
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe("Hunter x Hunter");
    expect(books[0].chapters).toHaveLength(6);
    expect(books[0].cover).toEqual({ kind: "original" });
  });

  it("single: atribui capa selecionada em coverAssignments['all']", () => {
    const books = buildBooks({
      ...baseWizardData,
      grouping: "single",
      coverMode: "single",
      coverAssignments: {
        all: { kind: "gallery", coverId: "cov_1" },
      },
    });
    expect(books).toHaveLength(1);
    expect(books[0].cover).toEqual({ kind: "gallery", coverId: "cov_1" });
  });

  it("separate + single cover: todos os volumes recebem coverAssignments['all']", () => {
    const books = buildBooks({
      ...baseWizardData,
      grouping: "separate",
      volumeSize: 3,
      coverMode: "single",
      coverAssignments: {
        all: { kind: "gallery", coverId: "cov_1" },
      },
    });
    expect(books).toHaveLength(2);
    expect(books[0].title).toBe("Hunter x Hunter - Vol. 1");
    expect(books[0].chapters).toHaveLength(3);
    expect(books[0].cover).toEqual({ kind: "gallery", coverId: "cov_1" });
    expect(books[1].title).toBe("Hunter x Hunter - Vol. 2");
    expect(books[1].chapters).toHaveLength(3);
    expect(books[1].cover).toEqual({ kind: "gallery", coverId: "cov_1" });
  });

  it("separate + per-volume cover: cada Book recebe sua capa por volume", () => {
    const books = buildBooks({
      ...baseWizardData,
      grouping: "separate",
      volumeSize: 3,
      coverMode: "per-volume",
      coverAssignments: {
        "vol-1": { kind: "gallery", coverId: "cov_1" },
        "vol-2": { kind: "upload", uploadId: "up_1", name: "minha_capa.png" },
      },
    });
    expect(books).toHaveLength(2);
    expect(books[0].title).toBe("Hunter x Hunter - Vol. 1");
    expect(books[0].cover).toEqual({ kind: "gallery", coverId: "cov_1" });
    expect(books[1].title).toBe("Hunter x Hunter - Vol. 2");
    expect(books[1].cover).toEqual({ kind: "upload", uploadId: "up_1", name: "minha_capa.png" });
  });

  it("separate + per-volume cover: faz fallback para { kind: 'original' } quando volume não configurado", () => {
    const books = buildBooks({
      ...baseWizardData,
      grouping: "separate",
      volumeSize: 3,
      coverMode: "per-volume",
      coverAssignments: {
        "vol-1": { kind: "gallery", coverId: "cov_1" },
      },
    });
    expect(books).toHaveLength(2);
    expect(books[0].cover).toEqual({ kind: "gallery", coverId: "cov_1" });
    expect(books[1].cover).toEqual({ kind: "original" });
  });

  it("respeita selectedChapters (apenas capítulos marcados)", () => {
    const selected = new Set([chapters[0].id, chapters[2].id, chapters[4].id]);
    const books = buildBooks({
      ...baseWizardData,
      selectedChapters: selected,
      grouping: "single",
      meta: { title: "One Piece", author: "Oda" },
    });
    expect(books).toHaveLength(1);
    expect(books[0].chapters).toHaveLength(3);
    expect(books[0].title).toBe("One Piece");
  });

  it("usa metaTitle padrão quando vazio", () => {
    const books = buildBooks({
      ...baseWizardData,
      meta: { title: "", author: "" },
      inspectData: {
        ...inspectData,
        metadata: { ...inspectData.metadata, title: "Mangá Default" },
      },
    });
    expect(books[0].title).toBe("Mangá Default");
  });
});

describe("coverModeLabel", () => {
  it("retorna 'Capa única' para 'single'", () => {
    expect(coverModeLabel("single")).toBe("Capa única");
  });

  it("retorna 'Por volume' para 'per-volume'", () => {
    expect(coverModeLabel("per-volume")).toBe("Por volume");
  });
});

describe("computeCoverTargets", () => {
  const chapters = Array.from({ length: 9 }, (_, i) =>
    makeChapter(`chap_${String(i + 1).padStart(4, "0")}`),
  );

  it("modo single: retorna apenas o target 'all'", () => {
    const targets = computeCoverTargets(chapters, "separate", "fixed", 3, [], "single");
    expect(targets).toEqual([{ key: "all", label: "Todos os volumes" }]);
  });

  it("modo per-volume com grouping 'single': retorna 1 volume com todos os caps", () => {
    const targets = computeCoverTargets(chapters, "single", "fixed", 3, [], "per-volume");
    expect(targets).toEqual([{ key: "vol-1", label: "Volume 1 (9 caps)" }]);
  });

  it("modo per-volume com grouping 'separate' e fixed size: gera volumes dinâmicos", () => {
    const targets = computeCoverTargets(chapters, "separate", "fixed", 4, [], "per-volume");
    expect(targets).toEqual([
      { key: "vol-1", label: "Volume 1 (4 caps)" },
      { key: "vol-2", label: "Volume 2 (4 caps)" },
      { key: "vol-3", label: "Volume 3 (1 cap)" },
    ]);
  });

  it("modo per-volume com grouping 'separate' e custom sizes: gera volumes dinâmicos", () => {
    const targets = computeCoverTargets(chapters, "separate", "custom", 0, [2, 5], "per-volume");
    expect(targets).toEqual([
      { key: "vol-1", label: "Volume 1 (2 caps)" },
      { key: "vol-2", label: "Volume 2 (5 caps)" },
      { key: "vol-3", label: "Volume 3 (2 caps)" },
    ]);
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

function describeRef(ref: CoverRef | undefined, covers: SourceInspectResponse["covers"]): string {
  if (!ref || ref.kind === "original") return "Original";
  if (ref.kind === "gallery") {
    const c = covers.find((cv) => cv.id === ref.coverId);
    return `Galeria · ${c?.label || ref.coverId}`;
  }
  if (ref.kind === "upload") {
    return `Personalizada · ${ref.name || "Upload"}`;
  }
  return "Original";
}

function filterOfficialCovers(
  covers: SourceInspectResponse["covers"],
): SourceInspectResponse["covers"] {
  return covers.filter((c) => c.type !== "upload");
}

function filterCustomCovers(
  covers: SourceInspectResponse["covers"],
): SourceInspectResponse["covers"] {
  return covers.filter((c) => c.type === "upload");
}

describe("filterOfficialCovers e filterCustomCovers", () => {
  const mixedCovers: SourceInspectResponse["covers"] = [
    { id: "cov_orig", imageUrl: "https://site/orig.jpg", label: "Capa Original", type: "original" },
    { id: "cov_vol1", imageUrl: "https://site/vol1.jpg", label: "Volume 1", type: "gallery" },
    {
      id: "upl_1",
      imageUrl: "/api/conversions/covers/uploaded/upl_1",
      label: "Minha Capa.png",
      type: "upload",
    },
    {
      id: "upl_2",
      imageUrl: "/api/conversions/covers/uploaded/upl_2",
      label: "Volume 2 Custom.jpg",
      type: "upload",
    },
  ];

  it("separa capas oficiais da galeria das capas personalizadas por upload", () => {
    const official = filterOfficialCovers(mixedCovers);
    const custom = filterCustomCovers(mixedCovers);

    expect(official).toHaveLength(2);
    expect(official.map((c) => c.id)).toEqual(["cov_orig", "cov_vol1"]);

    expect(custom).toHaveLength(2);
    expect(custom.map((c) => c.id)).toEqual(["upl_1", "upl_2"]);
  });

  it("adiciona nova capa personalizada na lista sem duplicar id", () => {
    const newCover = {
      id: "upl_3",
      type: "upload" as const,
      label: "Nova Capa.jpg",
      imageUrl: "/api/conversions/covers/uploaded/upl_3",
    };

    const updated = [...mixedCovers, newCover];
    const custom = filterCustomCovers(updated);

    expect(custom).toHaveLength(3);
    expect(custom.map((c) => c.id)).toEqual(["upl_1", "upl_2", "upl_3"]);
  });
});

describe("describeRef", () => {
  const covers: SourceInspectResponse["covers"] = [
    { id: "cov_1", imageUrl: "https://site/cov1.jpg", label: "Volume 1", type: "gallery" },
    { id: "cov_2", imageUrl: "https://site/cov2.jpg", label: "Volume 2", type: "gallery" },
  ];

  it("retorna 'Original' quando ref é undefined ou original", () => {
    expect(describeRef(undefined, covers)).toBe("Original");
    expect(describeRef({ kind: "original" }, covers)).toBe("Original");
  });

  it("retorna 'Galeria · {label}' quando cover é encontrado na galeria", () => {
    expect(describeRef({ kind: "gallery", coverId: "cov_1" }, covers)).toBe("Galeria · Volume 1");
  });

  it("retorna 'Galeria · {coverId}' quando cover não é encontrado na galeria", () => {
    expect(describeRef({ kind: "gallery", coverId: "cov_missing" }, covers)).toBe(
      "Galeria · cov_missing",
    );
  });

  it("retorna 'Personalizada · {name}' quando ref é upload com name", () => {
    expect(
      describeRef({ kind: "upload", uploadId: "up_123", name: "minha_capa.jpg" }, covers),
    ).toBe("Personalizada · minha_capa.jpg");
  });

  it("retorna 'Personalizada · Upload' quando ref é upload sem name", () => {
    expect(describeRef({ kind: "upload", uploadId: "up_123", name: "" }, covers)).toBe(
      "Personalizada · Upload",
    );
  });
});

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
