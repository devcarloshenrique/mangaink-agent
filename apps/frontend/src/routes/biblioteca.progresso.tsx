import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileArchive,
  Loader2,
  Send,
  Terminal,
  Zap,
} from "lucide-react";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { OnomatopoeiaBadge } from "@/components/comic/OnomatopoeiaBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import { getMockConversionRequest } from "@/lib/mock-add-manga";

export const Route = createFileRoute("/biblioteca/progresso")({
  component: MockProgressPage,
});

type StageId = "downloading" | "converting" | "generating" | "finishing";
type StageStatus = "pending" | "active" | "completed";

const STAGES: { id: StageId; label: string; onomatopoeia: string; icon: React.ReactNode }[] = [
  {
    id: "downloading",
    label: "Baixando capitulos",
    onomatopoeia: "SWOOSH!",
    icon: <Download className="h-5 w-5" />,
  },
  {
    id: "converting",
    label: "Processando paginas",
    onomatopoeia: "CRUNCH!",
    icon: <FileArchive className="h-5 w-5" />,
  },
  {
    id: "generating",
    label: "Gerando EPUB",
    onomatopoeia: "POW!",
    icon: <Zap className="h-5 w-5" />,
  },
  {
    id: "finishing",
    label: "Salvando na biblioteca",
    onomatopoeia: "TA-DA!",
    icon: <Send className="h-5 w-5" />,
  },
];

interface LogEntry {
  timestamp: number;
  type: "info" | "cache" | "progress" | "warn";
  message: string;
}

function MockProgressPage() {
  const navigate = useNavigate();
  const request = useMemo(() => getMockConversionRequest(), []);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [progress, setProgress] = useState<Record<StageId, number>>({
    downloading: 0,
    converting: 0,
    generating: 0,
    finishing: 0,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cancelled, setCancelled] = useState(false);
  const [chapterIndex, setChapterIndex] = useState(0);
  const cancelledRef = useRef(false);

  const totalChapters = request.chapters.length;

  // Simulacao mockada do progresso
  useEffect(() => {
    let stage = 0;
    const speeds: Record<StageId, number> = {
      downloading: 1.6,
      converting: 2.4,
      generating: 3.2,
      finishing: 5,
    };

    const timer = setInterval(() => {
      if (cancelledRef.current) return;
      setProgress((prev) => {
        const current = STAGES[stage];
        if (!current) return prev;
        const value = Math.min(100, prev[current.id] + speeds[current.id]);
        const next = { ...prev, [current.id]: value };
        if (value >= 100 && stage < STAGES.length - 1) stage += 1;
        return next;
      });
    }, 90);

    return () => clearInterval(timer);
  }, []);

  // Capitulo atual + logs mockados
  useEffect(() => {
    const idx = Math.min(
      totalChapters - 1,
      Math.floor((progress.downloading / 100) * totalChapters),
    );
    setChapterIndex(idx);
  }, [progress.downloading, totalChapters]);

  useEffect(() => {
    if (cancelled) return;
    const timer = setInterval(() => {
      setLogs((prev) => {
        const chapter = request.chapters[Math.min(chapterIndex, totalChapters - 1)];
        const pool: LogEntry[] = [
          {
            timestamp: Date.now(),
            type: "info",
            message: `Cap. ${chapter?.number} — ${chapter?.title}`,
          },
          {
            timestamp: Date.now(),
            type: "progress",
            message: `Baixando pagina ${1 + (prev.length % (chapter?.pages ?? 20))}/${chapter?.pages ?? 20}`,
          },
          { timestamp: Date.now(), type: "cache", message: "Imagem recuperada do cache local" },
          {
            timestamp: Date.now(),
            type: "warn",
            message: "Pagina de baixa resolucao — upscale aplicado",
          },
        ];
        const entry = pool[prev.length % pool.length];
        return [...prev.slice(-60), entry];
      });
    }, 700);
    return () => clearInterval(timer);
  }, [cancelled, chapterIndex, request.chapters, totalChapters]);

  const stages = STAGES.map((s, i) => {
    const value = Math.round(progress[s.id]);
    let status: StageStatus = "pending";
    if (value >= 100) status = "completed";
    else if (value > 0 || (i > 0 && progress[STAGES[i - 1].id] >= 100)) status = "active";
    return { ...s, progress: value, status };
  });

  const overall = Math.round(stages.reduce((sum, s) => sum + s.progress, 0) / stages.length);
  const activeStage = stages.find((s) => s.status === "active");
  const completedCount = stages.filter((s) => s.status === "completed").length;
  const isDone = overall >= 100;
  const isProcessing = !isDone && !cancelled;
  const currentChapter = request.chapters[chapterIndex];

  return (
    <div className="flex-1 bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <button
          type="button"
          onClick={() => navigate({ to: "/biblioteca" })}
          className="inline-flex items-center gap-1 font-display text-sm mb-6 underline underline-offset-4 hover:text-comic-red cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        {/* Header */}
        <div className="flex items-start gap-5 mb-8">
          <div className="h-28 w-20 border-[3px] border-ink rounded shadow-comic-sm shrink-0 overflow-hidden bg-muted">
            <img
              src={request.cover}
              alt={`Capa de ${request.mangaTitle}`}
              width={640}
              height={960}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-3xl md:text-4xl uppercase leading-none">
                {request.mangaTitle}
              </h1>
              {isDone && (
                <OnomatopoeiaBadge variant="blue" size="md">
                  DONE!
                </OnomatopoeiaBadge>
              )}
              {cancelled && (
                <OnomatopoeiaBadge variant="red" size="md">
                  CANCELADO
                </OnomatopoeiaBadge>
              )}
              {isProcessing && activeStage && (
                <OnomatopoeiaBadge variant="yellow" size="md">
                  {activeStage.onomatopoeia}
                </OnomatopoeiaBadge>
              )}
            </div>
            <p className="text-sm font-medium opacity-70 mt-1">
              {request.author} • {request.format} • {totalChapters} capitulos
            </p>
          </div>
        </div>

        {/* Progresso geral */}
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
              </Button>
            </div>
            <p className="font-display text-2xl">{overall}%</p>
          </div>
          <div className="h-4 w-full border-[3px] border-ink rounded-full bg-card overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300",
                cancelled ? "bg-comic-red" : isDone ? "bg-comic-blue" : "bg-comic-yellow",
              )}
              style={{ width: `${overall}%` }}
            />
          </div>
          <p className="text-xs font-medium opacity-60 mt-2">
            {cancelled
              ? "Conversao cancelada."
              : isDone
                ? "Conversao concluida com sucesso!"
                : `${completedCount} de ${stages.length} etapas concluidas`}
          </p>
        </ComicPanel>

        {isProcessing && activeStage && (
          <SpeechBubble variant="yellow" tail="left" className="mb-6 max-w-lg">
            {activeStage.id === "downloading" && currentChapter
              ? `Baixando cap. ${currentChapter.number} — ${currentChapter.title} (${chapterIndex + 1}/${totalChapters})`
              : `${activeStage.label}…`}
          </SpeechBubble>
        )}

        {/* Etapas */}
        <div className="space-y-3 mb-8">
          {stages.map((stage, i) => (
            <div
              key={stage.id}
              className={cn(
                "flex items-center gap-4 border-[3px] rounded-lg p-4 transition-all",
                stage.status === "completed"
                  ? "bg-comic-blue/15 border-comic-blue"
                  : stage.status === "active"
                    ? "bg-comic-yellow border-comic-blue"
                    : "bg-card border-ink opacity-60",
              )}
            >
              <div className="shrink-0">
                {stage.status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 text-comic-blue" />
                ) : stage.status === "active" ? (
                  <Loader2 className="h-5 w-5 text-comic-blue animate-spin" />
                ) : (
                  <Clock className="h-5 w-5 opacity-40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-lg flex items-center gap-2">
                    {stage.icon} {stage.label}
                  </p>
                  <span className="font-display text-sm shrink-0">
                    {stage.status === "pending" ? "Aguardando" : `${stage.progress}%`}
                  </span>
                </div>
                {stage.status === "active" && (
                  <div className="h-2 w-full border-2 border-ink rounded-full bg-card overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-comic-blue transition-all duration-200"
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

        {/* Capitulos da fila */}
        <ComicPanel bg="card" padding="md" className="mb-8">
          <p className="font-display text-xl mb-3">Fila de capitulos</p>
          <div className="scrollbar-comic max-h-[240px] overflow-y-auto">
            {request.chapters.map((ch, i) => {
              const done = isDone || i < chapterIndex;
              const active = !isDone && i === chapterIndex && !cancelled;
              return (
                <div
                  key={ch.id}
                  className={cn(
                    "flex items-center gap-3 py-2.5",
                    i < request.chapters.length - 1 && "border-b-2 border-dashed border-ink/20",
                  )}
                >
                  <span className="shrink-0 font-display text-base bg-comic-yellow border-[2px] border-ink rounded-md px-2 min-w-[2.5rem] text-center">
                    {ch.number}
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-medium truncate">{ch.title}</span>
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-comic-blue shrink-0" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin text-comic-blue shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 opacity-30 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </ComicPanel>

        {/* Acoes */}
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <button
            type="button"
            onClick={() => navigate({ to: "/biblioteca" })}
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
            {isProcessing && (
              <Button
                variant="outline"
                onClick={() => {
                  cancelledRef.current = true;
                  setCancelled(true);
                }}
                className="border-[3px] border-ink shadow-comic-sm font-display text-destructive hover:text-destructive"
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Terminal */}
      <Dialog open={terminalOpen} onOpenChange={setTerminalOpen}>
        <DialogContent className="border-[3px] border-ink shadow-comic-lg max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Terminal className="h-5 w-5" /> Terminal
            <span className="text-sm font-medium opacity-50 font-sans">
              ({logs.length} eventos)
            </span>
          </DialogTitle>
          <div className="scrollbar-comic flex-1 overflow-y-auto rounded-md border-[2px] border-ink bg-comic-ink text-comic-cream p-3 font-mono text-xs space-y-0.5 mt-4">
            {logs.length === 0 ? (
              <p className="opacity-50">Nenhum evento ainda…</p>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-2",
                    log.type === "warn"
                      ? "text-yellow-400"
                      : log.type === "cache"
                        ? "text-comic-blue"
                        : log.type === "progress"
                          ? "text-comic-yellow"
                          : "opacity-70",
                  )}
                >
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
