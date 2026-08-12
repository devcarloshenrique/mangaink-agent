// components/providers/constants.ts — estado e configuração visual dos providers/fontes

export type SourceStatus = "active" | "slow" | "beta" | "offline" | "soon";

export const STATUS_CONFIG: Record<SourceStatus, { label: string; color: string; dot: string }> = {
  active: { label: "online", color: "text-comic-blue", dot: "bg-comic-blue" },
  slow: { label: "lento", color: "text-comic-yellow", dot: "bg-comic-yellow" },
  beta: { label: "beta", color: "text-comic-yellow", dot: "bg-comic-yellow" },
  offline: { label: "offline", color: "text-comic-red", dot: "bg-comic-red" },
  soon: { label: "em breve", color: "opacity-60", dot: "bg-muted-foreground" },
};
