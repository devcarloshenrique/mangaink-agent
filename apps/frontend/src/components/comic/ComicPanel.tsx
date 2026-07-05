import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  tilt?: "left" | "right" | "none";
  bg?: "card" | "yellow" | "red" | "blue" | "halftone";
  padding?: "sm" | "md" | "lg";
  as?: "div" | "section" | "article";
}

const bgMap = {
  card: "bg-card",
  yellow: "bg-secondary",
  red: "bg-primary text-primary-foreground",
  blue: "bg-accent text-accent-foreground",
  halftone: "bg-card bg-halftone",
};

const padMap = { sm: "p-4", md: "p-6", lg: "p-8 md:p-10" };

export function ComicPanel({
  children,
  className,
  tilt = "none",
  bg = "card",
  padding = "md",
  as: Tag = "div",
}: Props) {
  return (
    <Tag
      className={cn(
        "border-[3px] border-ink rounded-xl shadow-comic transition-transform",
        bgMap[bg],
        padMap[padding],
        tilt === "left" && "-rotate-1",
        tilt === "right" && "rotate-1",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
