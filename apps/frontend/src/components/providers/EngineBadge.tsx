import { cn } from "@/lib/utils";
import type { ProviderRecord } from "@/types/scraping";
import { Globe, Rocket, Zap } from "lucide-react";

type Engine = ProviderRecord["engine"];

const ENGINE_LABEL: Record<Engine, string> = {
  cheerio: "Ultra Rápido",
  api: "Rápido",
  playwright: "Padrão",
};

const ENGINE_ICON: Record<Engine, typeof Zap> = {
  cheerio: Zap,
  api: Rocket,
  playwright: Globe,
};

const ENGINE_COLOR: Record<Engine, string> = {
  cheerio: "bg-comic-yellow text-comic-ink",
  api: "bg-comic-blue text-white",
  playwright: "bg-comic-red text-white",
};

export function EngineBadge({
  engine,
  className,
  size = "default",
}: {
  engine: Engine;
  className?: string;
  size?: "sm" | "default";
}) {
  const Icon = ENGINE_ICON[engine];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border-[2px] border-ink font-sans font-bold",
        size === "sm" ? "px-1 py-0.2 text-[9px]" : "px-1.5 py-0.5 text-[10px]",
        ENGINE_COLOR[engine],
        className,
      )}
    >
      <Icon className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3", "stroke-[2.5]")} />
      {ENGINE_LABEL[engine]}
    </span>
  );
}
