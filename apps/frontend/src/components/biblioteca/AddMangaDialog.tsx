import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Download, Search, User, Calendar, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OnomatopoeiaBadge } from "@/components/comic/OnomatopoeiaBadge";
import { cn } from "@/lib/utils";
import { conversionsApi } from "@/lib/api";
import { toast } from "sonner";
import type { SourceInspectResponse } from "@/types/scraping";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string;
  metadata: SourceInspectResponse;
}

export function AddMangaDialog({ open, onOpenChange, sourceId, metadata }: Props) {
  const navigate = useNavigate();
  const { metadata: meta, chapters, covers } = metadata;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return chapters;
    return chapters.filter((c) => c.number.includes(q) || c.title.toLowerCase().includes(q));
  }, [chapters, query]);

  const allSelected = selected.size === chapters.length;

  const coverUrl =
    covers.length > 0 ? conversionsApi.coverUrl(sourceId, { kind: "original" }) : null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(chapters.map((c) => c.id)));
  }

  async function handleConfirm() {
    const selectedChapters = chapters.filter((c) => selected.has(c.id));
    if (selectedChapters.length === 0) return;

    setSubmitting(true);
    try {
      const result = await conversionsApi.create({
        sourceId,
        downloadOnly: true,
        cover: { kind: "original" },
        metadata: { title: meta.title, author: meta.author || "" },
        books: [
          {
            title: meta.title,
            chapters: selectedChapters.map((c) => c.id),
          },
        ],
        errorHandlingStrategy: "ignore",
      });

      setSelected(new Set());
      setQuery("");
      navigate({
        to: "/biblioteca/converter/$jobId",
        params: { jobId: result.conversionId },
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar download dos capítulos");
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = chapters
    .filter((c) => selected.has(c.id))
    .reduce((sum, c) => sum + (c.pages ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[3px] border-ink shadow-comic-lg max-w-4xl max-h-[88vh] overflow-hidden flex flex-col p-0 gap-0">
        <div className="p-5 pb-4 border-b-[3px] border-ink">
          <DialogTitle className="font-display text-2xl uppercase flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Adicionar obra
          </DialogTitle>
        </div>

        <div className="scrollbar-comic flex-1 overflow-y-auto p-5 grid md:grid-cols-[200px_1fr] gap-6">
          {/* Info da obra */}
          <div>
            <div className="border-[3px] border-ink rounded-xl shadow-comic overflow-hidden bg-muted aspect-[2/3]">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={`Capa de ${meta.title}`}
                  width={640}
                  height={960}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-muted">
                  <BookOpen className="h-12 w-12 opacity-30" />
                </div>
              )}
            </div>
            <div className="mt-3 space-y-1.5 text-xs font-medium opacity-80">
              <p className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> {meta.author || "Desconhecido"}
              </p>
              <p className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> {meta.status ?? "Desconhecido"}
              </p>
              {metadata.statistics && (
                <p className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> {metadata.statistics.chapters} capítulos
                </p>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <h2 className="font-display text-3xl uppercase leading-none">{meta.title}</h2>
            {metadata.source?.language && (
              <p className="text-sm font-medium opacity-60 mt-1">
                {metadata.provider.name} • {metadata.source.language.toUpperCase()}
              </p>
            )}

            {meta.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {meta.genres.map((g) => (
                  <span
                    key={g}
                    className="border-[2px] border-ink rounded-md bg-comic-yellow px-2 py-0.5 font-display text-xs"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {meta.description && (
              <p className="text-sm font-medium opacity-80 mt-3 leading-relaxed line-clamp-4">
                {meta.description}
              </p>
            )}

            {/* Seletor de capítulos */}
            <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
              <p className="font-display text-xl uppercase">Capítulos ({chapters.length})</p>
              <button
                type="button"
                onClick={toggleAll}
                className="font-display text-xs border-[3px] border-ink rounded-md bg-card px-3 py-1.5 shadow-comic-sm hover:-translate-y-0.5 transition-transform cursor-pointer"
              >
                {allSelected ? "Limpar seleção" : "Selecionar todos"}
              </button>
            </div>

            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar capítulo…"
                className="pl-9 border-[3px] border-ink shadow-comic-sm"
              />
            </div>

            <div className="scrollbar-comic mt-3 max-h-[300px] overflow-y-auto border-[3px] border-ink rounded-lg bg-card">
              {filtered.map((ch, i) => {
                const isOn = selected.has(ch.id);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggle(ch.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer",
                      i < filtered.length - 1 && "border-b-2 border-dashed border-ink/20",
                      isOn ? "bg-comic-blue/15" : "hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "h-5 w-5 shrink-0 border-[2.5px] border-ink rounded flex items-center justify-center",
                        isOn ? "bg-comic-blue" : "bg-card",
                      )}
                    >
                      {isOn && <Check className="h-3.5 w-3.5" strokeWidth={4} />}
                    </span>
                    <span className="shrink-0 font-display text-base bg-comic-yellow border-[2px] border-ink rounded-md px-2 min-w-[2.5rem] text-center">
                      {ch.number}
                    </span>
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">{ch.title}</span>
                    <span className="shrink-0 text-xs font-medium opacity-60">
                      {ch.pages ?? "?"} págs
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="p-4 text-sm font-medium opacity-60">Nenhum capítulo encontrado.</p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t-[3px] border-ink p-4 flex items-center justify-between gap-3 flex-wrap bg-card">
          <div className="flex items-center gap-2">
            <OnomatopoeiaBadge variant={selected.size > 0 ? "blue" : "yellow"} size="sm">
              {selected.size} SELECIONADOS
            </OnomatopoeiaBadge>
            {selected.size > 0 && (
              <span className="text-xs font-medium opacity-60">~{totalPages} páginas</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[3px] border-ink shadow-comic-sm font-display"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selected.size === 0 || submitting}
              className="bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Enviando…
                </span>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-1.5" /> Baixar capítulos
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
