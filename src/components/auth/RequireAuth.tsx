import type { ReactNode } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  // Mock mode: always render children, no auth check
  return <>{children}</>;
}
