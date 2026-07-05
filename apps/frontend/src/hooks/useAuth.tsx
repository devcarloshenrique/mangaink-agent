import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authApi, userApi, ApiError } from "@/lib/api";
import type { User, LoginCredentials, RegisterData, UpdateProfileData } from "@/types/auth";

// ─── Context type ─────────────────────────────────────────────────────────────
interface AuthCtx {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Login com e-mail ou nome de usuário e senha */
  login: (credentials: LoginCredentials) => Promise<void>;
  /** Cadastro de novo usuário */
  register: (data: RegisterData) => Promise<void>;
  /** Logout local */
  logout: () => Promise<void>;
  /** Validar sessão existente via /auth/me */
  refreshSession: () => Promise<void>;
  /** Atualizar perfil do usuário */
  updateProfile: (data: UpdateProfileData) => Promise<void>;
  // Compatibilidade com consumidores legados
  /** @deprecated Use login() com { email, password } */
  signIn: (email: string, password: string) => Promise<void>;
  /** @deprecated Use register() */
  signUp: (username: string, email: string, password: string) => Promise<void>;
  /** @deprecated Use logout() */
  signOut: () => Promise<void>;
  /** @deprecated Use isLoading */
  loading: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Restaurar sessão ao montar ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const currentUser = await authApi.me();
        if (!cancelled) setUser(currentUser);
      } catch {
        // Token inválido ou expirado — limpa estado
        authApi.logout();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    restoreSession();
    return () => { cancelled = true; };
  }, []);

  // ── Métodos de Auth ────────────────────────────────────────────────────────
  const login = useCallback(async (credentials: LoginCredentials) => {
    const { user: loggedUser } = await authApi.login(credentials);
    setUser(loggedUser);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const { user: registeredUser } = await authApi.register(data);
    setUser(registeredUser);
  }, []);

  const logout = useCallback(async () => {
    authApi.logout();
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const currentUser = await authApi.me();
      setUser(currentUser);
    } catch {
      authApi.logout();
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (data: UpdateProfileData) => {
    const updatedUser = await userApi.updateMe(data);
    setUser(updatedUser);
  }, []);

  // ── Compat com consumidores legados ────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    await login({ identifier: email, password });
  }, [login]);

  const signUp = useCallback(
    async (username: string, email: string, password: string) => {
      await register({ username, email, password, confirmPassword: password });
    },
    [register],
  );

  const signOut = useCallback(async () => {
    await logout();
  }, [logout]);

  return (
    <Ctx.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshSession,
        updateProfile,
        // compat
        signIn,
        signUp,
        signOut,
        loading: isLoading,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
