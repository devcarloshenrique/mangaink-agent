import { useState, useRef, memo } from "react";
import {
  Upload,
  Loader2,
  Maximize2,
  X,
  Sparkles,
  Image as ImageIcon,
  BookOpen,
  Check,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { conversionsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCoverLabel, isCoverSelected } from "@/lib/custom-covers";
import { usePreferredCover } from "@/hooks/usePreferredCover";
import type { Cover } from "@/types/scraping";

interface TabGaleriaProps {
  sourceId: string;
  seriesTitle?: string;
  covers: Cover[];
  onCoverUploaded?: () => void;
}

export const TabGaleria = memo(function TabGaleria({
  sourceId,
  seriesTitle,
  covers,
  onCoverUploaded,
}: TabGaleriaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeCover, setActiveCover] = useState<Cover | null>(null);
  const { preferredCover, setPreferredCover, removePreferredCover } = usePreferredCover(sourceId);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato de imagem inválido. Use JPG, PNG ou WEBP.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      toast.error("A imagem deve ter no máximo 15MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      setUploading(true);
      await conversionsApi.uploadCover(file, sourceId, file.name);
      toast.success("Capa personalizada enviada com sucesso!");
      onCoverUploaded?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar capa.";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteCover = async () => {
    if (!activeCover || activeCover.type !== "upload") return;

    try {
      setDeleting(true);
      await conversionsApi.deleteCover(activeCover.id);

      if (isCoverSelected(activeCover, preferredCover)) {
        removePreferredCover();
      }

      toast.success("Capa personalizada excluída com sucesso!");
      setActiveCover(null);
      onCoverUploaded?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir capa personalizada.";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const getCoverImageUrl = (cover: Cover): string => {
    if (cover.type === "upload") {
      return (
        conversionsApi.coverUrl(sourceId, {
          kind: "upload",
          uploadId: cover.id,
          name: cover.label,
        }) ?? cover.imageUrl
      );
    }
    if (cover.type === "original") {
      return conversionsApi.coverUrl(sourceId, { kind: "original" }) ?? cover.imageUrl;
    }
    return (
      conversionsApi.coverUrl(sourceId, {
        kind: "gallery",
        coverId: cover.id,
      }) ?? cover.imageUrl
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Container Principal Unificado com Cabeçalho e Galeria */}
      <ComicPanel bg="card" padding="md" className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-dashed border-ink/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-comic-yellow border-[2px] border-ink shadow-comic-sm">
                <ImageIcon className="h-4 w-4" />
              </span>
              <h2 className="font-display text-2xl uppercase tracking-wide">
                Galeria de Capas ({covers.length})
              </h2>
            </div>
            <p className="text-sm font-medium text-muted-foreground mt-1">
              {covers.length} {covers.length === 1 ? "capa disponível" : "capas disponíveis"} para{" "}
              {seriesTitle || "esta obra"}.
            </p>
          </div>

          <div>
            <label
              className={cn(
                "inline-flex items-center gap-2 border-[2.5px] border-ink rounded-lg px-4 py-2.5 font-display text-sm uppercase tracking-wider bg-comic-yellow text-comic-ink shadow-comic-sm hover:-translate-y-0.5 transition-all cursor-pointer",
                uploading && "opacity-60 cursor-not-allowed hover:translate-y-0",
              )}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Upload de Nova Capa</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploading}
                onChange={handleFileChange}
              />
            </label>
          </div>
        </div>

        {/* Grid de Capas */}
        {covers.length === 0 ? (
          <div className="py-12 text-center bg-muted/40 rounded-lg border-2 border-dashed border-ink/20 p-6 space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-comic-yellow/30 border-2 border-ink">
              <BookOpen className="h-6 w-6 text-comic-ink" />
            </div>
            <h3 className="font-display text-lg uppercase">Nenhuma capa disponível</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto font-medium">
              Nenhuma capa foi encontrada para esta obra. Você pode fazer o upload de uma capa
              personalizada!
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 border-[2px] border-ink rounded-lg px-4 py-2 font-display text-xs uppercase tracking-wider bg-comic-yellow text-comic-ink shadow-comic-sm hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Enviar Primeira Capa</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {covers.map((cover, idx) => {
              const imgUrl = getCoverImageUrl(cover);
              const label = formatCoverLabel(cover, idx);
              const isSelected = isCoverSelected(cover, preferredCover);

              return (
                <div
                  key={cover.id}
                  onClick={() => setActiveCover(cover)}
                  className={cn(
                    "group relative aspect-[2/3] w-full border-[3px] rounded-xl bg-card shadow-comic overflow-hidden transition-all hover:-translate-y-1 hover:shadow-comic-lg cursor-zoom-in select-none",
                    isSelected ? "border-comic-yellow ring-4 ring-comic-yellow/40" : "border-ink",
                  )}
                  title="Clique para ampliar a capa"
                >
                  <img
                    src={imgUrl}
                    alt={label}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Badge de Capa Principal / Preferida da Biblioteca */}
                  {isSelected && (
                    <div className="absolute top-2.5 left-2.5 z-10">
                      <span className="inline-flex items-center gap-1 bg-comic-yellow text-comic-ink text-[11px] font-display uppercase tracking-wider px-2.5 py-1 rounded-md border-2 border-ink shadow-comic-sm">
                        <Sparkles className="h-3 w-3 fill-current" />
                        Capa Principal
                      </span>
                    </div>
                  )}

                  {/* Indicador de Zoom no canto superior direito no Hover */}
                  <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-comic-ink/85 text-comic-cream border-2 border-comic-yellow shadow-comic-sm pointer-events-none">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ComicPanel>

      {/* Visualizador Ampliado (Modal/Lightbox) */}
      <Dialog open={!!activeCover} onOpenChange={(open) => !open && setActiveCover(null)}>
        <DialogContent className="max-w-fit w-auto p-0 bg-transparent border-0 shadow-none sm:rounded-none overflow-visible [&>button]:hidden focus:outline-none select-none">
          <DialogTitle className="sr-only">
            {activeCover
              ? `Visualização da capa: ${formatCoverLabel(
                  activeCover,
                  covers.findIndex((c) => c.id === activeCover.id),
                )}`
              : "Visualização da capa"}
          </DialogTitle>

          {activeCover &&
            (() => {
              const activeIndex = covers.findIndex((c) => c.id === activeCover.id);
              const friendlyLabel = formatCoverLabel(
                activeCover,
                activeIndex >= 0 ? activeIndex : undefined,
              );
              const isCurrentMain = isCoverSelected(activeCover, preferredCover);

              return (
                <div className="relative flex flex-col items-center">
                  {/* Botão Fechar estilizado */}
                  <button
                    type="button"
                    onClick={() => setActiveCover(null)}
                    aria-label="Fechar visualização da capa"
                    className="absolute -top-3 -right-3 z-30 flex h-8 w-8 items-center justify-center rounded-full border-[2.5px] border-ink bg-comic-red text-white shadow-comic-sm transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                  >
                    <X className="h-4 w-4" strokeWidth={3} />
                  </button>

                  {/* Frame da imagem */}
                  <div className="relative border-[4px] border-ink rounded-2xl shadow-comic-lg bg-card overflow-hidden max-h-[80vh] max-w-[85vw] flex items-center justify-center">
                    <img
                      src={getCoverImageUrl(activeCover)}
                      alt={friendlyLabel}
                      className="max-h-[78vh] max-w-[83vw] w-auto h-auto object-contain select-none block"
                    />
                  </div>

                  {/* Barra de detalhes inferior */}
                  <div className="mt-4 flex items-center gap-3 flex-wrap justify-center max-w-[85vw]">
                    {/* Botão Definir como Capa da Biblioteca */}
                    <button
                      type="button"
                      disabled={isCurrentMain}
                      onClick={() => {
                        setPreferredCover(activeCover);
                        toast.success("Capa da biblioteca atualizada!");
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 border-[2.5px] border-ink rounded-full font-display text-sm uppercase tracking-wider px-4 py-1.5 shadow-comic transition-all",
                        isCurrentMain
                          ? "bg-muted text-muted-foreground opacity-90 cursor-default"
                          : "bg-comic-blue text-accent-foreground hover:-translate-y-0.5 active:translate-y-0 cursor-pointer",
                      )}
                    >
                      {isCurrentMain ? (
                        <>
                          <Check className="h-4 w-4 stroke-[3]" />
                          <span>Capa Atual da Biblioteca</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>Definir como Capa da Biblioteca</span>
                        </>
                      )}
                    </button>

                    {activeCover.type === "upload" && (
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={handleDeleteCover}
                        className={cn(
                          "inline-flex items-center gap-1.5 border-[2.5px] border-ink rounded-full font-display text-sm uppercase tracking-wider px-4 py-1.5 bg-comic-red text-white shadow-comic hover:-translate-y-0.5 active:translate-y-0 transition-transform cursor-pointer",
                          deleting && "opacity-60 cursor-not-allowed hover:translate-y-0",
                        )}
                        aria-label="Excluir capa personalizada"
                      >
                        {deleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span>Excluir Capa</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
});
