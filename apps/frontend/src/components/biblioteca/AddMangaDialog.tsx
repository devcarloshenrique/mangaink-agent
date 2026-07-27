import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Download, Search, Star, User, Calendar, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OnomatopoeiaBadge } from "@/components/comic/OnomatopoeiaBadge";
import { cn } from "@/lib/utils";
import { MOCK_ADD_MANGA, setMockConversionRequest } from "@/lib/mock-add-manga";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMangaDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const manga = MOCK_ADD_MANGA;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return manga.chapters;
    return manga.chapters.filter(
      (c) => c.number.includes(q) || c.title.toLowerCase().includes(q),
    );
  }, [manga.chapters, query]);

  const allSelected = selected.size === manga.chapters.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(manga.chapters.map((c) => c.id)));
  }

  function handleConfirm() {
    const chapters = manga.chapters.filter((c) => selected.has(c.id));
    if (chapters.length === 0) return;
    setMockConversionRequest({
      mangaTitle: manga.title,
      author: manga.author,
      cover: manga.cover,
      format: "EPUB",
      chapters,
    });
    onOpenChange(false);
    setSelected(new Set());
    setQuery("");
    navigate({ to: "/biblioteca/progresso" });
  }

  const totalPages = manga.chapters
    .filter((c) => selected.has(c.id))
    .reduce((sum, c) => sum + c.pages, 0);

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
              <img
                src={manga.cover}
                alt={`Capa de ${manga.title}`}
                width={640}
                height={960}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="mt-3 space-y-1.5 text-xs font-medium opacity-80">
              <p className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> {manga.author}
              </p>
              <p className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> {manga.year} • {manga.status}
              </p>
              <p className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5" /> {manga.rating.toFixed(1)} / 5
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <h2 className="font-display text-3xl uppercase leading-none">{manga.title}</h2>
            <p className="text-sm font-medium opacity-60 mt-1">{manga.altTitle}</p>

            <div className="flex flex-wrap gap-1.5 mt-3">
              {manga.genres.map((g) => (
                <span
                  key={g}
                  className="border-[2px] border-ink rounded-md bg-comic-yellow px-2 py-0.5 font-display text-xs"
                >
                  {g}
                </span>
              ))}
            </div>

            <p className="text-sm font-medium opacity-80 mt-3 leading-relaxed">
              {manga.description}
            </p>

            {/* Seletor de capitulos */}
            <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
              <p className="font-display text-xl uppercase">
                Capitulos ({manga.chapters.length})
              </p>
              <button
                type="button"
                onClick={toggleAll}
                className="font-display text-xs border-[3px] border-ink rounded-md bg-card px-3 py-1.5 shadow-comic-sm hover:-translate-y-0.5 transition-transform"
              >
                {allSelected ? "Limpar selecao" : "Selecionar todos"}
              </button>
            </div>

            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar capitulo…"
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
                      {ch.pages} pags
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="p-4 text-sm font-medium opacity-60">Nenhum capitulo encontrado.</p>
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
              <span className="text-xs font-medium opacity-60">~{totalPages} paginas</span>
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
              disabled={selected.size === 0}
              className="bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-1.5" /> Baixar e converter
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
