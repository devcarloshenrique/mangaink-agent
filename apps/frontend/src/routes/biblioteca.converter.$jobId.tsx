import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useConversion } from "@/hooks/useConversion";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { OnomatopoeiaBadge } from "@/components/comic/OnomatopoeiaBadge";
import { Button } from "@/components/ui/button";
import { Toaster } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  AlertTriangle,
  Clock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_MESSAGES, STAGE_ONOMATOPOEIA } from "@/lib/conversion-job";
import type { JobStage } from "@/lib/conversion-job";

export const Route = createFileRoute("/biblioteca/converter/$jobId")({
  component: ConverterPage,
});

function stageIcon(stageId: JobStage, status: string) {
  if (status === "completed") return <CheckCircle2 className="h-5 w-5 text-comic-blue" />;
  if (status === "active") return <Loader2 className="h-5 w-5 text-comic-blue animate-spin" />;
  if (status === "error") return <AlertTriangle className="h-5 w-5 text-comic-red" />;
  return <Clock className="h-5 w-5 opacity-40" />;
}

function stageBg(status: string) {
  switch (status) {
    case "completed":
      return "bg-comic-blue/15 border-comic-blue";
    case "active":
      return "bg-comic-yellow border-comic-blue";
    case "error":
      return "bg-comic-red/15 border-comic-red";
    default:
      return "bg-card opacity-60";
  }
}

function ConverterPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const { getJob, cancelJob } = useConversion();
  const job = getJob(jobId);

  if (!job) {
    return (
      <div className="min-h-screen bg-background">
        <ComicHeader />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="font-display text-4xl uppercase mb-4">Conversão não encontrada</h1>
          <p className="text-sm font-medium opacity-70 mb-6">
            Esse trabalho pode ter sido removido ou o link está incorreto.
          </p>
          <Link
            to="/biblioteca"
            className="inline-flex items-center gap-1 font-display text-lg border-[3px] border-ink bg-comic-yellow px-4 py-2 rounded-md shadow-comic-sm hover:-translate-y-0.5 transition-transform"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para a biblioteca
          </Link>
        </div>
      </div>
    );
  }

  const activeStage = job.stages.find((s) => s.status === "active");
  const completedCount = job.stages.filter((s) => s.status === "completed").length;
  const isDone = job.status === "completed";
  const isError = job.status === "error";

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <ComicHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          to="/biblioteca"
          className="inline-flex items-center gap-1 font-display text-sm mb-6 underline underline-offset-4 hover:text-comic-red"
        >
          <ArrowLeft className="h-4 w-4" /> Biblioteca
        </Link>

        {/* Header */}
        <div className="flex items-start gap-5 mb-8">
          <div
            className="h-20 w-14 border-[3px] border-ink rounded shadow-comic-sm shrink-0"
            style={{ background: `hsl(${job.seriesHue} 70% 55%)` }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-3xl md:text-4xl uppercase leading-none truncate">
                {job.seriesTitle}
              </h1>
              {isDone && (
                <OnomatopoeiaBadge variant="blue" size="md">
                  DONE!
                </OnomatopoeiaBadge>
              )}
              {isError && (
                <OnomatopoeiaBadge variant="red" size="md">
                  ERRO!
                </OnomatopoeiaBadge>
              )}
              {!isDone && !isError && activeStage && (
                <OnomatopoeiaBadge variant="yellow" size="md">
                  {STAGE_ONOMATOPOEIA[activeStage.id]}
                </OnomatopoeiaBadge>
              )}
            </div>
            <p className="text-sm font-medium opacity-70 mt-1">
              {job.format} • {job.totalChapters} capítulos • {job.totalPages} páginas
              {job.delivery === "kindle" && job.kindleEmail && ` • ${job.kindleEmail}`}
            </p>
          </div>
        </div>

        {/* Overall progress */}
        <ComicPanel bg="card" padding="md" className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display text-xl">Progresso geral</p>
            <p className="font-display text-2xl">{job.overallProgress}%</p>
          </div>
          <div className="h-4 w-full border-[3px] border-ink rounded-full bg-card overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500",
                isDone ? "bg-comic-blue" : isError ? "bg-comic-red" : "bg-comic-yellow",
              )}
              style={{ width: `${job.overallProgress}%` }}
            />
          </div>
          <p className="text-xs font-medium opacity-60 mt-2">
            {isDone
              ? "Conversão concluída com sucesso!"
              : isError
                ? job.errorMessage || "Ocorreu um erro na conversão."
                : `${completedCount} de ${job.stages.length} etapas concluídas`}
          </p>
        </ComicPanel>

        {/* Active stage message */}
        {activeStage && (
          <SpeechBubble variant="yellow" tail="left" className="mb-6 max-w-lg">
            {STAGE_MESSAGES[activeStage.id]}
          </SpeechBubble>
        )}

        {/* Stages */}
        <div className="space-y-3 mb-8">
          {job.stages.map((stage, i) => (
            <div
              key={stage.id}
              className={cn(
                "flex items-center gap-4 border-[3px] rounded-lg p-4 transition-all",
                stageBg(stage.status),
              )}
            >
              <div className="shrink-0">{stageIcon(stage.id, stage.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-lg">{stage.label}</p>
                  <span className="font-display text-sm shrink-0">
                    {stage.status === "completed"
                      ? "100%"
                      : stage.status === "active"
                        ? `${stage.progress}%`
                        : stage.status === "error"
                          ? "Erro"
                          : "Aguardando"}
                  </span>
                </div>
                {stage.status === "active" && (
                  <div className="h-2 w-full border-2 border-ink rounded-full bg-card overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-comic-blue transition-all duration-300"
                      style={{ width: `${stage.progress}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="font-display text-xs opacity-50 shrink-0 hidden sm:block">
                Etapa {i + 1}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <Link
            to="/biblioteca"
            className="inline-flex items-center gap-1.5 font-display text-sm border-[3px] border-ink bg-card px-4 py-2 rounded-md shadow-comic-sm hover:-translate-y-0.5 transition-transform"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para biblioteca
          </Link>

          <div className="flex gap-3">
            {isDone && (
              <Button
                onClick={() =>
                  navigate({ to: "/biblioteca/$slug", params: { slug: job.seriesSlug } })
                }
                className="bg-comic-blue text-accent-foreground hover:bg-comic-blue border-[3px] border-ink shadow-comic font-display"
              >
                <Zap className="h-4 w-4 mr-1.5" /> Ver na biblioteca
              </Button>
            )}

            {isError && (
              <Button
                onClick={() => navigate({ to: "/wizard" })}
                className="bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display"
              >
                <Download className="h-4 w-4 mr-1.5" /> Tentar novamente
              </Button>
            )}

            {!isDone && !isError && (
              <Button
                variant="outline"
                onClick={() => {
                  cancelJob(job.id);
                  navigate({ to: "/biblioteca" });
                }}
                className="border-[3px] border-ink shadow-comic-sm font-display text-destructive hover:text-destructive"
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
