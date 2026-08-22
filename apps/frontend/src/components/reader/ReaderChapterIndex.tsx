import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Chapter } from "@/types/scraping";

export interface ReaderIndexItem {
  id: string;
  title: string;
  number?: string;
  isDownloaded?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  chapters?: Chapter[];
  items?: ReaderIndexItem[];
  currentChapterId?: string;
  currentId?: string;
  onSelectChapter?: (chapterId: string) => void;
  onSelectItem?: (id: string) => void;
}

export function ReaderChapterIndex({
  open,
  onOpenChange,
  title = "Capítulos",
  chapters,
  items,
  currentChapterId,
  currentId,
  onSelectChapter,
  onSelectItem,
}: Props) {
  const activeId = currentId ?? currentChapterId ?? "";
  const handleSelect = (id: string) => {
    onSelectItem?.(id);
    onSelectChapter?.(id);
    onOpenChange(false);
  };

  const navItems: ReaderIndexItem[] =
    items ??
    chapters?.map((ch) => ({
      id: ch.id,
      title: ch.title,
      number: ch.number,
      isDownloaded: ch.isDownloaded,
    })) ??
    [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-80 border-l border-reader-border bg-reader-bg text-reader-foreground p-0"
      >
        <SheetHeader className="px-5 py-4 border-b border-reader-border">
          <SheetTitle className="text-sm font-medium uppercase tracking-[0.18em] text-reader-muted">
            {title}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-61px)]">
          <div className="flex flex-col py-1">
            {navItems.map((item) => {
              const isActive = item.id === activeId;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={cn(
                    "flex items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-reader-surface",
                    isActive && "bg-reader-surface",
                  )}
                >
                  {item.number && (
                    <span
                      className={cn(
                        "text-xs tabular-nums min-w-[2rem]",
                        isActive ? "text-reader-accent" : "text-reader-muted",
                      )}
                    >
                      {item.number}
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-sm truncate flex-1",
                      isActive ? "text-reader-foreground" : "text-reader-muted",
                    )}
                  >
                    {item.title}
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
