import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { Button } from "@/components/ui/button";
import { Toaster } from "sonner";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Trash2,
  XCircle,
  Loader2,
  FileText,
  BookOpen,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { conversionsApi } from "@/lib/api";
import { useConversionsList } from "@/hooks/useConversions";
import { useConversionActions } from "@/hooks/useConversionActions";
import type { ConversionState, ConversionStatus, JobSummary } from "@/types/conversion";

export const Route = createFileRoute("/biblioteca/$sourceId")({
  component: SourceDetailPage,
});

function statusLabel(s: ConversionStatus): string {
  const map: Record<ConversionStatus, string> = {
    queued: "Na fila",
    processing: "Convertendo",
    completed: "Concluído",
    failed: "Erro",
    cancelled: "Cancelado",
    partial: "Parcial",
  };
  return map[s] ?? s;
}

function statusColor(s: ConversionStatus): string {
  if (s === "completed") return "bg-comic-blue";
  if (s === "queued" || s === "processing") return "bg-comic-yellow animate-pulse";
  if (s === "failed" || s === "cancelled") return "bg-comic-red";
  if (s === "partial") return "bg-comic-yellow";
  return "bg-muted";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function coverUrl(sourceId: string, cover?: { kind: string; coverId?: string }): string | null {
  return conversionsApi.coverUrl(sourceId, cover ?? { kind: "original" });
}

function SourceDetailPage() {
  const { sourceId } = Route.useParams();
  const { data, isLoading } = useConversionsList({ sourceId, limit: 50 });
  const { cancel, remove, download, reconvert } = useConversionActions();

  const conversions = data?.items ?? [];
  const seriesTitle = conversions[0]?.title ?? sourceId;

  const hasActive = conversions.some((c) => c.status === "queued" || c.status === "processing");

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <ComicHeader />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="h-10 w-10 border-[3px] border-ink rounded-lg bg-comic-yellow flex items-center justify-center shadow-comic-sm hover:-translate-y-0.5 transition-transform"
          >
            <ArrowLeft />
          </button>
          <div>
            <h1 className="font-display text-3xl uppercase leading-none truncate">{seriesTitle}</h1>
            <p className="text-sm font-medium opacity-70 mt-1">
              {conversions.length} conversão(ões) •{" "}
              {hasActive && <Loader2 className="h-3 w-3 inline animate-spin" />}
            </p>
          </div>
          <div className="flex gap-2 ml-auto">
            {conversions.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="border-[2px] border-ink shadow-comic-sm"
                onClick={() => {
                  const last = conversions[0];
                  reconvert(last.conversionId);
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" /> Reconverter
              </Button>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-16">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-comic-blue" />
          </div>
        )}

        {!isLoading && conversions.length === 0 && (
          <SpeechBubble variant="yellow" tail="left" className="max-w-md">
            Nenhuma conversão encontrada.
          </SpeechBubble>
        )}

        {!isLoading && conversions.length > 0 && (
          <div className="space-y-4">
            {conversions.map((conv) => (
              <Link
                key={conv.conversionId}
                to={
                  conv.status === "completed"
                    ? "/biblioteca/reader/$conversionId"
                    : "/biblioteca/converter/$jobId"
                }
                params={
                  conv.status === "completed"
                    ? { conversionId: conv.conversionId }
                    : { jobId: conv.conversionId }
                }
                className="block"
              >
                <ComicPanel
                  bg="card"
                  padding="md"
                  tilt="none"
                  className="relative group hover:-translate-y-0.5 transition-transform cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-20 w-14 shrink-0 border-[3px] border-ink rounded shadow-comic-sm overflow-hidden bg-muted">
                      {conv.cover ? (
                        <img
                          src={coverUrl(conv.sourceId, conv.cover as any) ?? ""}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <BookOpen className="h-5 w-5 opacity-30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display text-lg truncate">
                          {conv.title || conv.conversionId}
                        </h3>
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 border-2 border-ink rounded-full",
                            conv.status === "completed" ? "bg-comic-blue text-white" : "bg-muted",
                          )}
                        >
                          {statusLabel(conv.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" /> {conv.completedJobs}/{conv.totalJobs}{" "}
                          jobs
                        </span>
                        <span>{conv.progress}%</span>
                        <span>{relativeTime(conv.updatedAt)}</span>
                      </div>
                    </div>
                    <div
                      className="shrink-0 flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link
                        to="/biblioteca/converter/$jobId"
                        params={{ jobId: conv.conversionId }}
                        className="inline-flex items-center justify-center border-[2px] border-ink shadow-comic-sm h-8 px-2 rounded-md bg-card hover:bg-muted"
                        title="Ver log de conversão"
                      >
                        <ScrollText className="h-4 w-4" />
                      </Link>
                      {(conv.status === "queued" || conv.status === "processing") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[2px] border-ink shadow-comic-sm h-8 px-2"
                          onClick={() => cancel(conv.conversionId)}
                          title="Cancelar"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[2px] border-ink shadow-comic-sm h-8 px-2"
                        onClick={() => remove(conv.conversionId)}
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </ComicPanel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
