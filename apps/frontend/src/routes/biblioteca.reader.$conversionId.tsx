import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { conversionsApi, tokenStore } from "@/lib/api";
import { ReaderCore } from "@/components/reader/ReaderCore";
import type { ReaderIndexItem } from "@/components/reader/ReaderChapterIndex";
import JSZip from "jszip";

export const Route = createFileRoute("/biblioteca/reader/$conversionId")({
  validateSearch: z.object({
    jobId: z.string().optional(),
  }),
  component: ReaderPage,
});

function getFormat(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "epub") return "epub";
  if (ext === "pdf") return "pdf";
  if (ext === "cbz") return "cbz";
  if (ext === "mobi") return "mobi";
  return ext;
}

function ReaderPage() {
  const { conversionId } = Route.useParams();
  const { jobId: preselectedJobId } = Route.useSearch();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readerData, setReaderData] = useState<{ url: string; format: string } | null>(null);
  const [title, setTitle] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Array<{ jobId: string; title: string; outputFile?: string }>>(
    [],
  );
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [mangaMode, setMangaMode] = useState(false);
  const autoSelectFired = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const state = await conversionsApi.get(conversionId);
        if (cancelled) return;
        const completed = state.jobs.filter((j) => j.status === "completed" && j.outputFile);
        setJobs(
          completed.map((j) => ({ jobId: j.jobId, title: j.title, outputFile: j.outputFile })),
        );
        const config = state.config as {
          sourceId?: string;
          metadata?: { title?: string };
          options?: { mangaMode?: boolean };
        } | null;
        const resolvedSourceId = config?.sourceId || state.sourceId || null;
        if (resolvedSourceId) {
          setSourceId(resolvedSourceId);
        }
        setTitle(config?.metadata?.title ?? "Conversão");
        setMangaMode(!!config?.options?.mangaMode);
        setLoading(false);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar");
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [conversionId]);

  async function openJob(jobId: string, outputFile?: string) {
    try {
      setLoading(true);
      setSelectedJob(jobId);
      const format = outputFile ? getFormat(outputFile) : "epub";

      // Revoga Object URL anterior para evitar vazamento de memória
      if (readerData?.url) {
        URL.revokeObjectURL(readerData.url);
      }

      // MOBI e PDF: preview incremental no navegador via endpoint de stream do backend
      if (format === "mobi" || format === "pdf") {
        setReaderData({ url: "", format });
        setLoading(false);
        return;
      }

      const token = tokenStore.get() ?? undefined;
      const url = `/api/conversions/${conversionId}/jobs/${jobId}/download`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao baixar arquivo");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      setReaderData({ url: objUrl, format });
      setLoading(false);
    } catch (err: unknown) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Erro ao abrir");
    }
  }

  const handleNavigateJob = (newJobId: string) => {
    nav({
      to: "/biblioteca/reader/$conversionId",
      params: { conversionId },
      search: { jobId: newJobId },
    });
    const target = jobs.find((j) => j.jobId === newJobId);
    if (target) {
      openJob(target.jobId, target.outputFile);
    }
  };

  // Auto-abrir o job selecionado ou o primeiro disponível
  useEffect(() => {
    if (!readerData && !loading && jobs.length > 0 && !autoSelectFired.current) {
      autoSelectFired.current = true;
      const target = preselectedJobId
        ? (jobs.find((j) => j.jobId === preselectedJobId) ?? jobs[0])
        : jobs[0];
      openJob(target.jobId, target.outputFile);
    }
  }, [preselectedJobId, jobs, readerData, loading]);

  const handleGoBack = useCallback(() => {
    if (readerData?.url) URL.revokeObjectURL(readerData.url);
    if (sourceId) {
      nav({
        to: "/biblioteca/$sourceId",
        params: { sourceId },
        search: { tab: "conversoes" as const },
      });
    } else {
      nav({ to: "/biblioteca" });
    }
  }, [sourceId, readerData, nav]);

  const volumeNavItems: ReaderIndexItem[] = useMemo(() => {
    return jobs.map((j, idx) => ({
      id: j.jobId,
      title: j.title || `Vol. ${idx + 1}`,
      number: `Vol. ${idx + 1}`,
      isDownloaded: true,
    }));
  }, [jobs]);

  const currentJobIndex = selectedJob ? jobs.findIndex((j) => j.jobId === selectedJob) : -1;
  const prevJobId = currentJobIndex > 0 ? jobs[currentJobIndex - 1].jobId : null;
  const nextJobId =
    currentJobIndex >= 0 && currentJobIndex < jobs.length - 1
      ? jobs[currentJobIndex + 1].jobId
      : null;
  const currentJob = currentJobIndex >= 0 ? jobs[currentJobIndex] : null;

  if (loading && !readerData) {
    return (
      <div className="fixed inset-0 z-50 bg-reader-bg flex flex-col items-center justify-center gap-5">
        <BookOpen className="w-8 h-8 text-reader-muted/50 animate-pulse" strokeWidth={1.25} />
        <p className="text-[11px] uppercase tracking-[0.3em] text-reader-muted/70">Mangaink</p>
        <p className="text-xs text-reader-muted/60">Carregando páginas…</p>
      </div>
    );
  }

  if (error && !readerData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-xl text-comic-red mb-4">{error}</p>
          <Button
            onClick={() => {
              setError(null);
              handleGoBack();
            }}
          >
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  // Visualizador unificado com ReaderCore para formatos renderizados pelo backend (MOBI e PDF)
  if (readerData && (readerData.format === "mobi" || readerData.format === "pdf")) {
    return (
      <ConversionServerPreviewReader
        conversionId={conversionId}
        jobId={selectedJob ?? ""}
        mangaTitle={title}
        volumeTitle={currentJob?.title ?? "Volume"}
        onBack={handleGoBack}
        mangaMode={mangaMode}
        volumeNavItems={volumeNavItems}
        prevJobId={prevJobId}
        nextJobId={nextJobId}
        onNavigateJob={handleNavigateJob}
      />
    );
  }

  // Visualizador unificado com ReaderCore para CBZ e EPUB (arquivos ZIP de imagens no KCC)
  if (readerData && (readerData.format === "cbz" || readerData.format === "epub")) {
    return (
      <ConversionArchiveReader
        url={readerData.url}
        mangaTitle={title}
        volumeTitle={currentJob?.title ?? "Volume"}
        onBack={handleGoBack}
        mangaMode={mangaMode}
        volumeNavItems={volumeNavItems}
        currentJobId={selectedJob ?? ""}
        prevJobId={prevJobId}
        nextJobId={nextJobId}
        onNavigateJob={handleNavigateJob}
      />
    );
  }

  // Visualizador de EPUB e PDF com chrome consistente
  return (
    <div className="h-screen bg-reader-bg flex flex-col overflow-hidden select-none">
      <div className="bg-reader-bg/90 backdrop-blur-sm border-b border-reader-border px-3 sm:px-4 py-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-3 shrink-0">
        <button
          onClick={handleGoBack}
          className="h-8 w-8 rounded-md flex items-center justify-center text-reader-muted hover:text-reader-foreground hover:bg-reader-surface transition-colors shrink-0 justify-self-start"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <span className="text-sm text-reader-foreground truncate text-center min-w-0">{title}</span>
        <span className="text-xs text-reader-muted truncate text-right justify-self-end max-w-[40vw]">
          {currentJob?.title ?? "Volume"}
        </span>
      </div>
      <div className="flex-1 relative overflow-hidden bg-reader-bg">
        {/* Futuros visualizadores customizados iriam aqui */}
      </div>
    </div>
  );
}

interface ConversionServerPreviewReaderProps {
  conversionId: string;
  jobId: string;
  mangaTitle: string;
  volumeTitle: string;
  onBack: () => void;
  mangaMode?: boolean;
  volumeNavItems: ReaderIndexItem[];
  prevJobId: string | null;
  nextJobId: string | null;
  onNavigateJob: (jobId: string) => void;
}

function ConversionServerPreviewReader({
  conversionId,
  jobId,
  mangaTitle,
  volumeTitle,
  onBack,
  mangaMode,
  volumeNavItems,
  prevJobId,
  nextJobId,
  onNavigateJob,
}: ConversionServerPreviewReaderProps) {
  const [status, setStatus] = useState<"starting" | "extracting" | "ready" | "failed">("starting");
  const [totalPages, setTotalPages] = useState(0);
  const [readyPages, setReadyPages] = useState(0);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = useCallback(() => {
    setStatus("starting");
    setExtractError(null);
    setTotalPages(0);
    setReadyPages(0);
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    async function startPreview() {
      try {
        const token = tokenStore.get() ?? undefined;
        const res = await fetch(`/api/conversions/${conversionId}/jobs/${jobId}/preview`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        });
        if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status}`);
        const body = await res.json().catch(() => ({}));

        if (body.status === "ready") {
          setStatus("ready");
          setTotalPages(body.totalPages ?? 0);
          setReadyPages(body.totalPages ?? 0);
          return;
        }

        setStatus("extracting");

        let lastKnownReadyPages = 0;
        const resetTimeout = () => {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          timeoutTimer = setTimeout(() => {
            if (cancelled) return;
            if (poll) clearInterval(poll);
            setStatus("failed");
            setExtractError(
              "Tempo limite excedido ao preparar o preview. Clique em tentar novamente.",
            );
          }, 120_000);
        };
        resetTimeout();

        poll = setInterval(async () => {
          if (cancelled) return;
          try {
            const sres = await fetch(`/api/conversions/${conversionId}/jobs/${jobId}/preview`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              credentials: "include",
            });
            if (!sres.ok) return;
            const sbody = await sres.json().catch(() => ({}));
            const currentTotal = sbody.totalPages ?? 0;
            const currentReady = sbody.readyPages ?? 0;
            setTotalPages(currentTotal);
            setReadyPages(currentReady);

            if (currentReady > lastKnownReadyPages) {
              lastKnownReadyPages = currentReady;
              resetTimeout();
            }

            if (sbody.status === "ready") {
              if (poll) clearInterval(poll);
              if (timeoutTimer) clearTimeout(timeoutTimer);
              setStatus("ready");
            } else if (sbody.status === "failed") {
              if (poll) clearInterval(poll);
              if (timeoutTimer) clearTimeout(timeoutTimer);
              setStatus("failed");
              setExtractError(sbody.error ?? "Falha na extração");
            }
          } catch {
            // mantém poll ativo
          }
        }, 1000);
      } catch (err: unknown) {
        setStatus("failed");
        setExtractError(err instanceof Error ? err.message : "Erro ao iniciar preview");
      }
    }

    startPreview();
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };
  }, [conversionId, jobId, retryCount]);

  const pageUrls = useMemo(() => {
    if (totalPages === 0) return [];
    return Array.from(
      { length: totalPages },
      (_, i) => `/api/conversions/${conversionId}/jobs/${jobId}/preview/pages/${i}`,
    );
  }, [conversionId, jobId, totalPages]);

  return (
    <ReaderCore
      pageUrls={pageUrls}
      totalPages={totalPages}
      mangaTitle={mangaTitle}
      itemTitle={volumeTitle}
      onBack={onBack}
      mangaMode={mangaMode}
      navItems={volumeNavItems}
      currentNavId={jobId}
      prevNavId={prevJobId}
      nextNavId={nextJobId}
      onNavigateNavId={onNavigateJob}
      navItemLabel="Volumes"
      onRetry={handleRetry}
      isLoading={status === "starting" || (status === "extracting" && totalPages === 0)}
      hasError={status === "failed"}
      errorMessage={extractError ?? "Falha ao carregar visualização"}
      transitionMessage={
        status === "extracting" && totalPages > 0
          ? `Carregando páginas… (${readyPages}/${totalPages})`
          : "Carregando páginas…"
      }
    />
  );
}

interface ConversionArchiveReaderProps {
  url: string;
  mangaTitle: string;
  volumeTitle: string;
  onBack: () => void;
  mangaMode?: boolean;
  volumeNavItems: ReaderIndexItem[];
  currentJobId: string;
  prevJobId: string | null;
  nextJobId: string | null;
  onNavigateJob: (jobId: string) => void;
}

function ConversionArchiveReader({
  url,
  mangaTitle,
  volumeTitle,
  onBack,
  mangaMode,
  volumeNavItems,
  currentJobId,
  prevJobId,
  nextJobId,
  onNavigateJob,
}: ConversionArchiveReaderProps) {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const zip = await JSZip.loadAsync(blob);
        const imageFiles = Object.keys(zip.files)
          .filter((f) => !zip.files[f].dir && /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(f))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const urls: string[] = [];
        for (const file of imageFiles) {
          const data = await zip.files[file].async("blob");
          urls.push(URL.createObjectURL(data));
        }
        if (!cancelled) {
          setPages(urls);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    return () => {
      pages.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [pages]);

  return (
    <ReaderCore
      pageUrls={pages}
      totalPages={pages.length}
      mangaTitle={mangaTitle}
      itemTitle={volumeTitle}
      onBack={onBack}
      mangaMode={mangaMode}
      navItems={volumeNavItems}
      currentNavId={currentJobId}
      prevNavId={prevJobId}
      nextNavId={nextJobId}
      onNavigateNavId={onNavigateJob}
      navItemLabel="Volumes"
      isLoading={loading}
      transitionMessage="Carregando páginas…"
    />
  );
}
