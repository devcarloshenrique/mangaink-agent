import { ComicPanel } from "@/components/comic/ComicPanel";
import { activity, type ActivityKind } from "@/lib/dashboard-mock";
import { AlertTriangle, Calendar, Check, RefreshCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const MAP: Record<ActivityKind, { icon: LucideIcon; bg: string }> = {
  sent: { icon: Check, bg: "bg-comic-blue text-accent-foreground" },
  converted: { icon: RefreshCcw, bg: "bg-comic-yellow" },
  scheduled: { icon: Calendar, bg: "bg-card" },
  error: { icon: AlertTriangle, bg: "bg-comic-red text-primary-foreground" },
};

export function ActivityFeed() {
  return (
    <ComicPanel bg="card" padding="md">
      <ul className="divide-y-2 divide-dashed divide-ink/30">
        {activity.map((a) => {
          const cfg = MAP[a.kind];
          const Icon = cfg.icon;
          return (
            <li key={a.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink shadow-comic-sm ${cfg.bg}`}
              >
                <Icon className="h-4 w-4" strokeWidth={3} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-base leading-tight truncate">{a.text}</p>
                <p className="text-[11px] font-bold opacity-60 mt-0.5">{a.when}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </ComicPanel>
  );
}
