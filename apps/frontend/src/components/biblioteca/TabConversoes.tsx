import { Link } from "@tanstack/react-router";
import { Loader2, BookOpen, FileText, ScrollText, XCircle, Trash2 } from "lucide-react";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/utils";
import { conversionsApi } from "@/lib/api";
import { useConversionsList } from "@/hooks/useConversions";
import { useConversionActions } from "@/hooks/useConversionActions";
import type { ConversionStatus } from "@/types/conversion";

interface TabConversoesProps {
  sourceId: string;
}

function statusLabel(s: ConversionStatus): string {
  const map: Record<ConversionStatus, string> = {
    queued: "Na fila",
    processing: "Convertendo",
    completed: "Concluido",
    failed: "Erro",
    cancelled: "Cancelado",
    partial: "Parcial",
  };
  return map[s] ?? s;
}

function coverUrl(sourceId: string, cover?: { kind: string; coverId?: string }): string | null {
  return conversionsApi.coverUrl(sourceId, cover ?? { kind: "original" });
}

export function TabConversoes({ sourceId }: TabConversoesProps) {
  const { data, isLoading } = useConversionsList({ sourceId, limit: 50 });
  const { cancel, remove, download, reconvert: _reconvert } = useConversionActions();

  const conversions = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-comic-blue" />
      </div>
    );
  }

  if (conversions.length === 0) {
    return (
      <SpeechBubble variant="yellow" tail="left">
        Nenhuma conversao encontrada.
      </SpeechBubble>
    );
  }

  return (
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
                    src={
                      coverUrl(conv.sourceId, conv.cover as { kind: string; coverId?: string }) ??
                      ""
                    }
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
                    <FileText className="h-3.5 w-3.5" /> {conv.completedJobs}/{conv.totalJobs} jobs
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
                  title="Ver log de conversao"
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
  );
}
