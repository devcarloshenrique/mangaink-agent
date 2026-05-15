import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BookOpen, Calendar, Cog, Library, LogOut, Sparkles, Wand2, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Início", icon: BookOpen },
  { to: "/wizard", label: "Converter", icon: Wand2 },
  { to: "/biblioteca", label: "Biblioteca", icon: Library },
  { to: "/agendamentos", label: "Agendamentos", icon: Calendar },
  { to: "/fontes", label: "Fontes", icon: Sparkles },
] as const;

export function ComicHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-comic-yellow">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:py-4">
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-ink bg-comic-red text-primary-foreground shadow-comic-sm group-hover:-rotate-12 transition-transform">
            <BookOpen className="h-5 w-5" strokeWidth={3} />
          </span>
          <span className="font-display text-2xl md:text-3xl tracking-wide">
            Manga<span className="text-comic-red">Forge</span>
          </span>
        </Link>

        {user && (
          <nav className="hidden lg:flex items-center gap-1 font-display text-base">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = pathname === n.to || (n.to !== "/" && pathname.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md border-[2.5px] transition-all",
                    active
                      ? "bg-comic-red text-primary-foreground border-ink shadow-comic-sm"
                      : "border-transparent hover:border-ink hover:-translate-y-0.5",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-10 items-center gap-2 px-3 rounded-md border-[3px] border-ink bg-card shadow-comic-sm hover:-translate-y-0.5 transition-transform">
                <UserIcon className="h-4 w-4" />
                <span className="font-display text-sm hidden sm:inline">{user.username}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-[3px] border-ink shadow-comic">
                <DropdownMenuLabel className="font-display">{user.username}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {NAV.map((n) => {
                  const Icon = n.icon;
                  return (
                    <DropdownMenuItem key={n.to} onClick={() => navigate({ to: n.to })} className="lg:hidden">
                      <Icon className="mr-2 h-4 w-4" /> {n.label}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuItem onClick={() => navigate({ to: "/configuracoes" })}>
                  <Cog className="mr-2 h-4 w-4" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/login" });
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/login"
              className="border-[3px] border-ink bg-card px-3 py-1.5 rounded-md shadow-comic-sm font-display hover:-translate-y-0.5 transition-transform"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
