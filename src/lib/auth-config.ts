// Configuração de sessão server-side (cookie criptografado).
// Lida pelo `useSession` do TanStack Start dentro de server functions.
//
// Em produção (container) defina SESSION_SECRET via env (mínimo 32 chars).
// Em dev usamos um fallback fixo só para destravar o build.

export const sessionConfig = {
  password:
    process.env.SESSION_SECRET ??
    "dev-only-mangaforge-session-secret-please-change-me-in-prod",
  name: "mangaforge_session",
  maxAge: 60 * 60 * 24 * 30, // 30 dias
  cookie: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
};

export interface SessionData {
  username?: string;
  loggedInAt?: number;
}
