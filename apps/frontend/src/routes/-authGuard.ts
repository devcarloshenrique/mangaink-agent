// Guard de autenticação para rotas protegidas
// Usa beforeLoad do TanStack Router com authSession em memória para transições instantâneas (0ms)

import { redirect } from "@tanstack/react-router";
import { authSession } from "@/lib/authSession";

/**
 * beforeLoad guard para rotas protegidas.
 * Verifica a sessão e redireciona para /login se não autenticado.
 * Resolve instantaneamente de forma síncrona/em cache quando a sessão já está inicializada.
 */
export async function authGuard({ location }: { location: { href: string } }) {
  await authSession.ensureInitialized();
  if (!authSession.isAuthenticated()) {
    throw redirect({
      to: "/login",
      search: { redirect: location.href },
    });
  }
}

/**
 * Guard para rotas de visitantes (login/cadastro).
 * Redireciona usuários já autenticados para o dashboard.
 */
export async function guestGuard() {
  await authSession.ensureInitialized();
  if (authSession.isAuthenticated()) {
    throw redirect({ to: "/" });
  }
}
