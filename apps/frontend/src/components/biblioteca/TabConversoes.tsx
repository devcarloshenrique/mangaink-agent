import { useState, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  BookOpen,
  ScrollText,
  Trash2,
  Eye,
  Settings,
  Search,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/utils";
import { conversionsApi } from "@/lib/api";
import { useConversionsList } from "@/hooks/useConversions";
import { useConversionActions } from "@/hooks/useConversionActions";
import { ComicPanel } from "@/components/comic/ComicPanel";
import type {
  ConversionStatus,
  ConversionSummary,
  JobSummary,
} from "@/types/conversion";

interface TabConversoesProps {
  sourceId: string;
  conversions?: ConversionSummary[];
  jobsMap?: Record<string, JobSummary[]>;
}

function statusLabel(s: ConversionStatus): string {
  const map: Record<ConversionStatus, string> = {
    queued: "Na fila",
    processing: "Convertendo",
    completed: "Concluido",
    failed: "Erro",
    cancelled: "Cancelado",
    partial: "Parcial",
  };
  return map[s] ?? s;
}

const SPINE_BORDER: Record<string, string> = {
  completed: "border-l-comic-blue",
  processing: "border-l-comic-yellow",
  queued: "border-l-comic-yellow/40",
  failed: "border-l-comic-red",
  cancelled: "border-l-comic-red/40",
  partial: "border-l-comic-yellow",
};

interface ExpandedState {
  open: boolean;
  jobs: JobSummary[] | null;
  loading: boolean;
  error: string | null;
  filter: string;
  searchOpen: boolean;
}

function ExpandBtn({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 font-display text-xs uppercase tracking-wider px-3 py-1.5 border-[2.5px] border-ink rounded-lg bg-comic-yellow shadow-comic-sm hover:-translate-y-0.5 transition-all shrink-0"
    >
      <span>{open ? "Fechar" : "Ver"}</span>
      <ChevronDown
        className={cn(
          "h-3 w-3 transition-transform duration-200",
          open && "rotate-180",
        )}
      />
    </button>
  );
}

function SearchBtn({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-display uppercase tracking-wider transition-colors",
        open ? "text-ink/60 hover:text-ink" : "text-ink/30 hover:text-ink/50",
      )}
    >
      <Search className="h-3.5 w-3.5" />
      {open ? "Ocultar" : "Filtrar"}
    </button>
  );
}

function JobRowCover({
  sourceId,
  className,
}: {
  sourceId: string;
  className?: string;
}) {
  const [error, setError] = useState(false);
  const url = conversionsApi.coverUrl(sourceId, { kind: "original" });

  if (!url || error) {
    return (
      <div
        className={cn(
          "h-full w-full bg-muted flex items-center justify-center",
          className,
        )}
      >
        <BookOpen className="h-5 w-5 opacity-30" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className={cn("h-full w-full object-cover", className)}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

export function TabConversoes({
  sourceId,
  conversions: propConversions,
  jobsMap,
}: TabConversoesProps) {
  const { data, isLoading: apiLoading } = useConversionsList({
    sourceId,
    limit: 50,
  });
  const { remove, reconvert } = useConversionActions();
  const navigate = useNavigate();

  const isMock = !!propConversions;
  const conversions = propConversions ?? data?.items ?? [];
  const isLoading = !isMock && apiLoading;

  const [expandedMap, setExpandedMap] = useState<Record<string, ExpandedState>>(
    {},
  );

  const toggleExpand = useCallback(
    async (convId: string) => {
      let shouldFetch = false;

      setExpandedMap((prev) => {
        const current = prev[convId];
        if (current?.open) {
          return { ...prev, [convId]: { ...current, open: false } };
        }
        if (current?.jobs) {
          return { ...prev, [convId]: { ...current, open: true } };
        }

        if (jobsMap?.[convId]) {
          const mockJobs = jobsMap[convId].filter(
            (j) => j.status === "completed" && j.outputFile,
          );
          return {
            ...prev,
            [convId]: {
              open: true,
              jobs: mockJobs,
              loading: false,
              error: null,
              filter: "",
              searchOpen: false,
            },
          };
        }

        shouldFetch = true;
        return {
          ...prev,
          [convId]: {
            open: true,
            jobs: null,
            loading: true,
            error: null,
            filter: "",
            searchOpen: false,
          },
        };
      });

      if (!shouldFetch) return;

      try {
        const state = await conversionsApi.get(convId);
        const completedJobs = state.jobs.filter(
          (j) => j.status === "completed" && j.outputFile,
        );
        setExpandedMap((prev) => ({
          ...prev,
          [convId]: {
            ...prev[convId],
            jobs: completedJobs,
            loading: false,
          },
        }));
      } catch (err: any) {
        setExpandedMap((prev) => ({
          ...prev,
          [convId]: {
            ...prev[convId],
            loading: false,
            error: err?.message ?? "Erro ao carregar volumes",
          },
        }));
      }
    },
    [jobsMap],
  );

  const setFilter = useCallback((convId: string, filter: string) => {
    setExpandedMap((prev) => {
      const current = prev[convId];
      if (!current) return prev;
      return { ...prev, [convId]: { ...current, filter } };
    });
  }, []);

  const toggleSearch = useCallback((convId: string) => {
    setExpandedMap((prev) => {
      const current = prev[convId];
      if (!current) return prev;
      return {
        ...prev,
        [convId]: { ...current, searchOpen: !current.searchOpen },
      };
    });
  }, []);

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-comic-blue" />
      </div>
    );
  }

  if (conversions.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
        <p className="font-display text-lg uppercase text-ink/30">
          Nenhuma conversao encontrada.
        </p>
      </div>
    );
  }

  return (
    <ComicPanel bg="card" padding="sm">
      {conversions.map((conv, idx) => {
        const expanded = expandedMap[conv.conversionId];
        const isOpen = expanded?.open ?? false;
        const jobs = expanded?.jobs ?? [];
        const filter = expanded?.filter ?? "";
        const loadingJobs = expanded?.loading ?? false;
        const jobsError = expanded?.error ?? null;
        const searchOpen = expanded?.searchOpen ?? false;

        const q = filter.toLowerCase().trim();
        const filteredJobs = q
          ? jobs.filter(
              (j) =>
                String(j.title ?? "").toLowerCase().includes(q) ||
                String(j.outputFile ?? "").toLowerCase().includes(q),
            )
          : jobs;

        const statusBg =
          conv.status === "completed"
            ? "bg-comic-blue text-white"
            : conv.status === "queued" || conv.status === "processing"
              ? "bg-comic-yellow text-ink"
              : "bg-muted";

        return (
          <div key={conv.conversionId}>
            <div
              className={cn(
                "border-l-[8px] pl-6",
                SPINE_BORDER[conv.status],
              )}
            >
              <div className="flex items-center gap-3 py-3">
                <BookOpen className="h-5 w-5 shrink-0 opacity-20" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-lg leading-none truncate">
                      {conv.title || conv.conversionId}
                    </h3>
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 border-2 border-ink rounded-full shrink-0",
                        statusBg,
                      )}
                    >
                      {statusLabel(conv.status)}
                    </span>
                  </div>
                  <p className="text-xs font-medium opacity-70 mt-1">
                    {conv.completedJobs}/{conv.totalJobs} volumes
                    {"  •  "}
                    {conv.progress}%
                    {"  •  "}
                    {relativeTime(conv.updatedAt)}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <ExpandBtn
                    open={isOpen}
                    onClick={() => toggleExpand(conv.conversionId)}
                  />
                  <div className="flex items-center gap-1">
                    <Link
                      to="/biblioteca/converter/$jobId"
                      params={{ jobId: conv.conversionId }}
                      className="inline-flex items-center justify-center border-[2.5px] border-ink shadow-comic-sm h-7 w-7 rounded-md bg-card hover:bg-muted"
                      title="Ver log de conversao"
                    >
                      <ScrollText className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(conv.conversionId)}
                      className="inline-flex items-center justify-center border-[2.5px] border-ink shadow-comic-sm h-7 w-7 rounded-md bg-card hover:bg-muted"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {isOpen && (
                <div className="pb-3 animate-slide-up">
                  {jobs.length > 0 && (
                    <div className="flex items-center justify-between mb-3">
                      <SearchBtn
                        open={searchOpen}
                        onClick={() => toggleSearch(conv.conversionId)}
                      />
                      <p className="text-[11px] text-ink/30 font-display tracking-wider">
                        {searchOpen && filter
                          ? `${filteredJobs.length} de ${jobs.length}`
                          : `${jobs.length} volumes`}
                      </p>
                    </div>
                  )}

                  {searchOpen && (
                    <div className="mb-3">
                      <div className="relative">
                        <input
                          autoFocus
                          type="text"
                          value={filter}
                          onChange={(e) =>
                            setFilter(conv.conversionId, e.target.value)
                          }
                          placeholder="Filtrar por nome ou numero..."
                          className="w-full pl-3 pr-8 py-1.5 font-display text-xs uppercase tracking-wider border-[2px] border-ink rounded-lg bg-white placeholder:text-ink/20 focus:outline-none focus:ring-2 focus:ring-comic-yellow focus:ring-offset-1 transition-all"
                        />
                        {filter.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFilter(conv.conversionId, "")}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center border-[2px] border-ink rounded bg-comic-red text-white text-xs font-bold hover:bg-comic-red/80 transition-colors"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {loadingJobs && (
                    <div className="text-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-comic-blue" />
                    </div>
                  )}

                  {jobsError && (
                    <div className="text-center py-4">
                      <p className="font-display text-sm text-comic-red">
                        {jobsError}
                      </p>
                    </div>
                  )}

                  {!loadingJobs &&
                    !jobsError &&
                    filteredJobs.length > 0 && (
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {filteredJobs.map((job) => (
                          <div
                            key={job.jobId}
                            className="flex items-center gap-3 p-2.5 border-2 border-ink rounded bg-muted/20 hover:bg-muted/40 transition-colors"
                          >
                            <div className="shrink-0 border-[2px] border-ink rounded overflow-hidden bg-muted aspect-[2/3] h-20">
                              <JobRowCover sourceId={sourceId} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-display text-base truncate">
                                {job.title}
                              </h4>
                              <p className="text-[11px] opacity-40 truncate">
                                {job.outputFile}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigate({
                                  to: "/biblioteca/reader/$conversionId",
                                  params: {
                                    conversionId: conv.conversionId,
                                  },
                                  search: { jobId: job.jobId },
                                });
                              }}
                              title="Ler"
                              className="inline-flex items-center gap-1 font-display text-xs uppercase tracking-wider px-2.5 py-1.5 border-[2.5px] border-ink rounded-md bg-comic-blue/10 text-ink hover:bg-comic-blue/20 shadow-comic-sm transition-all shrink-0"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Ler
                            </button>
                            <button
                              type="button"
                              onClick={() => reconvert(conv.conversionId)}
                              title="Configurar"
                              className="inline-flex items-center justify-center border-[2.5px] border-ink shadow-comic-sm h-8 w-8 rounded-md bg-card hover:bg-comic-yellow/30 transition-all shrink-0"
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                  {!loadingJobs &&
                    !jobsError &&
                    jobs.length > 0 &&
                    filteredJobs.length === 0 && (
                      <div className="py-10 text-center border-t border-ink/10">
                        <BookOpen className="h-8 w-8 mx-auto opacity-20 mb-2" />
                        <p className="font-display text-sm uppercase tracking-wider text-ink/30">
                          Nenhum volume encontrado
                        </p>
                      </div>
                    )}

                  {!loadingJobs && !jobsError && jobs.length === 0 && (
                    <div className="py-10 text-center">
                      <BookOpen className="h-8 w-8 mx-auto opacity-20 mb-2" />
                      <p className="font-display text-sm uppercase tracking-wider text-ink/30">
                        Nenhum volume disponivel
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {idx < conversions.length - 1 && (
              <div className="ml-8 py-4">
                <div className="border-b-2 border-ink/10" />
              </div>
            )}
          </div>
        );
      })}
    </ComicPanel>
  );
}
