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
          <DialogContent className="max-w-4xl p-0 bg-transparent border-0 shadow-none sm:rounded-none flex flex-col items-center justify-center focus:outline-none select-none">
            <DialogTitle className="sr-only">
              {title ? `Capa de ${title}` : "Capa da obra em tela cheia"}
            </DialogTitle>

            {/* Barra superior com botão fechar fora da imagem */}
            <div className="w-full flex items-center justify-end pb-2 max-w-[85vw]">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-comic-ink text-comic-cream border-2 border-comic-yellow shadow-comic-sm hover:bg-comic-red hover:text-white transition-colors cursor-pointer font-display text-xs"
                title="Fechar (Esc)"
              >
                <X className="h-4 w-4" /> Fechar
              </button>
            </div>

            {/* Imagem em tela cheia completamente desobstruída */}
            <div className="relative border-[4px] border-ink rounded-2xl shadow-comic-lg bg-card overflow-hidden max-h-[82vh] max-w-[85vw] flex items-center justify-center">
              <img
                src={url}
                alt={title ?? "Capa do mangá"}
                className="max-h-[80vh] max-w-[82vw] w-auto h-auto object-contain select-none"
              />
            </div>

            {title && (
              <p className="mt-3 font-display text-base text-white bg-comic-ink/90 px-4 py-1 rounded-full border-2 border-comic-yellow/80 shadow-comic-sm text-center max-w-[85vw] truncate">
                {title}
              </p>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}


