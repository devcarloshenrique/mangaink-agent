import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { useBiblioteca } from "@/hooks/useBiblioteca";
import { SeriesActionsMenu } from "@/components/biblioteca/SeriesActionsMenu";
import { DeleteConfirmDialog } from "@/components/biblioteca/DeleteConfirmDialog";
import { RenameSeriesDialog } from "@/components/biblioteca/RenameSeriesDialog";
import { toast, Toaster } from "sonner";
import { Library, FileText, LayoutGrid, List, Star, Wand2, Plus } from "lucide-react";
import type { MangaSeries } from "@/lib/biblioteca-data";

export const Route = createFileRoute("/biblioteca/")({
  component: BibliotecaPage,
});

function BibliotecaPage() {
  const { series, renameSeries, deleteSeries, toggleFavorite } = useBiblioteca();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

  // Sort: favorites first, then by title
  const sorted = [...series].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <ComicHeader />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-lg border-[3px] border-ink bg-comic-yellow flex items-center justify-center shadow-comic-sm">
            <Library />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-4xl uppercase leading-none">Biblioteca</h1>
            <p className="text-sm font-medium opacity-80 mt-1">
              Arquivos salvos em <code>/data/library/&lt;obra&gt;/</code>
            </p>
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

        <SpeechBubble variant="yellow" tail="left" className="mb-6 max-w-md">
          {series.length === 0
            ? "Sua estante está vazia. Que tal converter seu primeiro mangá?"
            : `${series.length} obras na sua estante. Bem servido, hein?`}
        </SpeechBubble>

        {sorted.length === 0 ? (
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
        ) : viewMode === "grid" ? (
          <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {sorted.map((s, i) => (
              <div key={s.slug} className="relative group transition-transform group-hover:-translate-y-1">
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
                        {s.title}
                      </div>
                      {s.favorite && (
                        <Star className="absolute bottom-1 right-1 h-4 w-4 text-comic-yellow fill-comic-yellow drop-shadow-[1px_1px_0_#000]" />
                      )}
                    </div>
                    <p className="font-display text-base truncate">{s.title}</p>
                    <p className="text-xs font-medium opacity-70 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> {s.files.length} arquivos
                    </p>
                  </ComicPanel>
                </Link>
                <div className="absolute top-2 right-2 z-10">
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
              {sorted.map((s, i) => (
                <div
                  key={s.slug}
                  className={`flex items-center gap-4 py-3 border-b-2 border-dashed border-ink/30 last:border-0 last:pb-0 ${i === 0 ? "pt-0" : ""}`}
                >
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
                      <p className="font-display text-xl leading-none truncate">{s.title}</p>
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
    </div>
  );
}
