import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Cog,
  Download,
  Library,
  Loader2,
  LogOut,
  Sparkles,
  Trash2,
  Wand2,
  AlertTriangle,
  User as UserIcon,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useConversion } from "@/hooks/useConversion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { STAGE_LABELS, formatTimeAgo } from "@/lib/conversion-job";
import type { JobStage } from "@/lib/conversion-job";

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
  const { jobs, clearCompleted } = useConversion();

  const activeJobs = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const activeCount = activeJobs.length;
  const completedCount = jobs.filter((j) => j.status === "completed" || j.status === "error").length;

  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-comic-yellow">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:py-4">
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-ink bg-comic-red text-primary-foreground shadow-comic-sm group-hover:-rotate-12 transition-transform">
            <BookOpen className="h-5 w-5" strokeWidth={3} />
          </span>
          <span className="font-display text-2xl md:text-3xl tracking-wide">
            Mangaink
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
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-md border-[3px] transition-all",
                    activeCount > 0
                      ? "border-ink bg-comic-yellow shadow-comic-sm hover:-translate-y-0.5"
                      : "border-ink bg-card hover:-translate-y-0.5",
                  )}
                  title={activeCount > 0 ? `${activeCount} conversão(ões) em andamento` : "Downloads"}
                >
                  <Download className={cn("h-4 w-4", activeCount > 0 && "text-comic-blue")} />
                  {activeCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-comic-red px-0.5 text-[10px] font-bold text-primary-foreground">
                      {activeCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-80 border-[3px] border-ink shadow-comic p-0"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b-2 border-ink/20 bg-comic-yellow">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    <span className="font-display text-lg">Downloads</span>
                  </div>
                  {activeCount > 0 && (
                    <span className="text-xs font-medium bg-comic-blue text-accent-foreground border-2 border-ink px-1.5 py-0.5 rounded">
                      {activeCount} ativo{activeCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Job list */}
                <div className="max-h-80 overflow-y-auto">
                  {jobs.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Download className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium opacity-50">
                        Nenhuma conversão recente
                      </p>
                    </div>
                  ) : (
                    jobs.map((job) => (
                      <DropdownMenuItem
                        key={job.id}
                        onClick={() =>
                          navigate({
                            to: "/biblioteca/converter/$jobId",
                            params: { jobId: job.id },
                          })
                        }
                        className="flex flex-col items-start gap-1 px-4 py-3 cursor-pointer border-b border-ink/10 last:border-0 focus:bg-muted"
                      >
                        <div className="flex items-center gap-2 w-full">
                          {job.status === "running" || job.status === "queued" ? (
                            <Loader2 className="h-4 w-4 text-comic-blue animate-spin shrink-0" />
                          ) : job.status === "completed" ? (
                            <CheckCircle2 className="h-4 w-4 text-comic-blue shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-comic-red shrink-0" />
                          )}
                          <span className="font-display text-sm truncate flex-1">
                            {job.seriesTitle}
                          </span>
                          <span className="text-[10px] font-medium opacity-50 shrink-0">
                            {job.format}
                          </span>
                        </div>

                        {job.status === "running" || job.status === "queued" ? (
                          <>
                            <div className="w-full h-1.5 border border-ink/30 rounded-full bg-card overflow-hidden ml-6">
                              <div
                                className="h-full bg-comic-blue transition-all duration-300"
                                style={{ width: `${job.overallProgress}%` }}
                              />
                            </div>
                            <p className="text-[11px] font-medium opacity-60 ml-6">
                              {STAGE_LABELS[job.stages.find((s) => s.status === "active")?.id as JobStage] ?? "Iniciando..."}
                              {" • "}{job.overallProgress}%
                            </p>
                          </>
                        ) : job.status === "completed" ? (
                          <p className="text-[11px] font-medium opacity-60 ml-6">
                            Concluído • {job.completedAt ? formatTimeAgo(job.completedAt) : ""}
                          </p>
                        ) : (
                          <p className="text-[11px] font-medium text-comic-red ml-6">
                            {job.errorMessage || "Erro na conversão"}
                          </p>
                        )}
                      </DropdownMenuItem>
                    ))
                  )}
                </div>

                {/* Footer */}
                {completedCount > 0 && (
                  <>
                    <div className="border-t-2 border-ink/20 px-2 py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearCompleted();
                        }}
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-sm font-medium hover:bg-muted rounded transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 opacity-60" />
                        Limpar histórico
                      </button>
                    </div>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

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
                    <DropdownMenuItem
                      key={n.to}
                      onClick={() => navigate({ to: n.to })}
                      className="lg:hidden"
                    >
                      <Icon className="mr-2 h-4 w-4" /> {n.label}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuItem onClick={() => navigate({ to: "/perfil" })}>
                  <BarChart3 className="mr-2 h-4 w-4" /> Perfil & Estatísticas
                </DropdownMenuItem>
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
