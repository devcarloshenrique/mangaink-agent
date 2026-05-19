import { createFileRoute, Link } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { useBiblioteca } from "@/hooks/useBiblioteca";
import { MonthlyChart } from "@/components/perfil/MonthlyChart";
import { TopReadings } from "@/components/perfil/TopReadings";
import { BarChart3, ArrowLeft, BookOpen, HardDrive, Send } from "lucide-react";

export const Route = createFileRoute("/perfil")({
  component: () => (
    <RequireAuth>
      <PerfilPage />
    </RequireAuth>
  ),
});

function PerfilPage() {
  const { user } = useAuth();
  const { series } = useBiblioteca();

  const totalFiles = series.reduce((s, serie) => s + serie.files.length, 0);
  const totalMB = series.reduce(
    (s, serie) => s + serie.files.reduce((fs, f) => fs + f.bytes, 0),
    0,
  );
  const totalSent = series.reduce((s, serie) => s + serie.files.filter((f) => f.sent).length, 0);

  return (
    <div className="min-h-screen bg-background">
      <ComicHeader />
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1 font-display text-sm underline underline-offset-4 hover:text-comic-red"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full border-[3px] border-ink bg-comic-yellow flex items-center justify-center shadow-comic-sm">
            <span className="font-display text-2xl">
              {user?.username?.[0]?.toUpperCase() ?? "U"}
            </span>
          </div>
          <div>
            <h1 className="font-display text-4xl uppercase leading-none">
              {user?.username ?? "Usuário"}
            </h1>
            <p className="text-sm font-medium opacity-70 mt-1">{user?.kindleEmail ?? ""}</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <ComicPanel bg="card" padding="md" tilt="left">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-5 w-5 text-comic-blue" />
              <span className="font-display text-base">Obras</span>
            </div>
            <p className="font-display text-3xl">{series.length}</p>
            <p className="text-xs font-medium opacity-60">séries na biblioteca</p>
          </ComicPanel>
          <ComicPanel bg="card" padding="md" tilt="right">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="h-5 w-5 text-comic-red" />
              <span className="font-display text-base">Volume</span>
            </div>
            <p className="font-display text-3xl">{totalFiles}</p>
            <p className="text-xs font-medium opacity-60">
              {(totalMB / 1024 / 1024).toFixed(0)} MB total
            </p>
          </ComicPanel>
          <ComicPanel bg="card" padding="md" tilt="left">
            <div className="flex items-center gap-2 mb-2">
              <Send className="h-5 w-5" />
              <span className="font-display text-base">Enviados</span>
            </div>
            <p className="font-display text-3xl">{totalSent}</p>
            <p className="text-xs font-medium opacity-60">arquivos pro Kindle</p>
          </ComicPanel>
        </div>

        {/* Chart */}
        <div>
          <h2 className="font-display text-2xl mb-3 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Conversões por mês
          </h2>
          <ComicPanel bg="card" padding="md">
            <MonthlyChart />
          </ComicPanel>
        </div>

        {/* Top readings */}
        <div>
          <h2 className="font-display text-2xl mb-3">Top 5 mais lidos</h2>
          <ComicPanel bg="card" padding="md">
            <TopReadings />
          </ComicPanel>
        </div>
      </div>
    </div>
  );
}
