import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { logout as logoutFn, me } from "@/lib/auth.functions";

interface SessionUser {
  username: string;
  kindleEmail: string;
}

interface AuthCtx {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const meFn = useServerFn(me);
  const logoutSrv = useServerFn(logoutFn);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await meFn();
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [meFn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        refresh,
        signOut: async () => {
          await logoutSrv();
          setUser(null);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
