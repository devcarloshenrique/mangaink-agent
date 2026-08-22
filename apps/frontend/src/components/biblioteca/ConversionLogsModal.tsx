import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { conversionsApi } from "@/lib/api";
import type { SSEJournalEvent } from "@/types/conversion";
import {
  Loader2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  X,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversionLogsModalProps {
  conversionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotTitle?: string;
}

function getEventBadge(type: string) {
  if (type.includes("failed") || type.includes("error") || type.includes("corrupt")) {
    return {
      label: "ERRO",
      icon: AlertTriangle,
      className: "bg-comic-red text-white border-ink",
    };
  }
  if (type.includes("finished") || type.includes("done") || type.includes("completed")) {
    return {
      label: "SUCESSO",
      icon: CheckCircle2,
      className: "bg-comic-blue text-white border-ink",
    };
  }
  if (type.includes("progress")) {
    return {
      label: "PROGRESSO",
      icon: RefreshCw,
      className: "bg-comic-yellow text-ink border-ink",
    };
  }
  if (type.includes("started")) {
    return {
      label: "INICIADO",
      icon: Clock,
      className: "bg-muted text-ink/80 border-ink",
    };
  }
  return {
    label: "INFO",
    icon: FileText,
    className: "bg-card text-muted-foreground border-ink",
  };
}

function formatLogTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
}

function extractLogMessage(ev: SSEJournalEvent): string {
  const data = ev.data ?? {};
  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;
  if (typeof data.stage === "string") {
    const pct = data.progress != null ? ` (${Math.round(Number(data.progress))}%)` : "";
    return `${data.stage}${pct}`;
  }
  if (ev.type === "download.progress") {
    const pct = data.progress != null ? `${Math.round(Number(data.progress))}%` : "";
    const ch = data.chapter ? `Capítulo ${data.chapter}` : "";
    return `Baixando ${ch} ${pct}`.trim();
  }
  if (ev.type === "conversion.progress") {
    const pct = data.progress != null ? `${Math.round(Number(data.progress))}%` : "";
    return `Convertendo ${pct}`.trim();
  }
  return JSON.stringify(data);
}

export function ConversionLogsModal({
  conversionId,
  open,
  onOpenChange,
  lotTitle,
}: ConversionLogsModalProps) {
  const [search, setSearch] = useState("");

  const {
    data: logs,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<SSEJournalEvent[]>({
    queryKey: ["conversion-logs", conversionId],
    queryFn: () => conversionsApi.getLogs(conversionId!),
    enabled: !!conversionId && open,
    refetchInterval: (query) => {
      if (!open) return false;
      const data = query.state.data;
      if (data && data.length > 0) {
        const lastEv = data[data.length - 1];
        if (
          lastEv.type === "conversion.completed" ||
          lastEv.type === "conversion.failed" ||
          lastEv.type === "conversion.cancelled"
        ) {
          return false;
        }
      }
      return 3000;
    },
  });

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    if (!search.trim()) return logs;
    const q = search.toLowerCase().trim();
    return logs.filter(
      (ev) =>
        ev.type.toLowerCase().includes(q) ||
        extractLogMessage(ev).toLowerCase().includes(q) ||
        JSON.stringify(ev.data).toLowerCase().includes(q),
    );
  }, [logs, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[3px] border-ink shadow-comic max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-card">
        <DialogHeader className="px-6 pt-5 pb-3 border-b-2 border-ink/15 bg-muted/40">
          <div className="flex items-center justify-between gap-2 pr-6">
            <div>
              <DialogTitle className="font-display text-xl uppercase tracking-wide flex items-center gap-2">
                <FileText className="h-5 w-5 text-comic-blue" />
                Logs da Conversão
              </DialogTitle>
              {lotTitle && (
                <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                  {lotTitle} {conversionId ? `· ID: ${conversionId}` : ""}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className="inline-flex items-center gap-1 text-xs font-bold border-2 border-ink rounded-md px-2 py-1 bg-card hover:bg-muted shadow-comic-sm transition-transform active:scale-95 disabled:opacity-50"
              title="Atualizar logs"
            >
              <RefreshCw className={cn("h-3 w-3", (isLoading || isRefetching) && "animate-spin")} />
              Atualizar
            </button>
          </div>
        </DialogHeader>

        {/* Barra de busca */}
        <div className="px-6 py-3 border-b border-ink/10 bg-card flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por evento, capítulo ou erro..."
              className="w-full pl-9 pr-8 py-1.5 text-xs font-medium border-2 border-ink rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-comic-yellow"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">
            {filteredLogs.length} {filteredLogs.length === 1 ? "evento" : "eventos"}
          </span>
        </div>

        {/* Corpo com timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5 min-h-[260px] max-h-[50vh] bg-background/50">
          {isLoading && !logs ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-comic-blue" />
              <p className="font-display text-sm uppercase opacity-70">Carregando logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <Clock className="h-8 w-8 mx-auto text-muted-foreground opacity-40" />
              <p className="font-display text-base uppercase text-muted-foreground">
                {search ? "Nenhum evento corresponde à busca" : "Nenhum log disponível"}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {search
                  ? "Tente ajustar o termo pesquisado."
                  : "Os logs podem ter sido removidos após um reinício do servidor. Inicie uma nova conversão para gerar logs em tempo real."}
              </p>
              {!search && (
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold border-2 border-ink rounded-md px-3 py-1.5 bg-card hover:bg-muted shadow-comic-sm transition-transform active:scale-95"
                >
                  <RefreshCw className="h-3 w-3" />
                  Tentar novamente
                </button>
              )}
            </div>
          ) : (
            filteredLogs.map((ev, i) => {
              const badge = getEventBadge(ev.type);
              const BadgeIcon = badge.icon;
              const msg = extractLogMessage(ev);
              return (
                <div
                  key={ev.id ?? `${ev.timestamp}-${i}`}
                  className="flex items-start gap-3 border-2 border-ink/40 rounded-lg p-2.5 bg-card hover:border-ink transition-colors shadow-comic-sm text-xs"
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider shrink-0",
                      badge.className,
                    )}
                  >
                    <BadgeIcon className="h-2.5 w-2.5" />
                    {badge.label}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-ink/90 text-[11.5px]">
                        {ev.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                        {formatLogTimestamp(ev.timestamp)}
                      </span>
                    </div>
                    <p className="text-muted-foreground font-medium mt-0.5 break-words">{msg}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3 border-t-2 border-ink/15 bg-muted/30 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="border-2 border-ink rounded-lg bg-card hover:bg-muted font-display text-xs uppercase px-4 py-1.5 shadow-comic-sm hover:-translate-y-0.5 transition-transform"
          >
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
