import { useCallback, useEffect, useRef, useState } from "react";
import { scrapingApi } from "@/lib/api";
import type { SourceInspectResponse } from "@/types/scraping";

type ScrapingStatus = "idle" | "processing" | "ready" | "failed";

interface ScrapingState {
  sourceId: string | null;
  status: ScrapingStatus;
  progress: number;
  message: string | null;
  metadata: SourceInspectResponse | null;
  error: string | null;
}

const INITIAL_STATE: ScrapingState = {
  sourceId: null,
  status: "idle",
  progress: 0,
  message: null,
  metadata: null,
  error: null,
};

export interface UseScraping {
  state: ScrapingState;
  inspect: (url: string, refresh?: boolean) => Promise<void>;
  reset: () => void;
}

export function useScraping(): UseScraping {
  const [state, setState] = useState<ScrapingState>(INITIAL_STATE);
  // Guarda a função close() do SSE ativo para cleanup
  const sseRef = useRef<{ close: () => void } | null>(null);

  // Fecha SSE anterior ao desmontar ou ao iniciar nova inspeção
  useEffect(() => {
    return () => {
      sseRef.current?.close();
    };
  }, []);

  const reset = useCallback(() => {
    sseRef.current?.close();
    sseRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const inspect = useCallback(async (url: string, refresh = false) => {
    // Fecha SSE anterior se existir
    sseRef.current?.close();
    sseRef.current = null;

    setState({
      sourceId: null,
      status: "processing",
      progress: 0,
      message: "Iniciando inspeção…",
      metadata: null,
      error: null,
    });

    try {
      const trigger = await scrapingApi.inspect(url, refresh);

      if (trigger.status === "ready") {
        // Cache hit — busca metadados diretamente
        const metadata = await scrapingApi.getSource(trigger.sourceId);
        setState({
          sourceId: trigger.sourceId,
          status: "ready",
          progress: 100,
          message: null,
          metadata,
          error: null,
        });
        return;
      }

      // status === "processing" — abre SSE
      setState((prev) => ({ ...prev, sourceId: trigger.sourceId, message: "Analisando obra…" }));

      const sse = scrapingApi.inspectEvents(trigger.sourceId, {
        onProgress({ stage, message, progress }) {
          setState((prev) => ({
            ...prev,
            status: "processing",
            progress,
            message: message || stage,
          }));
        },
        async onCompleted({ sourceId }) {
          sseRef.current?.close();
          sseRef.current = null;
          try {
            const metadata = await scrapingApi.getSource(sourceId);
            setState({
              sourceId,
              status: "ready",
              progress: 100,
              message: null,
              metadata,
              error: null,
            });
          } catch (err) {
            setState((prev) => ({
              ...prev,
              status: "failed",
              error: err instanceof Error ? err.message : "Erro ao carregar metadados",
            }));
          }
        },
        onFailed({ message }) {
          sseRef.current?.close();
          sseRef.current = null;
          setState((prev) => ({
            ...prev,
            status: "failed",
            error: message,
          }));
        },
        onError(error) {
          setState((prev) => ({
            ...prev,
            status: "failed",
            error: error.message,
          }));
        },
      });

      sseRef.current = sse;
    } catch (err) {
      setState({
        sourceId: null,
        status: "failed",
        progress: 0,
        message: null,
        metadata: null,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }, []);

  return { state, inspect, reset };
}
