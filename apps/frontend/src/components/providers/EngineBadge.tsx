import { cn } from "@/lib/utils";
import type { ProviderRecord } from "@/types/scraping";
import { Bot, FileCode2, Zap } from "lucide-react";

type Engine = ProviderRecord["engine"];

const ENGINE_LABEL: Record<Engine, string> = {
  api: "API direta",
  cheerio: "HTML scraping",
  playwright: "Browser",
};

const ENGINE_ICON: Record<Engine, typeof Zap> = {
  api: Zap,
  cheerio: FileCode2,
  playwright: Bot,
};

const ENGINE_COLOR: Record<Engine, string> = {
  api: "bg-comic-blue text-accent-foreground",
  cheerio: "bg-comic-yellow text-comic-ink",
  playwright: "bg-comic-red text-primary-foreground",
};

export function EngineBadge({ engine }: { engine: Engine }) {
  const Icon = ENGINE_ICON[engine];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border-[2px] border-ink font-display text-[10px]",
        ENGINE_COLOR[engine],
      )}
    >
      <Icon className="h-3 w-3" />
      {ENGINE_LABEL[engine]}
    </span>
  );
}
