import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Chapter } from "@/types/scraping";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: Chapter[];
  currentChapterId: string;
  onSelectChapter: (chapterId: string) => void;
}

export function ReaderChapterIndex({
  open,
  onOpenChange,
  chapters,
  currentChapterId,
  onSelectChapter,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-80 border-l border-reader-border bg-reader-bg text-reader-foreground p-0"
      >
        <SheetHeader className="px-5 py-4 border-b border-reader-border">
          <SheetTitle className="text-sm font-medium uppercase tracking-[0.18em] text-reader-muted">
            Capítulos
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-61px)]">
          <div className="flex flex-col py-1">
            {chapters.map((ch) => {
              const isActive = ch.id === currentChapterId;
              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    onSelectChapter(ch.id);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-reader-surface",
                    isActive && "bg-reader-surface",
                  )}
                >
                  <span
                    className={cn(
                      "text-xs tabular-nums min-w-[2rem]",
                      isActive ? "text-reader-accent" : "text-reader-muted",
                    )}
                  >
                    {ch.number}
                  </span>
                  <span
                    className={cn(
                      "text-sm truncate flex-1",
                      isActive ? "text-reader-foreground" : "text-reader-muted",
                    )}
                  >
                    {ch.title}
                  </span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-reader-accent shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
