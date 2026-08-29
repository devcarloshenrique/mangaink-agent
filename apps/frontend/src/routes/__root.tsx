import { Outlet, Link, createRootRoute, useRouterState } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ComicIntensityProvider } from "@/hooks/useComicIntensity";
import { useAuth } from "@/hooks/useAuth";
import { ComicHeader } from "@/components/comic/Header";
import { Toaster } from "sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30s
      refetchOnWindowFocus: false,
    },
  },
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-comic-red">404</h1>
        <h2 className="mt-4 font-display text-2xl">Página não encontrada</h2>
        <p className="mt-2 text-sm font-medium opacity-80">
          Esse capítulo não existe no nosso acervo.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border-[3px] border-ink bg-comic-yellow text-comic-ink px-4 py-2 font-display text-lg shadow-comic-sm hover:-translate-y-0.5 transition-transform"
          >
            Voltar para a home
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Aguarda a restauração da sessão antes de renderizar a árvore de rotas com Header persistente */
function AppShell() {
  const { isLoading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isFullscreenReader = pathname.includes("/reader-chapter");

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-[3px] border-ink bg-comic-yellow flex items-center justify-center shadow-comic-sm animate-spin">
            <span className="font-display text-2xl">M</span>
          </div>
          <p className="font-display text-lg opacity-70">Carregando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-background">
      <Toaster richColors position="top-right" />
      {!isFullscreenReader && <ComicHeader />}
      <main className="flex-1 overflow-y-scroll overflow-x-hidden flex flex-col min-w-0 [scrollbar-gutter:stable]">
        <Outlet />
      </main>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ComicIntensityProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </ComicIntensityProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
