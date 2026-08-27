import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { conversionsApi } from "@/lib/api";
import type { ConversionState } from "@/types/conversion";

/**
 * Progresso ao vivo por conversão ativa, consumindo o MESMO stream SSE da
 * página do job (`GET /api/conversions/:id/events`). O endpoint de listagem
 * só recomputa o % agregado em transições de fase — durante o download ele
 * fica congelado, então o sino precisa dos eventos para a barra se mover.
 *
 * Resiliência: o stream pode morrer sem evento de erro (rede/proxy) ou ser
 * encerrado pelo servidor — neste caso há RECONEXÃO com backoff (o replay de
 * journal do backend recupera eventos perdidos), watchdog de stall e clamp
 * monotônico do % exibido.
 */
export interface LiveConversionProgress {
  /** 0–100, mesma fórmula da página de progresso (capítulos 50% + conversão 50%). */
  overall: number;
  /** Todos os jobs chegaram a estado terminal — pode parar de acompanhar. */
  done: boolean;
  /** Download de capítulos soltos (sem KCC) — muda o rótulo do sino. */
  downloadOnly: boolean;
  /** Capítulos processados (baixados + falhos) em tempo real. */
  chaptersDone: number;
  chaptersTotal: number;
  /** Capítulos que falharam/pularam em tempo real. */
  chaptersFailed: number;
}

interface LiveEntry {
  totalJobs: number;
  totalChapters: number;
  downloadOnly: boolean;
  processedChapters: number;
  chaptersFailed: number;
  completedJobs: number;
  failedJobs: number;
  kccProgress: number;
  overall: number;
  done: boolean;

  closed: boolean;
  close: () => void;
  seeded: boolean;
  lastEventAt: number;
  /** Watchdog da conexão atual — limpo a cada reconexão (evita watchdog órfão). */
  watchdog?: ReturnType<typeof setInterval>;
  /** Incrementado a cada connect() — invalida callbacks de conexões antigas. */
  generation: number;
}

const STALL_WATCHDOG_MS = 35_000; // keepalive server-side é 30s
const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 15_000;

function computeOverall(entry: LiveEntry): number {
  const pctChapters =
    entry.totalChapters > 0 ? Math.round((entry.processedChapters / entry.totalChapters) * 100) : 0;

  if (entry.downloadOnly) return Math.min(100, pctChapters);

  const blend =
    entry.totalJobs > 0
      ? Math.min(100, Math.round((entry.completedJobs * 100 + entry.kccProgress) / entry.totalJobs))
      : 0;
  return Math.min(100, Math.round(pctChapters * 0.5 + blend * 0.5));
}

export function useLiveConversionProgress(
  conversionIds: string[],
): Map<string, LiveConversionProgress> {
  const [snapshot, setSnapshot] = useState<Map<string, LiveConversionProgress>>(new Map());
  const entriesRef = useRef<Map<string, LiveEntry>>(new Map());
  const queryClient = useQueryClient();

  // Chave estável: evita re-inscrever SSE a cada render (ids vêm de query data).
  const idsKey = useMemo(() => [...new Set(conversionIds)].sort().join(","), [conversionIds]);

  useEffect(() => {
    const wanted = new Set(idsKey ? idsKey.split(",") : []);
    const entries = entriesRef.current;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    // Remove (e fecha) assinaturas de conversões que saíram da lista.
    for (const [id, entry] of entries) {
      if (!wanted.has(id)) {
        entry.closed = true;
        entry.close();
        entries.delete(id);
      }
    }

    const publish = () => {
      const next = new Map<string, LiveConversionProgress>();
      for (const [id, e] of entries) {
        next.set(id, {
          overall: e.overall,
          done: e.done,
          downloadOnly: e.downloadOnly,
          chaptersDone: e.processedChapters,
          chaptersTotal: e.totalChapters,
          chaptersFailed: e.chaptersFailed,
        });
      }
      setSnapshot(next);
    };

    /** Conecta (ou reconecta) o SSE de uma conversão com backoff. */
    const connect = (id: string, attempt = 0) => {
      const entry = entries.get(id);
      if (!entry || entry.closed || entry.done) return;

      // Invalida callbacks (onEvent/onEnd/watchdog) da conexão anterior.
      const generation = ++entry.generation;
      // Fecha o stream anterior desta entrada — reuso da entrada entre
      // execuções do efeito (idsKey mudou) não pode vazar conexões.
      const previousClose = entry.close;
      previousClose();
      if (entry.watchdog) {
        clearInterval(entry.watchdog);
        timers.delete(entry.watchdog);
        entry.watchdog = undefined;
      }

      let alive = false;
      let finished = false;

      const scheduleRetry = () => {
        if (entry.closed || entry.done || finished) return;
        if (generation !== entry.generation) return; // conexão já substituída
        finished = true;
        const delay = Math.min(
          RECONNECT_BASE_DELAY_MS * 2 ** Math.min(attempt, 4),
          RECONNECT_MAX_DELAY_MS,
        );
        const t = setTimeout(() => {
          timers.delete(t);
          connect(id, attempt + 1);
        }, delay);
        timers.add(t);
      };

      const sse = conversionsApi.events(id, {
        onEvent(event, rawData) {
          if (entry.closed || generation !== entry.generation) return;
          const data = rawData as Record<string, unknown>;
          alive = true;
          entry.lastEventAt = Date.now();
          attempt = 0; // stream saudável — zera o backoff

          switch (event) {
            case "download.chapter.finished":
              entry.processedChapters++;
              break;
            case "download.chapter.skipped":
            case "download.error":
              entry.processedChapters++;
              entry.chaptersFailed++;
              break;
            case "conversion.progress":
              entry.kccProgress = Math.max(0, Math.min(100, (data.progress as number) ?? 0));
              break;
            case "conversion.finished":
              entry.kccProgress = 100;
              break;
            case "job.finished":
              entry.completedJobs++;
              break;
            case "job.failed":
              entry.failedJobs++;
              break;
            default:
              return;
          }

          const terminalJobs = entry.completedJobs + entry.failedJobs;
          if (entry.totalJobs > 0 && terminalJobs >= entry.totalJobs) {
            entry.done = true;
            entry.overall = 100;
            entry.close();
            // Sino some da lista "Em andamento" imediatamente E a notificação
            // de conclusão aparece na hora — sem depender do SSE de
            // notificações (que pode estar morto/defasado).
            void queryClient.invalidateQueries({ queryKey: ["conversions"] });
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          } else {
            // Clamp monotônico: o % nunca regride na UI.
            entry.overall = Math.max(entry.overall, computeOverall(entry));
          }
          publish();
        },
        onEnd() {
          // Stream caiu sem estado terminal — o replay do journal no reconnect
          // recupera o que foi perdido.
          scheduleRetry();
        },
      });

      if (entry.closed) {
        sse.close();
        return;
      }

      alive = true;
      entry.lastEventAt = Date.now();
      entry.close = () => sse.close();

      // Watchdog: sem NENHUM byte (evento/keepalive não diferencia aqui, mas
      // keepalive mantém a conexão viva; se nem ele chegar, o fetch morre e
      // dispara onEnd). Fallback extra: sem eventos de progresso por muito
      // tempo E ainda não terminal → testa reconectando uma vez.
      // Guard de geração: um watchdog de conexão antiga NUNCA fecha/reconecta
      // a conexão atual (regressão do "watchdog órfão").
      const watchdog = setInterval(() => {
        if (entry.closed || entry.done || generation !== entry.generation) {
          clearInterval(watchdog);
          timers.delete(watchdog);
          if (entry.watchdog === watchdog) entry.watchdog = undefined;
          return;
        }
        if (!alive || Date.now() - entry.lastEventAt > STALL_WATCHDOG_MS * 3) {
          clearInterval(watchdog);
          timers.delete(watchdog);
          if (entry.watchdog === watchdog) entry.watchdog = undefined;
          entry.close();
          scheduleRetry();
          return;
        }
        alive = false;
      }, STALL_WATCHDOG_MS);
      entry.watchdog = watchdog;
      timers.add(watchdog);

      void (async () => {
        if (!entry.seeded) {
          entry.seeded = true;
          try {
            const initial: ConversionState = await conversionsApi.get(id);
            if (entry.closed) return;
            const config = initial.config as {
              books?: { chapters?: string[] }[];
              downloadOnly?: boolean;
            };
            entry.totalJobs = initial.totalJobs;
            entry.totalChapters =
              config?.books?.reduce((sum, b) => sum + (b.chapters?.length ?? 0), 0) ?? 0;
            entry.downloadOnly = config?.downloadOnly === true;
            entry.overall =
              initial.status === "processing" || initial.status === "queued"
                ? initial.progress
                : 100;
            publish();
          } catch {
            // Sem seed — os eventos SSE preenchem o resto.
          }
        }
      })();
    };

    for (const id of wanted) {
      if (!entries.has(id)) {
        entries.set(id, {
          totalJobs: 0,
          totalChapters: 0,
          downloadOnly: false,
          processedChapters: 0,
          chaptersFailed: 0,
          completedJobs: 0,
          failedJobs: 0,
          kccProgress: 0,
          overall: 0,
          done: false,
          closed: false,
          close: () => {},
          seeded: false,
          lastEventAt: Date.now(),
          generation: 0,
        });
      }
      connect(id);
    }

    publish();
    // Sem cleanup por-run: remoções são tratadas acima; o unmount tem
    // efeito próprio abaixo (evita fechar streams que o próximo run reutiliza).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // Cleanup final no unmount do componente dono.
  useEffect(() => {
    const entries = entriesRef.current;
    return () => {
      for (const entry of entries.values()) {
        entry.closed = true;
        entry.close();
      }
      entries.clear();
    };
  }, []);

  return snapshot;
}
