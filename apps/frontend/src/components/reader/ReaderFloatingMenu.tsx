import { ArrowUp, ArrowDown, List, Plus, Minus, Settings } from "lucide-react";

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
    "p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-all";

  return (
    <div
      data-testid="floating-menu"
      className={`fixed right-4 top-1/2 -translate-y-1/2 z-30 transition-opacity duration-300 ${
        showUI ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="bg-black/60 backdrop-blur-sm rounded-xl px-2 py-2 flex flex-col items-center gap-1">
        <button
          disabled={!hasPrevChapter}
          onClick={(e) => {
            e.stopPropagation();
            onPrevChapter();
          }}
          className={`${btnBase} ${!hasPrevChapter ? "opacity-20 cursor-default" : ""}`}
          title="Capítulo anterior"
        >
          <ArrowUp className="w-5 h-5" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenIndex();
          }}
          className={btnBase}
          title="Índice de capítulos"
        >
          <List className="w-5 h-5" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onZoomIn();
          }}
          className={btnBase}
          title="Zoom +"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onZoomOut();
          }}
          className={btnBase}
          title="Zoom -"
        >
          <Minus className="w-5 h-5" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings();
          }}
          className={btnBase}
          title="Configurações"
        >
          <Settings className="w-5 h-5" />
        </button>

        <button
          disabled={!hasNextChapter}
          onClick={(e) => {
            e.stopPropagation();
            onNextChapter();
          }}
          className={`${btnBase} ${!hasNextChapter ? "opacity-20 cursor-default" : ""}`}
          title="Próximo capítulo"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
