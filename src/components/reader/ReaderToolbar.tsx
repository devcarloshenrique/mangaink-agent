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
        "fixed bottom-0 left-0 right-0 z-50 border-t-[3px] border-ink bg-comic-yellow shadow-[0_-4px_0_0_var(--comic-ink)]",
        className,
      )}
    >
      <div className="mx-auto max-w-3xl px-4 py-2 flex items-center gap-3">
        <span className="font-display text-sm shrink-0">
          {currentPage + 1} / {totalPages}
        </span>
        <div className="flex-1 h-2.5 border-[2px] border-ink rounded-full bg-card overflow-hidden">
          <div
            className="h-full bg-comic-red transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-display text-xs opacity-60 shrink-0">{pct}%</span>
      </div>
    </div>
  );
}
