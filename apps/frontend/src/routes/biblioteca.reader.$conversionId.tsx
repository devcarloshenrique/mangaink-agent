import { useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { Button } from "@/components/ui/button";
import { Toaster } from "sonner";
import { ArrowLeft, BookOpen, Loader2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { conversionsApi } from "@/lib/api";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readerData, setReaderData] = useState<{ url: string; format: string } | null>(null);
  const [title, setTitle] = useState("");
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
        setTitle(
          state.config && typeof state.config === "object" && "metadata" in state.config
            ? ((state.config as any).metadata?.title ?? "Conversão")
            : "Conversão",
        );
        setMangaMode(
          state.config && typeof state.config === "object" && "options" in state.config
            ? !!(state.config as any).options?.mangaMode
            : false,
        );
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Erro ao carregar");
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

      // MOBI: preview no navegador via extracao de paginas no /temp/ do backend.
      // Nao baixa o arquivo inteiro — apenas aciona POST /preview e renderiza
      // as paginas individualmente (fetch /preview/pages/:index).
      if (format === "mobi") {
        setReaderData({ url: "", format });
        setLoading(false);
        return;
      }

      const token = localStorage.getItem("mangaink_token");
      const url = `/api/conversions/${conversionId}/jobs/${jobId}/download`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Erro ao baixar arquivo");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      setReaderData({ url: objUrl, format });
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setError(err?.message ?? "Erro ao abrir");
    }
  }

  useEffect(() => {
    if (
      preselectedJobId &&
      jobs.length > 0 &&
      !readerData &&
      !loading &&
      !autoSelectFired.current
    ) {
      const target = jobs.find((j) => j.jobId === preselectedJobId);
      if (target) {
        autoSelectFired.current = true;
        openJob(target.jobId, target.outputFile);
      }
    }
  }, [preselectedJobId, jobs, readerData, loading]);

  const goBack = () => {
    if (readerData?.url) URL.revokeObjectURL(readerData.url);
    setReaderData(null);
    setSelectedJob(null);
  };

  if (loading && !readerData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-comic-blue" />
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
              window.history.back();
            }}
          >
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  if (!readerData && jobs.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <Toaster richColors position="top-right" />
        <ComicHeader />
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="h-10 w-10 border-[3px] border-ink rounded-lg bg-comic-yellow flex items-center justify-center shadow-comic-sm hover:-translate-y-0.5 transition-transform"
            >
              <ArrowLeft />
            </button>
            <div>
              <h1 className="font-display text-3xl uppercase leading-none truncate">{title}</h1>
              <p className="text-sm font-medium opacity-70 mt-1">Selecione um volume para ler</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {jobs.map((job) => (
              <ComicPanel
                key={job.jobId}
                bg="card"
                padding="md"
                tilt="none"
                className="cursor-pointer hover:-translate-y-1 transition-transform"
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => openJob(job.jobId, job.outputFile)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-12 shrink-0 border-[3px] border-ink rounded bg-muted flex items-center justify-center">
                      <BookOpen className="h-6 w-6 opacity-40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-lg truncate">{job.title}</h3>
                      <p className="text-xs opacity-50">{job.outputFile}</p>
                    </div>
                  </div>
                </button>
              </ComicPanel>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b-[3px] border-ink bg-card shrink-0">
        <button
          type="button"
          onClick={goBack}
          className="h-9 w-9 border-[2.5px] border-ink rounded-md bg-comic-yellow flex items-center justify-center shadow-comic-sm hover:-translate-y-0.5 transition-transform"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="font-display text-lg uppercase truncate flex-1">{title}</h2>
      </div>
      <div className="flex-1 relative overflow-hidden">
        {readerData && readerData.format === "epub" && <EpubViewer url={readerData.url} />}
        {readerData && readerData.format === "pdf" && <PdfViewer url={readerData.url} />}
        {readerData && readerData.format === "cbz" && (
          <CbzViewer url={readerData.url} mangaMode={mangaMode} />
        )}
        {readerData && readerData.format === "mobi" && (
          <MobiViewer
            conversionId={conversionId}
            jobId={selectedJob ?? ""}
            title={title}
            mangaMode={mangaMode}
          />
        )}
      </div>
    </div>
  );
}

function EpubViewer({ url }: { url: string }) {
  const [ReactReader, setReactReader] = useState<any>(null);
  const [readerStyles, setReaderStyles] = useState<any>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    import("react-reader").then((mod) => {
      setReactReader(() => mod.ReactReader);
      setReaderStyles(() => ({
        ...mod.ReactReaderStyle,
        container: { ...mod.ReactReaderStyle.container, height: "100%", width: "100%" },
        readerArea: { ...mod.ReactReaderStyle.readerArea, backgroundColor: "#f5f0e8" },
      }));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((buf) => {
        if (!cancelled) setArrayBuffer(buf);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="font-display text-lg text-comic-red">Erro ao carregar EPUB</p>
      </div>
    );
  }

  if (!ReactReader || !arrayBuffer || !readerStyles) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactReader
        url={arrayBuffer}
        title=""
        showToc={true}
        location={null}
        locationChanged={() => {}}
        readerStyles={readerStyles}
      />
    </div>
  );
}

function PdfViewer({ url }: { url: string }) {
  return <iframe src={url} className="w-full h-full border-0" title="PDF Viewer" />;
}

function CbzViewer({ url, mangaMode }: { url: string; mangaMode?: boolean }) {
  const [pages, setPages] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const zip = await JSZip.loadAsync(blob);
        const imageFiles = Object.keys(zip.files)
          .filter((f) => /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(f))
          .sort();
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

  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);
  const next = useCallback(
    () => setCurrent((c) => Math.min(pages.length - 1, c + 1)),
    [pages.length],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Nenhuma página encontrada no CBZ</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#2a2a2a]">
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b-[2px] border-ink shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="border-[2px] border-ink shadow-comic-sm"
          onClick={mangaMode ? next : prev}
          disabled={mangaMode ? current >= pages.length - 1 : current === 0}
        >
          {mangaMode ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        <span className="font-display text-sm">
          {current + 1} / {pages.length}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="border-[2px] border-ink shadow-comic-sm"
          onClick={mangaMode ? prev : next}
          disabled={mangaMode ? current === 0 : current >= pages.length - 1}
        >
          {mangaMode ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <img
          src={pages[current]}
          alt={`Página ${current + 1}`}
          className="max-h-full max-w-full object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}

interface MobiViewerProps {
  conversionId: string;
  jobId: string;
  title: string;
  mangaMode?: boolean;
}

function MobiViewer({ conversionId, jobId, title, mangaMode }: MobiViewerProps) {
  const [status, setStatus] = useState<"starting" | "extracting" | "ready" | "failed">("starting");
  const [totalPages, setTotalPages] = useState(0);
  const [readyPages, setReadyPages] = useState(0);
  const [current, setCurrent] = useState(0);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const pageUrlRef = useRef<string | null>(null);

  // Poll de status enquanto extrai
  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    async function startPreview() {
      try {
        const token = localStorage.getItem("mangaink_token");
        const res = await fetch(`/api/conversions/${conversionId}/jobs/${jobId}/preview`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
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
        poll = setInterval(async () => {
          if (cancelled) return;
          try {
            const sres = await fetch(`/api/conversions/${conversionId}/jobs/${jobId}/preview`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!sres.ok) return;
            const sbody = await sres.json().catch(() => ({}));
            setTotalPages(sbody.totalPages ?? 0);
            setReadyPages(sbody.readyPages ?? 0);
            if (sbody.status === "ready") {
              if (poll) clearInterval(poll);
              setStatus("ready");
            } else if (sbody.status === "failed") {
              if (poll) clearInterval(poll);
              setStatus("failed");
              setExtractError(sbody.error ?? "Falha na extração");
            }
          } catch {
            // mantém poll ativo
          }
        }, 1000);
      } catch (err: any) {
        setStatus("failed");
        setExtractError(err?.message ?? "Erro ao iniciar preview");
      }
    }

    startPreview();
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
    };
  }, [conversionId, jobId]);

  // Carrega a pagina atual sob demanda
  const loadPage = useCallback(
    async (index: number) => {
      if (index < 0 || (totalPages > 0 && index >= totalPages)) return;
      setPageLoading(true);
      setPageError(null);
      try {
        const token = localStorage.getItem("mangaink_token");
        const res = await fetch(
          `/api/conversions/${conversionId}/jobs/${jobId}/preview/pages/${index}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (res.status === 425) {
          setPageLoading(false);
          setPageError("Página ainda sendo extraída…");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        // Revoga URL anterior da lista de object URLs
        const prev = pageUrlRef.current;
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        pageUrlRef.current = url;
        objectUrlsRef.current = objectUrlsRef.current.filter((u) => u !== prev);
        objectUrlsRef.current.push(url);
        setPageUrl(url);
        setPageLoading(false);
      } catch (err: any) {
        setPageError(err?.message ?? "Erro ao carregar página");
        setPageLoading(false);
      }
    },
    [conversionId, jobId, totalPages],
  );

  // Carrega pagina 0 assim que temos status (ready ou readyPages > 0)
  useEffect(() => {
    if (status === "ready" || readyPages > 0) {
      loadPage(current);
    }
  }, [status, readyPages, current, loadPage]);

  // Cleanup de object URLs
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(URL.revokeObjectURL);
      objectUrlsRef.current = [];
    };
  }, []);

  // Botao de download do MOBI original (caminho secundario)
  const downloadMobiUrl = `/api/conversions/${conversionId}/jobs/${jobId}/download`;
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("mangaink_token") : null;

  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);
  const next = useCallback(
    () => setCurrent((c) => Math.min(Math.max(totalPages - 1, readyPages - 1, c), c + 1)),
    [totalPages, readyPages],
  );

  if (status === "failed") {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-md">
          <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <h3 className="font-display text-2xl uppercase mb-2">Falha na extração</h3>
          <p className="text-sm opacity-70 mb-6">{extractError}</p>
          <a
            href={downloadMobiUrl}
            download={`${title || "manga"}.mobi`}
            className="inline-flex items-center gap-2 bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display text-sm px-4 py-2 rounded-md hover:-translate-y-0.5 transition-transform"
            {...(token ? { "data-auth": "1" } : {})}
          >
            <Download className="h-4 w-4" /> Baixar MOBI
          </a>
        </div>
      </div>
    );
  }

  if (status === "starting" || (status === "extracting" && readyPages === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
        <Loader2 className="h-10 w-10 animate-spin text-comic-blue" />
        <p className="font-display text-lg uppercase">Extraindo MOBI…</p>
        <p className="text-xs opacity-60">A primeira página aparecerá em instantes.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#2a2a2a]">
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b-[2px] border-ink shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="border-[2px] border-ink shadow-comic-sm"
          onClick={mangaMode ? next : prev}
          disabled={mangaMode ? status === "ready" && current >= totalPages - 1 : current === 0}
        >
          {mangaMode ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        <div className="flex items-center gap-3">
          <span className="font-display text-sm">
            {status === "extracting" ? (
              <span className="text-comic-yellow">
                Extraindo… {readyPages}/{totalPages || "…"}
              </span>
            ) : (
              <span>
                {current + 1} / {totalPages}
              </span>
            )}
          </span>
          <a
            href={downloadMobiUrl}
            download={`${title || "manga"}.mobi`}
            className="inline-flex items-center gap-1 text-xs font-display border-[2px] border-ink rounded px-2 py-1 bg-comic-red text-primary-foreground hover:-translate-y-0.5 transition-transform shadow-comic-sm"
            {...(token ? { "data-auth": "1" } : {})}
          >
            <Download className="h-3 w-3" /> Baixar MOBI
          </a>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-[2px] border-ink shadow-comic-sm"
          onClick={mangaMode ? prev : next}
          disabled={mangaMode ? current === 0 : status === "ready" && current >= totalPages - 1}
        >
          {mangaMode ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {pageLoading && <Loader2 className="h-8 w-8 animate-spin" />}
        {pageError && !pageLoading && (
          <div className="text-center text-comic-yellow">
            <p className="font-display text-lg mb-2">{pageError}</p>
            <Button size="sm" variant="outline" onClick={() => loadPage(current)}>
              Tentar novamente
            </Button>
          </div>
        )}
        {!pageLoading && !pageError && pageUrl && (
          <img
            src={pageUrl}
            alt={`Página ${current + 1}`}
            className="max-h-full max-w-full object-contain shadow-2xl"
          />
        )}
      </div>
    </div>
  );
}
