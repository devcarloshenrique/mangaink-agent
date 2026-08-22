import { useEffect, useRef, useState, memo } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSourceConversions } from "@/hooks/useSourceConversions";
import { useConversionActions } from "@/hooks/useConversionActions";
import { ConversionLogsModal } from "@/components/biblioteca/ConversionLogsModal";
import type { ConversionLot, ConversionVolume } from "@/types/conversion-tab.types";
import { extractSeriesInitials } from "@/types/conversion-tab.types";
import type { ConversionStatus, JobStatus } from "@/types/conversion";

interface TabConversoesProps {
  sourceId: string;
  seriesTitle?: string;
}

/* ── Status / formatos ─────────────────────────────────────── */

const LOT_STATUS: Record<
  ConversionStatus,
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
  cancelled: {
    chip: "bg-muted text-muted-foreground",
    label: "Cancelado",
    dot: "bg-muted-foreground",
  },
};

const VOL_STATUS: Record<JobStatus, { icon: typeof Clock; cls: string; label: string }> = {
  completed: { icon: CheckCircle2, cls: "text-comic-blue", label: "Pronto" },
  converting: { icon: Loader2, cls: "text-ink", label: "Convertendo" },
  packaging: { icon: Loader2, cls: "text-ink", label: "Empacotando" },
  downloading: { icon: Download, cls: "text-ink", label: "Baixando" },
  preparing: { icon: Clock, cls: "text-muted-foreground", label: "Preparando" },
  queued: { icon: Clock, cls: "text-muted-foreground", label: "Na fila" },
  failed: { icon: AlertTriangle, cls: "text-comic-red", label: "Falhou" },
  cancelled: { icon: Clock, cls: "text-muted-foreground", label: "Cancelado" },
};

const isSelectable = (v: ConversionVolume) => v.state === "completed";

/* ── Botões (estilo Comic) ──────────────────────────────────── */

const btnBase =
  "inline-flex items-center justify-center gap-1.5 border-[2.5px] border-ink rounded-lg font-display text-[11px] uppercase tracking-wider px-2.5 py-1.5 whitespace-nowrap transition-all hover:-translate-y-0.5 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0";
const btnYellow = cn(btnBase, "bg-comic-yellow text-ink shadow-comic-sm");
const btnRed = cn(btnBase, "bg-comic-red text-white shadow-comic-sm");
const btnGhost = cn(btnBase, "bg-card");
const btnBlue = cn(btnBase, "bg-comic-blue text-white shadow-comic-sm");
const btnIcon =
  "inline-flex items-center justify-center h-[34px] w-[34px] border-[2.5px] border-ink rounded-md bg-card shadow-comic-sm transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0";

/* ── Peças pequenas ────────────────────────────────────────── */

function StChip({ status, small }: { status: ConversionStatus; small?: boolean }) {
  const s = LOT_STATUS[status] ?? LOT_STATUS.queued;
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

function VolCover({ vol, seriesTitle }: { vol: string; seriesTitle?: string }) {
  const initials = extractSeriesInitials(seriesTitle);
  return (
    <div className="relative h-[50px] w-[34px] shrink-0 border-[2.5px] border-ink rounded-md shadow-comic-sm bg-comic-yellow bg-halftone flex flex-col items-center justify-center overflow-hidden">
      <span className="absolute -top-[3px] -right-[3px] h-[14px] w-[14px] bg-comic-red rotate-45" />
      <span className="font-display text-xs text-comic-red -rotate-[4deg] leading-none">
        {initials}
      </span>
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
  v: ConversionVolume;
  checked: boolean;
  onToggle: (c: boolean) => void;
}) {
  const ok = isSelectable(v);
  return (
    <label
      className="inline-flex items-center shrink-0 cursor-pointer"
      title={ok ? "Selecionar volume" : "Volume ainda não disponível para seleção"}
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

function VolStatusCell({ v }: { v: ConversionVolume }) {
  const s = VOL_STATUS[v.state] ?? VOL_STATUS.queued;
  const Icon = s.icon;
  const isSpinning =
    v.state === "converting" || v.state === "packaging" || v.state === "downloading";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold shrink-0">
      <Icon className={cn("h-3.5 w-3.5", s.cls, isSpinning && "animate-spin")} />
      {s.label}
    </span>
  );
}

function MiniProgress({ pct }: { pct: number }) {
  return (
    <span className="h-1.5 w-[72px] border-[1.5px] border-ink rounded-full overflow-hidden bg-card shrink-0">
      <i className="block h-full bg-comic-yellow" style={{ width: `${pct}%` }} />
    </span>
  );
}

/* ── Menu suspenso (dropdown) ──────────────────────────────── */

interface MenuItemDef {
  icon: typeof FileText;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}

function MoreMenu({ items, onClose }: { items: MenuItemDef[]; onClose: () => void }) {
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[200px] bg-card border-[3px] border-ink rounded-lg shadow-comic p-1.5 animate-slide-up">
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            disabled={it.disabled}
            title={it.title}
            onClick={() => {
              if (it.disabled) return;
              onClose();
              it.onClick();
            }}
            className={cn(
              "flex items-center gap-2 w-full text-left font-semibold text-[13px] px-2.5 py-2 rounded-md transition-colors",
              it.disabled
                ? "opacity-40 cursor-not-allowed text-muted-foreground"
                : "hover:bg-muted cursor-pointer",
              it.danger && !it.disabled && "text-comic-red hover:bg-comic-red/10",
            )}
          >
            <it.icon className="h-3.5 w-3.5 shrink-0" />
            {it.label}
          </button>
        ))}
      </div>
    </>
  );
}

/* ── Linha de volume ───────────────────────────────────────── */

interface VolumeRowProps {
  lot: ConversionLot;
  v: ConversionVolume;
  checked: boolean;
  menuOpen: boolean;
  onToggleCheck: (c: boolean) => void;
  onRead: () => void;
  onDownload: () => void;
  onReconvert: () => void;
  onOpenLogs: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}

function VolumeRow({
  lot,
  v,
  checked,
  menuOpen,
  onToggleCheck,
  onRead,
  onDownload,
  onReconvert,
  onOpenLogs,
  onToggleMenu,
  onCloseMenu,
}: VolumeRowProps) {
  const serie = lot.series || "Obra";
  const file = v.outputFile || `${serie} - ${v.vol}.${lot.format.toLowerCase()}`;
  const isCompleted = v.state === "completed";
  const hasProgress =
    (v.state === "converting" || v.state === "packaging" || v.state === "downloading") &&
    v.pct != null;

  return (
    <div
      className={cn(
        "flex items-center gap-3.5 border-2 border-ink rounded-[10px] px-3 py-2.5 transition-colors bg-[color-mix(in_oklch,var(--muted)_35%,white)] hover:bg-[color-mix(in_oklch,var(--muted)_75%,white)]",
        checked && "bg-[color-mix(in_oklch,var(--comic-yellow)_26%,white)]",
        menuOpen ? "relative z-30" : "relative z-0",
      )}
    >
      <VolCheck v={v} checked={checked} onToggle={onToggleCheck} />
      <VolCover vol={v.vol} seriesTitle={serie} />
      <div className="flex-1 min-w-0">
        <div className="font-display text-sm uppercase tracking-wide leading-tight">
          {v.vol} <span className="opacity-55">·</span> {v.ch}
        </div>
        <div className="text-[10.5px] text-muted-foreground font-medium mt-0.5 truncate">
          {file} {v.size !== "—" ? `(${v.size})` : ""}
        </div>
      </div>
      <VolStatusCell v={v} />
      {hasProgress && <MiniProgress pct={v.pct ?? 0} />}
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
        {/* Botão Enviar ao Kindle (desabilitado conforme especificação) */}
        <button
          type="button"
          disabled
          title="Envio ao Kindle em breve"
          className={cn(
            btnBase,
            "bg-comic-yellow text-ink shadow-comic-sm opacity-50 cursor-not-allowed",
          )}
        >
          <Mail className="h-3.5 w-3.5" /> Enviar
        </button>

        {/* Botão Ler */}
        <button
          type="button"
          onClick={onRead}
          disabled={!isCompleted}
          title={isCompleted ? "Ler no navegador" : "Volume ainda não concluído"}
          className={btnBlue}
        >
          <Eye className="h-3.5 w-3.5" /> Ler
        </button>

        {/* Botão Baixar */}
        <button
          type="button"
          onClick={onDownload}
          disabled={!isCompleted}
          title={isCompleted ? "Baixar arquivo" : "Volume ainda não concluído"}
          className={btnGhost}
        >
          <Download className="h-3.5 w-3.5" />
        </button>

        {/* Menu mais ações */}
        <div className="relative">
          <button
            type="button"
            onClick={onToggleMenu}
            className={btnIcon}
            title="Mais ações do volume"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <MoreMenu
              onClose={onCloseMenu}
              items={[
                {
                  icon: RotateCw,
                  label: "Reconverter no Wizard",
                  onClick: onReconvert,
                },
                {
                  icon: FileText,
                  label: "Ver logs",
                  onClick: onOpenLogs,
                },
                {
                  icon: Trash2,
                  label: "Excluir volume",
                  disabled: true,
                  title:
                    "Exclusão individual ainda não disponível — use 'Remover lote' nas ações do lote",
                  danger: true,
                  onClick: () => {},
                },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton do Container Completo (Premium Comic Pop-Art) ─────── */

function SkeletonVolRow({ delay }: { delay: number }) {
  return (
    <div
      className="flex items-center gap-3.5 border-[2.5px] border-ink/12 rounded-[10px] px-3 py-2.5 bg-[color-mix(in_oklch,var(--muted)_25%,white)] skeleton-shimmer animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Checkbox bone */}
      <div className="h-5 w-5 rounded-md border-[2.5px] border-ink/12 skeleton-bone shrink-0" />

      {/* Mini-cover placeholder — matches VolCover iconic shape */}
      <div className="relative h-[50px] w-[34px] shrink-0 border-[2.5px] border-ink/15 rounded-md overflow-hidden bg-[color-mix(in_oklch,var(--comic-yellow)_35%,var(--card))] bg-halftone">
        <span className="absolute -top-[3px] -right-[3px] h-[14px] w-[14px] bg-comic-red/20 rotate-45" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-3 w-5 rounded skeleton-bone" />
        </span>
      </div>

      {/* Text content */}
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center gap-2">
          <div className="h-4 w-20 skeleton-bone-dark rounded" />
          <div className="h-4 w-px bg-ink/10" />
          <div className="h-3.5 w-28 skeleton-bone rounded" />
        </div>
        <div className="h-3 w-44 skeleton-bone rounded" />
      </div>

      {/* Status chip bone */}
      <div className="h-6 w-[72px] rounded-full border-[2px] border-ink/10 skeleton-bone shrink-0 hidden sm:block" />

      {/* Action button bones */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="h-8 w-[72px] rounded-lg border-[2.5px] border-ink/12 skeleton-bone hidden sm:block" />
        <div className="h-8 w-[52px] rounded-lg border-[2.5px] border-ink/12 skeleton-bone hidden sm:block" />
        <div className="h-8 w-8 rounded-lg border-[2.5px] border-ink/12 skeleton-bone" />
        <div className="h-[34px] w-[34px] rounded-md border-[2.5px] border-ink/12 skeleton-bone" />
      </div>
    </div>
  );
}

export function TabConversoesSkeleton() {
  return (
    <div className="rounded-xl border-[3px] border-ink shadow-comic bg-card overflow-hidden animate-slide-up">
      {/* ── Header skeleton ── */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b-2 border-ink/15 bg-[color-mix(in_oklch,var(--comic-yellow)_42%,white)]">
        {/* Dropdown title bone */}
        <div className="flex items-center gap-1.5">
          <div className="h-8 w-48 rounded-lg skeleton-shimmer skeleton-bone border-[2px] border-ink/15" />
          <div className="h-4 w-4 rounded skeleton-bone" />
        </div>
        <span className="flex-1" />
        {/* Nova conversão button bone */}
        <div className="h-8 w-[140px] rounded-lg border-[2.5px] border-ink/12 bg-[color-mix(in_oklch,var(--comic-red)_15%,var(--card))] skeleton-shimmer skeleton-bone hidden sm:block" />
        {/* Menu icon bone */}
        <div className="h-[34px] w-[34px] rounded-md skeleton-shimmer skeleton-bone border-[2.5px] border-ink/12 shrink-0" />
      </div>

      {/* ── Body skeleton ── */}
      <div className="p-[18px] flex flex-col gap-3.5 min-w-0">
        {/* Metadata row */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Device tag bone */}
          <div className="inline-flex items-center gap-1.5 h-7 w-24 rounded-md border-[2px] border-ink/12 skeleton-bone skeleton-shimmer" />
          {/* Status chip bone */}
          <div className="inline-flex items-center gap-1.5 h-7 w-20 rounded-full border-[2px] border-ink/12 skeleton-bone skeleton-shimmer" />
          {/* Volume count bone */}
          <div className="ml-auto h-4 w-36 rounded skeleton-bone" />
          {/* Select-all bone */}
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded border-[2px] border-ink/12 skeleton-bone" />
            <div className="h-3 w-[90px] rounded skeleton-bone" />
          </div>
        </div>

        {/* ── Volume row skeletons (staggered entrance) ── */}
        <div className="flex flex-col gap-2.5">
          <SkeletonVolRow delay={0} />
          <SkeletonVolRow delay={80} />
          <SkeletonVolRow delay={160} />
        </div>
      </div>
    </div>
  );
}

/* ── Componente principal ──────────────────────────────────── */

export const TabConversoes = memo(function TabConversoes({
  sourceId,
  seriesTitle,
}: TabConversoesProps) {
  const navigate = useNavigate();
  const { lots, selectedLot, selectedId, setSelectedId, isLoading, isDetailsLoading, refetch } =
    useSourceConversions(sourceId, seriesTitle);

  const { remove, download } = useConversionActions();

  const [ddOpen, setDdOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [selectedVols, setSelectedVols] = useState<Set<string>>(new Set());
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState<"idle" | "downloading">("idle");
  const [bulkDlLabel, setBulkDlLabel] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(ev: MouseEvent) {
      if (!rootRef.current?.contains(ev.target as Node)) {
        setDdOpen(false);
        setOpenMenu(null);
        setTopMenuOpen(false);
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
    setTopMenuOpen(false);
  }

  function handleNewConversion() {
    navigate({
      to: "/wizard",
      search: { sourceId },
    });
  }

  function handleReconvert(conversionId: string) {
    navigate({
      to: "/wizard",
      search: { sourceId, conversionId },
    });
  }

  async function handleDeleteLot(conversionId: string) {
    try {
      await remove(conversionId);
      refetch();
    } catch {
      // Toast é tratado pelo useConversionActions
    }
    setConfirmId(null);
    setDdOpen(false);
    setTopMenuOpen(false);
  }

  function handleRead(jobId: string) {
    if (!selectedLot) return;
    navigate({
      to: "/biblioteca/reader/$conversionId",
      params: { conversionId: selectedLot.id },
      search: { jobId },
    });
  }

  function handleDownloadJob(jobId: string) {
    if (!selectedLot) return;
    download(selectedLot.id, jobId);
  }

  function toggleAll(checked: boolean) {
    if (!selectedLot) return;
    const completedIds = selectedLot.vols.filter(isSelectable).map((v) => v.id);
    setSelectedVols(checked ? new Set(completedIds) : new Set());
  }

  async function handleBulkDownload() {
    if (!selectedLot || bulkBusy !== "idle" || selectedVols.size === 0) return;
    setBulkBusy("downloading");
    const count = selectedVols.size;
    let downloadedCount = 0;
    setBulkDlLabel(`Baixando 0/${count}...`);

    for (const jobId of selectedVols) {
      try {
        await download(selectedLot.id, jobId);
        downloadedCount++;
        setBulkDlLabel(`Baixando ${downloadedCount}/${count}...`);
      } catch (err) {
        console.error(`Erro ao baixar volume ${jobId}:`, err);
      }
    }

    setBulkDlLabel(`${downloadedCount} baixado(s)!`);
    setTimeout(() => {
      setBulkBusy("idle");
      setBulkDlLabel(null);
      setSelectedVols(new Set());
    }, 1500);
  }

  // Loading skeleton estilo LinkedIn
  if (isLoading && lots.length === 0) {
    return <TabConversoesSkeleton />;
  }

  // Empty state
  if (!lots.length) {
    return (
      <div className="bg-card border-[3px] border-dashed border-ink rounded-xl bg-halftone px-6 py-14 text-center animate-slide-up">
        <div className="h-[72px] w-[72px] mx-auto mb-4 border-[3px] border-ink rounded-full bg-comic-yellow shadow-comic-sm grid place-items-center">
          <BookOpen className="h-8 w-8" />
        </div>
        <h3 className="font-display text-[26px] mb-2">Nenhuma conversão ainda</h3>
        <p className="max-w-[460px] mx-auto mb-5 font-medium text-muted-foreground">
          Converta os capítulos desta obra e acompanhe os lotes aqui — para ler no navegador, baixar
          ou enviar direto ao seu Kindle.
        </p>
        <div className="flex gap-2.5 justify-center flex-wrap">
          <button type="button" className={btnRed} onClick={handleNewConversion}>
            <Plus className="h-4 w-4" /> Converter esta obra
          </button>
          <button
            type="button"
            className={btnGhost}
            onClick={() =>
              toast.info("Selecione os capítulos no assistente para gerar EPUB, MOBI ou PDF.")
            }
          >
            Como funciona?
          </button>
        </div>
      </div>
    );
  }

  if (!selectedLot) return null;

  const enabledCount = selectedLot.vols.filter(isSelectable).length;
  const allChecked = enabledCount > 0 && selectedVols.size === enabledCount;
  const volsTotal = lots.reduce((acc, l) => acc + l.vols.length, 0);

  return (
    <div ref={rootRef} className="rounded-xl border-[3px] border-ink shadow-comic bg-card">
      {/* Topo do Lote */}
      <div className="flex items-center gap-3 flex-wrap px-4 py-3.5 border-b-2 border-ink/15 bg-[color-mix(in_oklch,var(--comic-yellow)_42%,white)] rounded-t-[9px]">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setDdOpen((o) => !o);
              setOpenMenu(null);
              setTopMenuOpen(false);
            }}
            aria-haspopup="listbox"
            aria-expanded={ddOpen}
            className={cn(
              "inline-flex items-center gap-1.5 font-display text-[26px] md:text-[28px] uppercase tracking-wide px-2 py-1 rounded-lg transition-colors hover:bg-ink/10 cursor-pointer",
            )}
          >
            {selectedLot.title}
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
                      aria-selected={l.id === selectedLot.id}
                      className={cn(
                        "flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-left font-semibold text-[13px] cursor-pointer hover:bg-muted",
                        l.id === selectedLot.id &&
                          "bg-[color-mix(in_oklch,var(--comic-yellow)_30%,white)]",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          LOT_STATUS[l.status]?.dot ?? "bg-muted-foreground",
                        )}
                      />
                      <span className="min-w-0 truncate flex-1">{l.title}</span>
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
                              handleDeleteLot(l.id);
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
                          className="h-[26px] w-[26px] border-2 border-ink rounded-md bg-card inline-flex items-center justify-center shrink-0 hover:bg-comic-red/10 hover:text-comic-red cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 flex-wrap border-t-2 border-dashed border-ink/25 mt-1.5 pt-1.5 px-2 pb-1 text-[11px] font-bold text-muted-foreground">
                {lots.length} {lots.length === 1 ? "conversão" : "conversões"} · {volsTotal} volumes
              </div>
            </div>
          )}
        </div>

        <span className="flex-1" />

        {/* Botão Nova Conversão */}
        <button type="button" className={btnRed} onClick={handleNewConversion}>
          <Plus className="h-3.5 w-3.5" /> Nova conversão
        </button>

        {/* Ações do lote */}
        <div className="relative">
          <button
            type="button"
            className={btnIcon}
            onClick={() => setTopMenuOpen((m) => !m)}
            title="Ações do lote"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {topMenuOpen && (
            <MoreMenu
              onClose={() => setTopMenuOpen(false)}
              items={[
                {
                  icon: FileText,
                  label: "Ver logs de conversão",
                  onClick: () => setLogsModalOpen(true),
                },
                {
                  icon: RotateCw,
                  label: "Reconverter todos",
                  onClick: () => handleReconvert(selectedLot.id),
                },
                {
                  icon: Trash2,
                  label: "Remover lote",
                  danger: true,
                  onClick: () => handleDeleteLot(selectedLot.id),
                },
              ]}
            />
          )}
        </div>
      </div>

      {/* Detalhes do Lote */}
      <div className="p-[18px] flex flex-col gap-3.5 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="flex items-center gap-2 min-w-0">
            <DeviceTag device={selectedLot.device} />
            <StChip status={selectedLot.status} />
          </span>
          <div className="ml-auto flex items-center">
            {isDetailsLoading ? (
              <div className="h-4 w-28 bg-ink/10 rounded animate-pulse" />
            ) : (
              <span className="text-[11.5px] font-bold text-muted-foreground uppercase tracking-wider tabular-nums animate-fade-in">
                {selectedLot.vols.length} {selectedLot.vols.length === 1 ? "volume" : "volumes"}
                {selectedLot.totalMB !== "—" ? ` · ${selectedLot.totalMB}` : ""}
              </span>
            )}
          </div>
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

        {/* Alerta de erro do lote */}
        {selectedLot.status === "failed" && (
          <div className="flex items-center gap-2.5 flex-wrap border-[3px] border-ink rounded-lg bg-comic-red text-white shadow-comic-sm px-3.5 py-2.5 animate-fade-in">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1 min-w-[200px] font-semibold text-[13.5px]">
              {selectedLot.vols[0]?.err ?? "Falha na conversão de um ou mais volumes."}
            </span>
            <button
              type="button"
              className={cn(btnBase, "bg-white text-ink")}
              onClick={() => setLogsModalOpen(true)}
            >
              Ver logs
            </button>
            <button
              type="button"
              className={cn(btnBase, "bg-white text-ink")}
              onClick={() => handleReconvert(selectedLot.id)}
            >
              <RotateCw className="h-3.5 w-3.5" /> Reconverter
            </button>
          </div>
        )}

        {/* Alerta de conversão parcial */}
        {selectedLot.status === "partial" && (
          <div className="flex items-center gap-2.5 flex-wrap border-[3px] border-ink rounded-lg bg-comic-ink text-comic-cream shadow-comic-sm px-3.5 py-2.5 animate-fade-in">
            <Clock className="h-4 w-4 shrink-0" />
            <span className="font-semibold text-[13.5px]">
              Conversão parcial — os volumes concluídos seguem disponíveis para leitura e download.
            </span>
          </div>
        )}

        {/* Lista de Volumes */}
        {isDetailsLoading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: selectedLot.vols.length || 2 }).map((_, i) => (
              <SkeletonVolRow key={i} delay={i * 60} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 animate-fade-in">
            {selectedLot.vols.map((v, idx) => {
              const isMenuOpen = openMenu === v.id;
              return (
                <div
                  key={v.id}
                  className={cn("animate-fade-in", isMenuOpen ? "relative z-30" : "relative z-0")}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <VolumeRow
                    lot={selectedLot}
                    v={v}
                    checked={selectedVols.has(v.id)}
                    menuOpen={isMenuOpen}
                    onToggleCheck={(c) =>
                      setSelectedVols((prev) => {
                        const next = new Set(prev);
                        if (c) next.add(v.id);
                        else next.delete(v.id);
                        return next;
                      })
                    }
                    onRead={() => handleRead(v.id)}
                    onDownload={() => handleDownloadJob(v.id)}
                    onReconvert={() => handleReconvert(selectedLot.id)}
                    onOpenLogs={() => setLogsModalOpen(true)}
                    onToggleMenu={() => setOpenMenu((m) => (m === v.id ? null : v.id))}
                    onCloseMenu={() => setOpenMenu(null)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Barra fixa de ações em lote */}
        {selectedVols.size > 0 && (
          <div className="sticky bottom-3 z-[15] flex items-center gap-2.5 flex-wrap border-[3px] border-ink rounded-lg bg-comic-yellow shadow-comic-sm px-3.5 py-2.5 animate-slide-up">
            <span className="mr-auto font-bold text-xs tabular-nums text-ink">
              {selectedVols.size} {selectedVols.size === 1 ? "selecionado" : "selecionados"}
            </span>

            {/* Botão Baixar Selecionados */}
            <button
              type="button"
              className={btnBlue}
              onClick={handleBulkDownload}
              disabled={bulkBusy !== "idle"}
            >
              {bulkBusy === "downloading" && bulkDlLabel ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {bulkDlLabel}
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" /> Baixar
                </>
              )}
            </button>

            {/* Botão Enviar ao Kindle (desabilitado conforme especificação) */}
            <button
              type="button"
              disabled
              title="Envio ao Kindle em breve"
              className={cn(
                btnBase,
                "bg-muted text-muted-foreground opacity-60 cursor-not-allowed",
              )}
            >
              <Mail className="h-3.5 w-3.5" /> Enviar ao Kindle
            </button>
          </div>
        )}
      </div>

      {/* Modal de Logs */}
      <ConversionLogsModal
        conversionId={selectedLot.id}
        lotTitle={selectedLot.title}
        open={logsModalOpen}
        onOpenChange={setLogsModalOpen}
      />
    </div>
  );
});
