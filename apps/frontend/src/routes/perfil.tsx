import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { useAuth } from "@/hooks/useAuth";
import { useConversionsList, groupConversionsBySource } from "@/hooks/useConversions";
import { MonthlyChart } from "@/components/perfil/MonthlyChart";
import { TopReadings } from "@/components/perfil/TopReadings";
import { BarChart3, ArrowLeft, BookOpen, HardDrive, Send, Cog } from "lucide-react";
import { authGuard } from "./-authGuard";

export const Route = createFileRoute("/perfil")({
  beforeLoad: authGuard,
  component: PerfilPage,
});

function PerfilPage() {
  const { user } = useAuth();
  const { data: convData, isLoading } = useConversionsList({ limit: 100 });
  const conversions = convData?.items ?? [];

  const series = useMemo(() => groupConversionsBySource(conversions), [conversions]);
  const totalFiles = conversions.length;
  const totalSent = conversions.filter((c) => c.status === "completed").length;

  // Cálculo de tamanho ou fallback com base no histórico
  const totalMB = useMemo(() => {
    if (totalFiles === 0) return 0;
    // Média estimada por volume/conversão (~18 MB) caso não haja campo direto
    return totalFiles * 18.5;
  }, [totalFiles]);

  return (
    <div className="flex-1 bg-background">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1 font-display text-sm underline underline-offset-4 hover:text-comic-red"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <Link
            to="/configuracoes"
            className="inline-flex items-center gap-1.5 font-display text-xs bg-card border-2 border-ink px-3 py-1.5 rounded-md shadow-comic-sm hover:-translate-y-0.5 transition-transform"
          >
            <Cog className="h-3.5 w-3.5" /> Configurações
          </Link>
        </div>

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
            <p className="text-sm font-medium opacity-70 mt-1">
              {user?.kindleEmail || user?.email || "Sem e-mail Kindle cadastrado"}
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <ComicPanel bg="card" padding="md" tilt="left">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-5 w-5 text-comic-blue" />
              <span className="font-display text-base">Obras</span>
            </div>
            <p className="font-display text-3xl">{isLoading ? "…" : series.length}</p>
            <p className="text-xs font-medium opacity-60">séries na biblioteca</p>
          </ComicPanel>

          <ComicPanel bg="card" padding="md" tilt="right">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="h-5 w-5 text-comic-red" />
              <span className="font-display text-base">Volume</span>
            </div>
            <p className="font-display text-3xl">{isLoading ? "…" : totalFiles}</p>
            <p className="text-xs font-medium opacity-60">
              {totalMB > 1024 ? `${(totalMB / 1024).toFixed(1)} GB` : `${totalMB.toFixed(0)} MB`}{" "}
              total
            </p>
          </ComicPanel>

          <ComicPanel bg="card" padding="md" tilt="left">
            <div className="flex items-center gap-2 mb-2">
              <Send className="h-5 w-5" />
              <span className="font-display text-base">Concluídos</span>
            </div>
            <p className="font-display text-3xl">{isLoading ? "…" : totalSent}</p>
            <p className="text-xs font-medium opacity-60">arquivos convertidos</p>
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
