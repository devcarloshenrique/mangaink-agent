// DEPRECATED: Substituído por useConversionsList + useConversionActions (conexão real com backend).
// Mantido como referência.
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import {
  INITIAL_SERIES,
  type MangaSeries,
  type MangaFile,
  type ConversionStatus,
} from "@/lib/biblioteca-data";

interface BibliotecaCtx {
  series: MangaSeries[];
  addSeries: (series: MangaSeries) => void;
  renameSeries: (slug: string, newTitle: string) => string;
  deleteSeries: (slug: string) => void;
  toggleFavorite: (slug: string) => void;
  reconvertSeries: (slug: string) => void;
  reconvertFile: (slug: string, fileId: string) => void;
  reconvertChapters: (slug: string, fileId: string, chapterIds: string[]) => void;
  deleteFile: (slug: string, fileId: string) => void;
  getSeriesBySlug: (slug: string) => MangaSeries | undefined;
}

const Ctx = createContext<BibliotecaCtx | null>(null);

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function resetFileStatus(file: MangaFile, status: ConversionStatus): MangaFile {
  return {
    ...file,
    status,
    chapters: file.chapters.map((ch) => ({ ...ch, status })),
  };
}

export function BibliotecaProvider({ children }: { children: ReactNode }) {
  const [series, setSeries] = useState<MangaSeries[]>(INITIAL_SERIES);

  const addSeries = useCallback((newSeries: MangaSeries) => {
    setSeries((prev) => {
      const exists = prev.find((s) => s.slug === newSeries.slug);
      if (exists) {
        return prev.map((s) => (s.slug === newSeries.slug ? newSeries : s));
      }
      return [newSeries, ...prev];
    });
  }, []);

  const renameSeries = useCallback((slug: string, newTitle: string): string => {
    const newSlug = slugify(newTitle);
    setSeries((prev) =>
      prev.map((s) => (s.slug === slug ? { ...s, title: newTitle, slug: newSlug } : s)),
    );
    return newSlug;
  }, []);

  const deleteSeries = useCallback((slug: string) => {
    setSeries((prev) => prev.filter((s) => s.slug !== slug));
  }, []);

  const toggleFavorite = useCallback((slug: string) => {
    setSeries((prev) => prev.map((s) => (s.slug === slug ? { ...s, favorite: !s.favorite } : s)));
  }, []);

  const reconvertSeries = useCallback((slug: string) => {
    setSeries((prev) =>
      prev.map((s) => {
        if (s.slug !== slug) return s;
        return {
          ...s,
          files: s.files.map((f) => resetFileStatus(f, "pending")),
        };
      }),
    );
  }, []);

  const reconvertFile = useCallback((slug: string, fileId: string) => {
    setSeries((prev) =>
      prev.map((s) => {
        if (s.slug !== slug) return s;
        return {
          ...s,
          files: s.files.map((f) => (f.id === fileId ? resetFileStatus(f, "pending") : f)),
        };
      }),
    );
  }, []);

  const reconvertChapters = useCallback((slug: string, fileId: string, chapterIds: string[]) => {
    const idSet = new Set(chapterIds);
    setSeries((prev) =>
      prev.map((s) => {
        if (s.slug !== slug) return s;
        return {
          ...s,
          files: s.files.map((f) => {
            if (f.id !== fileId) return f;
            const updatedChapters = f.chapters.map((ch) =>
              idSet.has(ch.id) ? { ...ch, status: "pending" as ConversionStatus } : ch,
            );
            const allPending = updatedChapters.every((ch) => ch.status === "pending");
            return {
              ...f,
              status: allPending ? "pending" : f.status,
              chapters: updatedChapters,
            };
          }),
        };
      }),
    );
  }, []);

  const deleteFile = useCallback((slug: string, fileId: string) => {
    setSeries((prev) =>
      prev.map((s) => {
        if (s.slug !== slug) return s;
        return { ...s, files: s.files.filter((f) => f.id !== fileId) };
      }),
    );
  }, []);

  const getSeriesBySlug = useCallback(
    (slug: string) => series.find((s) => s.slug === slug),
    [series],
  );

  return (
    <Ctx.Provider
      value={{
        series,
        addSeries,
        renameSeries,
        deleteSeries,
        toggleFavorite,
        reconvertSeries,
        reconvertFile,
        reconvertChapters,
        deleteFile,
        getSeriesBySlug,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useBiblioteca() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBiblioteca deve ser usado dentro de BibliotecaProvider");
  return ctx;
}
