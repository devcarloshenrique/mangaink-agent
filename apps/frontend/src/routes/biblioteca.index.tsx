import { useState, useMemo, useCallback } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { OnomatopoeiaBadge } from "@/components/comic/OnomatopoeiaBadge";
import { useBiblioteca } from "@/hooks/useBiblioteca";
import { useConversion } from "@/hooks/useConversion";
import { SeriesActionsMenu } from "@/components/biblioteca/SeriesActionsMenu";
import { DeleteConfirmDialog } from "@/components/biblioteca/DeleteConfirmDialog";
import { RenameSeriesDialog } from "@/components/biblioteca/RenameSeriesDialog";
import { SearchBar, highlightMatch } from "@/components/biblioteca/SearchBar";
import { FilterBar, type FilterId } from "@/components/biblioteca/FilterBar";
import { CollectionManager } from "@/components/biblioteca/CollectionManager";
import { STAGE_LABELS } from "@/lib/conversion-job";
import type { JobStage } from "@/lib/conversion-job";
import { Button } from "@/components/ui/button";
import { toast, Toaster } from "sonner";
import {
  Library,
  FileText,
  LayoutGrid,
  List,
  Star,
  Wand2,
  Plus,
  Loader2,
  Clock,
  FolderPlus,
  GripVertical,
} from "lucide-react";
import type { MangaSeries } from "@/lib/biblioteca-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/biblioteca/")({
  component: BibliotecaPage,
});

type TabId = "all" | "converting" | "completed";

interface Collection {
  id: string;
  name: string;
  slug: string;
}

function isNewSeries(s: MangaSeries): boolean {
  const added = new Date(s.addedAt);
  const now = new Date();
  const diffHours = (now.getTime() - added.getTime()) / (1000 * 60 * 60);
  return diffHours < 168; // 7 days
}

function BibliotecaPage() {
  const { series, renameSeries, deleteSeries, toggleFavorite } = useBiblioteca();
  const { jobs } = useConversion();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [orderedSlugs, setOrderedSlugs] = useState<string[]>([]);

  // Dialog state
  const [renamingSeries, setRenamingSeries] = useState<MangaSeries | null>(null);
  const [deletingSeries, setDeletingSeries] = useState<MangaSeries | null>(null);

  const handleRename = (s: MangaSeries) => {
    setRenamingSeries(s);
  };

  const handleRenameSubmit = (newTitle: string) => {
    if (!renamingSeries) return;
    const newSlug = renameSeries(renamingSeries.slug, newTitle);
    toast.success(`Série renomeada para "${newTitle}"`);
    setRenamingSeries(null);
    navigate({ to: "/biblioteca/$slug", params: { slug: newSlug } });
  };

  const handleDelete = (s: MangaSeries) => {
    setDeletingSeries(s);
  };

  const handleDeleteConfirm = () => {
    if (!deletingSeries) return;
    deleteSeries(deletingSeries.slug);
    toast.success(`"${deletingSeries.title}" foi excluída`);
    setDeletingSeries(null);
  };

  // Active conversion jobs
  const activeJobs = jobs.filter((j) => j.status === "queued" || j.status === "running");

  // Filtering logic
  const filtered = useMemo(() => {
    let result = [...series];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.title.toLowerCase().includes(q));
    }

    // Tab filter
    if (activeTab === "converting") {
      const activeSlugs = new Set(activeJobs.map((j) => j.seriesSlug));
      result = result.filter((s) => activeSlugs.has(s.slug));
    }

    // Chip filter
    switch (activeFilter) {
      case "favorites":
        result = result.filter((s) => s.favorite);
        break;
      case "epub":
        result = result.filter((s) => s.files.some((f) => f.format === "EPUB"));
        break;
      case "mobi":
        result = result.filter((s) => s.files.some((f) => f.format === "MOBI"));
        break;
      case "cbz":
        result = result.filter((s) => s.files.some((f) => f.format === "CBZ"));
        break;
      case "not-sent":
        result = result.filter((s) => s.files.some((f) => !f.sent));
        break;
      case "errors":
        result = result.filter((s) => s.files.some((f) => f.status === "error"));
        break;
    }

    // Sort: favorites first, then by title (or custom order)
    const orderMap = new Map(orderedSlugs.map((slug, i) => [slug, i]));
    result.sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      const aIdx = orderMap.get(a.slug);
      const bIdx = orderMap.get(b.slug);
      if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
      if (aIdx !== undefined) return -1;
      if (bIdx !== undefined) return 1;
      return a.title.localeCompare(b.title);
    });

    return result;
  }, [series, searchQuery, activeFilter, activeTab, activeJobs, orderedSlugs]);

  // Drag and drop
  const handleDragStart = useCallback((index: number) => setDragIndex(index), []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === index) return;
      const newSlugs = [...orderedSlugs];
      // Build current order from filtered
      const currentSlugs = filtered.map((s) => s.slug);
      // Ensure all slugs are tracked
      currentSlugs.forEach((s) => {
        if (!newSlugs.includes(s)) newSlugs.push(s);
      });
      const [moved] = newSlugs.splice(dragIndex, 1);
      newSlugs.splice(index, 0, moved);
      setOrderedSlugs(newSlugs);
      setDragIndex(index);
    },
    [dragIndex, orderedSlugs, filtered],
  );

  const handleDragEnd = useCallback(() => setDragIndex(null), []);

  const showLibrary = activeTab === "all" || activeTab === "completed";
  const showConverting = activeTab === "all" || activeTab === "converting";
  const totalCount = series.length;
  const convertingCount = activeJobs.length;

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
            <p className="text-sm font-medium opacity-80 mt-1">
              Arquivos salvos em <code>/data/library/&lt;obra&gt;/</code>
            </p>
          </div>
          <Button
            onClick={() => setCollectionsOpen(true)}
            variant="outline"
            className="border-[3px] border-ink shadow-comic-sm font-display text-sm px-3 py-1.5 rounded-md hover:-translate-y-0.5 transition-transform"
          >
            <FolderPlus className="h-4 w-4 mr-1" /> Coleções
          </Button>
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
              title="Visualização em grade"
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors border-l-[3px] border-ink ${viewMode === "list" ? "bg-comic-red text-primary-foreground" : "bg-card hover:bg-muted"}`}
              title="Visualização em lista"
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="space-y-3 mb-6">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <FilterBar active={activeFilter} onChange={setActiveFilter} />
        </div>

        {/* Tabs */}
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
            Todas ({totalCount + convertingCount})
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
            Concluídas ({totalCount})
          </button>
        </div>

        {/* Status message */}
        <SpeechBubble variant="yellow" tail="left" className="mb-6 max-w-md">
          {activeTab === "converting"
            ? convertingCount === 0
              ? "Nenhuma conversão em andamento no momento."
              : `${convertingCount} conversão(ões) em andamento. Acompanhe o progresso abaixo!`
            : filtered.length === 0
              ? searchQuery
                ? `Nenhum resultado para "${searchQuery}".`
                : "Sua estante está vazia. Que tal converter seu primeiro mangá?"
              : `${filtered.length} obras na sua estante. Bem servido, hein?`}
        </SpeechBubble>

        {/* Converting section */}
        {showConverting && activeJobs.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display text-2xl mb-4 flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-comic-blue" />
              Convertendo agora
            </h2>
            {viewMode === "grid" ? (
              <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {activeJobs.map((job) => {
                  const activeStage = job.stages.find((s) => s.status === "active");
                  return (
                    <Link
                      key={job.id}
                      to="/biblioteca/converter/$jobId"
                      params={{ jobId: job.id }}
                      className="block focus:outline-none cursor-pointer group transition-transform group-hover:-translate-y-1"
                    >
                      <ComicPanel bg="yellow" padding="sm" tilt="left" className="h-full">
                        <div
                          className="aspect-[2/3] border-[3px] border-ink rounded mb-2 flex items-end p-2 shadow-comic-sm relative overflow-hidden"
                          style={{ background: `hsl(${job.seriesHue} 70% 55%)` }}
                        >
                          <div className="bg-comic-yellow border-[2.5px] border-ink px-1.5 py-0.5 font-display text-xs truncate">
                            {job.seriesTitle}
                          </div>
                          <div className="absolute top-2 right-2">
                            <Loader2 className="h-5 w-5 animate-spin text-comic-ink" />
                          </div>
                        </div>
                        <p className="font-display text-base truncate">{job.seriesTitle}</p>
                        <p className="text-xs font-medium opacity-70">
                          {job.format} • {job.totalChapters} caps
                        </p>
                        <div className="mt-2 h-2 w-full border-2 border-ink rounded-full bg-card overflow-hidden">
                          <div
                            className="h-full bg-comic-blue transition-all duration-300"
                            style={{ width: `${job.overallProgress}%` }}
                          />
                        </div>
                        <p className="text-[10px] font-medium opacity-60 mt-1 truncate">
                          {activeStage
                            ? `${STAGE_LABELS[activeStage.id as JobStage]} • ${job.overallProgress}%`
                            : "Iniciando..."}
                        </p>
                      </ComicPanel>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <ComicPanel bg="card" padding="md">
                <div className="space-y-0">
                  {activeJobs.map((job, i) => {
                    const activeStage = job.stages.find((s) => s.status === "active");
                    return (
                      <Link
                        key={job.id}
                        to="/biblioteca/converter/$jobId"
                        params={{ jobId: job.id }}
                        className={cn(
                          "flex items-center gap-4 py-3 border-b-2 border-dashed border-ink/30 last:border-0 last:pb-0 hover:bg-muted/50 rounded transition-colors -mx-2 px-2",
                          i === 0 && "pt-0",
                        )}
                      >
                        <div
                          className="h-16 w-12 shrink-0 border-[3px] border-ink rounded shadow-comic-sm relative"
                          style={{ background: `hsl(${job.seriesHue} 70% 55%)` }}
                        >
                          <Loader2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-comic-ink" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-xl leading-none truncate">
                            {job.seriesTitle}
                          </p>
                          <p className="text-xs font-medium opacity-70 mt-1">
                            <FileText className="h-3 w-3 inline mr-1" />
                            {job.format} • {job.totalChapters} capítulos • {job.totalPages} páginas
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="h-2 flex-1 border-2 border-ink rounded-full bg-card overflow-hidden">
                              <div
                                className="h-full bg-comic-blue transition-all duration-300"
                                style={{ width: `${job.overallProgress}%` }}
                              />
                            </div>
                            <span className="font-display text-xs shrink-0">
                              {job.overallProgress}%
                            </span>
                          </div>
                          <p className="text-[11px] font-medium opacity-60 mt-0.5">
                            {activeStage
                              ? STAGE_LABELS[activeStage.id as JobStage]
                              : "Iniciando..."}
                          </p>
                        </div>
                        <Clock className="h-4 w-4 opacity-40 shrink-0 hidden sm:block" />
                      </Link>
                    );
                  })}
                </div>
              </ComicPanel>
            )}
          </div>
        )}

        {/* Empty state for converting tab */}
        {showConverting && activeJobs.length === 0 && activeTab === "converting" && (
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

        {/* Library section */}
        {showLibrary && (
          <>
            {filtered.length === 0 ? (
              activeTab === "completed" && activeJobs.length === 0 ? (
                <div className="text-center py-16">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-ink bg-comic-yellow shadow-comic-sm">
                    <Library className="h-10 w-10" />
                  </div>
                  <h2 className="font-display text-3xl uppercase mb-3">Nada por aqui ainda</h2>
                  <p className="text-sm font-medium opacity-70 mb-6 max-w-md mx-auto">
                    Use o wizard para converter mangás de sites online e enviar pro seu Kindle.
                  </p>
                  <Link
                    to="/wizard"
                    className="inline-flex items-center gap-2 bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display text-lg px-6 py-3 rounded-md hover:-translate-y-0.5 transition-transform"
                  >
                    <Wand2 className="h-5 w-5" /> Converter meu primeiro mangá
                  </Link>
                </div>
              ) : null
            ) : viewMode === "grid" ? (
              <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map((s, i) => (
                  <div
                    key={s.slug}
                    className={cn(
                      "relative group transition-transform group-hover:-translate-y-1",
                      dragIndex === i && "opacity-50",
                    )}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragEnd={handleDragEnd}
                  >
                    <Link
                      to="/biblioteca/$slug"
                      params={{ slug: s.slug }}
                      className="block focus:outline-none cursor-pointer"
                    >
                      <ComicPanel
                        bg="card"
                        padding="sm"
                        tilt={i % 2 === 0 ? "left" : "right"}
                        className="h-full"
                      >
                        <div
                          className="aspect-[2/3] border-[3px] border-ink rounded mb-2 flex items-end p-2 shadow-comic-sm relative"
                          style={{ background: `hsl(${s.hue} 70% 55%)` }}
                        >
                          <div className="bg-comic-yellow border-[2.5px] border-ink px-1.5 py-0.5 font-display text-xs">
                            {highlightMatch(s.title, searchQuery)}
                          </div>
                          {s.favorite && (
                            <Star className="absolute bottom-1 right-1 h-4 w-4 text-comic-yellow fill-comic-yellow drop-shadow-[1px_1px_0_#000]" />
                          )}
                        </div>
                        <p className="font-display text-base truncate">
                          {highlightMatch(s.title, searchQuery)}
                        </p>
                        <p className="text-xs font-medium opacity-70 flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {s.files.length} arquivos
                        </p>
                      </ComicPanel>
                    </Link>

                    {/* Badges */}
                    <div className="absolute -top-2 -right-2 z-10 flex flex-col gap-1 items-end">
                      {isNewSeries(s) && (
                        <OnomatopoeiaBadge variant="red" size="sm">
                          NOVO
                        </OnomatopoeiaBadge>
                      )}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="h-4 w-4 text-comic-ink/40 cursor-grab" />
                      </div>
                    </div>

                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <SeriesActionsMenu
                        title={s.title}
                        isFavorite={s.favorite}
                        onRename={() => handleRename(s)}
                        onToggleFavorite={() => toggleFavorite(s.slug)}
                        onDelete={() => handleDelete(s)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ComicPanel bg="card" padding="md">
                <div className="space-y-0">
                  {filtered.map((s, i) => (
                    <div
                      key={s.slug}
                      className={cn(
                        "flex items-center gap-4 py-3 border-b-2 border-dashed border-ink/30 last:border-0 last:pb-0",
                        i === 0 && "pt-0",
                        dragIndex === i && "opacity-50",
                      )}
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={(e) => handleDragOver(e, i)}
                      onDragEnd={handleDragEnd}
                    >
                      <GripVertical className="h-4 w-4 text-comic-ink/30 cursor-grab shrink-0" />
                      <Link
                        to="/biblioteca/$slug"
                        params={{ slug: s.slug }}
                        className="flex items-center gap-4 flex-1 min-w-0 hover:bg-muted/50 rounded transition-colors -mx-2 px-2"
                      >
                        <div
                          className="h-16 w-12 shrink-0 border-[3px] border-ink rounded shadow-comic-sm relative"
                          style={{ background: `hsl(${s.hue} 70% 55%)` }}
                        >
                          {s.favorite && (
                            <Star className="absolute -top-1 -right-1 h-3.5 w-3.5 text-comic-yellow fill-comic-yellow drop-shadow-[1px_1px_0_#000]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-display text-xl leading-none truncate">
                              {highlightMatch(s.title, searchQuery)}
                            </p>
                            {isNewSeries(s) && (
                              <OnomatopoeiaBadge variant="red" size="sm">
                                NOVO
                              </OnomatopoeiaBadge>
                            )}
                          </div>
                          <p className="text-xs font-medium opacity-70 mt-1">
                            <FileText className="h-3 w-3 inline mr-1" />
                            {s.files.length} arquivos
                          </p>
                        </div>
                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="text-xs font-medium opacity-70">Última conversão</p>
                          <p className="font-display text-sm">{s.lastConverted}</p>
                        </div>
                      </Link>
                      <div className="shrink-0">
                        <SeriesActionsMenu
                          title={s.title}
                          isFavorite={s.favorite}
                          onRename={() => handleRename(s)}
                          onToggleFavorite={() => toggleFavorite(s.slug)}
                          onDelete={() => handleDelete(s)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </ComicPanel>
            )}
          </>
        )}
      </div>

      {renamingSeries && (
        <RenameSeriesDialog
          currentTitle={renamingSeries.title}
          open={!!renamingSeries}
          onOpenChange={(o) => !o && setRenamingSeries(null)}
          onConfirm={handleRenameSubmit}
        />
      )}

      {deletingSeries && (
        <DeleteConfirmDialog
          title={deletingSeries.title}
          open={!!deletingSeries}
          onOpenChange={(o) => !o && setDeletingSeries(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      <CollectionManager
        open={collectionsOpen}
        onOpenChange={setCollectionsOpen}
        collections={collections}
        onAdd={(name) => {
          setCollections((prev) => [
            ...prev,
            { id: `col-${Date.now()}`, name, slug: name.toLowerCase().replace(/\s+/g, "-") },
          ]);
        }}
        onRemove={(id) => setCollections((prev) => prev.filter((c) => c.id !== id))}
      />
    </div>
  );
}
