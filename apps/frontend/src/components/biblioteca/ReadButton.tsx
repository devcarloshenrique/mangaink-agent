import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReadButtonProps {
  readingProgress: { chapterNumber: string } | null;
  sourceId: string;
  className?: string;
}

export function ReadButton({ readingProgress, sourceId: _sourceId, className }: ReadButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "w-full bg-comic-red text-primary-foreground border-[3px] border-ink shadow-comic-sm font-display text-lg py-3 rounded-md hover:-translate-y-0.5 transition-transform flex items-center justify-center gap-2",
        className,
      )}
    >
      <Play className="h-5 w-5" />
      {readingProgress ? `Continuar lendo cap ${readingProgress.chapterNumber}` : "Comecar a ler"}
    </button>
  );
}
