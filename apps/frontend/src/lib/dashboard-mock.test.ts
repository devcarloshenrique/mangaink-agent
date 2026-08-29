import { describe, expect, it } from "vitest";
import {
  newChapters,
  ongoingConversions,
  libraryShelf,
  recentReads,
  STAGE_ORDER,
  STAGE_LABELS,
} from "./dashboard-mock";

describe("dashboard-mock invariants", () => {
  it("ongoingConversions deve ter IDs únicos, progresso válido e capas", () => {
    const ids = ongoingConversions.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const c of ongoingConversions) {
      expect(c.progress).toBeGreaterThanOrEqual(0);
      expect(c.progress).toBeLessThanOrEqual(100);
      expect(STAGE_ORDER).toContain(c.stage);
      expect(STAGE_LABELS[c.stage]).toBeDefined();
      expect(typeof c.hue).toBe("number");
      if (c.coverUrl) {
        expect(c.coverUrl).toMatch(/^https?:\/\//);
      }
    }
  });

  it("newChapters deve conter capítulos com capas e informações válidas", () => {
    for (const c of newChapters) {
      expect(c.series.length).toBeGreaterThan(0);
      expect(c.chapter).toBeGreaterThan(0);
      expect(typeof c.hue).toBe("number");
      expect(typeof c.isNew).toBe("boolean");
      if (c.coverUrl) {
        expect(c.coverUrl).toMatch(/^https?:\/\//);
      }
    }
  });

  it("recentReads e libraryShelf devem conter obras com sourceId e coverUrl", () => {
    for (const r of recentReads) {
      expect(r.sourceId).toMatch(/^src-/);
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.coverUrl.length).toBeGreaterThan(0);
    }

    for (const s of libraryShelf) {
      expect(s.sourceId).toMatch(/^src-/);
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.formats.length).toBeGreaterThan(0);
    }
  });
});
