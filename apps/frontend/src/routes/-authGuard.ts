// Guard de autenticação para rotas protegidas
// Usa beforeLoad do TanStack Router para evitar flash de conteúdo protegido

import { redirect } from "@tanstack/react-router";
import { authApi } from "@/lib/api";

/**
 * beforeLoad guard para rotas protegidas.
 * Verifica o token e redireciona para /login se não autenticado.
 *
 * Uso:
 *   export const Route = createFileRoute('/rota-protegida')({
 *     beforeLoad: authGuard,
 *     component: ...,
 *   })
 */
export async function authGuard({ location }: { location: { href: string } }) {
  try {
    await authApi.me();
    // Token válido → permite acesso
  } catch {
    // Token inválido ou ausente → redireciona para login
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
  try {
    await authApi.me();
    // Já autenticado → redireciona para home
    throw redirect({ to: "/" });
  } catch (err) {
    // Se for o redirect, propaga
    if (err && typeof err === "object" && "href" in err) throw err;
    // Token inválido → permite acesso à página de visitante
  }
}
