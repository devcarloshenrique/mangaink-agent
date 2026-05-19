import { useState } from "react";
import { THEME_PRESETS } from "@/lib/theme-presets";
import { setTheme, getTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { Check, Moon, Sun } from "lucide-react";

export function ThemeSelector() {
  const [active, setActive] = useState(getTheme);

  const handleSelect = (themeId: string) => {
    setTheme(themeId);
    setActive(themeId);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {THEME_PRESETS.map((theme) => {
        const selected = active === theme.id;
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => handleSelect(theme.id)}
            className={cn(
              "relative flex flex-col items-center gap-2 p-4 rounded-lg border-[3px] transition-all",
              selected
                ? "border-ink bg-secondary shadow-comic-sm -translate-y-0.5"
                : "border-ink bg-card hover:-translate-y-0.5 shadow-comic-sm",
            )}
          >
            {selected && (
              <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-comic-red border-2 border-ink flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
              </div>
            )}
            <div className="flex gap-1.5">
              <span
                className="h-5 w-5 rounded-full border-2 border-ink"
                style={{ background: theme.colors.yellow }}
              />
              <span
                className="h-5 w-5 rounded-full border-2 border-ink"
                style={{ background: theme.colors.red }}
              />
              <span
                className="h-5 w-5 rounded-full border-2 border-ink"
                style={{ background: theme.colors.blue }}
              />
              <span
                className="h-5 w-5 rounded-full border-2 border-ink"
                style={{ background: theme.colors.cream }}
              />
              <span
                className="h-5 w-5 rounded-full border-2 border-ink"
                style={{ background: theme.colors.ink }}
              />
            </div>
            <span className="font-display text-sm flex items-center gap-1.5">
              {theme.name}
              {theme.isDark ? (
                <Moon className="h-3.5 w-3.5 opacity-60" />
              ) : (
                <Sun className="h-3.5 w-3.5 opacity-60" />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
