import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { OnomatopoeiaBadge } from "@/components/comic/OnomatopoeiaBadge";
import { SearchBar, highlightMatch } from "@/components/biblioteca/SearchBar";
import { Button } from "@/components/ui/button";
import { Toaster } from "sonner";
import {
  Library,
  FileText,
  LayoutGrid,
  List,
  Wand2,
  Plus,
  Loader2,
  Clock,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useConversionsList,
  useActiveConversions,
  groupConversionsBySource,
  type SeriesGroup,
} from "@/hooks/useConversions";
import { conversionsApi } from "@/lib/api";
import type { ConversionSummary, CoverRef } from "@/types/conversion";

export const Route = createFileRoute("/biblioteca/")({
  component: BibliotecaPage,
});

type TabId = "all" | "converting" | "completed";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days}d`;
  return `há ${Math.floor(days / 30)} meses`;
}

function seriesCoverUrl(group: SeriesGroup): string | null {
  const withCover = group.items.find((i) => i.cover);
  if (!withCover?.cover) return null;
  return conversionsApi.coverUrl(withCover.sourceId, withCover.cover as CoverRef);
}

function SeriesCover({ group, className }: { group: SeriesGroup; className?: string }) {
  const url = seriesCoverUrl(group);
  const [error, setError] = useState(false);
  if (!url || error) return null;
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

function getSeriesStatusBadge(group: SeriesGroup) {
  if (group.status === "active") {
    return (
      <OnomatopoeiaBadge variant="blue" size="sm">
        ATIVO
      </OnomatopoeiaBadge>
    );
  }
  if (group.status === "mixed") {
    return (
      <OnomatopoeiaBadge variant="yellow" size="sm">
        MISTO
      </OnomatopoeiaBadge>
    );
  }
  return null;
}

function BibliotecaPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: allData, isLoading } = useConversionsList({ limit: 100 });
  const { data: activeData } = useActiveConversions();

  const allConversions = allData?.items ?? [];
  const activeConversions = activeData?.items ?? [];

  const seriesGroups = useMemo(() => {
    const all = allConversions;
    if (activeTab === "completed") {
      return groupConversionsBySource(all.filter((c) => c.status === "completed"));
    }
    if (activeTab === "converting") {
      return groupConversionsBySource(
        all.filter((c) => c.status === "queued" || c.status === "processing"),
      );
    }
    return groupConversionsBySource(all);
  }, [allConversions, activeTab]);

  const filtered = useMemo(() => {
    let result = [...seriesGroups];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((g) => g.title.toLowerCase().includes(q));
    }
    return result;
  }, [seriesGroups, searchQuery]);

  const convertingCount = useMemo(
    () => allConversions.filter((c) => c.status === "queued" || c.status === "processing").length,
    [allConversions],
  );

  const totalCount = seriesGroups.length;

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <ComicHeader />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="h-12 w-12 rounded-lg border-[3px] border-ink bg-comic-yellow flex items-center justify-center shadow-comic-sm">
            <Library />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-4xl uppercase leading-none">Biblioteca</h1>
            <p className="text-sm font-medium opacity-80 mt-1">Histórico de conversões</p>
          </div>
          <Link
            to="/wizard"
            className="inline-flex items-center gap-1.5 bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display text-sm px-3 py-1.5 rounded-md hover:-translate-y-0.5 transition-transform"
          >
            <Plus className="h-4 w-4" /> Converter novo
          </Link>
          <div className="flex border-[3px] border-ink rounded-md overflow-hidden shadow-comic-sm">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-colors ${viewMode === "grid" ? "bg-comic-red text-primary-foreground" : "bg-card hover:bg-muted"}`}
              title="Grade"
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors border-l-[3px] border-ink ${viewMode === "list" ? "bg-comic-red text-primary-foreground" : "bg-card hover:bg-muted"}`}
              title="Lista"
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-4 py-2 rounded-md border-[3px] font-display text-sm transition-all",
              activeTab === "all"
                ? "bg-comic-red text-primary-foreground border-ink shadow-comic-sm"
                : "bg-card border-ink hover:-translate-y-0.5 shadow-comic-sm",
            )}
          >
            Todas ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("converting")}
            className={cn(
              "px-4 py-2 rounded-md border-[3px] font-display text-sm transition-all flex items-center gap-1.5",
              activeTab === "converting"
                ? "bg-comic-yellow text-comic-ink border-ink shadow-comic-sm"
                : "bg-card border-ink hover:-translate-y-0.5 shadow-comic-sm",
            )}
          >
            {convertingCount > 0 && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Em Andamento ({convertingCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={cn(
              "px-4 py-2 rounded-md border-[3px] font-display text-sm transition-all",
              activeTab === "completed"
                ? "bg-comic-blue text-accent-foreground border-ink shadow-comic-sm"
                : "bg-card border-ink hover:-translate-y-0.5 shadow-comic-sm",
            )}
          >
            Concluídas ({allConversions.filter((c) => c.status === "completed").length})
          </button>
        </div>

        <SpeechBubble variant="yellow" tail="left" className="mb-6 max-w-md">
          {isLoading
            ? "Carregando..."
            : activeTab === "converting"
              ? convertingCount === 0
                ? "Nenhuma conversão em andamento no momento."
                : `${convertingCount} conversão(ões) em andamento.`
              : filtered.length === 0
                ? searchQuery
                  ? `Nenhum resultado para "${searchQuery}".`
                  : "Sua estante está vazia. Que tal converter seu primeiro mangá?"
                : `${totalCount} obras na sua estante.`}
        </SpeechBubble>

        {isLoading && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-comic-blue" />
          </div>
        )}

        {!isLoading && activeTab === "converting" && convertingCount === 0 && (
          <div className="text-center py-16">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-ink bg-comic-yellow shadow-comic-sm">
              <Clock className="h-10 w-10" />
            </div>
            <h2 className="font-display text-3xl uppercase mb-3">Nada convertendo</h2>
            <p className="text-sm font-medium opacity-70 mb-6 max-w-md mx-auto">
              Inicie uma conversão no wizard e acompanhe o progresso aqui em tempo real.
            </p>
            <Link
              to="/wizard"
              className="inline-flex items-center gap-2 bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display text-lg px-6 py-3 rounded-md hover:-translate-y-0.5 transition-transform"
            >
              <Wand2 className="h-5 w-5" /> Converter um mangá
            </Link>
          </div>
        )}

        {!isLoading && filtered.length > 0 && activeTab !== "converting" && (
          <>
            {viewMode === "grid" ? (
              <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map((group, i) => (
                  <Link
                    key={group.sourceId}
                    to="/biblioteca/$sourceId"
                    params={{ sourceId: group.sourceId }}
                    className="block focus:outline-none cursor-pointer group transition-transform group-hover:-translate-y-1"
                  >
                    <div
                      className={cn(
                        "aspect-[2/3] border-[3px] border-ink rounded-xl shadow-comic relative bg-muted overflow-hidden",
                        i % 2 === 0 ? "-rotate-1" : "rotate-1",
                      )}
                    >
                      <SeriesCover group={group} />
                      <div className="absolute bottom-1 left-1 bg-comic-yellow border-[2.5px] border-ink px-1.5 py-0.5 font-display text-xs z-10">
                        {highlightMatch(group.title, searchQuery)}
                      </div>
                    </div>
                    <div className="absolute -top-2 -right-2 z-10">
                      {getSeriesStatusBadge(group)}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <ComicPanel bg="card" padding="md">
                <div className="space-y-0">
                  {filtered.map((group, i) => (
                    <Link
                      key={group.sourceId}
                      to="/biblioteca/$sourceId"
                      params={{ sourceId: group.sourceId }}
                      className={cn(
                        "flex items-center gap-4 py-3 border-b-2 border-dashed border-ink/30 last:border-0 last:pb-0 hover:bg-muted/50 rounded transition-colors -mx-2 px-2",
                        i === 0 && "pt-0",
                      )}
                    >
                      <div className="h-16 w-12 shrink-0 border-[3px] border-ink rounded shadow-comic-sm bg-muted overflow-hidden relative">
                        {seriesCoverUrl(group) ? (
                          <SeriesCover group={group} />
                        ) : (
                          <Library className="h-5 w-5 absolute inset-0 m-auto opacity-30" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-display text-xl leading-none truncate">
                            {highlightMatch(group.title, searchQuery)}
                          </p>
                          {getSeriesStatusBadge(group)}
                        </div>
                        <p className="text-xs font-medium opacity-70 mt-1">
                          <FileText className="h-3 w-3 inline mr-1" /> {group.conversionCount}{" "}
                          conversões
                        </p>
                      </div>
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="text-xs font-medium opacity-70">Última</p>
                        <p className="font-display text-sm">{relativeTime(group.lastActivity)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </ComicPanel>
            )}
          </>
        )}

        {!isLoading && filtered.length === 0 && searchQuery && (
          <div className="text-center py-16">
            <Library className="h-10 w-10 mx-auto mb-4 opacity-30" />
            <p className="font-display text-xl opacity-60">Nenhum resultado para "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
