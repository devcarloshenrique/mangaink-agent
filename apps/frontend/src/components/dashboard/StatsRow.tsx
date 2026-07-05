import { ComicPanel } from "@/components/comic/ComicPanel";
import { AnimatedCounter } from "@/components/comic/AnimatedCounter";
import { stats } from "@/lib/dashboard-mock";
import { BookCheck, HardDrive, Send } from "lucide-react";

const ITEMS = [
  {
    icon: BookCheck,
    label: "Capítulos convertidos",
    value: stats.totalConverted,
    bg: "bg-comic-yellow",
    suffix: "",
  },
  {
    icon: HardDrive,
    label: "MB economizados",
    value: stats.mbSaved,
    bg: "bg-card",
    suffix: " MB",
  },
  {
    icon: Send,
    label: "Enviados ao Kindle (mai/26)",
    value: stats.kindleSentThisMonth,
    bg: "bg-comic-blue text-accent-foreground",
    suffix: "",
  },
];

export function StatsRow() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {ITEMS.map((it, i) => {
        const Icon = it.icon;
        return (
          <ComicPanel
            key={it.label}
            bg="card"
            padding="md"
            tilt={i % 2 === 0 ? "left" : "right"}
            className={`${it.bg}`}
          >
            <Icon className="h-6 w-6 mb-2" strokeWidth={2.5} />
            <div className="font-display text-4xl leading-none">
              <AnimatedCounter
                value={it.value}
                format={(n) => `${n.toLocaleString("pt-BR")}${it.suffix}`}
              />
            </div>
            <p className="text-xs font-bold mt-2 opacity-80 uppercase tracking-wide">{it.label}</p>
          </ComicPanel>
        );
      })}
    </div>
  );
}
