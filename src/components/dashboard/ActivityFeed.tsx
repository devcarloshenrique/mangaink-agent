import { RECENT_ACTIVITY } from "@/lib/mock-dashboard";
import { cn } from "@/lib/utils";

export function ActivityFeed() {
  return (
    <div className="space-y-0">
      {RECENT_ACTIVITY.map((item, i) => (
        <div
          key={item.id}
          className={cn(
            "flex items-center gap-3 py-3 border-b-2 border-dashed border-ink/20 last:border-0 last:pb-0",
            i === 0 && "pt-0",
          )}
        >
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink text-xs font-bold shrink-0",
              item.color,
              "bg-card",
            )}
          >
            {item.icon}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.message}</p>
          </div>
          <span className="text-xs font-medium opacity-50 shrink-0">{item.when}</span>
        </div>
      ))}
    </div>
  );
}
