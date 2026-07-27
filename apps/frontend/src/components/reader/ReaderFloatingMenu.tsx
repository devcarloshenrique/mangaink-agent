import { ArrowUp, ArrowDown, List, Plus, Minus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  showUI: boolean;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onOpenIndex: () => void;
  onOpenSettings: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ReaderFloatingMenu({
  showUI,
  hasPrevChapter,
  hasNextChapter,
  onPrevChapter,
  onNextChapter,
  onOpenIndex,
  onOpenSettings,
  onZoomIn,
  onZoomOut,
}: Props) {
  const btnBase =
    "p-2 rounded-md text-reader-muted hover:text-reader-foreground hover:bg-reader-surface transition-colors";

  return (
    <div
      data-testid="floating-menu"
      className={cn(
        "fixed right-4 top-1/2 -translate-y-1/2 z-30 transition-opacity duration-200",
        showUI ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
    >
      <div className="rounded-lg border border-reader-border bg-reader-bg/80 backdrop-blur-sm p-1 flex flex-col items-center gap-0.5">
        <button
          disabled={!hasPrevChapter}
          onClick={(e) => {
            e.stopPropagation();
            onPrevChapter();
          }}
          className={cn(btnBase, !hasPrevChapter && "opacity-25 cursor-default")}
          title="Capítulo anterior"
        >
          <ArrowUp className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenIndex();
          }}
          className={btnBase}
          title="Índice de capítulos"
        >
          <List className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onZoomIn();
          }}
          className={btnBase}
          title="Zoom +"
        >
          <Plus className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onZoomOut();
          }}
          className={btnBase}
          title="Zoom -"
        >
          <Minus className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings();
          }}
          className={btnBase}
          title="Configurações"
        >
          <Settings className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <button
          disabled={!hasNextChapter}
          onClick={(e) => {
            e.stopPropagation();
            onNextChapter();
          }}
          className={cn(btnBase, !hasNextChapter && "opacity-25 cursor-default")}
          title="Próximo capítulo"
        >
          <ArrowDown className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
