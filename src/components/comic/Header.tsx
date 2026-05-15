import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, LogOut, User as UserIcon, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ComicHeader() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-comic-yellow">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:py-4">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-ink bg-comic-red text-primary-foreground shadow-comic-sm group-hover:-rotate-12 transition-transform">
            <BookOpen className="h-5 w-5" strokeWidth={3} />
          </span>
          <span className="font-display text-2xl md:text-3xl tracking-wide">
            Manga<span className="text-comic-red">Forge</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 font-display text-lg">
          <a href="/#how" className="hover:text-comic-red transition-colors">Como funciona</a>
          <a href="/#features" className="hover:text-comic-red transition-colors">Recursos</a>
        </nav>

        <div className="flex items-center gap-2">
          {user && profile && (
            <Link
              to="/conta"
              className="flex items-center gap-1 border-[3px] border-ink bg-comic-red text-primary-foreground px-3 py-1 rounded-md shadow-comic-sm font-display text-sm md:text-base hover:-translate-y-0.5 transition-transform"
            >
              <Zap className="h-4 w-4 fill-current" />
              {profile.credits}
              <span className="hidden sm:inline ml-1">créditos</span>
            </Link>
          )}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-ink bg-card shadow-comic-sm hover:-translate-y-0.5 transition-transform">
                <UserIcon className="h-5 w-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-[3px] border-ink shadow-comic">
                <DropdownMenuLabel className="font-display">
                  {profile?.display_name ?? user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/conta" })}>
                  <UserIcon className="mr-2 h-4 w-4" /> Minha conta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/wizard" })}>
                  <BookOpen className="mr-2 h-4 w-4" /> Novo mangá
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/" });
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
