import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { relativeTime } from "@/lib/utils";
import type { CachedChapter } from "@/types/manga-detail";

interface TabCapitulosProps {
  chapters: CachedChapter[];
}

export function TabCapitulos({ chapters }: TabCapitulosProps) {
  if (chapters.length === 0) {
    return (
      <SpeechBubble variant="yellow" tail="left">
        Nenhum capitulo em cache.
      </SpeechBubble>
    );
  }

  return (
    <ComicPanel bg="card" padding="sm">
      <div>
        {chapters.map((chapter, i) => (
          <div
            key={chapter.id}
            className={`flex items-center gap-3 py-3 ${
              i < chapters.length - 1 ? "border-b-2 border-dashed border-ink/20" : ""
            }`}
          >
            <span className="shrink-0 font-display text-lg bg-comic-yellow border-[2px] border-ink rounded-md px-2 min-w-[2.5rem] text-center">
              {chapter.number}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{chapter.title}</p>
              <p className="text-xs text-muted-foreground">
                {chapter.pages !== null ? `${chapter.pages} pgs` : "—"}
                {" • "}
                {relativeTime(chapter.cachedAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ComicPanel>
  );
}
