import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileText,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  RotateCw,
  SlidersHorizontal,
  Tablet,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MOCK_LOTS } from "@/lib/manga-detail-mocks";
import type { MockLot, MockVol, MockVolState } from "@/lib/manga-detail-mocks";

interface TabConversoesProps {
  sourceId: string;
  lots?: MockLot[];
}

/* ── Status / formatos ─────────────────────────────────────── */

const LOT_STATUS: Record<
  MockLot["status"],
  { chip: string; label: string; dot: string; pulse?: boolean }
> = {
  completed: {
    chip: "bg-[color-mix(in_oklch,var(--comic-blue)_14%,white)] text-comic-blue",
    label: "Pronto",
    dot: "bg-comic-blue",
  },
  processing: {
    chip: "bg-[color-mix(in_oklch,var(--comic-yellow)_40%,white)] text-ink",
    label: "Convertendo",
    dot: "bg-comic-yellow border-[1.5px] border-ink",
    pulse: true,
  },
  failed: {
    chip: "bg-[color-mix(in_oklch,var(--comic-red)_12%,white)] text-comic-red",
    label: "Erro",
    dot: "bg-comic-red",
  },
  partial: {
    chip: "bg-muted text-ink/65",
    label: "Parcial",
    dot: "bg-ink/65",
  },
  queued: {
    chip: "bg-card text-muted-foreground",
    label: "Na fila",
    dot: "bg-muted-foreground",
  },
  downloading: {
    chip: "bg-[color-mix(in_oklch,var(--comic-blue)_22%,white)] text-comic-blue",
    label: "Baixando",
    dot: "bg-comic-blue",
    pulse: true,
  },
};

const VOL_STATUS: Record<MockVolState, { icon: typeof Clock; cls: string; label: string }> = {
  sent: { icon: CheckCircle2, cls: "text-comic-blue", label: "Pronto" },
  ready: { icon: CheckCircle2, cls: "text-comic-blue", label: "Pronto" },
  done: { icon: CheckCircle2, cls: "text-comic-blue", label: "Pronto" },
  converting: { icon: Loader2, cls: "text-ink", label: "Convertendo" },
  queued: { icon: Clock, cls: "text-muted-foreground", label: "Na fila" },
  downloading: { icon: Download, cls: "text-ink", label: "Baixando" },
  failed: { icon: AlertTriangle, cls: "text-comic-red", label: "Falhou" },
  cancelled: { icon: Clock, cls: "text-muted-foreground", label: "Cancelado" },
};

const isSelectable = (v: MockVol) =>
  v.state === "ready" || v.state === "done" || v.state === "sent";
const isSendable = (v: MockVol) => isSelectable(v);

function totalMB(vs: MockVol[]): string {
  const mb = vs.reduce((acc, v) => {
    const n = parseFloat(String(v.size).replace(",", "."));
    return acc + (isNaN(n) ? 0 : n);
  }, 0);
  return mb.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " MB";
}

/* ── Botões (estilo C07c) ──────────────────────────────────── */

const btnBase =
  "inline-flex items-center justify-center gap-1.5 border-[2.5px] border-ink rounded-lg font-display text-[11px] uppercase tracking-wider px-2.5 py-1.5 whitespace-nowrap transition-all hover:-translate-y-0.5 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0";
const btnYellow = cn(btnBase, "bg-comic-yellow text-ink shadow-comic-sm");
const btnRed = cn(btnBase, "bg-comic-red text-white shadow-comic-sm");
const btnGhost = cn(btnBase, "bg-card");
const btnBlue = cn(btnBase, "bg-comic-blue text-white shadow-comic-sm");
const btnIcon =
  "inline-flex items-center justify-center h-[34px] w-[34px] border-[2.5px] border-ink rounded-md bg-card shadow-comic-sm transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0";

/* ── Peças pequenas ────────────────────────────────────────── */

function StChip({ status, small }: { status: MockLot["status"]; small?: boolean }) {
  const s = LOT_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border-2 border-ink rounded-full font-bold uppercase tracking-wider whitespace-nowrap",
        small ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-0.5",
        s.chip,
      )}
    >
      <span className={cn("h-[7px] w-[7px] rounded-full", s.dot, s.pulse && "animate-pulse")} />
      {s.label}
    </span>
  );
}

function DeviceTag({ device }: { device: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 border-2 border-ink rounded-md bg-card text-[11px] font-bold uppercase tracking-wider px-2 py-0.5">
      <Tablet className="h-3.5 w-3.5" />
      {device}
    </span>
  );
}

function VolCover({ vol }: { vol: string }) {
  return (
    <div className="relative h-[50px] w-[34px] shrink-0 border-[2.5px] border-ink rounded-md shadow-comic-sm bg-comic-yellow bg-halftone flex flex-col items-center justify-center overflow-hidden">
      <span className="absolute -top-[3px] -right-[3px] h-[14px] w-[14px] bg-comic-red rotate-45" />
      <span className="font-display text-xs text-comic-red -rotate-[4deg] leading-none">TBV</span>
      <span className="font-display text-[8px] tracking-wider text-ink leading-none mt-0.5">
        {vol.toUpperCase()}
      </span>
    </div>
  );
}

function VolCheck({
  v,
  checked,
  onToggle,
}: {
  v: MockVol;
  checked: boolean;
  onToggle: (c: boolean) => void;
}) {
  const ok = isSelectable(v);
  return (
    <label
      className="inline-flex items-center shrink-0 cursor-pointer"
      title={ok ? "Selecionar volume" : "Volume não disponível"}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={!ok}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span className="h-5 w-5 border-[2.5px] border-ink rounded-md bg-card shadow-comic-sm grid place-items-center transition-all peer-checked:bg-comic-red peer-checked:rotate-[4deg] peer-disabled:opacity-30 peer-disabled:cursor-not-allowed after:content-[''] after:h-[6px] after:w-[10px] after:border-l-[3px] after:border-b-[3px] after:border-white after:-rotate-45 after:scale-0 after:transition-transform after:mt-[-2px] peer-checked:after:scale-100" />
    </label>
  );
}

function VolStatusCell({ v }: { v: MockVol }) {
  const s = VOL_STATUS[v.state];
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold shrink-0">
      <Icon className={cn("h-3.5 w-3.5", s.cls, s.icon === Loader2 && "animate-spin")} />
      {s.label}
    </span>
  );
}

function MiniProgress({ pct }: { pct: number }) {
  return (
    <span className="h-1.5 w-[72px] border-[1.5px] border-ink rounded-full overflow-hidden bg-card shrink-0">
      <i className="block h-full bg-comic-yellow" style={{ width: pct + "%" }} />
    </span>
  );
}

interface SendState {
  phase: "sending" | "sent";
  sentAt?: string;
}

/* ── Menu suspenso (dropdown) ──────────────────────────────── */

interface MenuItemDef {
  icon: typeof FileText;
  label: string;
  danger?: boolean;
  onClick: () => void;
}

function MoreMenu({ items, onClose }: { items: MenuItemDef[]; onClose: () => void }) {
  return (
    <div className="absolute right-0 top-[calc(100%+6px)] z-10 min-w-[190px] bg-card border-[3px] border-ink rounded-lg shadow-comic p-1.5 animate-slide-up">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={() => {
            onClose();
            it.onClick();
          }}
          className={cn(
            "flex items-center gap-2 w-full text-left font-semibold text-[13px] px-2.5 py-2 rounded-md hover:bg-muted",
            it.danger && "text-comic-red hover:bg-comic-red/10",
          )}
        >
          <it.icon className="h-3.5 w-3.5" />
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ── Linha de volume ───────────────────────────────────────── */

interface VolumeRowProps {
  lot: MockLot;
  v: MockVol;
  checked: boolean;
  sending: boolean;
  sent: boolean;
  reading: boolean;
  menuOpen: boolean;
  onToggleCheck: (c: boolean) => void;
  onSend: () => void;
  onRead: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}

function VolumeRow({
  lot,
  v,
  checked,
  sending,
  sent,
  reading,
  menuOpen,
  onToggleCheck,
  onSend,
  onRead,
  onToggleMenu,
  onCloseMenu,
}: VolumeRowProps) {
  const serie = lot.series ?? "Boruto Two Blue Vortex";
  const file = `${serie} - ${v.vol}.${lot.format.toLowerCase()}`;
  const unavailable = ["failed", "cancelled", "queued", "downloading"].includes(v.state);
  const canSend = isSendable(v) && !sent;

  return (
    <div
      className={cn(
        "flex items-center gap-3.5 border-2 border-ink rounded-[10px] px-3 py-2.5 transition-colors bg-[color-mix(in_oklch,var(--muted)_35%,white)] hover:bg-[color-mix(in_oklch,var(--muted)_75%,white)]",
        checked && "bg-[color-mix(in_oklch,var(--comic-yellow)_26%,white)]",
      )}
    >
      <VolCheck v={v} checked={checked} onToggle={onToggleCheck} />
      <VolCover vol={v.vol} />
      <div className="flex-1 min-w-0">
        <div className="font-display text-sm uppercase tracking-wide leading-tight">
          {v.vol} <span className="opacity-55">·</span> {v.ch}
        </div>
        <div className="text-[10.5px] text-muted-foreground font-medium mt-0.5 truncate">
          {file}
        </div>
      </div>
      <VolStatusCell v={v} />
      {(v.state === "converting" || v.state === "downloading") && <MiniProgress pct={v.pct ?? 0} />}
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
        {sent ? (
          <button
            type="button"
            disabled
            className={cn(btnBase, "bg-comic-blue text-white relative")}
            aria-label="Enviado ao Kindle"
          >
            <Check className="h-3.5 w-3.5" /> Enviado
            {v.sentAt && (
              <span className="absolute -bottom-[14px] right-0 font-sans text-[9.5px] font-semibold text-muted-foreground">
                {v.sentAt}
              </span>
            )}
          </button>
        ) : sending ? (
          <button type="button" disabled className={cn(btnBase, "bg-comic-yellow text-ink")}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            title={canSend ? undefined : "Volume indisponível"}
            className={cn(btnBase, "bg-comic-yellow text-ink shadow-comic-sm")}
          >
            <Mail className="h-3.5 w-3.5" /> Enviar
          </button>
        )}
        <button type="button" onClick={onRead} disabled={unavailable} className={btnBlue}>
          <Eye className="h-3.5 w-3.5" /> {reading ? "Abrindo…" : "Ler"}
        </button>
        <button
          type="button"
          onClick={onToggleMenu}
          disabled={unavailable}
          className={btnIcon}
          title="Mais ações"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <MoreMenu
            onClose={onCloseMenu}
            items={[
              {
                icon: RotateCw,
                label: "Reconverter volume",
                onClick: () => toast.info("Reconversão de volume em breve"),
              },
              {
                icon: SlidersHorizontal,
                label: "Configurar",
                onClick: () => toast.info("Configurações em breve"),
              },
              {
                icon: Trash2,
                label: "Excluir volume",
                danger: true,
                onClick: () => toast.info("Exclusão de volume em breve"),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}

/* ── Componente principal ──────────────────────────────────── */

export function TabConversoes({ lots: initialLots = MOCK_LOTS }: TabConversoesProps) {
  const [lots, setLots] = useState<MockLot[]>(initialLots);
  const [selectedId, setSelectedId] = useState<string>(initialLots[0]?.id ?? "");
  const [ddOpen, setDdOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [selectedVols, setSelectedVols] = useState<Set<string>>(new Set());
  const [sendMap, setSendMap] = useState<Record<string, SendState>>({});
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [readingVol, setReadingVol] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<"idle" | "sending" | "downloading">("idle");
  const [bulkDlLabel, setBulkDlLabel] = useState<string | null>(null);
  const [ddNote, setDdNote] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const lot = lots.find((l) => l.id === selectedId) ?? lots[0] ?? null;

  useEffect(() => {
    function onDown(ev: MouseEvent) {
      if (!rootRef.current?.contains(ev.target as Node)) {
        setDdOpen(false);
        setOpenMenu(null);
        setConfirmId(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function selectLot(id: string) {
    setSelectedId(id);
    setSelectedVols(new Set());
    setConfirmId(null);
    setDdOpen(false);
    setOpenMenu(null);
  }

  function sendFlow(vol: string) {
    if (sendMap[vol]) return;
    setSendMap((m) => ({ ...m, [vol]: { phase: "sending" } }));
    setTimeout(() => {
      setSendMap((m) => ({ ...m, [vol]: { phase: "sent", sentAt: "agora" } }));
    }, 1600);
  }

  function addVolume() {
    if (!lot) return;
    const n = lot.vols.length + 1;
    const novo: MockVol = {
      vol: "Vol. " + n,
      ch: "Cap. " + (n * 6 - 5) + " – " + n * 6,
      size: "12,4 MB",
      state: "ready",
    };
    setLots((prev) =>
      prev.map((l) =>
        l.id === lot.id
          ? { ...l, vols: [...l.vols, novo], totalMB: totalMB([...l.vols, novo]) }
          : l,
      ),
    );
  }

  function deleteLot(id: string) {
    const idx = lots.findIndex((l) => l.id === id);
    setLots((prev) => prev.filter((l) => l.id !== id));
    if (selectedId === id) {
      const next = lots[idx + 1] ?? lots[idx - 1] ?? null;
      setSelectedId(next ? next.id : "");
      setSelectedVols(new Set());
    }
    setConfirmId(null);
    setDdOpen(false);
    setDdNote("1 excluída ✓");
    setTimeout(() => setDdNote(null), 1400);
  }

  function toggleAll(checked: boolean) {
    if (!lot) return;
    const enabled = lot.vols.filter(isSelectable).map((v) => v.vol);
    setSelectedVols(checked ? new Set(enabled) : new Set());
  }

  function bulkSend() {
    if (!lot || bulkBusy !== "idle") return;
    const pending = lot.vols.filter(
      (v) => selectedVols.has(v.vol) && isSendable(v) && !sendMap[v.vol]?.phase,
    );
    if (!pending.length) {
      setSelectedVols(new Set());
      return;
    }
    setBulkBusy("sending");
    let i = 0;
    const tick = setInterval(() => {
      if (i >= pending.length) {
        clearInterval(tick);
        setBulkBusy("idle");
        setSelectedVols(new Set());
        return;
      }
      sendFlow(pending[i].vol);
      i++;
    }, 700);
  }

  function bulkDownload() {
    const n = selectedVols.size;
    if (!n || bulkBusy !== "idle") return;
    setBulkBusy("downloading");
    setBulkDlLabel("Baixando " + n + "…");
    setTimeout(() => {
      setBulkDlLabel(n + " baixados");
      setTimeout(() => {
        setBulkBusy("idle");
        setBulkDlLabel(null);
        setSelectedVols(new Set());
      }, 1400);
    }, 1300);
  }

  function bulkRemove() {
    if (!lot) return;
    const rem = new Set(selectedVols);
    setLots((prev) =>
      prev.map((l) => {
        if (l.id !== lot.id) return l;
        const vols = l.vols.filter((v) => !rem.has(v.vol));
        return { ...l, vols, totalMB: totalMB(vols) };
      }),
    );
    setSelectedVols(new Set());
  }

  if (!lots.length) {
    return (
      <div className="bg-card border-[3px] border-dashed border-ink rounded-xl bg-halftone px-6 py-14 text-center animate-slide-up">
        <div className="h-[72px] w-[72px] mx-auto mb-4 border-[3px] border-ink rounded-full bg-comic-yellow shadow-comic-sm grid place-items-center">
          <BookOpen className="h-8 w-8" />
        </div>
        <h3 className="font-display text-[26px] mb-2">Nenhuma conversão ainda</h3>
        <p className="max-w-[460px] mx-auto mb-5 font-medium text-muted-foreground">
          Converta os capítulos desta série e acompanhe os lotes aqui — para ler no navegador,
          baixar ou enviar direto ao seu Kindle.
        </p>
        <div className="flex gap-2.5 justify-center flex-wrap">
          <button
            type="button"
            className={btnRed}
            onClick={() => toast.info("Converter esta série em breve")}
          >
            Converter esta série
          </button>
          <button type="button" className={btnGhost} onClick={() => toast.info("Guia em breve")}>
            Como funciona?
          </button>
        </div>
      </div>
    );
  }

  if (!lot) return null;

  const enabledCount = lot.vols.filter(isSelectable).length;
  const allChecked = enabledCount > 0 && selectedVols.size === enabledCount;
  const volsTotal = lots.reduce((acc, l) => acc + l.vols.length, 0);

  return (
    <div ref={rootRef} className="rounded-xl border-[3px] border-ink shadow-comic bg-card">
      {/* Topo */}
      <div className="flex items-center gap-3 flex-wrap px-4 py-3.5 border-b-2 border-ink/15 bg-[color-mix(in_oklch,var(--comic-yellow)_42%,white)] rounded-t-[9px]">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setDdOpen((o) => !o);
              setOpenMenu(null);
            }}
            aria-haspopup="listbox"
            aria-expanded={ddOpen}
            className={cn(
              "inline-flex items-center gap-1.5 font-display text-[28px] uppercase tracking-wide px-2 py-1 rounded-lg transition-colors hover:bg-ink/10",
            )}
          >
            {lot.title}
            <ChevronDown
              className={cn(
                "h-[18px] w-[18px] transition-transform duration-200",
                ddOpen && "rotate-180",
              )}
            />
          </button>

          {ddOpen && (
            <div
              className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-[356px] bg-card border-[3px] border-ink rounded-lg shadow-comic p-1.5 flex flex-col max-h-[320px] animate-slide-up"
              role="listbox"
              aria-label="Lotes"
            >
              <div className="overflow-y-auto">
                {lots.map((l) => {
                  const confirming = confirmId === l.id;
                  return (
                    <div
                      key={l.id}
                      onClick={() => {
                        if (confirming) return;
                        selectLot(l.id);
                      }}
                      role="option"
                      aria-selected={l.id === lot.id}
                      className={cn(
                        "flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-left font-semibold text-[13px] cursor-pointer hover:bg-muted",
                        l.id === lot.id && "bg-[color-mix(in_oklch,var(--comic-yellow)_30%,white)]",
                      )}
                    >
                      <span
                        className={cn("h-2 w-2 rounded-full shrink-0", LOT_STATUS[l.status].dot)}
                      />
                      <span className="min-w-0 truncate">{l.title}</span>
                      <StChip status={l.status} small />
                      <span className="tabular-nums text-[10px] font-bold bg-comic-ink text-comic-cream rounded-full px-1.5 py-px shrink-0">
                        {l.vols.length}
                      </span>
                      {confirming ? (
                        <span className="inline-flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteLot(l.id);
                            }}
                            title="Confirmar exclusão"
                            className="h-[26px] w-[26px] border-2 border-ink rounded-md bg-comic-blue text-white inline-flex items-center justify-center shrink-0"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmId(null);
                            }}
                            title="Cancelar"
                            className="h-[26px] w-[26px] border-2 border-ink rounded-md bg-card text-comic-red inline-flex items-center justify-center shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmId(l.id);
                          }}
                          title="Excluir conversão"
                          className="h-[26px] w-[26px] border-2 border-ink rounded-md bg-card inline-flex items-center justify-center shrink-0 hover:bg-comic-red/10 hover:text-comic-red"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 flex-wrap border-t-2 border-dashed border-ink/25 mt-1.5 pt-1.5 px-2 pb-1 text-[11px] font-bold text-muted-foreground">
                {ddNote ?? `${lots.length} conversões · ${volsTotal} volumes`}
              </div>
            </div>
          )}
        </div>

        <span className="flex-1" />

        <button type="button" className={btnYellow} onClick={addVolume}>
          <Plus className="h-3.5 w-3.5" /> Adicionar obra
        </button>
        <button
          type="button"
          className={btnRed}
          onClick={() => toast.info("Nova conversão em breve")}
        >
          <Plus className="h-3.5 w-3.5" /> Nova conversão
        </button>
        <div className="relative">
          <button
            type="button"
            className={btnIcon}
            onClick={() => setOpenMenu((m) => (m === "top" ? null : "top"))}
            title="Ações do lote"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {openMenu === "top" && (
            <MoreMenu
              onClose={() => setOpenMenu(null)}
              items={[
                {
                  icon: FileText,
                  label: "Ver log de conversão",
                  onClick: () => toast.info("Log de conversão em breve"),
                },
                {
                  icon: RotateCw,
                  label: "Reconverter todos",
                  onClick: () => toast.info("Reconversão em breve"),
                },
                {
                  icon: Trash2,
                  label: "Remover lote",
                  danger: true,
                  onClick: () => toast.info("Exclusão em breve"),
                },
              ]}
            />
          )}
        </div>
      </div>

      {/* Detalhe */}
      <div className="p-[18px] flex flex-col gap-3.5 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="flex items-center gap-2 min-w-0">
            <DeviceTag device={lot.device} />
            <StChip status={lot.status} />
          </span>
          <span className="ml-auto text-[11.5px] font-bold text-muted-foreground uppercase tracking-wider tabular-nums">
            {lot.vols.length} {lot.vols.length === 1 ? "volume" : "volumes"} · {lot.totalMB}
          </span>
          <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer select-none">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={allChecked}
              onChange={(e) => toggleAll(e.target.checked)}
            />
            <span className="h-4 w-4 border-2 border-ink rounded bg-card grid place-items-center peer-checked:bg-comic-blue after:content-[''] after:h-[5px] after:w-[8px] after:border-l-[2.5px] after:border-b-[2.5px] after:border-white after:-rotate-45 after:scale-0 after:transition-transform after:mt-[-1px] peer-checked:after:scale-100" />
            Selecionar todos
          </label>
        </div>

        {lot.status === "failed" && (
          <div className="flex items-center gap-2.5 flex-wrap border-[3px] border-ink rounded-lg bg-comic-red text-white shadow-comic-sm px-3.5 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1 min-w-[200px] font-semibold text-[13.5px]">
              {lot.vols[0]?.err ?? "Falha ao baixar capítulos — HTTP 503 do servidor de origem."}
            </span>
            <button
              type="button"
              className={cn(btnBase, "bg-white text-ink")}
              onClick={() => toast.info("Log de conversão em breve")}
            >
              Ver log
            </button>
            <button
              type="button"
              className={cn(btnBase, "bg-white text-ink")}
              onClick={() =>
                setLots((prev) =>
                  prev.map((l) => (l.id === lot.id ? { ...l, status: "processing" } : l)),
                )
              }
            >
              <RotateCw className="h-3.5 w-3.5" /> Tentar novamente
            </button>
          </div>
        )}

        {lot.status === "partial" && (
          <div className="flex items-center gap-2.5 flex-wrap border-[3px] border-ink rounded-lg bg-comic-ink text-comic-cream shadow-comic-sm px-3.5 py-2.5">
            <Clock className="h-4 w-4 shrink-0" />
            <span className="font-semibold text-[13.5px]">
              2 volumes cancelados por você — os concluídos seguem disponíveis.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {lot.vols.map((v) => {
            const send = sendMap[v.vol];
            return (
              <VolumeRow
                key={v.vol}
                lot={lot}
                v={v}
                checked={selectedVols.has(v.vol)}
                sending={send?.phase === "sending"}
                sent={send?.phase === "sent" || v.state === "sent"}
                reading={readingVol === v.vol}
                menuOpen={openMenu === v.vol}
                onToggleCheck={(c) =>
                  setSelectedVols((prev) => {
                    const next = new Set(prev);
                    if (c) next.add(v.vol);
                    else next.delete(v.vol);
                    return next;
                  })
                }
                onSend={() => sendFlow(v.vol)}
                onRead={() => setReadingVol(v.vol)}
                onToggleMenu={() => setOpenMenu((m) => (m === v.vol ? null : v.vol))}
                onCloseMenu={() => setOpenMenu(null)}
              />
            );
          })}
        </div>

        {selectedVols.size > 0 && (
          <div className="sticky bottom-3 z-[15] flex items-center gap-2.5 flex-wrap border-[3px] border-ink rounded-lg bg-comic-ink text-comic-cream shadow-comic-sm px-3.5 py-2.5 animate-slide-up">
            <span className="mr-auto font-bold text-xs tabular-nums">
              {selectedVols.size} {selectedVols.size === 1 ? "selecionado" : "selecionados"}
            </span>
            <button
              type="button"
              className={cn(btnBase, "bg-comic-cream text-ink")}
              onClick={bulkDownload}
              disabled={bulkBusy !== "idle"}
            >
              {bulkBusy === "downloading" && bulkDlLabel ? (
                <>
                  {bulkDlLabel.startsWith("Baixando") ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  {bulkDlLabel}
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" /> Baixar
                </>
              )}
            </button>
            <button
              type="button"
              className={btnRed}
              onClick={bulkSend}
              disabled={bulkBusy !== "idle"}
            >
              {bulkBusy === "sending" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…
                </>
              ) : (
                <>
                  <Mail className="h-3.5 w-3.5" /> Enviar ao Kindle
                </>
              )}
            </button>
            <button
              type="button"
              className={cn(btnBase, "bg-comic-cream text-ink")}
              onClick={bulkRemove}
              disabled={bulkBusy !== "idle"}
            >
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
