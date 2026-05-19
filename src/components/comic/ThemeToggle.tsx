import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "Mudar para claro" : "Mudar para escuro"}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-md border-[3px] border-ink bg-card shadow-comic-sm hover:-translate-y-0.5 transition-transform",
        className,
      )}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
