import { useEffect, useMemo, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { conversionsApi } from "@/lib/api";
import { computeConversionOverall } from "@/lib/conversion-progress";
import type { ConversionState } from "@/types/conversion";

/**
 * Progresso ao vivo por conversão ativa, consumindo o MESMO stream SSE da
 * página do job (`GET /api/conversions/:id/events`). O endpoint de listagem
 * só recomputa o % agregado em transições de fase — durante o download ele
 * fica congelado, então o sino precisa dos eventos para a barra se mover.
 *
 * Store singleton por módulo: todas as instâncias do hook que acompanham o
 * mesmo `conversionId` compartilham UMA entrada (um SSE, um seed via
 * `GET /:id`, um `overall` monotônico). Sem isso, capa (home) e sino (header)
 * abriam dois SSE em paralelo e o clamp `Math.max(prev, compute)` divergia
 * por instância — mesma conversão, % diferente nas duas superfícies.
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
  /** Capítulos com evento terminal já contabilizado (dedupe de replay). */
  seenChapters: Set<string>;
  /** Jobs com evento terminal já contabilizado (dedupe de replay). */
  seenJobs: Set<string>;
  overall: number;
  done: boolean;

  closed: boolean;
  close: () => void;
  seeded: boolean;
  /** SSE já aberto para esta entrada — novos subscribers só escutam. */
  connected: boolean;
  lastEventAt: number;
  /** Watchdog da conexão atual — limpo a cada reconexão (evita watchdog órfão). */
  watchdog?: ReturnType<typeof setInterval>;
  /** Incrementado a cada connect() — invalida callbacks de conexões antigas. */
  generation: number;
  /** Timer de reconnect pendente — limpo no closeEntry (evita leak). */
  retryTimer?: ReturnType<typeof setTimeout>;
}

interface SavedLiveProgress {
  overall: number;
  downloadOnly: boolean;
  chaptersDone: number;
  chaptersTotal: number;
  chaptersFailed: number;
}

const STORAGE_PREFIX = "mangaink:live_prog:";

function loadSavedProgress(id: string): SavedLiveProgress | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as SavedLiveProgress;
  } catch {
    return null;
  }
}

function saveProgress(id: string, data: SavedLiveProgress): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(data));
  } catch {
    // quota exceeded / storage disabled
  }
}

function clearSavedProgress(id: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(`${STORAGE_PREFIX}${id}`);
  } catch {
    // storage disabled
  }
}

const STALL_WATCHDOG_MS = 35_000; // keepalive server-side é 30s
const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 15_000;

/** Entrada terminal = todos os jobs completos/falhos. Única via para 100%. */
function isTerminalEntry(entry: LiveEntry): boolean {
  return entry.totalJobs > 0 && entry.completedJobs + entry.failedJobs >= entry.totalJobs;
}

/**
 * Seletor único de % exibido — capa (home) e sino (header) DEVEM usar este
 * seletor em vez de copiar a fórmula (evita segunda divergência futura).
 */
export function selectOverallProgress(
  liveOverall: number | undefined,
  fallbackProgress: number | undefined,
): number {
  return Math.max(0, Math.min(100, Math.round(liveOverall ?? fallbackProgress ?? 0)));
}

// ── Store singleton ─────────────────────────────────────────────────────────

const entries = new Map<string, LiveEntry>();
const subscriptions = new Map<object, Set<string>>();
const snapshotListeners = new Set<(snap: Map<string, LiveConversionProgress>) => void>();
const queryClients = new Set<QueryClient>();
const retryTimers = new Set<ReturnType<typeof setTimeout>>();

function toSnapshot(): Map<string, LiveConversionProgress> {
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
    if (e.done) {
      clearSavedProgress(id);
    } else if (e.overall > 0 || e.processedChapters > 0) {
      saveProgress(id, {
        overall: e.overall,
        downloadOnly: e.downloadOnly,
        chaptersDone: e.processedChapters,
        chaptersTotal: e.totalChapters,
        chaptersFailed: e.chaptersFailed,
      });
    }
  }
  return next;
}

function publishAll(): void {
  const snap = toSnapshot();
  for (const listener of snapshotListeners) {
    listener(new Map(snap));
  }
}

function invalidateConversionQueries(): void {
  for (const qc of queryClients) {
    void qc.invalidateQueries({ queryKey: ["conversions"] });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  }
}

function closeEntry(id: string, entry: LiveEntry): void {
  entry.closed = true;
  entry.close();
  if (entry.retryTimer) {
    clearTimeout(entry.retryTimer);
    retryTimers.delete(entry.retryTimer);
    entry.retryTimer = undefined;
  }
  if (entry.watchdog) {
    clearInterval(entry.watchdog);
    entry.watchdog = undefined;
  }
}

/** Conecta (ou reconecta) o SSE de uma conversão com backoff. */
function connect(id: string, attempt = 0): void {
  const entry = entries.get(id);
  if (!entry || entry.closed || entry.done) return;
  // Invalida callbacks (onEvent/onEnd/watchdog) da conexão anterior.
  const generation = ++entry.generation;
  entry.connected = true;
  // Fecha o stream anterior desta entrada — reuso da entrada entre
  // reconciliações não pode vazar conexões.
  const previousClose = entry.close;
  previousClose();
  if (entry.watchdog) {
    clearInterval(entry.watchdog);
    entry.watchdog = undefined;
  }

  let alive = false;
  let finished = false;

  const scheduleRetry = (status?: number) => {
    // 401 (auth expirada) / 404 (conversão removida) não são transitórios:
    // aborta o backoff e fecha a entrada em vez de retentar para sempre.
    if (status === 401 || status === 404) {
      closeEntry(id, entry);
      publishAll();
      return;
    }
    if (entries.get(id) !== entry || entry.closed || entry.done || finished) return;
    if (generation !== entry.generation) return; // conexão já substituída
    finished = true;
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** Math.min(attempt, 4),
      RECONNECT_MAX_DELAY_MS,
    );
    if (entry.retryTimer) return;
    const t = setTimeout(() => {
      retryTimers.delete(t);
      if (entry.retryTimer === t) entry.retryTimer = undefined;
      connect(id, attempt + 1);
    }, delay);
    entry.retryTimer = t;
    retryTimers.add(t);
  };
  const sse = conversionsApi.events(id, {
    onEvent(event, rawData) {
      if (entries.get(id) !== entry || entry.closed || generation !== entry.generation) return;
      const data = rawData as Record<string, unknown>;
      alive = true;
      entry.lastEventAt = Date.now();
      attempt = 0; // stream saudável — zera o backoff

      // Dedupe idempotente por capítulo/job: o servidor faz replay integral
      // do journal a cada (re)conexão SSE, então o mesmo evento terminal pode
      // chegar N vezes (reconnect, watchdog, recriação de entrada). Sem o
      // gate, capítulos/jobs contam em dobro e o % ao vivo (capa/sino)
      // ultrapassa a página. Primeira ocorrência por id vence.
      const chapterId = data.chapterId as string | undefined;
      const jobId = data.jobId as string | undefined;
      switch (event) {
        case "job.started":
          entry.kccProgress = 0;
          break;
        case "download.chapter.finished":
        case "download.chapter.skipped":
        case "download.error":
          if (typeof chapterId === "string" && chapterId) {
            // finished/skipped SELAM o id; error conta mas NÃO sela — um
            // finished posterior de retentativa conta normalmente. Ordem
            // inversa continua dedupada pelo selo do finished.
            if (entry.seenChapters.has(chapterId)) return;
            if (event !== "download.error") entry.seenChapters.add(chapterId);
          }
          entry.processedChapters++;
          if (event !== "download.chapter.finished") entry.chaptersFailed++;
          break;
        case "conversion.started":
          entry.kccProgress = 5;
          break;
        case "conversion.progress":
          entry.kccProgress = Math.max(5, Math.min(100, (data.progress as number) ?? 5));
          break;
        case "conversion.finished":
          entry.kccProgress = 100;
          break;
        case "job.finished":
        case "job.failed":
          if (typeof jobId === "string" && jobId) {
            if (entry.seenJobs.has(jobId)) return;
            entry.seenJobs.add(jobId);
          }
          // Espelha o reducer da página (JOB_COMPLETED): job.finished sem
          // conversion.finished prévio (downloadOnly, falha rápida) não
          // pode divergir até o próximo evento. job.failed não toca kcc
          // em nenhum dos lados.
          if (event === "job.finished") {
            entry.completedJobs++;
            entry.kccProgress = 100;
          } else {
            entry.failedJobs++;
          }
          break;
        default:
          return;
      }

      if (isTerminalEntry(entry)) {
        entry.done = true;
        entry.overall = 100;
        clearSavedProgress(id);
        entry.close();
        // Sino some da lista "Em andamento" imediatamente E a notificação
        // de conclusão aparece na hora — sem depender do SSE de
        // notificações (que pode estar morto/defasado).
        invalidateConversionQueries();
      } else {
        // Clamp monotônico: o % nunca regride na UI. 100% pré-terminal
        // iguala a referência (página) — nunca "corrige" só um lado.
        entry.overall = Math.max(entry.overall, computeConversionOverall(entry));
      }
      publishAll();
    },
    onEnd(info) {
      // Stream caiu sem estado terminal — o replay do journal no reconnect
      // recupera o que foi perdido (401/404 abortam via scheduleRetry).
      scheduleRetry(info?.status);
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
    if (
      entries.get(id) !== entry ||
      entry.closed ||
      entry.done ||
      generation !== entry.generation
    ) {
      clearInterval(watchdog);
      if (entry.watchdog === watchdog) entry.watchdog = undefined;
      return;
    }
    if (!alive || Date.now() - entry.lastEventAt > STALL_WATCHDOG_MS * 3) {
      clearInterval(watchdog);
      if (entry.watchdog === watchdog) entry.watchdog = undefined;
      entry.close();
      scheduleRetry();
      return;
    }
    alive = false;
  }, STALL_WATCHDOG_MS);
  entry.watchdog = watchdog;

  void (async () => {
    if (!entry.seeded) {
      entry.seeded = true;
      try {
        const initial: ConversionState = await conversionsApi.get(id);
        if (entries.get(id) !== entry || entry.closed) return;
        const config = initial.config as {
          books?: { chapters?: string[] }[];
          downloadOnly?: boolean;
        };
        entry.totalJobs = initial.totalJobs;
        const computedChapters =
          config?.books?.reduce((sum, b) => sum + (b.chapters?.length ?? 0), 0) ?? 0;
        if (computedChapters > 0) {
          entry.totalChapters = computedChapters;
        }
        entry.downloadOnly = config?.downloadOnly === true;
        const terminalStatus =
          initial.status === "completed" ||
          initial.status === "failed" ||
          initial.status === "cancelled" ||
          initial.status === "partial";
        if (terminalStatus) {
          // Terminal: sem SSE/replay na página — jobs do GET são a verdade
          // (espelha useConversionProgress seed). O seed sobrescreve, então
          // eventos do replay que chegaram antes são corrigidos aqui.
          const jobs = initial.jobs ?? [];
          entry.completedJobs = jobs.filter((j) => j.status === "completed").length;
          entry.failedJobs = jobs.filter(
            (j) => j.status === "failed" || j.status === "cancelled",
          ).length;
          entry.processedChapters = jobs
            .filter((j) => j.status === "completed")
            .reduce((sum, j) => sum + (config?.books?.[j.index]?.chapters?.length ?? 0), 0);
        }
        // Não-terminal: zeros + replay do journal no connect — igual à página.
        // Semear completed/processed do GET aqui contaria em dobro com o
        // replay (job.finished do journal) e terminaria a entrada cedo.
        // `overall` semeado é a fórmula — nunca `initial.progress` como valor
        // exibido. Sem cap: igualdade com a referência, não correção isolada.
        const seedOverall = terminalStatus ? 100 : computeConversionOverall(entry);
        entry.overall = Math.max(entry.overall, seedOverall);
        if (terminalStatus) {
          entry.done = true;
          clearSavedProgress(id);
        }
        publishAll();
      } catch {
        // Sem seed — os eventos SSE preenchem o resto.
      }
    }
  })();
}

/** Garante UMA conexão por conversão — subscribers extras só escutam. */
function ensureConnected(id: string): void {
  const entry = entries.get(id);
  if (!entry || entry.closed || entry.done || entry.connected) return;
  connect(id, 0);
}

/** Reconcilia a união dos ids queridos por todos os subscribers. */
function reconcile(): void {
  const wanted = new Set<string>();
  for (const set of subscriptions.values()) {
    for (const id of set) wanted.add(id);
  }

  // Remove (e fecha) entradas que ninguém mais quer.
  for (const [id, entry] of entries) {
    if (!wanted.has(id)) {
      closeEntry(id, entry);
      entries.delete(id);
    }
  }

  for (const id of wanted) {
    if (!entries.has(id)) {
      const saved = loadSavedProgress(id);
      entries.set(id, {
        totalJobs: 0,
        totalChapters: saved?.chaptersTotal ?? 0,
        downloadOnly: saved?.downloadOnly ?? false,
        // Contadores SEMPRE partem de zero: o connect faz replay integral do
        // journal e reconstrói a contagem exata. Restaurar salvos + replay
        // contaria em dobro (foi a divergência capa/sino > página).
        processedChapters: 0,
        chaptersFailed: 0,
        completedJobs: 0,
        failedJobs: 0,
        kccProgress: 0,
        seenChapters: new Set<string>(),
        seenJobs: new Set<string>(),
        // Sem cap: igualdade com a referência em todos os momentos.
        overall: saved?.overall ?? 0,
        done: false,
        closed: false,
        close: () => {},
        seeded: false,
        connected: false,
        lastEventAt: Date.now(),
        generation: 0,
        retryTimer: undefined,
      });
    }
    ensureConnected(id);
  }

  publishAll();
}

export function useLiveConversionProgress(
  conversionIds: string[],
): Map<string, LiveConversionProgress> {
  const [snapshot, setSnapshot] = useState<Map<string, LiveConversionProgress>>(new Map());
  const queryClient = useQueryClient();

  // Chave estável: evita re-inscrever SSE a cada render (ids vêm de query data).
  const idsKey = useMemo(() => [...new Set(conversionIds)].sort().join(","), [conversionIds]);

  useEffect(() => {
    queryClients.add(queryClient);
    const token: object = {};
    subscriptions.set(token, new Set(idsKey ? idsKey.split(",") : []));
    snapshotListeners.add(setSnapshot);
    reconcile();
    return () => {
      subscriptions.delete(token);
      snapshotListeners.delete(setSnapshot);
      queryClients.delete(queryClient);
      reconcile();
    };
  }, [idsKey, queryClient]);

  return snapshot;
}
