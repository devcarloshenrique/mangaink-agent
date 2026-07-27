import { cn } from "@/lib/utils";

interface Props {
  currentPage: number;
  totalPages: number;
  className?: string;
}

export function ReaderToolbar({ currentPage, totalPages, className }: Props) {
  const pct = totalPages > 1 ? Math.round((currentPage / (totalPages - 1)) * 100) : 0;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t border-reader-border bg-reader-bg/90 backdrop-blur-sm",
        className,
      )}
    >
      <div className="mx-auto max-w-3xl px-4 py-2 flex items-center gap-3">
        <span className="text-xs tabular-nums text-reader-muted shrink-0">
          {currentPage + 1} / {totalPages}
        </span>
        <div className="flex-1 h-[3px] rounded-full bg-reader-surface overflow-hidden">
          <div
            className="h-full bg-reader-accent transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-reader-muted shrink-0">{pct}%</span>
      </div>
    </div>
  );
}
