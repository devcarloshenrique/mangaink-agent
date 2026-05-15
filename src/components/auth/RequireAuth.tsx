import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-display text-2xl animate-pulse">Carregando…</div>
      </div>
    );
  }
  return <>{children}</>;
}
