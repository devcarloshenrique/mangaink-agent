import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  useConversionProgress,
  formatChapterId,
  type StageId,
  type StageStatus,
  STAGE_LABELS,
  STAGE_MESSAGES,
  STAGE_ONOMATOPOEIA,
  type LogEntry,
  type CorruptPageEntry,
} from "@/hooks/useConversionProgress";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { OnomatopoeiaBadge } from "@/components/comic/OnomatopoeiaBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Toaster } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  AlertTriangle,
  Clock,
  Zap,
  Terminal,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authGuard } from "./-authGuard";

export const Route = createFileRoute("/biblioteca/converter/$jobId")({
  beforeLoad: authGuard,
  component: ConverterPage,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const stageIcons: Record<StageId, React.ReactNode> = {
  downloading: <Download className="h-5 w-5" />,
  converting: <SettingsIcon className="h-5 w-5" />,
};

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function stageIcon(status: StageStatus) {
  if (status === "completed") return <CheckCircle2 className="h-5 w-5 text-comic-blue" />;
  if (status === "active") return <Loader2 className="h-5 w-5 text-comic-blue animate-spin" />;
  return <Clock className="h-5 w-5 opacity-40" />;
}

function stageBg(status: StageStatus) {
  switch (status) {
    case "completed":
      return "bg-comic-blue/15 border-comic-blue";
    case "active":
      return "bg-comic-yellow border-comic-blue";
    default:
      return "bg-card opacity-60";
  }
}

function stageProgressLabel(status: StageStatus, progress: number) {
  if (status === "completed") return "100%";
  if (status === "active") return `${progress}%`;
  return "Aguardando";
}

function logColor(type: LogEntry["type"]) {
  switch (type) {
    case "error":
      return "text-comic-red";
    case "warn":
      return "text-yellow-600 dark:text-yellow-400";
    case "cache":
      return "text-comic-blue";
    case "progress":
      return "text-comic-yellow";
    default:
      return "opacity-70";
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

function ConverterPage() {
  const { jobId: conversionId } = Route.useParams();
  const navigate = useNavigate();
  const [terminalOpen, setTerminalOpen] = useState(false);
  const {
    state,
    stages,
    overallProgress,
    currentChapter,
    logs,
    corruptPages,
    isLoading,
    error,
    cancel,
  } = useConversionProgress(conversionId);

  // ── Loading ─────────────────────────────────────────────────────────────
  if (isLoading && !state) {
    return (
      <div className="min-h-screen bg-background">
        <ComicHeader />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-comic-blue" />
          <p className="font-display text-xl">Carregando conversão…</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (error && !state) {
    return (
      <div className="min-h-screen bg-background">
        <ComicHeader />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="font-display text-4xl uppercase mb-4">Conversão não encontrada</h1>
          <p className="text-sm font-medium opacity-70 mb-6">{error}</p>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1 font-display text-lg border-[3px] border-ink bg-comic-yellow px-4 py-2 rounded-md shadow-comic-sm hover:-translate-y-0.5 transition-transform"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        </div>
      </div>
    );
  }

  if (!state) return null;

  const isDone = state.status === "completed" || state.status === "partial";
  const isFailed = state.status === "failed";
  const isCancelled = state.status === "cancelled";
  const isProcessing = !isDone && !isFailed && !isCancelled;

  const activeStage = stages.find((s) => s.status === "active");
  const completedCount = stages.filter((s) => s.status === "completed").length;
  const totalStages = stages.length;
  const errorCount = logs.filter((l) => l.type === "error").length;

  const title =
    (state.config as { metadata?: { title?: string } })?.metadata?.title ??
    `Conversão ${conversionId.slice(0, 8)}`;
  const format = (state.config as { output?: { format?: string } })?.output?.format ?? "";

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <ComicHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1 font-display text-sm mb-6 underline underline-offset-4 hover:text-comic-red cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        {/* Header */}
        <div className="flex items-start gap-5 mb-8">
          <div
            className="h-20 w-14 border-[3px] border-ink rounded shadow-comic-sm shrink-0"
            style={{ background: `hsl(${(title.length * 37) % 360} 70% 55%)` }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-3xl md:text-4xl uppercase leading-none truncate">
                {title}
              </h1>
              {currentChapter?.fromCache && (
                <OnomatopoeiaBadge variant="blue" size="sm">
                  <Database className="h-3 w-3 mr-1" /> Cache
                </OnomatopoeiaBadge>
              )}
              {isDone && (
                <OnomatopoeiaBadge variant="blue" size="md">
                  DONE!
                </OnomatopoeiaBadge>
              )}
              {isFailed && (
                <OnomatopoeiaBadge variant="red" size="md">
                  ERRO!
                </OnomatopoeiaBadge>
              )}
              {isProcessing && activeStage && (
                <OnomatopoeiaBadge variant="yellow" size="md">
                  {STAGE_ONOMATOPOEIA[activeStage.id]}
                </OnomatopoeiaBadge>
              )}
            </div>
            <p className="text-sm font-medium opacity-70 mt-1">
              {format && `${format} • `}
              {state.jobs.length === 1 ? "Arquivo único" : `${state.jobs.length} volumes`}
            </p>
          </div>
        </div>

        {/* Overall progress */}
        <ComicPanel bg="card" padding="md" className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="font-display text-xl">Progresso geral</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTerminalOpen(true)}
                className="border-[2px] border-ink shadow-comic-sm font-display h-7 px-2 text-xs"
              >
                <Terminal className="h-3 w-3 mr-1" /> Logs
                {errorCount > 0 && (
                  <span className="ml-1 h-3.5 min-w-3.5 flex items-center justify-center rounded-full bg-comic-red px-0.5 text-[9px] font-bold text-primary-foreground">
                    {errorCount}
                  </span>
                )}
              </Button>
            </div>
            <p className="font-display text-2xl">{overallProgress}%</p>
          </div>
          <div className="h-4 w-full border-[3px] border-ink rounded-full bg-card overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500",
                isDone ? "bg-comic-blue" : isFailed ? "bg-comic-red" : "bg-comic-yellow",
              )}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="text-xs font-medium opacity-60 mt-2">
            {isDone
              ? "Conversão concluída com sucesso!"
              : isFailed
                ? state.error || "Ocorreu um erro na conversão."
                : isCancelled
                  ? "Conversão cancelada."
                  : `${completedCount} de ${totalStages} etapas concluídas`}
          </p>
        </ComicPanel>

        {/* Active stage message + chapter detail */}
        {isProcessing && (
          <div className="mb-6 space-y-2">
            {activeStage && (
              <SpeechBubble variant="yellow" tail="left" className="max-w-lg">
                {activeStage.id === "downloading" && currentChapter
                  ? `Baixando ${formatChapterId(currentChapter.chapterId)} — ${currentChapter.currentImage}/${currentChapter.totalImages} imagens`
                  : STAGE_MESSAGES[activeStage.id]}
              </SpeechBubble>
            )}
          </div>
        )}

        {/* Corrupt pages warning */}
        {corruptPages.length > 0 && (
          <ComicPanel bg="yellow" padding="md" className="mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
              <div className="flex-1 min-w-0">
                <p className="font-display text-base">
                  {corruptPages.length} página{corruptPages.length > 1 ? "s" : ""} corrompida
                  {corruptPages.length > 1 ? "s" : ""} detectada{corruptPages.length > 1 ? "s" : ""}
                </p>
                <p className="text-xs font-medium opacity-80 mt-0.5">
                  Substituída{corruptPages.length > 1 ? "s" : ""} por placeholder para evitar falha
                  no KCC.
                </p>
                <button
                  className="text-xs font-display underline mt-1.5 hover:opacity-70"
                  onClick={() => setTerminalOpen(true)}
                >
                  Ver log para detalhes
                </button>
              </div>
            </div>
          </ComicPanel>
        )}

        {/* Stages */}
        <div className="space-y-3 mb-8">
          {stages.map((stage, i) => (
            <div
              key={stage.id}
              className={cn(
                "flex items-center gap-4 border-[3px] rounded-lg p-4 transition-all",
                stageBg(stage.status),
              )}
            >
              <div className="shrink-0">{stageIcon(stage.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-lg">
                    {stage.id === "downloading" && stage.status === "active"
                      ? `${STAGE_LABELS[stage.id]} (${stage.progress}%)`
                      : STAGE_LABELS[stage.id]}
                  </p>
                  <span className="font-display text-sm shrink-0">
                    {stageProgressLabel(stage.status, stage.progress)}
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
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 font-display text-sm border-[3px] border-ink bg-card px-4 py-2 rounded-md shadow-comic-sm hover:-translate-y-0.5 transition-transform"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>

          <div className="flex gap-3">
            {isDone && (
              <Button
                onClick={() => navigate({ to: "/biblioteca" })}
                className="bg-comic-blue text-accent-foreground hover:bg-comic-blue border-[3px] border-ink shadow-comic font-display"
              >
                <Zap className="h-4 w-4 mr-1.5" /> Ver na biblioteca
              </Button>
            )}

            {(isFailed || isCancelled) && (
              <Button
                onClick={() => navigate({ to: "/wizard" })}
                className="bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display"
              >
                Tentar novamente
              </Button>
            )}

            {isProcessing && (
              <Button
                variant="outline"
                onClick={async () => {
                  await cancel();
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

      {/* Terminal Logs Dialog */}
      <Dialog open={terminalOpen} onOpenChange={setTerminalOpen}>
        <DialogContent className="border-[3px] border-ink shadow-comic-lg max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Terminal className="h-5 w-5" /> Terminal
            <span className="text-sm font-medium opacity-50 font-sans">
              ({logs.length} evento{logs.length !== 1 ? "s" : ""})
            </span>
          </DialogTitle>
          <div className="flex-1 overflow-y-auto rounded-md border-[2px] border-ink bg-comic-ink text-comic-cream p-3 font-mono text-xs space-y-0.5 mt-4">
            {logs.length === 0 ? (
              <p className="opacity-50">Nenhum evento ainda…</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={cn("flex gap-2", logColor(log.type))}>
                  <span className="shrink-0 opacity-50">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="shrink-0 font-bold w-14 text-right">
                    {log.type.toUpperCase()}
                  </span>
                  <span>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
