import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

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

const MOCK_USER: SessionUser = {
  username: "admin",
  kindleEmail: "admin@kindle.com",
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(MOCK_USER);
  const [loading] = useState(false);

  const refresh = useCallback(async () => {
    setUser(MOCK_USER);
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        refresh,
        signOut: async () => {
          // No-op in mock mode — user stays "logged in"
          setUser(MOCK_USER);
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
