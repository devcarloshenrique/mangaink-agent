import { cn } from "@/lib/utils";

type Variant = "yellow" | "red" | "blue";
const variantMap: Record<Variant, string> = {
  yellow: "bg-secondary text-secondary-foreground",
  red: "bg-primary text-primary-foreground",
  blue: "bg-accent text-accent-foreground",
};

interface Props {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function OnomatopoeiaBadge({ children, variant = "yellow", className, size = "md" }: Props) {
  const sizeMap = {
    sm: "text-2xl px-4 py-1",
    md: "text-4xl px-5 py-2",
    lg: "text-6xl px-7 py-3",
  };
  return (
    <span
      className={cn(
        "inline-block font-display border-[3px] border-ink shadow-comic -rotate-3 rounded-md",
        variantMap[variant],
        sizeMap[size],
        className,
      )}
      style={{
        clipPath:
          "polygon(6% 0, 92% 4%, 100% 30%, 96% 70%, 100% 100%, 60% 96%, 30% 100%, 4% 92%, 0 50%, 4% 8%)",
      }}
    >
      {children}
    </span>
  );
}
