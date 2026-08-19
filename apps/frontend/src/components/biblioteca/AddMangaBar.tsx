import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Link2, Loader2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { useScraping } from "@/hooks/useScraping";
import type { SourceInspectResponse } from "@/types/scraping";
import { cn } from "@/lib/utils";

export type AddMangaMode = "filter" | "url";

interface Props {
  value: string;
  onChange: (v: string) => void;
  mode: AddMangaMode;
  onModeChange: (mode: AddMangaMode) => void;
  onReady: (sourceId: string, metadata: SourceInspectResponse) => void;
}

export function AddMangaBar({ value, onChange, mode, onModeChange, onReady }: Props) {
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, inspect, reset } = useScraping();
  const hasReportedRef = useRef(false);

  const isUrlMode = mode === "url";

  useEffect(() => {
    if (isUrlMode) {
      if (value && (!url || url === "")) {
        setUrl(value);
      }
      inputRef.current?.focus();
    } else {
      reset();
      hasReportedRef.current = false;
    }
  }, [isUrlMode, reset, value]);

  const handleSearch = useCallback(async () => {
    if (!url.trim() || state.status === "processing") return;
    hasReportedRef.current = false;
    await inspect(url.trim());
  }, [url, inspect, state.status]);

  const isValidUrl = useMemo(() => {
    try {
      new URL(url.trim());
      return true;
    } catch {
      return false;
    }
  }, [url]);

  const handleLeave = useCallback(() => {
    onModeChange("filter");
  }, [onModeChange]);

  if (
    isUrlMode &&
    state.status === "ready" &&
    state.metadata &&
    state.sourceId &&
    !hasReportedRef.current
  ) {
    hasReportedRef.current = true;
    onModeChange("filter");
    onReady(state.sourceId, state.metadata);
  }

  const inputValue = isUrlMode ? url : value;

  return (
    <div>
      <div
        className={cn(
          "relative flex items-center border-[3px] border-ink rounded-lg shadow-comic-sm transition-colors duration-300 focus-within:ring-2 focus-within:ring-comic-blue",
          isUrlMode ? "bg-comic-blue/10" : "bg-card",
        )}
      >
        {isUrlMode ? (
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-comic-blue" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            if (isUrlMode) {
              setUrl(e.target.value);
            } else {
              onChange(e.target.value);
            }
          }}
          onKeyDown={(e) => {
            if (!isUrlMode) {
              const val = value.trim();
              if (
                e.key === "Enter" &&
                (val.startsWith("http://") || val.startsWith("https://"))
              ) {
                e.preventDefault();
                setUrl(val);
                onModeChange("url");
              }
              return;
            }
            if (e.key === "Enter") void handleSearch();
            if (e.key === "Escape") handleLeave();
          }}
          placeholder={isUrlMode ? "Cole a URL do mangá…" : "Buscar por título..."}
          disabled={isUrlMode && state.status === "processing"}
          className={cn(
            "h-11 w-full bg-transparent pl-10 font-medium text-sm focus:outline-none",
            isUrlMode ? "pr-3" : "pr-10",
          )}
        />
        {isUrlMode ? (
          <>
            {url && (
              <button
                type="button"
                onClick={() => {
                  setUrl("");
                  onChange("");
                }}
                className="shrink-0 p-1.5 rounded-md opacity-50 hover:opacity-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <Button
              onClick={() => void handleSearch()}
              disabled={!url.trim() || !isValidUrl || state.status === "processing"}
              className="mr-2 h-8 px-3 rounded-md bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic-sm font-display text-xs disabled:opacity-50 shrink-0 animate-comic-pop"
            >
              {state.status === "processing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              Adicionar
            </Button>
          </>
        ) : (
          value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      {isUrlMode && state.status === "idle" && (
        <p className="mt-2 text-xs font-medium opacity-60">
          Cole a URL de uma fonte suportada e pressione Enter.
        </p>
      )}

      {isUrlMode && state.status === "processing" && (
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

      {isUrlMode && state.status === "failed" && (
        <div className="mt-3">
          <SpeechBubble variant="red" tail="left" className="text-sm">
            <AlertCircle className="h-3.5 w-3.5 inline mr-1" />
            {state.error || "Erro ao inspecionar URL"}
          </SpeechBubble>
          <button
            type="button"
            onClick={() => void handleSearch()}
            className="mt-2 font-display text-xs border-[2px] border-ink rounded-md bg-card px-3 py-1 shadow-comic-sm hover:-translate-y-0.5 transition-transform cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
