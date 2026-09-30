import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { OnomatopoeiaBadge } from "@/components/comic/OnomatopoeiaBadge";
import { highlightMatch } from "@/components/biblioteca/SearchBar";
import {
  Library,
  BookOpen,
  LayoutGrid,
  List,
  Wand2,
  Plus,
  BookPlus,
  Loader2,
  Clock,
  Heart,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useConversionsList, useActiveConversions } from "@/hooks/useConversions";
import { useLibrary } from "@/hooks/useLibrary";
import { conversionsApi } from "@/lib/api";
import { AddMangaDialog } from "@/components/biblioteca/AddMangaDialog";
import { AddMangaBar } from "@/components/biblioteca/AddMangaBar";
import { usePreferredCover } from "@/hooks/usePreferredCover";
import type { SourceInspectResponse } from "@/types/scraping";
import type { LibraryItemDTO } from "@mangaink/shared";

export const Route = createFileRoute("/biblioteca/")({
  component: BibliotecaPage,
});

type TabId = "all" | "favorites" | "converting";

function MangaCoverImage({ item, className }: { item: LibraryItemDTO; className?: string }) {
  const [error, setError] = useState(false);
  const { preferredCover } = usePreferredCover(item.sourceId);

  const preferredUrl = preferredCover
    ? conversionsApi.coverUrl(item.sourceId, preferredCover)
    : null;
  const backendUrl = conversionsApi.coverUrl(item.sourceId, { kind: "original" });
  // Prioriza a capa preferida ou a rota interna do backend (evita bloqueio de referer/CORS em CDNs externos)
  const url = preferredUrl || backendUrl || item.coverUrl;

  if (!url || error) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-muted", className)}>
        <BookOpen className="h-10 w-10 opacity-30" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={item.title}
      className={cn("h-full w-full object-cover", className)}
      loading="lazy"
      onError={() => {
        // Se a rota falhar, marca erro para exibir placeholder
        setError(true);
      }}
    />
  );
}

function BibliotecaPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [addMode, setAddMode] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scrapedData, setScrapedData] = useState<{
    sourceId: string;
    metadata: SourceInspectResponse;
  } | null>(null);

  const { data: libraryData, isLoading: libraryLoading } = useLibrary();
  const { data: allConversionsData, isLoading: conversionsLoading } = useConversionsList({
    limit: 100,
  });
  const { data: activeData } = useActiveConversions();

  const libraryItems = useMemo(() => libraryData?.items ?? [], [libraryData]);
  const allConversions = useMemo(() => allConversionsData?.items ?? [], [allConversionsData]);
  const activeConversions = useMemo(() => activeData?.items ?? [], [activeData]);

  // Mapa de conversões ativas ou concluídas por sourceId
  const conversionsBySource = useMemo(() => {
    const map = new Map<string, { hasActive: boolean; hasCompleted: boolean }>();
    for (const c of allConversions) {
      const prev = map.get(c.sourceId) ?? { hasActive: false, hasCompleted: false };
      if (c.status === "queued" || c.status === "processing") {
        prev.hasActive = true;
      } else if (c.status === "completed") {
        prev.hasCompleted = true;
      }
      map.set(c.sourceId, prev);
    }
    return map;
  }, [allConversions]);

  const convertingCount = useMemo(() => activeConversions.length, [activeConversions]);

  const favoritesCount = useMemo(
    () => libraryItems.filter((i) => i.isFavorite).length,
    [libraryItems],
  );

  const displayedItems = useMemo(() => {
    let items = libraryItems;
    if (activeTab === "favorites") {
      items = items.filter((i) => i.isFavorite);
    } else if (activeTab === "converting") {
      items = items.filter((i) => conversionsBySource.get(i.sourceId)?.hasActive);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) || (i.author && i.author.toLowerCase().includes(q)),
      );
    }

    return items;
  }, [libraryItems, activeTab, conversionsBySource, searchQuery]);

  const isLoading = libraryLoading || conversionsLoading;

  return (
    <div className="flex-1 bg-background overflow-x-clip">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="h-12 w-12 rounded-lg border-[3px] border-ink bg-comic-yellow flex items-center justify-center shadow-comic-sm">
            <Library />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-4xl uppercase leading-none">Biblioteca</h1>
            <p className="text-sm font-medium opacity-80 mt-1">Histórico de obras</p>
          </div>
          <button
            type="button"
            onClick={() => setAddMode((prev) => !prev)}
            className={cn(
              "inline-flex items-center gap-1.5 border-[3px] border-ink shadow-comic font-display text-sm px-3 py-1.5 rounded-md transition-all cursor-pointer",
              addMode
                ? "bg-comic-yellow text-comic-ink hover:-translate-y-0.5"
                : "bg-comic-blue text-accent-foreground hover:-translate-y-0.5",
            )}
          >
            {addMode ? <X className="h-4 w-4" /> : <BookPlus className="h-4 w-4" />}
            {addMode ? "Cancelar" : "Adicionar obra"}
          </button>
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
              className={`p-2 transition-colors cursor-pointer ${viewMode === "grid" ? "bg-comic-red text-primary-foreground" : "bg-card hover:bg-muted"}`}
              title="Grade"
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors border-l-[3px] border-ink cursor-pointer ${viewMode === "list" ? "bg-comic-red text-primary-foreground" : "bg-card hover:bg-muted"}`}
              title="Lista"
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mb-6">
          <AddMangaBar
            value={searchQuery}
            onChange={setSearchQuery}
            mode={addMode ? "url" : "filter"}
            onModeChange={(mode) => setAddMode(mode === "url")}
            onReady={(sourceId, metadata) => {
              setScrapedData({ sourceId, metadata });
              setDialogOpen(true);
            }}
          />
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-4 py-2 rounded-md border-[3px] font-display text-sm transition-all cursor-pointer",
              activeTab === "all"
                ? "bg-comic-red text-primary-foreground border-ink shadow-comic-sm"
                : "bg-card border-ink hover:-translate-y-0.5 shadow-comic-sm",
            )}
          >
            Todas ({libraryItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("favorites")}
            className={cn(
              "px-4 py-2 rounded-md border-[3px] font-display text-sm transition-all flex items-center gap-1.5 cursor-pointer",
              activeTab === "favorites"
                ? "bg-comic-yellow text-comic-ink border-ink shadow-comic-sm"
                : "bg-card border-ink hover:-translate-y-0.5 shadow-comic-sm",
            )}
          >
            <Heart className="h-3.5 w-3.5 fill-current" />
            Favoritos ({favoritesCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("converting")}
            className={cn(
              "px-4 py-2 rounded-md border-[3px] font-display text-sm transition-all flex items-center gap-1.5 cursor-pointer",
              activeTab === "converting"
                ? "bg-comic-blue text-accent-foreground border-ink shadow-comic-sm"
                : "bg-card border-ink hover:-translate-y-0.5 shadow-comic-sm",
            )}
          >
            {convertingCount > 0 && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Em Andamento ({convertingCount})
          </button>
        </div>

        {isLoading && (
          <div className="text-center py-16">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-comic-blue" />
          </div>
        )}

        {!isLoading && libraryItems.length === 0 && (
          <div className="text-center py-16">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-ink bg-comic-yellow shadow-comic-sm">
              <BookOpen className="h-10 w-10" />
            </div>
            <h2 className="font-display text-3xl uppercase mb-3">Nenhuma obra na sua biblioteca</h2>
            <p className="text-sm font-medium opacity-70 mb-6 max-w-md mx-auto">
              Adicione uma colando o link acima! Ou converta agora mesmo seu mangá preferido.
            </p>
            <Link
              to="/wizard"
              className="inline-flex items-center gap-2 bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display text-lg px-6 py-3 rounded-md hover:-translate-y-0.5 transition-transform"
            >
              <Wand2 className="h-5 w-5" /> Converter um mangá
            </Link>
          </div>
        )}

        {!isLoading &&
          libraryItems.length > 0 &&
          activeTab === "converting" &&
          convertingCount === 0 && (
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

        {!isLoading && libraryItems.length > 0 && displayedItems.length > 0 && (
          <>
            {viewMode === "grid" ? (
              <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {displayedItems.map((item, i) => {
                  const status = conversionsBySource.get(item.sourceId);
                  return (
                    <Link
                      key={item.sourceId}
                      to="/biblioteca/$sourceId"
                      params={{ sourceId: item.sourceId }}
                      className="block relative focus:outline-none cursor-pointer group transition-transform hover:-translate-y-1"
                    >
                      <div
                        className={cn(
                          "aspect-[2/3] border-[3px] border-ink rounded-xl shadow-comic-sm transition-all group-hover:shadow-comic group-hover:-translate-y-1 relative bg-card overflow-hidden",
                        )}
                      >
                        <MangaCoverImage
                          item={item}
                          className="transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                        {item.isFavorite && (
                          <div className="absolute top-2 left-2 z-10 bg-comic-yellow border-[2px] border-ink rounded-full p-1 shadow-comic-sm">
                            <Heart className="h-3.5 w-3.5 fill-current text-comic-ink" />
                          </div>
                        )}
                        {status?.hasActive && (
                          <div className="absolute top-2 right-2 z-10">
                            <OnomatopoeiaBadge variant="blue" size="sm">
                              ATIVO
                            </OnomatopoeiaBadge>
                          </div>
                        )}

                        {/* Overlay com informações no hover (igual à tela de início) */}
                        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 z-20">
                          <p className="font-display text-base leading-tight text-white line-clamp-2">
                            {highlightMatch(item.title, searchQuery)}
                          </p>
                          <p className="text-[11px] font-medium text-white/80 mt-1 truncate">
                            {item.author || "Autor desconhecido"}
                          </p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-comic-yellow">
                            {item.chaptersCount} capítulos
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <ComicPanel bg="card" padding="md">
                <div className="space-y-0">
                  {displayedItems.map((item, i) => {
                    const status = conversionsBySource.get(item.sourceId);
                    return (
                      <Link
                        key={item.sourceId}
                        to="/biblioteca/$sourceId"
                        params={{ sourceId: item.sourceId }}
                        className={cn(
                          "flex items-center gap-4 py-3 border-b-2 border-dashed border-ink/30 last:border-0 last:pb-0 hover:bg-muted/50 rounded transition-colors px-2",
                          i === 0 && "pt-0",
                        )}
                      >
                        <div className="h-16 w-12 shrink-0 border-[3px] border-ink rounded shadow-comic-sm bg-muted overflow-hidden relative">
                          <MangaCoverImage item={item} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-display text-xl leading-none truncate">
                              {highlightMatch(item.title, searchQuery)}
                            </p>
                            {item.isFavorite && (
                              <Heart className="h-4 w-4 fill-comic-yellow text-comic-yellow shrink-0" />
                            )}
                            {status?.hasActive && (
                              <OnomatopoeiaBadge variant="blue" size="sm">
                                ATIVO
                              </OnomatopoeiaBadge>
                            )}
                          </div>
                          <p className="text-xs font-semibold opacity-80 mt-1 truncate">
                            {item.author || "Autor desconhecido"}
                          </p>
                          <p className="text-xs font-medium opacity-60">
                            {item.chaptersCount} capítulos
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </ComicPanel>
            )}
          </>
        )}

        {!isLoading && libraryItems.length > 0 && displayedItems.length === 0 && searchQuery && (
          <div className="text-center py-16">
            <Library className="h-10 w-10 mx-auto mb-4 opacity-30" />
            <p className="font-display text-xl opacity-60">Nenhum resultado para "{searchQuery}"</p>
          </div>
        )}
      </div>
      {scrapedData && (
        <AddMangaDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setScrapedData(null);
          }}
          sourceId={scrapedData.sourceId}
          metadata={scrapedData.metadata}
        />
      )}
    </div>
  );
}
