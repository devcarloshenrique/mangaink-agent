import { useState } from "react";
import { BookOpen, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { conversionsApi } from "@/lib/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface MangaCoverProps {
  sourceId: string;
  title?: string;
  className?: string;
  enableFullscreen?: boolean;
}

export function MangaCover({
  sourceId,
  title,
  className,
  enableFullscreen = true,
}: MangaCoverProps) {
  const [error, setError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const url = conversionsApi.coverUrl(sourceId, { kind: "original" });

  if (!url || error) {
    return (
      <ComicPanel bg="halftone" className={cn("flex items-center justify-center", className)}>
        <BookOpen className="h-16 w-16 opacity-30" />
      </ComicPanel>
    );
  }

  return (
    <>
      <div
        onClick={() => {
          if (enableFullscreen) setIsOpen(true);
        }}
        className={cn(
          "border-[3px] border-ink rounded-xl shadow-comic overflow-hidden relative group",
          enableFullscreen &&
            "cursor-zoom-in transition-transform hover:-translate-y-1 hover:shadow-comic-lg",
          className,
        )}
        title={enableFullscreen ? "Clique para ampliar a capa" : undefined}
      >
        <img
          src={url}
          alt={title ?? "Capa do mangá"}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setError(true)}
        />
        {enableFullscreen && (
          <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-comic-ink/85 text-comic-cream border-2 border-comic-yellow shadow-comic-sm">
              <Maximize2 className="h-3.5 w-3.5" />
            </span>
          </div>
        )}
      </div>

      {enableFullscreen && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-fit w-auto p-0 bg-transparent border-0 shadow-none sm:rounded-none overflow-visible [&>button]:hidden focus:outline-none select-none">
            <DialogTitle className="sr-only">
              {title ? `Capa de ${title}` : "Capa da obra em tela cheia"}
            </DialogTitle>

            {/* Container da imagem */}
            <div className="relative flex flex-col items-center">
              {/* Botão de Fechar pop-art ancorado no canto superior direito do frame da imagem */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fechar visualização da capa"
                className="absolute -top-3 -right-3 z-30 flex h-8 w-8 items-center justify-center rounded-full border-[2.5px] border-ink bg-comic-red text-white shadow-comic-sm transition-transform hover:scale-110 active:scale-95 cursor-pointer"
              >
                <X className="h-4 w-4" strokeWidth={3} />
              </button>

              {/* Frame da capa estilizado estilo comic */}
              <div className="relative border-[4px] border-ink rounded-2xl shadow-comic-lg bg-card overflow-hidden max-h-[82vh] max-w-[85vw] flex items-center justify-center">
                <img
                  src={url}
                  alt={title ?? "Capa do mangá"}
                  className="max-h-[80vh] max-w-[83vw] w-auto h-auto object-contain select-none block"
                  style={{ imageRendering: "auto" }}
                />
              </div>

              {title && (
                <p className="mt-5 font-display text-base tracking-wide text-comic-ink bg-comic-yellow px-5 py-1.5 rounded-full border-[2.5px] border-ink shadow-comic text-center max-w-[85vw] truncate">
                  {title}
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
