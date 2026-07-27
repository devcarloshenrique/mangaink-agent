import { useState, useCallback, useRef, useMemo } from "react";
import { Search, Loader2, AlertCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { useScraping } from "@/hooks/useScraping";
import type { SourceInspectResponse } from "@/types/scraping";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onReady: (sourceId: string, metadata: SourceInspectResponse) => void;
}

export function InlineUrlBar({ open, onClose, onReady }: Props) {
  const [url, setUrl] = useState("");
  const { state, inspect, reset } = useScraping();
  const inputRef = useRef<HTMLInputElement>(null);
  const hasReportedRef = useRef(false);

  const handleSearch = useCallback(async () => {
    if (!url.trim()) return;
    hasReportedRef.current = false;
    await inspect(url.trim());
  }, [url, inspect]);

  const isValidUrl = useMemo(() => {
    try {
      new URL(url.trim());
      return true;
    } catch {
      return false;
    }
  }, [url]);

  const handleClose = useCallback(() => {
    reset();
    setUrl("");
    hasReportedRef.current = false;
    onClose();
  }, [reset, onClose]);

  if (state.status === "ready" && state.metadata && state.sourceId && !hasReportedRef.current) {
    hasReportedRef.current = true;
    onReady(state.sourceId, state.metadata);
  }

  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-300 ease-in-out",
        open ? "max-h-40 opacity-100 mb-4" : "max-h-0 opacity-0",
      )}
    >
      <div className="border-[3px] border-ink rounded-lg bg-card p-4 shadow-comic">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
            <Input
              ref={inputRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Cole a URL do mangá…"
              disabled={state.status === "processing"}
              className="pl-9 pr-8 border-[3px] border-ink shadow-comic-sm font-medium"
            />
            {url && (
              <button
                type="button"
                onClick={() => setUrl("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            onClick={handleSearch}
            disabled={!url.trim() || !isValidUrl || state.status === "processing"}
            className="bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display disabled:opacity-50 shrink-0"
          >
            {state.status === "processing" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Search className="h-4 w-4 mr-1.5" />
            )}
            Buscar
          </Button>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 p-1.5 rounded-md border-[2px] border-ink hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {state.status === "processing" && (
          <div className="mt-3">
            <SpeechBubble variant="yellow" tail="left" className="text-sm">
              {state.message || "Analisando obra…"} ({Math.round(state.progress)}%)
            </SpeechBubble>
            <div className="h-2 w-full border-2 border-ink rounded-full bg-card overflow-hidden mt-2">
              <div
                className="h-full bg-comic-yellow transition-all duration-300"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>
        )}

        {state.status === "failed" && (
          <div className="mt-3">
            <SpeechBubble variant="red" tail="left" className="text-sm">
              <AlertCircle className="h-3.5 w-3.5 inline mr-1" />
              {state.error || "Erro ao inspecionar URL"}
            </SpeechBubble>
            <button
              type="button"
              onClick={handleSearch}
              className="mt-2 font-display text-xs border-[2px] border-ink rounded-md bg-card px-3 py-1 shadow-comic-sm hover:-translate-y-0.5 transition-transform cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
