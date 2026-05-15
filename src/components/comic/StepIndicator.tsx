import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  label: string;
  short: string;
}

interface Props {
  steps: Step[];
  current: number;
  visited: number;
  onJump: (index: number) => void;
}

export function StepIndicator({ steps, current, visited, onJump }: Props) {
  return (
    <ol className="grid grid-cols-5 gap-2 md:gap-3">
      {steps.map((step, i) => {
        const isActive = i === current;
        const isDone = i < current || (i <= visited && i !== current);
        const canJump = i <= visited;
        return (
          <li key={step.label}>
            <button
              type="button"
              onClick={() => canJump && onJump(i)}
              disabled={!canJump}
              className={cn(
                "group relative flex w-full flex-col items-center gap-1 rounded-lg border-[3px] border-ink p-2 md:p-3 text-center transition-all",
                "shadow-comic-sm",
                isActive && "bg-secondary -translate-y-1 shadow-comic",
                !isActive && isDone && "bg-accent text-accent-foreground",
                !isActive && !isDone && "bg-card",
                canJump && !isActive && "hover:-translate-y-0.5 cursor-pointer",
                !canJump && "opacity-60 cursor-not-allowed",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 md:h-9 md:w-9 items-center justify-center rounded-full border-[3px] border-ink font-display text-base md:text-lg",
                  isActive && "bg-primary text-primary-foreground",
                  isDone && !isActive && "bg-secondary text-secondary-foreground",
                  !isActive && !isDone && "bg-muted",
                )}
              >
                {isDone && !isActive ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className="font-display text-[10px] md:text-sm leading-tight">
                <span className="hidden md:inline">{step.label}</span>
                <span className="md:hidden">{step.short}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
