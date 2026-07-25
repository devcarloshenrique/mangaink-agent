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
      <SheetContent side="right" className="w-80 border-l-2 border-ink bg-black/95 text-white p-0">
        <SheetHeader className="px-5 py-4 border-b border-white/10">
          <SheetTitle className="font-display text-lg text-white/90">Capítulos</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-65px)]">
          <div className="flex flex-col py-2">
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
                    "flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-white/5",
                    isActive && "bg-white/10 border-l-2 border-comic-blue",
                  )}
                >
                  <span
                    className={cn(
                      "font-display text-sm min-w-[2.5rem]",
                      isActive ? "text-comic-blue" : "text-white/60",
                    )}
                  >
                    {ch.number}
                  </span>
                  <span
                    className={cn(
                      "text-sm truncate flex-1",
                      isActive ? "text-white/90" : "text-white/50",
                    )}
                  >
                    {ch.title}
                  </span>
                  {isActive && <span className="w-2 h-2 rounded-full bg-comic-blue shrink-0" />}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
