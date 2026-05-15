import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Variant = "white" | "yellow" | "red" | "blue";
type Tail = "left" | "right" | "bottom" | "none";

const variantClasses: Record<Variant, string> = {
  white: "bg-card text-foreground",
  yellow: "bg-secondary text-secondary-foreground",
  red: "bg-primary text-primary-foreground",
  blue: "bg-accent text-accent-foreground",
};

interface Props {
  children: ReactNode;
  variant?: Variant;
  tail?: Tail;
  className?: string;
}

export function SpeechBubble({
  children,
  variant = "white",
  tail = "left",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "relative inline-block rounded-3xl border-[3px] border-ink px-5 py-3 font-bold shadow-comic",
        variantClasses[variant],
        className,
      )}
    >
      {children}
      {tail !== "none" && (
        <span
          aria-hidden
          className={cn(
            "absolute h-0 w-0",
            tail === "left" &&
              "-bottom-4 left-8 border-t-[18px] border-r-[14px] border-l-0 border-t-current border-r-transparent",
            tail === "right" &&
              "-bottom-4 right-8 border-t-[18px] border-l-[14px] border-r-0 border-t-current border-l-transparent",
            tail === "bottom" &&
              "-bottom-4 left-1/2 -translate-x-1/2 border-t-[18px] border-x-[10px] border-t-current border-x-transparent",
          )}
          style={{ color: "inherit" }}
        />
      )}
    </div>
  );
}
