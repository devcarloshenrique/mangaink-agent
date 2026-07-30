import { Play, Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { Chapter } from "@/types/scraping";

interface ReadButtonProps {
  sourceId: string;
  readChapterIds: Set<string>;
  chapters: Chapter[];
  isLoading: boolean;
  className?: string;
}

export function ReadButton({
  sourceId,
  readChapterIds,
  chapters,
  isLoading,
  className,
}: ReadButtonProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          "w-full bg-comic-red text-primary-foreground border-[3px] border-ink shadow-comic-sm font-display text-lg py-3 rounded-md flex items-center justify-center gap-2 opacity-70 cursor-wait",
          className,
        )}
        aria-label="Carregando progresso de leitura"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando...
      </button>
    );
  }

  const unreadDownloaded = chapters.find((ch) => !readChapterIds.has(ch.id) && ch.isDownloaded);
  const unreadAny = chapters.find((ch) => !readChapterIds.has(ch.id));

  const targetChapter = unreadDownloaded ?? unreadAny ?? chapters[0];

  const allRead =
    chapters.length > 0 &&
    readChapterIds.size >= chapters.length &&
    chapters.every((ch) => readChapterIds.has(ch.id));
  const noneRead = readChapterIds.size === 0;

  let label: string;
  if (noneRead) {
    label = "Começar a ler";
  } else if (allRead) {
    label = "Re-ler cap 1";
  } else {
    label = `Continuar lendo cap ${targetChapter.number}`;
  }

  function handleClick() {
    if (!targetChapter) return;

    navigate({
      to: "/biblioteca/reader-chapter/$sourceId",
      params: { sourceId },
      search: { chapterId: targetChapter.id },
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "w-full bg-comic-red text-primary-foreground border-[3px] border-ink shadow-comic-sm font-display text-lg py-3 rounded-md hover:-translate-y-0.5 transition-transform flex items-center justify-center gap-2",
        className,
      )}
      aria-label={label}
    >
      <Play className="h-5 w-5" />
      {label}
    </button>
  );
}
