import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useBiblioteca } from "@/hooks/useBiblioteca";
import type { MangaFile, MangaSeries } from "@/lib/biblioteca-data";
import type { ConversionJob, JobStage } from "@/lib/conversion-job";
import { STAGE_LABELS } from "@/lib/conversion-job";

interface WizardStartData {
  series: {
    title: string;
    author: string;
    chapters: { id: string; number: string; title: string; pages: number }[];
  };
  selectedChapters: Set<string>;
  meta: { title: string; author: string };
  format: "EPUB" | "MOBI" | "PDF" | "CBZ" | "KFX";
  delivery: "download" | "kindle";
  kindleEmail?: string;
  volumeSize: number;
}

interface ConversionCtx {
  jobs: ConversionJob[];
  startJob: (data: WizardStartData) => string;
  getJob: (jobId: string) => ConversionJob | undefined;
  cancelJob: (jobId: string) => void;
  clearCompleted: () => void;
}

const Ctx = createContext<ConversionCtx | null>(null);

function uid(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildStages(delivery: "download" | "kindle") {
  const ids: JobStage[] = ["downloading", "converting", "generating"];
  if (delivery === "kindle") ids.push("sending");
  return ids.map((id) => ({
    id,
    label: STAGE_LABELS[id],
    status: "pending" as const,
    progress: 0,
  }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function ConversionProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const navigate = useNavigate();
  const { addSeries } = useBiblioteca();
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const updateJob = useCallback((jobId: string, patch: Partial<ConversionJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...patch } : j)));
  }, []);

  const updateStage = useCallback(
    (
      jobId: string,
      stageId: JobStage,
      status: "pending" | "active" | "completed" | "error",
      progress?: number,
    ) => {
      setJobs((prev) =>
        prev.map((j) => {
          if (j.id !== jobId) return j;
          return {
            ...j,
            stages: j.stages.map((s) =>
              s.id === stageId
                ? { ...s, status, ...(progress !== undefined ? { progress } : {}) }
                : s,
            ),
          };
        }),
      );
    },
    [],
  );

  const calcOverall = useCallback((job: ConversionJob): number => {
    const total = job.stages.reduce((sum, s) => sum + s.progress, 0);
    return Math.round(total / job.stages.length);
  }, []);

  const simulateJob = useCallback(
    async (jobId: string, data: WizardStartData) => {
      const stages: JobStage[] = ["downloading", "converting", "generating"];
      if (data.delivery === "kindle") stages.push("sending");

      const selectedChaptersList = data.series.chapters.filter((ch) =>
        data.selectedChapters.has(ch.id),
      );
      const totalPages = selectedChaptersList.reduce((sum, ch) => sum + ch.pages, 0);

      try {
        for (const stage of stages) {
          updateStage(jobId, stage, "active", 0);
          updateJob(jobId, { status: "running" });

          let steps: number;
          let stepDuration: number;

          switch (stage) {
            case "downloading":
              steps = selectedChaptersList.length;
              stepDuration = 800;
              for (let i = 1; i <= steps; i++) {
                await sleep(stepDuration);
                const pct = Math.round((i / steps) * 100);
                updateStage(jobId, stage, "active", pct);
                setJobs((prev) => {
                  const job = prev.find((j) => j.id === jobId);
                  if (job) {
                    const total = job.stages.reduce((sum, s) => sum + s.progress, 0);
                    const overall = Math.round(total / job.stages.length);
                    return prev.map((j) =>
                      j.id === jobId ? { ...j, overallProgress: overall } : j,
                    );
                  }
                  return prev;
                });
              }
              break;

            case "converting":
              steps = Math.min(totalPages, 20);
              stepDuration = 600;
              for (let i = 1; i <= steps; i++) {
                await sleep(stepDuration);
                const pct = Math.round((i / steps) * 100);
                updateStage(jobId, stage, "active", pct);
                setJobs((prev) => {
                  const job = prev.find((j) => j.id === jobId);
                  if (job) {
                    const total = job.stages.reduce((sum, s) => sum + s.progress, 0);
                    const overall = Math.round(total / job.stages.length);
                    return prev.map((j) =>
                      j.id === jobId ? { ...j, overallProgress: overall } : j,
                    );
                  }
                  return prev;
                });
              }
              break;

            case "generating":
              steps = 12;
              stepDuration = 500;
              for (let i = 1; i <= steps; i++) {
                await sleep(stepDuration);
                const pct = Math.round((i / steps) * 100);
                updateStage(jobId, stage, "active", pct);
                setJobs((prev) => {
                  const job = prev.find((j) => j.id === jobId);
                  if (job) {
                    const total = job.stages.reduce((sum, s) => sum + s.progress, 0);
                    const overall = Math.round(total / job.stages.length);
                    return prev.map((j) =>
                      j.id === jobId ? { ...j, overallProgress: overall } : j,
                    );
                  }
                  return prev;
                });
              }
              break;

            case "sending":
              steps = 10;
              stepDuration = 600;
              for (let i = 1; i <= steps; i++) {
                await sleep(stepDuration);
                const pct = Math.round((i / steps) * 100);
                updateStage(jobId, stage, "active", pct);
                setJobs((prev) => {
                  const job = prev.find((j) => j.id === jobId);
                  if (job) {
                    const total = job.stages.reduce((sum, s) => sum + s.progress, 0);
                    const overall = Math.round(total / job.stages.length);
                    return prev.map((j) =>
                      j.id === jobId ? { ...j, overallProgress: overall } : j,
                    );
                  }
                  return prev;
                });
              }
              break;
          }

          updateStage(jobId, stage, "completed", 100);
          await sleep(300);
        }

        // Build and save series
        const seriesSlug = slugify(data.meta.title || data.series.title);
        const volSize = data.volumeSize;
        const volumeCount = Math.ceil(selectedChaptersList.length / volSize);
        const now = new Date();
        const when = "agora";

        const files: MangaFile[] = [];
        for (let v = 0; v < volumeCount; v++) {
          const volChapters = selectedChaptersList.slice(v * volSize, (v + 1) * volSize);
          if (volChapters.length === 0) continue;
          const chapters = volChapters.map((ch) => ({
            id: ch.id,
            number: ch.number,
            title: ch.title,
            status: "completed" as const,
          }));
          const volTotalPages = chapters.length * 20;
          const bytes = volTotalPages * 1024 * 128;
          files.push({
            id: `${seriesSlug}-vol-${String(v + 1).padStart(2, "0")}`,
            name: `${seriesSlug}-vol-${String(v + 1).padStart(2, "0")}.${data.format.toLowerCase()}`,
            bytes,
            when,
            format: data.format,
            sent: false,
            status: "completed",
            chapters,
          });
        }

        const hue = (seriesSlug.length * 37) % 360;
        const newSeries: MangaSeries = {
          slug: seriesSlug,
          title: data.meta.title || data.series.title,
          author: data.meta.author || data.series.author,
          hue,
          files,
          lastConverted: when,
          favorite: false,
          tags: [],
          addedAt: now.toISOString(),
        };

        addSeries(newSeries);

        updateJob(jobId, {
          status: "completed",
          overallProgress: 100,
          completedAt: Date.now(),
        });

        toast.success(`Conversão de "${newSeries.title}" concluída!`, {
          duration: 8000,
          action: {
            label: "Ver na biblioteca",
            onClick: () => navigate({ to: "/biblioteca/$slug", params: { slug: seriesSlug } }),
          },
        });
      } catch {
        updateJob(jobId, {
          status: "error",
          errorMessage: "Erro na conversão. Tente novamente.",
        });
      }
    },
    [addSeries, calcOverall, navigate, updateJob, updateStage],
  );

  const startJob = useCallback(
    (data: WizardStartData): string => {
      const jobId = uid();
      const selectedChaptersList = data.series.chapters.filter((ch) =>
        data.selectedChapters.has(ch.id),
      );
      const totalPages = selectedChaptersList.reduce((sum, ch) => sum + ch.pages, 0);
      const seriesSlug = slugify(data.meta.title || data.series.title);
      const hue = (seriesSlug.length * 37) % 360;

      const job: ConversionJob = {
        id: jobId,
        seriesTitle: data.meta.title || data.series.title,
        seriesSlug,
        seriesHue: hue,
        format: data.format,
        delivery: data.delivery,
        kindleEmail: data.kindleEmail,
        totalChapters: selectedChaptersList.length,
        totalPages,
        status: "queued",
        overallProgress: 0,
        stages: buildStages(data.delivery),
        createdAt: Date.now(),
      };

      setJobs((prev) => [job, ...prev]);
      simulateJob(jobId, data);
      return jobId;
    },
    [simulateJob],
  );

  const getJob = useCallback((jobId: string) => jobs.find((j) => j.id === jobId), [jobs]);

  const cancelJob = useCallback(
    (jobId: string) => {
      updateJob(jobId, {
        status: "error",
        errorMessage: "Cancelado pelo usuário.",
      });
    },
    [updateJob],
  );

  const clearCompleted = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status === "queued" || j.status === "running"));
  }, []);

  return (
    <Ctx.Provider value={{ jobs, startJob, getJob, cancelJob, clearCompleted }}>
      {children}
    </Ctx.Provider>
  );
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function useConversion() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConversion deve ser usado dentro de ConversionProvider");
  return ctx;
}
