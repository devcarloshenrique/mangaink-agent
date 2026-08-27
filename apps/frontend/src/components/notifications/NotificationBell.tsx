import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CheckCheck,
  CheckCircle2,
  DownloadCloud,
  History,
  Loader2,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useActiveConversions } from "@/hooks/useConversions";
import {
  useLiveConversionProgress,
  type LiveConversionProgress,
} from "@/hooks/useLiveConversionProgress";
import { notificationsApi, conversionsApi } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { NotificationDTO } from "@mangaink/shared";

// ── Ícones/cores por tipo de notificação ─────────────────────────────────────

const TYPE_ICON: Record<string, typeof CheckCircle2> = {
  volume_ready: CheckCircle2,
  conversion_failed: XCircle,
  conversion_cancelled: AlertTriangle,
  download_completed: DownloadCloud,
  download_failed: XCircle,
  chapter_cache_deleted: Trash2,
};

const TYPE_COLOR: Record<string, string> = {
  volume_ready: "text-comic-blue",
  conversion_failed: "text-comic-red",
  conversion_cancelled: "text-comic-red",
  download_completed: "text-comic-blue",
  download_failed: "text-comic-red",
  chapter_cache_deleted: "text-comic-yellow",
};

/** Estilo de item legível em qualquer tema — sobrescreve o par
 * `focus:bg-accent focus:text-accent-foreground` do DropdownMenuItem base
 * (texto branco sobre fundo creme = invisível). */
const ITEM_HOVER = "focus:bg-muted focus:text-foreground hover:bg-muted hover:text-foreground";

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ── Item de notificação persistida ───────────────────────────────────────────

function NotificationItem({
  notification,
  justArrived,
  onAnimated,
  onOpen,
  variant = "menu",
}: {
  notification: NotificationDTO;
  justArrived: boolean;
  onAnimated: (id: string) => void;
  onOpen: () => void;
  /** "menu": DropdownMenuItem (dentro do dropdown). "panel": div neutra (modal). */
  variant?: "menu" | "panel";
}) {
  const Icon = TYPE_ICON[notification.type] ?? Bell;
  const isCancelled = notification.type === "conversion_cancelled";

  useEffect(() => {
    if (!justArrived) return;
    // Marca como já animado após a duração da animação de entrada.
    const t = setTimeout(() => onAnimated(notification.id), 700);
    return () => clearTimeout(t);
  }, [justArrived, notification.id, onAnimated]);

  const rowClasses = cn(
    "flex flex-col items-start gap-1 px-4 py-3 cursor-pointer w-full text-left",
    ITEM_HOVER,
  );

  const body = (
    <>
      <div className="flex items-center gap-2 w-full">
        <Icon className={cn("h-4 w-4 shrink-0", TYPE_COLOR[notification.type])} />
        <span
          className={cn(
            "font-display text-sm truncate flex-1 min-w-0",
            isCancelled && "line-through decoration-comic-red decoration-2 opacity-75",
          )}
        >
          {notification.title}
        </span>
        {isCancelled && (
          <span className="text-[10px] font-bold text-comic-red bg-comic-red/10 border border-comic-red/30 px-1.5 py-0.5 rounded shrink-0">
            Cancelado
          </span>
        )}
        {!notification.readAt && !isCancelled && (
          <span className="h-2 w-2 rounded-full bg-comic-red shrink-0" />
        )}
        <span className="text-[10px] font-medium opacity-40 shrink-0">
          {formatTimeAgo(notification.createdAt)}
        </span>
      </div>
      <p
        className={cn(
          "text-xs font-medium ml-6 break-words text-pretty",
          isCancelled ? "line-through opacity-50" : "opacity-70",
        )}
      >
        {notification.message}
      </p>
    </>
  );

  // Fora de um MenuContent o DropdownMenuItem do Radix crasha — no modal usamos
  // div neutra com o mesmo visual.
  return (
    <div
      className={cn(
        "border-b border-ink/10 last:border-0",
        !notification.readAt && !isCancelled && "bg-comic-yellow/30",
        isCancelled && "bg-muted/30 opacity-80",
        justArrived && "animate-comic-pop motion-reduce:animate-none",
      )}
    >
      {variant === "menu" ? (
        <DropdownMenuItem onClick={onOpen} className={rowClasses}>
          {body}
        </DropdownMenuItem>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen();
            }
          }}
          className={rowClasses}
        >
          {body}
        </div>
      )}
    </div>
  );
}

// ── Linha de conversão em andamento ──────────────────────────────────────────

interface ActiveConversionSummary {
  conversionId: string;
  title: string;
  progress: number;
  completedJobs: number;
  totalJobs: number;
  output?: { format: string };
  downloadOnly?: boolean;
}

function ActiveConversionRow({
  conversion,
  live,
  justAdded,
  onAnimated,
  onOpen,
  variant = "menu",
}: {
  conversion: ActiveConversionSummary;
  live?: LiveConversionProgress;
  justAdded: boolean;
  onAnimated: (id: string) => void;
  onOpen: () => void;
  /** "menu": DropdownMenuItem (dropdown). "panel": div neutra (modal histórico). */
  variant?: "menu" | "panel";
}) {
  const queryClient = useQueryClient();
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => onAnimated(conversion.conversionId), 700);
    return () => clearTimeout(t);
  }, [justAdded, conversion.conversionId, onAnimated]);

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await conversionsApi.cancel(conversion.conversionId);
      toast.success("Download/conversão cancelado");
      void queryClient.invalidateQueries({ queryKey: ["conversions"] });
      void queryClient.invalidateQueries({ queryKey: ["source"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      toast.error("Erro ao cancelar");
    } finally {
      setIsCancelling(false);
    }
  };

  const isDownloadOnly = live?.downloadOnly ?? conversion.downloadOnly ?? false;
  const overall = Math.max(0, Math.min(100, live?.overall ?? conversion.progress));

  const rowClasses = cn(
    "flex flex-col items-start gap-1 px-4 py-2.5 cursor-pointer group",
    ITEM_HOVER,
    justAdded && "animate-comic-pop motion-reduce:animate-none",
  );

  // Rótulo: capítulos soltos mostram contagem de capítulos + falhas em tempo
  // real (ex: "3/12 capítulo(s) • 1 falha(s) • 25%"); conversões mantêm volumes.
  const progressLabel = isDownloadOnly
    ? live && live.chaptersTotal > 0
      ? `${live.chaptersDone}/${live.chaptersTotal} capítulo(s)${
          live.chaptersFailed > 0 ? ` • ${live.chaptersFailed} falha(s)` : ""
        } • ${overall}%`
      : `Baixando capítulo(s) • ${overall}%`
    : `${conversion.completedJobs}/${conversion.totalJobs} volume(s) • ${overall}%`;

  const body = (
    <>
      <div className="flex items-center justify-between gap-2 w-full mb-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isCancelling ? (
            <Loader2 className="h-4 w-4 text-comic-red animate-spin shrink-0" />
          ) : (
            <Loader2 className="h-4 w-4 text-comic-blue animate-spin shrink-0" />
          )}
          <span
            className={cn(
              "font-display text-sm truncate flex-1 min-w-0",
              isCancelling && "line-through decoration-comic-red decoration-2 opacity-60",
            )}
          >
            {conversion.title}
          </span>
          {/* Badge de formato só faz sentido para conversões KCC reais */}
          {!isDownloadOnly && conversion.output?.format && (
            <span className="text-[10px] font-medium opacity-50 shrink-0 uppercase">
              {conversion.output.format}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isCancelling}
          title="Cancelar este download/conversão"
          aria-label={`Cancelar ${conversion.title}`}
          className="h-6 w-6 rounded border border-ink/40 bg-muted/40 hover:bg-comic-red hover:text-primary-foreground flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-comic-sm ml-1"
        >
          {isCancelling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <div className="h-1.5 self-stretch border border-ink/30 rounded-full bg-card overflow-hidden ml-6 mr-1 my-1">
        <div
          className={cn(
            "h-full transition-all duration-500",
            isCancelling ? "bg-comic-red opacity-50" : "bg-comic-blue",
          )}
          style={{ width: `${overall}%` }}
        />
      </div>
      <p className="text-[11px] font-medium opacity-60 ml-6 break-words text-pretty">
        {isCancelling ? "Cancelando..." : progressLabel}
      </p>
    </>
  );

  // Fora do MenuContent o DropdownMenuItem do Radix crasha — no modal usamos
  // div neutra com o mesmo visual (mesmo padrão de NotificationItem).
  return variant === "menu" ? (
    <DropdownMenuItem onClick={onOpen} className={rowClasses}>
      {body}
    </DropdownMenuItem>
  ) : (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={rowClasses}
    >
      {body}
    </div>
  );
}

// ── Seção "Em andamento" (barras ao vivo) — dropdown E modal de histórico ────

function ActiveWorkSection({
  variant,
  conversions,
  liveProgress,
  lastAddedId,
  isAnimated,
  onAnimated,
  onOpen,
}: {
  variant: "menu" | "panel";
  conversions: ActiveConversionSummary[];
  liveProgress: Map<string, LiveConversionProgress>;
  lastAddedId: string | null;
  isAnimated: (id: string) => boolean;
  onAnimated: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  if (conversions.length === 0) return null;

  return (
    <div className="border-b-2 border-ink/20 shrink-0">
      <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide opacity-50">
        Em andamento
      </p>
      {conversions.map((conversion) => (
        <ActiveConversionRow
          key={conversion.conversionId}
          conversion={conversion}
          variant={variant}
          live={liveProgress.get(conversion.conversionId)}
          justAdded={
            conversion.conversionId === lastAddedId && !isAnimated(conversion.conversionId)
          }
          onAnimated={onAnimated}
          onOpen={() => onOpen(conversion.conversionId)}
        />
      ))}
    </div>
  );
}

// ── Centro de notificações (sino do header) ──────────────────────────────────
export function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    clearHistory,
    pulseSignal,
    lastNotificationId,
    triggerPulse,
  } = useNotifications();
  const { data: activeData } = useActiveConversions();
  const activeConversions = activeData?.items ?? [];

  // Progresso ao vivo via SSE por conversão ativa (o % da listagem congela
  // durante downloads — ver useLiveConversionProgress).
  const liveIds = activeConversions.map((c) => c.conversionId);
  const liveProgress = useLiveConversionProgress(liveIds);

  // Ids já animados — a entrada anima apenas na primeira aparição.
  const animatedIdsRef = useRef<Set<string>>(new Set());
  const handleAnimated = useCallback((id: string) => animatedIdsRef.current.add(id), []);

  // ── Pulso quando entra conversão nova em andamento (estilo Chrome) ──────
  const seenActiveRef = useRef<Set<string> | null>(null);
  const [lastAddedActiveId, setLastAddedActiveId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Menu controlado: re-busca frescor ao abrir o sino.
  const [menuOpen, setMenuOpen] = useState(false);
  const handleMenuOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        // Rede de segurança de frescor: a lista do sino atualiza via SSE;
        // se o stream estiver morto/defasado, abrir o sino re-busca.
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
      setMenuOpen(open);
    },
    [queryClient],
  );
  // Confirmação em 2 etapas do "Limpar histórico": 1º clique arma, 2º executa.
  const [confirmingClear, setConfirmingClear] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClearHistory = () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmingClear(false), 3_000);
      return;
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingClear(false);
    clearHistory();
  };

  useEffect(() => {
    if (historyOpen) return;
    // Modal fechou com confirmação armada — desarma.
    setConfirmingClear(false);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  }, [historyOpen]);

  // Histórico completo do modal (100 recentes = retenção máxima).
  const historyQuery = useQuery({
    queryKey: ["notifications", "history"],
    queryFn: () => notificationsApi.list(100),
    enabled: historyOpen,
    staleTime: 30_000,
  });

  // Chave estável dos ids ativos — evita reexecutar o efeito a cada render
  // (a identidade do array muda com cada poll).
  const activeIdsKey = useMemo(
    () => liveIds.join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeData],
  );

  useEffect(() => {
    const ids = activeIdsKey ? activeIdsKey.split(",") : [];
    if (seenActiveRef.current === null) {
      seenActiveRef.current = new Set(ids);
    } else {
      const seen = seenActiveRef.current;
      const fresh = ids.filter((id) => !seen.has(id));
      for (const id of ids) seen.add(id);
      if (fresh.length > 0) {
        triggerPulse();
        setLastAddedActiveId(fresh[0]);
      }
    }
  }, [activeIdsKey, triggerPulse]);

  const openNotification = (n: NotificationDTO) => {
    markAsRead(n.id);
    const conversionId = n.metadata?.conversionId;
    const sourceId = n.metadata?.sourceId;
    if (conversionId) {
      navigate({ to: "/biblioteca/converter/$jobId", params: { jobId: conversionId } });
    } else if (sourceId) {
      // Notificações de download de capítulos apontam para a página da obra.
      navigate({ to: "/biblioteca/$sourceId", params: { sourceId } });
    }
  };

  const hasActiveWork = activeConversions.length > 0;
  const activeWorkTitle =
    activeConversions.length > 0 ? `${activeConversions.length} conversão(ões)/download(s)` : null;

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-md border-[3px] border-ink bg-card shadow-comic-sm hover:-translate-y-0.5 transition-all"
            title={
              hasActiveWork
                ? `${activeWorkTitle}${unreadCount > 0 ? ` • ${unreadCount} notificação(ões)` : ""}`
                : unreadCount > 0
                  ? `${unreadCount} notificação(ões)`
                  : "Notificações"
            }
          >
            {/* key por pulso: remonta o ícone e reinicia a animação de sino */}
            <Bell
              key={`bell-${pulseSignal}`}
              className={cn(
                "h-4 w-4",
                unreadCount > 0 && "text-comic-blue",
                pulseSignal > 0 && "animate-bell-ring motion-reduce:animate-none",
              )}
            />
            {unreadCount > 0 && (
              <span
                key={`badge-${pulseSignal}`}
                className={cn(
                  "absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-comic-red px-0.5 text-[10px] font-bold text-primary-foreground",
                  pulseSignal > 0 && "animate-badge-pop motion-reduce:animate-none",
                )}
              >
                {unreadCount}
              </span>
            )}
            {/* Indicador permanente de atividade em curso (estilo download do Chrome) */}
            {hasActiveWork && (
              <span
                className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-card bg-comic-blue animate-pulse-glow motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 border-[3px] border-ink shadow-comic p-0">
          {/* ── Barra contextual rápida (apenas quando houver não lidas) ── */}
          {unreadCount > 0 && (
            <div className="flex items-center justify-between px-3.5 py-2 border-b-2 border-ink/20 bg-comic-yellow/50 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-foreground">
                <span className="h-2 w-2 rounded-full bg-comic-red shrink-0" />
                {unreadCount} nova{unreadCount > 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-1 font-medium text-comic-blue hover:text-comic-red underline underline-offset-2 transition-colors cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas como lidas
              </button>
            </div>
          )}

          {/* ── Seção 1: Em andamento (barras ao vivo) ── */}
          <ActiveWorkSection
            variant="menu"
            conversions={activeConversions}
            liveProgress={liveProgress}
            lastAddedId={lastAddedActiveId}
            isAnimated={(id) => animatedIdsRef.current.has(id)}
            onAnimated={handleAnimated}
            onOpen={(jobId) => navigate({ to: "/biblioteca/converter/$jobId", params: { jobId } })}
          />

          {/* ── Seção 2: Histórico persistido ── */}
          <div className="max-h-80 overflow-y-auto overflow-x-hidden">
            {isLoading ? (
              <div className="px-4 py-8 text-center">
                <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin opacity-40" />
                <p className="text-sm font-medium opacity-50">Carregando…</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium opacity-50">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map((n) => {
                const justArrived =
                  n.id === lastNotificationId && !animatedIdsRef.current.has(n.id);
                return (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    justArrived={justArrived}
                    onAnimated={handleAnimated}
                    onOpen={() => openNotification(n)}
                  />
                );
              })
            )}
          </div>

          {/* ── Rodapé: histórico completo ── */}
          <DropdownMenuItem
            onSelect={() => setHistoryOpen(true)}
            className={cn(
              "flex items-center justify-center gap-2 border-t-2 border-ink/20 px-4 py-2.5 cursor-pointer font-display text-sm",
              ITEM_HOVER,
            )}
          >
            <History className="h-4 w-4" />
            Ver histórico completo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Modal: histórico completo (100 recentes) ──
          FORA do DropdownMenu: os itens usam div neutra (variant="panel"),
          pois DropdownMenuItem fora de um MenuContent crasha. */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="border-[3px] border-ink shadow-comic-lg max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0">
          <DialogTitle className="flex items-center justify-between gap-2 px-4 py-3 border-b-2 border-ink/20 bg-comic-yellow">
            <span className="font-display text-xl flex items-center gap-2">
              <History className="h-5 w-5" /> Histórico completo
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-medium underline underline-offset-2 hover:text-comic-red"
              >
                Marcar todas como lidas
              </button>
            )}
          </DialogTitle>

          {/* ── Em andamento (mesmas barras ao vivo do dropdown) ── */}
          <ActiveWorkSection
            variant="panel"
            conversions={activeConversions}
            liveProgress={liveProgress}
            lastAddedId={lastAddedActiveId}
            isAnimated={(id) => animatedIdsRef.current.has(id)}
            onAnimated={handleAnimated}
            onOpen={(jobId) => {
              setHistoryOpen(false);
              navigate({ to: "/biblioteca/converter/$jobId", params: { jobId } });
            }}
          />

          <div className="overflow-y-auto overflow-x-hidden flex-1">
            {historyQuery.isLoading ? (
              <div className="px-4 py-10 text-center">
                <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin opacity-40" />
                <p className="text-sm font-medium opacity-50">Carregando…</p>
              </div>
            ) : (historyQuery.data?.items ?? []).length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium opacity-50">Nenhuma notificação no histórico</p>
              </div>
            ) : (
              historyQuery.data!.items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  variant="panel"
                  justArrived={false}
                  onAnimated={() => {}}
                  onOpen={() => {
                    // Fecha a modal antes de navegar para a página alvo.
                    setHistoryOpen(false);
                    openNotification(n);
                  }}
                />
              ))
            )}
          </div>

          {/* ── Rodapé: limpar histórico (confirmação em 2 etapas) ── */}
          <div className="border-t-2 border-ink/20 px-4 py-2.5 flex justify-end">
            <button
              type="button"
              onClick={handleClearHistory}
              disabled={historyQuery.isLoading}
              className={cn(
                "inline-flex items-center gap-1.5 border-[2.5px] border-ink rounded-md font-display text-xs px-3 py-1.5 transition-all",
                confirmingClear
                  ? "bg-comic-red text-primary-foreground hover:-translate-y-0.5"
                  : "bg-card hover:bg-muted hover:-translate-y-0.5",
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmingClear ? "Confirmar exclusão?" : "Limpar histórico"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
