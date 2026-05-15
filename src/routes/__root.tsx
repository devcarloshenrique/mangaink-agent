import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/hooks/useAuth";

import appCss from "../styles.css?url";

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

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MangaForge — Mangás direto no seu Kindle" },
      { name: "description", content: "Wizard pop art para baixar mangás, escolher capas e enviar pro seu Kindle em formato EPUB, MOBI, KFX ou CBZ." },
      { name: "author", content: "MangaForge" },
      { property: "og:title", content: "MangaForge — Mangás direto no seu Kindle" },
      { property: "og:description", content: "Da URL ao seu Kindle em 5 passos. Otimizado para mangás e webtoons." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bangers&family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
