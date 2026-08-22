import { useState } from "react";
import { BookOpen, Maximize2 } from "lucide-react";
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
          <DialogContent
            className="max-w-[92vw] max-h-[92vh] p-0 bg-transparent border-0 shadow-none sm:rounded-none flex flex-col items-center justify-center focus:outline-none select-none [&>button]:bg-comic-ink [&>button]:text-comic-cream [&>button]:border-2 [&>button]:border-comic-yellow [&>button]:rounded-full [&>button]:h-8 [&>button]:w-8 [&>button]:shadow-comic-sm [&>button]:opacity-100 [&>button]:top-2 [&>button]:right-2 hover:[&>button]:bg-comic-red"
            onInteractOutside={() => setIsOpen(false)}
          >
            <DialogTitle className="sr-only">
              {title ? `Capa de ${title}` : "Capa da obra em tela cheia"}
            </DialogTitle>

            {/* Imagem em tela cheia completamente desobstruída */}
            <div className="relative border-[4px] border-ink rounded-2xl shadow-comic-lg bg-card overflow-hidden max-h-[88vh] max-w-[90vw] flex items-center justify-center">
              <img
                src={url}
                alt={title ?? "Capa do mangá"}
                className="max-h-[86vh] max-w-[88vw] w-auto h-auto object-contain select-none"
                style={{ imageRendering: "auto" }}
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
