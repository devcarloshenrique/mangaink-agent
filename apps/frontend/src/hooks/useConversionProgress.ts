import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { conversionsApi } from "@/lib/api";
import type { ConversionState } from "@/types/conversion";

// ── Tipos de Stage ────────────────────────────────────────────────────────────
export type StageId = "downloading" | "converting";
export type StageStatus = "pending" | "active" | "completed";

export interface StageInfo {
  id: StageId;
  label: string;
  status: StageStatus;
  progress: number;
}

export const STAGE_LABELS: Record<StageId, string> = {
  downloading: "Baixando imagens",
  converting: "Convertendo páginas",
};

export const STAGE_MESSAGES: Record<StageId, string> = {
  downloading: "Baixando as imagens dos capítulos…",
  converting: "Aplicando o preset e convertendo as páginas…",
};

export const STAGE_ONOMATOPOEIA: Record<StageId, string> = {
  downloading: "WHOOSH!",
  converting: "BEEP!",
};

// ── Tipos de log ──────────────────────────────────────────────────────────────
export interface LogEntry {
  timestamp: string;
  type: "info" | "error" | "cache" | "progress" | "warn";
  message: string;
}

// ── Chapter detail ────────────────────────────────────────────────────────────
export interface ChapterDetail {
  chapterId: string;
  currentImage: number;
  totalImages: number;
  fromCache: boolean;
}

export interface CorruptPageEntry {
  chapterId: string;
  pageIndex: number;
  reason: string;
}

// ── Progress state (gerido por reducer) ───────────────────────────────────────
interface ProgressState {
  processedChapters: number;
  totalChapters: number;
  currentChapter: ChapterDetail | null;
  conversionActive: boolean;
  completedJobs: number;
  totalJobs: number;
  currentJobConversionProgress: number;
  logs: LogEntry[];
  corruptPages: CorruptPageEntry[];
}

type ProgressAction =
  | { type: "SET_TOTALS"; totalChapters: number; totalJobs: number; processedChapters?: number }
  | { type: "CHAPTER_STARTED"; chapterId: string; totalImages: number; fromCache: boolean }
  | { type: "CHAPTER_PROGRESS"; downloadedImages: number; totalImages: number }
  | { type: "CHAPTER_FINISHED" }
  | { type: "CHAPTER_SKIPPED"; chapterId: string }
  | { type: "CHAPTER_ERROR"; chapterId: string; error: string }
  | { type: "CORRUPT_PAGE"; chapterId: string; pageIndex: number; reason: string }
  | { type: "CONVERSION_STARTED" }
  | { type: "CONVERSION_PROGRESS"; progress: number }
  | { type: "JOB_COMPLETED" }
  | { type: "ADD_LOG"; entry: LogEntry };

function now(): string {
  return new Date().toISOString();
}

/**
 * Converte IDs internos de capítulo para exibição amigável.
 * "chap_0001"   → "Capítulo 1"
 * "chap_0001_2" → "Capítulo 1.2"
 */
export function formatChapterId(chapterId: string): string {
  const match = chapterId.match(/chap_0*(\d+)(?:_(\d+))?/i);
  if (!match) return chapterId;
  const main = parseInt(match[1], 10);
  const sub = match[2] ? `.${match[2]}` : "";
  return `Capítulo ${main}${sub}`;
}

function progressReducer(state: ProgressState, action: ProgressAction): ProgressState {
  switch (action.type) {
    case "SET_TOTALS":
      return {
        ...state,
        totalChapters: action.totalChapters,
        totalJobs: action.totalJobs,
        processedChapters: action.processedChapters ?? state.processedChapters,
      };

    case "CHAPTER_STARTED":
      return {
        ...state,
        currentChapter: {
          chapterId: action.chapterId,
          currentImage: 0,
          totalImages: action.totalImages,
          fromCache: action.fromCache,
        },
      };

    case "CHAPTER_PROGRESS":
      return {
        ...state,
        currentChapter: state.currentChapter
          ? {
              ...state.currentChapter,
              currentImage: action.downloadedImages,
              totalImages: action.totalImages,
            }
          : null,
      };

    case "CHAPTER_FINISHED":
      return {
        ...state,
        processedChapters: state.processedChapters + 1,
        currentChapter: null,
      };

    case "CHAPTER_SKIPPED":
      return {
        ...state,
        processedChapters: state.processedChapters + 1,
        currentChapter: null,
      };

    case "CHAPTER_ERROR":
      return {
        ...state,
        processedChapters: state.processedChapters + 1,
        currentChapter: null,
      };

    case "CORRUPT_PAGE":
      return {
        ...state,
        corruptPages: [...state.corruptPages, {
          chapterId: action.chapterId,
          pageIndex: action.pageIndex,
          reason: action.reason,
        }],
      };

    case "CONVERSION_STARTED":
      return { ...state, conversionActive: true };

    case "CONVERSION_PROGRESS":
      return {
        ...state,
        conversionActive: true,
        currentJobConversionProgress: action.progress,
      };

    case "JOB_COMPLETED":
      return {
        ...state,
        completedJobs: state.completedJobs + 1,
        currentJobConversionProgress: 100,
      };

    case "ADD_LOG":
      return { ...state, logs: [...state.logs, action.entry] };

    default:
      return state;
  }
}

const INITIAL_PROGRESS: ProgressState = {
  processedChapters: 0,
  totalChapters: 0,
  currentChapter: null,
  conversionActive: false,
  completedJobs: 0,
  totalJobs: 0,
  currentJobConversionProgress: 0,
  logs: [],
  corruptPages: [],
};

// ── Deriva stages a partir do ProgressState + apiJobs ─────────────────────────
function deriveStages(progress: ProgressState, apiJobs: { status: string }[]): StageInfo[] {
  const allDone =
    apiJobs.length > 0 &&
    apiJobs.every((j) => ["completed", "failed", "cancelled"].includes(j.status));

  // ── Download ─────────────────────────────────────────────────────────
  const downloadDone =
    allDone ||
    (progress.totalChapters > 0 && progress.processedChapters >= progress.totalChapters);
  const downloadActive =
    !downloadDone && (progress.processedChapters > 0 || progress.currentChapter !== null);
  const downloadProgress =
    progress.totalChapters > 0
      ? Math.round((progress.processedChapters / progress.totalChapters) * 100)
      : 0;

  // ── Conversion ───────────────────────────────────────────────────────
  const conversionDone = allDone;
  const conversionActive = progress.conversionActive && !conversionDone;
  // Agregado: completedJobs * 100/totalJobs + currentJobProgress/totalJobs
  const conversionProgress =
    progress.totalJobs > 0
      ? Math.min(
          100,
          Math.round(
            (progress.completedJobs * 100) / progress.totalJobs +
              progress.currentJobConversionProgress / progress.totalJobs,
          ),
        )
      : progress.conversionActive
        ? progress.currentJobConversionProgress
        : 0;

  return [
    {
      id: "downloading" as StageId,
      label: STAGE_LABELS.downloading,
      status: downloadDone ? "completed" : downloadActive ? "active" : "pending",
      progress: downloadProgress,
    },
    {
      id: "converting" as StageId,
      label: STAGE_LABELS.converting,
      status: conversionDone ? "completed" : conversionActive ? "active" : "pending",
      progress: conversionProgress,
    },
  ];
}

// ── Interface pública ─────────────────────────────────────────────────────────
interface UseConversionProgress {
  state: ConversionState | null;
  stages: StageInfo[];
  overallProgress: number;
  currentChapter: ChapterDetail | null;
  logs: LogEntry[];
  corruptPages: CorruptPageEntry[];
  isLoading: boolean;
  error: string | null;
  cancel: () => Promise<void>;
  isCancelled: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled", "partial"]);

function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

function allJobsTerminal(jobs: { status: string }[]): boolean {
  const terminalJobStatuses = new Set(["completed", "failed", "cancelled"]);
  return jobs.length > 0 && jobs.every((j) => terminalJobStatuses.has(j.status));
}

function toLogType(fromCache: boolean): "cache" | "info" {
  return fromCache ? "cache" : "info";
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useConversionProgress(conversionId: string): UseConversionProgress {
  const [apiState, setApiState] = useState<ConversionState | null>(null);
  const [progress, dispatch] = useReducer(progressReducer, INITIAL_PROGRESS);
  const overallProgressRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const sseRef = useRef<{ close: () => void } | null>(null);

  const closeSSE = useCallback(() => {
    sseRef.current?.close();
    sseRef.current = null;
  }, []);

  useEffect(() => {
    return () => closeSSE();
  }, [closeSSE]);

  // ── Load initial state + SSE ─────────────────────────────────────────────
  useEffect(() => {
    if (!conversionId) return;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const initial = await conversionsApi.get(conversionId);
        if (cancelled) return;

        setApiState(initial);
        const config = initial.config as {
          books?: { chapters?: string[] }[];
        };
        const totalChapters =
          config?.books?.reduce((sum, b) => sum + (b.chapters?.length ?? 0), 0) ?? 0;
        const totalJobs = initial.totalJobs;

        const terminal = isTerminal(initial.status);
        const initialProcessed = terminal
          ? initial.jobs
              .filter((j) => j.status === "completed")
              .reduce((sum, j) => {
                const book = config?.books?.[j.index];
                return sum + (book?.chapters?.length ?? 0);
              }, 0)
          : undefined;

        dispatch({ type: "SET_TOTALS", totalChapters, totalJobs, processedChapters: initialProcessed });

        setIsLoading(false);

        if (isTerminal(initial.status)) return;

        const sse = conversionsApi.events(conversionId, {
          onEvent(event, rawData) {
            const data = rawData as Record<string, unknown>;
            const chapterId = data.chapterId as string | undefined;
            const fromCache = (data.fromCache as boolean) ?? false;

            switch (event) {
              // ── Download events ──────────────────────────────────────
              case "download.chapter.started":
                if (chapterId) {
                  dispatch({
                    type: "CHAPTER_STARTED",
                    chapterId,
                    totalImages: (data.totalImages as number) ?? 0,
                    fromCache,
                  });
                  dispatch({
                    type: "ADD_LOG",
                    entry: {
                      timestamp: now(),
                      type: toLogType(fromCache),
                      message: fromCache
                        ? `${formatChapterId(chapterId)} em cache — pulando download`
                        : `Baixando ${formatChapterId(chapterId)} (${data.totalImages} imagens)`,
                    },
                  });
                }
                break;

              case "download.progress":
                if (chapterId) {
                  dispatch({
                    type: "CHAPTER_PROGRESS",
                    downloadedImages: (data.downloadedImages as number) ?? 0,
                    totalImages: (data.totalImages as number) ?? 0,
                  });
                }
                break;

              case "download.chapter.finished":
                dispatch({ type: "CHAPTER_FINISHED" });
                if (chapterId) {
                  dispatch({
                    type: "ADD_LOG",
                    entry: {
                      timestamp: now(),
                      type: "info",
                      message: `${formatChapterId(chapterId)} baixado — ${data.downloadedImages ?? "?"}/${data.totalImages ?? "?"} imagens`,
                    },
                  });
                }
                break;

              case "download.chapter.skipped":
                if (chapterId) {
                  dispatch({ type: "CHAPTER_SKIPPED", chapterId });
                  dispatch({
                    type: "ADD_LOG",
                    entry: {
                      timestamp: now(),
                      type: "warn",
                      message: `${formatChapterId(chapterId)} indisponível no site — capítulo ignorado`,
                    },
                  });
                }
                break;

              case "download.image.corrupt":
                dispatch({
                  type: "CORRUPT_PAGE",
                  chapterId: chapterId ?? "desconhecido",
                  pageIndex: (data.pageIndex as number) ?? 0,
                  reason: String(data.reason ?? "Imagem corrompida"),
                });
                dispatch({
                  type: "ADD_LOG",
                  entry: {
                    timestamp: now(),
                    type: "warn",
                    message: `${formatChapterId(chapterId ?? "")} pág. ${data.pageIndex} corrompida — ${String(data.reason ?? "desconhecido")}`,
                  },
                });
                break;

              case "download.error":
                dispatch({
                  type: "CHAPTER_ERROR",
                  chapterId: chapterId ?? "desconhecido",
                  error: String(data.error ?? "Erro no download"),
                });
                dispatch({
                  type: "ADD_LOG",
                  entry: {
                    timestamp: now(),
                    type: "error",
                    message: `Erro no capítulo ${chapterId ?? "?"}: ${String(data.error ?? "desconhecido")}`,
                  },
                });
                break;

              case "job.failed":
                dispatch({
                  type: "ADD_LOG",
                  entry: {
                    timestamp: now(),
                    type: "error",
                    message: `Job falhou: ${String(data.error ?? "Erro desconhecido")}`,
                  },
                });
                break;

              case "conversion.started":
                dispatch({ type: "CONVERSION_STARTED" });
                dispatch({ type: "CONVERSION_PROGRESS", progress: 5 });
                dispatch({
                  type: "ADD_LOG",
                  entry: {
                    timestamp: now(),
                    type: "info",
                    message: `KCC iniciado — ${String(data.deviceId ?? "")} ${String(data.format ?? "")}`,
                  },
                });
                break;

              case "conversion.progress":
                dispatch({
                  type: "CONVERSION_PROGRESS",
                  progress: Math.max(5, Math.min(100, (data.progress as number) ?? 5)),
                });
                break;

              case "conversion.finished":
                dispatch({ type: "CONVERSION_PROGRESS", progress: 100 });
                dispatch({
                  type: "ADD_LOG",
                  entry: {
                    timestamp: now(),
                    type: "info",
                    message: `KCC concluído — output: ${String(data.outputFile ?? "?")}`,
                  },
                });
                break;

              // ── Lifecycle ─────────────────────────────────────────────
              case "job.started":
                dispatch({ type: "CONVERSION_PROGRESS", progress: 0 });
                break;

              case "job.finished":
                dispatch({ type: "JOB_COMPLETED" });
                dispatch({
                  type: "ADD_LOG",
                  entry: {
                    timestamp: now(),
                    type: "info",
                    message: `Volume concluído — ${String(data.outputFile ?? "")}${((data.outputSize as number) ?? 0) > 0 ? ` (${((data.outputSize as number) / 1024 / 1024).toFixed(1)} MB)` : ""}`,
                  },
                });
                break;
            }

            // Update apiState via setApiState for job-level status
            setApiState((prev) => {
              if (!prev) return prev;
              const jobId = data.jobId as string | undefined;
              if (!jobId) return prev;

              const idx = prev.jobs.findIndex((j) => j.jobId === jobId);
              if (idx === -1) return prev;

              const updatedJobs = [...prev.jobs];
              const job = { ...updatedJobs[idx] };

              switch (event) {
                case "job.started":
                  job.status = "preparing";
                  break;
                case "download.started":
                  job.status = "downloading";
                  break;
                case "conversion.started":
                  job.status = "converting";
                  break;
                case "conversion.progress":
                  job.status = "converting";
                  break;
                case "conversion.finished":
                  job.status = "packaging";
                  break;
                case "job.finished":
                  job.status = "completed";
                  if (data.outputFile) job.outputFile = data.outputFile as string;
                  if (data.outputSize) job.outputSize = data.outputSize as number;
                  break;
                case "job.failed":
                  job.status = "failed";
                  job.error = (data.error as string) ?? "Erro desconhecido";
                  break;
              }

              updatedJobs[idx] = job;

              const allDone = allJobsTerminal(updatedJobs);
              const hasFailure = updatedJobs.some((j) => j.status === "failed");
              const hasSuccess = updatedJobs.some((j) => j.status === "completed");

              let newStatus = prev.status;
              if (allDone) {
                if (hasFailure && hasSuccess) newStatus = "partial";
                else if (hasFailure) newStatus = "failed";
                else newStatus = "completed";
              } else {
                newStatus = "processing";
              }

              return { ...prev, jobs: updatedJobs, status: newStatus };
            });

            setApiState((current) => {
              if (current && allJobsTerminal(current.jobs)) {
                conversionsApi.get(conversionId).then((fresh) => {
                  setApiState(fresh);
                });
                closeSSE();
              }
              return current;
            });
          },

          onError(err) {
            setError(err.message);
            dispatch({
              type: "ADD_LOG",
              entry: { timestamp: now(), type: "error", message: `SSE erro: ${err.message}` },
            });
          },
        });

        sseRef.current = sse;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar conversão");
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      closeSSE();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversionId]);

  const cancel = useCallback(async () => {
    closeSSE();
    try {
      await conversionsApi.cancel(conversionId);
      setIsCancelled(true);
      setApiState((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
      dispatch({
        type: "ADD_LOG",
        entry: { timestamp: now(), type: "info", message: "Conversão cancelada pelo usuário" },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar");
    }
  }, [conversionId, closeSSE]);

  // ── Derived values ───────────────────────────────────────────────────────
  const stages = deriveStages(progress, apiState?.jobs ?? []);

  // Aggregated conversion progress (same formula as deriveStages)
  const aggregatedConversion =
    progress.totalJobs > 0
      ? Math.min(
          100,
          Math.round(
            (progress.completedJobs * 100) / progress.totalJobs +
              progress.currentJobConversionProgress / progress.totalJobs,
          ),
        )
      : progress.conversionActive
        ? progress.currentJobConversionProgress
        : 0;

  const overallProgress = useMemo(() => {
    if (apiState && isTerminal(apiState.status)) return 100;

    const raw =
      progress.totalChapters > 0
        ? Math.round(
            (progress.processedChapters / progress.totalChapters) * 50 + aggregatedConversion * 0.5,
          )
        : 0;
    overallProgressRef.current = Math.max(overallProgressRef.current, raw);
    return overallProgressRef.current;
  }, [apiState?.status, progress.processedChapters, progress.totalChapters, aggregatedConversion]);

  return {
    state: apiState,
    stages,
    overallProgress,
    currentChapter: progress.currentChapter,
    logs: progress.logs,
    corruptPages: progress.corruptPages,
    isLoading,
    error,
    cancel,
    isCancelled,
  };
}
