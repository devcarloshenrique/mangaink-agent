import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface SessionUser {
  username: string;
  kindleEmail: string;
}

interface AuthCtx {
  user: SessionUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading] = useState(false);

  const signIn = useCallback(async (username: string, _password: string) => {
    await new Promise((r) => setTimeout(r, 300));
    setUser({ username, kindleEmail: `${username}@kindle.com` });
  }, []);

  const signUp = useCallback(async (username: string, email: string, _password: string) => {
    await new Promise((r) => setTimeout(r, 500));
    setUser({ username, kindleEmail: email });
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
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
