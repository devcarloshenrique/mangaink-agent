import { useCallback, useEffect, useRef, useState } from "react";
import { scrapingApi } from "@/lib/api";
import type { SourceInspectResponse } from "@/types/scraping";

export type ScrapingStatus = "idle" | "processing" | "ready" | "failed";

export interface ScrapingState {
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

const POLL_INTERVAL_MS = 2000;
const INSPECT_TIMEOUT_MS = 60000;

export function useScraping(): UseScraping {
  const [state, setState] = useState<ScrapingState>(INITIAL_STATE);
  const sseRef = useRef<{ close: () => void } | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSettledRef = useRef(false);

  const cleanup = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const reset = useCallback(() => {
    isSettledRef.current = true;
    cleanup();
    setState(INITIAL_STATE);
  }, [cleanup]);

  const inspect = useCallback(
    async (url: string, refresh = false) => {
      cleanup();
      isSettledRef.current = false;

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
          isSettledRef.current = true;
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

        // status === "processing" — abre SSE e inicia polling defensivo
        setState((prev) => ({
          ...prev,
          sourceId: trigger.sourceId,
          message: "Analisando obra…",
        }));

        const handleSuccess = (sourceId: string, metadata: SourceInspectResponse) => {
          if (isSettledRef.current) return;
          isSettledRef.current = true;
          cleanup();
          setState({
            sourceId,
            status: "ready",
            progress: 100,
            message: null,
            metadata,
            error: null,
          });
        };

        const handleFailure = (errorMessage: string) => {
          if (isSettledRef.current) return;
          isSettledRef.current = true;
          cleanup();
          setState((prev) => ({
            ...prev,
            status: "failed",
            error: errorMessage,
          }));
        };

        // Polling defensivo de fallback caso o SSE atrase ou perca o evento completed
        pollTimerRef.current = setInterval(async () => {
          if (isSettledRef.current) return;
          try {
            const data = await scrapingApi.getSource(trigger.sourceId);
            if (data && data.metadata) {
              handleSuccess(trigger.sourceId, data);
            }
          } catch {
            // Em processamento ainda ou não encontrado
          }
        }, POLL_INTERVAL_MS);

        // Timeout global de 60s
        timeoutTimerRef.current = setTimeout(() => {
          if (!isSettledRef.current) {
            handleFailure("Tempo limite excedido ao inspecionar a obra.");
          }
        }, INSPECT_TIMEOUT_MS);

        const sse = scrapingApi.inspectEvents(trigger.sourceId, {
          onProgress({ stage, message, progress }) {
            if (isSettledRef.current) return;
            setState((prev) => ({
              ...prev,
              status: "processing",
              progress,
              message: message || stage,
            }));
          },
          async onCompleted({ sourceId }) {
            try {
              const metadata = await scrapingApi.getSource(sourceId);
              handleSuccess(sourceId, metadata);
            } catch (err) {
              handleFailure(err instanceof Error ? err.message : "Erro ao carregar metadados");
            }
          },
          onFailed({ message }) {
            handleFailure(message);
          },
          async onError(error) {
            // Tenta verificar se o resultado já está pronto antes de marcar erro
            try {
              const data = await scrapingApi.getSource(trigger.sourceId);
              if (data && data.metadata) {
                handleSuccess(trigger.sourceId, data);
                return;
              }
            } catch {
              // segue aguardando polling
            }
          },
        });

        sseRef.current = sse;
      } catch (err) {
        isSettledRef.current = true;
        cleanup();
        setState({
          sourceId: null,
          status: "failed",
          progress: 0,
          message: null,
          metadata: null,
          error: err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
    },
    [cleanup],
  );

  return { state, inspect, reset };
}
