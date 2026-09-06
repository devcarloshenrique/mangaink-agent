import { describe, expect, it, beforeEach } from "vitest";
import {
  formatCoverLabel,
  coverToCoverRef,
  isSameCover,
  isCoverSelected,
  getPreferredCover,
  setPreferredCover,
  removePreferredCover,
  PREFERRED_COVERS_KEY,
} from "./custom-covers";
import type { Cover } from "@/types/scraping";
import type { CoverRef } from "@/types/conversion";

describe("custom-covers helper", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("formatCoverLabel", () => {
    it("retorna 'Capa Original' para tipo original", () => {
      const cover: Cover = {
        id: "cov-1",
        type: "original",
        label: "cover.jpg",
        imageUrl: "http://example.com/1.jpg",
      };
      expect(formatCoverLabel(cover)).toBe("Capa Original");
    });

    it("formata capas personalizadas de upload com UUID ou nome gerado", () => {
      const uuidCover: Cover = {
        id: "cov-2",
        type: "upload",
        label: "DF921B3E-DCBC-4ECA-A25E-0DE7A99C724F.JPEG",
        imageUrl: "http://example.com/2.jpg",
      };
      expect(formatCoverLabel(uuidCover)).toBe("Capa Personalizada");

      const hashCover: Cover = {
        id: "cov-3",
        type: "upload",
        label: "a1b2c3d4e5f6789012345678.png",
        imageUrl: "http://example.com/3.jpg",
      };
      expect(formatCoverLabel(hashCover)).toBe("Capa Personalizada");
    });

    it("mantém label customizado legível de upload limpando a extensão", () => {
      const namedCover: Cover = {
        id: "cov-4",
        type: "upload",
        label: "Minha Capa Incrivel.png",
        imageUrl: "http://example.com/4.jpg",
      };
      expect(formatCoverLabel(namedCover)).toBe("Minha Capa Incrivel");
    });

    it("formata capas de galeria com volume ou fallback de índice", () => {
      const volCover: Cover = {
        id: "cov-5",
        type: "gallery",
        label: "Volume 3",
        imageUrl: "http://example.com/5.jpg",
      };
      expect(formatCoverLabel(volCover)).toBe("Volume 3");

      const numCover: Cover = {
        id: "cov-6",
        type: "gallery",
        label: "12",
        imageUrl: "http://example.com/6.jpg",
      };
      expect(formatCoverLabel(numCover)).toBe("Volume 12");

      const emptyCover: Cover = {
        id: "cov-7",
        type: "gallery",
        label: "",
        imageUrl: "http://example.com/7.jpg",
      };
      expect(formatCoverLabel(emptyCover, 4)).toBe("Volume 5");
      expect(formatCoverLabel(emptyCover)).toBe("Capa Oficial");
    });
  });

  describe("coverToCoverRef & isSameCover", () => {
    it("converte Cover para CoverRef corretamente", () => {
      const orig: Cover = { id: "1", type: "original", label: "Capa", imageUrl: "" };
      expect(coverToCoverRef(orig)).toEqual({ kind: "original" });

      const gal: Cover = { id: "cov-9", type: "gallery", label: "Vol 9", imageUrl: "" };
      expect(coverToCoverRef(gal)).toEqual({ kind: "gallery", coverId: "cov-9" });

      const up: Cover = { id: "up-1", type: "upload", label: "Capa Nova", imageUrl: "" };
      expect(coverToCoverRef(up)).toEqual({ kind: "upload", uploadId: "up-1", name: "Capa Nova" });
    });

    it("compara igualdade de CoverRefs corretamente", () => {
      expect(isSameCover({ kind: "original" }, { kind: "original" })).toBe(true);
      expect(
        isSameCover({ kind: "gallery", coverId: "1" }, { kind: "gallery", coverId: "1" }),
      ).toBe(true);
      expect(
        isSameCover({ kind: "gallery", coverId: "1" }, { kind: "gallery", coverId: "2" }),
      ).toBe(false);
      expect(
        isSameCover(
          { kind: "upload", uploadId: "u1", name: "a" },
          { kind: "upload", uploadId: "u1", name: "b" },
        ),
      ).toBe(true);
    });

    it("isCoverSelected retorna true para original quando não há preferência salva", () => {
      const orig: Cover = { id: "1", type: "original", label: "Capa", imageUrl: "" };
      const gal: Cover = { id: "cov-1", type: "gallery", label: "Vol 1", imageUrl: "" };

      expect(isCoverSelected(orig, null)).toBe(true);
      expect(isCoverSelected(gal, null)).toBe(false);
    });
  });

  describe("localStorage persistence", () => {
    it("armazena, recupera e remove a capa preferida", () => {
      expect(getPreferredCover("src-berserk")).toBeNull();

      const galCover: Cover = { id: "cov-3", type: "gallery", label: "Vol 3", imageUrl: "" };
      setPreferredCover("src-berserk", galCover);

      expect(getPreferredCover("src-berserk")).toEqual({
        kind: "gallery",
        coverId: "cov-3",
      });

      removePreferredCover("src-berserk");
      expect(getPreferredCover("src-berserk")).toBeNull();
    });
  });
});
