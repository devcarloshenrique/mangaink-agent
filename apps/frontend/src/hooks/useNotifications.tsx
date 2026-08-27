import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { NotificationDTO } from "@mangaink/shared";

interface NotificationsCtx {
  notifications: NotificationDTO[];
  unreadCount: number;
  isLoading: boolean;
  /** Incrementa a cada notificação nova via SSE — dispara a animação do sino. */
  pulseSignal: number;
  /** Id da notificação recém-chegada (para animar a entrada na lista). */
  lastNotificationId: string | null;
  /** Dispara manualmente o pulso do sino (ex.: nova conversão em andamento). */
  triggerPulse: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearHistory: () => void;
}

const Ctx = createContext<NotificationsCtx | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const [pulseSignal, setPulseSignal] = useState(0);
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(50),
    enabled: isAuthenticated,
    staleTime: 30_000,
    // Rede de segurança: o tempo real é o SSE, mas se o stream morrer
    // silenciosamente (proxy, sleep, backend reiniciado), a lista se recupera
    // em ≤30s sem o usuário precisar trocar de tela.
    refetchInterval: isAuthenticated ? 30_000 : false,
  });

  // ── SSE em tempo real ────────────────────────────────────────────────────
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Sementes anti-duplicidade: notificações já carregadas não contam como novas.
  useEffect(() => {
    for (const item of query.data?.items ?? []) seenIdsRef.current.add(item.id);
  }, [query.data?.items]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let disposed = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stream: { close: () => void } | null = null;

    /** Reconecta com backoff exponencial (teto de 15s). */
    const scheduleReconnect = () => {
      if (disposed) return;
      const delay = Math.min(1_000 * 2 ** Math.min(attempt, 4), 15_000);
      attempt += 1;
      retryTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (disposed) return;
      stream = notificationsApi.events({
        onNotification(notification) {
          attempt = 0; // stream saudável — zera o backoff
          if (seenIdsRef.current.has(notification.id)) return;
          seenIdsRef.current.add(notification.id);

          queryClient.setQueryData<{ items: NotificationDTO[]; unreadCount: number }>(
            ["notifications"],
            (prev) =>
              prev
                ? { items: [notification, ...prev.items], unreadCount: prev.unreadCount + 1 }
                : { items: [notification], unreadCount: 1 },
          );

          // Sinal visual no sino (animação curta estilo toolbar de downloads).
          setPulseSignal((n) => n + 1);
          setLastNotificationId(notification.id);
        },
        onError(err) {
          console.warn("[notifications] SSE error:", err.message);
        },
        onEnd() {
          // Stream caiu (rede/proxy/restart do backend). Reconecta com backoff
          // e faz BACKFILL: o backend não tem replay de eventos, então o que
          // foi perdido durante a queda volta com 1 request.
          if (disposed) return;
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          scheduleReconnect();
        },
      });
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      stream?.close();
    };
  }, [isAuthenticated, queryClient]);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    [queryClient],
  );

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidate,
  });

  const clearHistoryMutation = useMutation({
    mutationFn: () => notificationsApi.clearHistory(),
    onSuccess: invalidate,
  });

  const value: NotificationsCtx = {
    notifications: query.data?.items ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    pulseSignal,
    lastNotificationId,
    triggerPulse: useCallback(() => setPulseSignal((n) => n + 1), []),
    markAsRead: (id) => markReadMutation.mutate(id),
    markAllAsRead: () => markAllReadMutation.mutate(),
    clearHistory: () => clearHistoryMutation.mutate(),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications deve ser usado dentro de NotificationProvider");
  return ctx;
}
