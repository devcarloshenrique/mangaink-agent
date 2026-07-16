import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { StepIndicator } from "@/components/comic/StepIndicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast, Toaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useScraping } from "@/hooks/useScraping";
import { useConversionOptions } from "@/hooks/useConversionOptions";
import { conversionsApi } from "@/lib/api";
import type { SourceInspectResponse, Chapter } from "@/types/scraping";
import type { Book, CoverRef } from "@/types/conversion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Download,
  FileStack,
  ImageIcon,
  Layers,
  Mail,
  Search,
  Send,
  Settings2,
  Tablet,
  Upload,
  Zap,
  Moon,
  Clock,
  Split,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { MockPage } from "@/components/comic/MockPage";
import { ComparisonSlider } from "@/components/wizard/ComparisonSlider";
import { cn } from "@/lib/utils";
import { authGuard } from "./-authGuard";

export const Route = createFileRoute("/wizard")({
  beforeLoad: authGuard,
  component: WizardPage,
});

const STEPS = [
  { label: "Origem", short: "Origem" },
  { label: "Capítulos", short: "Caps" },
  { label: "Capas", short: "Capas" },
  { label: "Configurações", short: "Config" },
  { label: "Envio", short: "Envio" },
];

type Delivery = "download" | "kindle";
type VolumeMode = "fixed" | "custom";
type CoverMode = "single" | "per-volume" | "per-chapter";

interface WizardData {
  // Step 1 — Origem
  url: string;
  sourceId: string | null;
  inspectData: SourceInspectResponse | null;

  // Step 2 — Capítulos
  selectedChapters: Set<string>;
  grouping: "single" | "separate";
  volumeSize: number;
  volumeMode: VolumeMode;
  volumeSizes: number[];

  // Step 3 — Capas
  coverMode: CoverMode;
  coverAssignments: Record<string, CoverRef>;

  // Step 4 — Configurações
  device: string;
  format: string;
  preset: string;
  fieldOptions: Record<string, string | number | boolean>;
  meta: { title: string; author: string };
  errorHandlingStrategy: "ignore" | "skip_chapter" | "abort";

  // Step 5 — Envio
  delivery: Delivery;
  kindleEmail: string;
}

function buildBooks(data: WizardData): Book[] {
  const chapters = data.inspectData!.chapters.filter((c) => data.selectedChapters.has(c.id));

  if (data.grouping === "single") {
    return [
      {
        title: data.meta.title || data.inspectData!.metadata.title,
        chapters: chapters.map((c) => c.id),
      },
    ];
  }

  // Agrupar por volumes
  const volumes = computeVolumes(chapters, data.volumeMode, data.volumeSize, data.volumeSizes);
  const baseTitle = data.meta.title || data.inspectData!.metadata.title;
  return volumes.map((vChapters, i) => ({
    title: `${baseTitle} - Vol. ${i + 1}`,
    chapters: vChapters.map((c) => c.id),
  }));
}

function computeVolumes(
  chapters: Chapter[],
  mode: VolumeMode,
  fixedSize: number,
  customSizes: number[],
): Chapter[][] {
  if (mode === "fixed") {
    const result: Chapter[][] = [];
    for (let i = 0; i < chapters.length; i += fixedSize) {
      result.push(chapters.slice(i, i + fixedSize));
    }
    return result;
  }
  // custom
  const result: Chapter[][] = [];
  let offset = 0;
  for (const size of customSizes) {
    result.push(chapters.slice(offset, offset + size));
    offset += size;
  }
  if (offset < chapters.length) result.push(chapters.slice(offset));
  return result.filter((v) => v.length > 0);
}

function WizardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const scraping = useScraping();
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [data, setData] = useState<WizardData>({
    url: "",
    sourceId: null,
    inspectData: null,
    selectedChapters: new Set(),
    grouping: "single",
    coverMode: "single",
    coverAssignments: {},
    device: "",
    format: "EPUB",
    preset: "",
    fieldOptions: {},
    meta: { title: "", author: "" },
    errorHandlingStrategy: "ignore",
    delivery: "kindle",
    kindleEmail: "",
    volumeSize: 8,
    volumeMode: "fixed",
    volumeSizes: [],
  });

  const update = <K extends keyof WizardData>(k: K, v: WizardData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const goto = (i: number) => i <= visited && setStep(i);

  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return scraping.state.status === "ready";
      case 1:
        return data.selectedChapters.size > 0;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        if (data.delivery === "kindle")
          return /^\S+@(kindle\.com|free\.kindle\.com)$/i.test(data.kindleEmail);
        return true;
      default:
        return true;
    }
  }, [step, data, scraping.state.status]);

  const next = () => {
    if (step === 4) {
      finish();
      return;
    }
    const n = step + 1;
    setStep(n);
    setVisited((v) => Math.max(v, n));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const handleFetch = async () => {
    if (!data.url) return;
    scraping.reset();
    setData((d) => ({ ...d, sourceId: null, inspectData: null, selectedChapters: new Set() }));
    await scraping.inspect(data.url);
  };

  // Quando scraping finaliza, sincroniza sourceId/inspectData no WizardData
  useEffect(() => {
    if (scraping.state.status === "ready" && scraping.state.metadata) {
      const meta = scraping.state.metadata;
      setData((d) => ({
        ...d,
        sourceId: scraping.state.sourceId,
        inspectData: meta,
        selectedChapters: new Set(),
        meta: {
          title: d.meta.title || meta.metadata.title,
          author: d.meta.author || (meta.metadata.author ?? ""),
        },
      }));
      setVisited((v) => Math.max(v, 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scraping.state.status, scraping.state.sourceId, scraping.state.metadata]);

  const toggleChapter = (id: string) => {
    setData((d) => {
      const s = new Set(d.selectedChapters);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return { ...d, selectedChapters: s };
    });
  };

  const finish = async () => {
    if (!user) {
      toast.error("Você precisa estar logado para converter.");
      return;
    }
    if (!data.sourceId || !data.inspectData) {
      toast.error("Nenhuma série carregada. Volte ao passo 1.");
      return;
    }
    if (data.selectedChapters.size === 0) {
      toast.error("Selecione ao menos um capítulo.");
      return;
    }
    if (
      data.delivery === "kindle" &&
      !/^\S+@(kindle\.com|free\.kindle\.com)$/i.test(data.kindleEmail)
    ) {
      toast.error("E-mail Kindle inválido.");
      return;
    }

    setFinishing(true);
    try {
      const books = buildBooks(data);
      const { conversionId } = await conversionsApi.create({
        sourceId: data.sourceId,
        cover: { kind: "original" },
        output: { deviceId: data.device || "kpw_11", format: data.format },
        metadata: data.meta,
        books,
        options: data.fieldOptions,
        errorHandlingStrategy: data.errorHandlingStrategy,
      });
      toast.success(`Conversão iniciada!`);
      navigate({ to: "/biblioteca/converter/$jobId", params: { jobId: conversionId } });
    } catch (e) {
      toast.error((e as Error).message ?? "Erro ao iniciar conversão.");
      setFinishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <ComicHeader />

      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <div className="text-center mb-6">
          <SpeechBubble variant="yellow" tail="bottom" className="mb-4">
            Passo {step + 1} de {STEPS.length}: {STEPS[step].label}
          </SpeechBubble>
          <h1 className="font-display text-4xl md:text-5xl uppercase">Mangá pro Kindle</h1>
        </div>

        <div className="mb-8">
          <StepIndicator steps={STEPS} current={step} visited={visited} onJump={goto} />
        </div>

        <ComicPanel bg="card" padding="lg" className="min-h-[420px]">
          {step === 0 && (
            <StepOrigin
              url={data.url}
              scraping={scraping}
              onUrlChange={(v) => update("url", v)}
              onFetch={handleFetch}
            />
          )}
          {step === 1 && data.inspectData && (
            <StepChapters
              chapters={data.inspectData.chapters}
              selected={data.selectedChapters}
              grouping={data.grouping}
              volumeSize={data.volumeSize}
              volumeMode={data.volumeMode}
              volumeSizes={data.volumeSizes}
              onToggle={toggleChapter}
              onSelectAll={() =>
                update("selectedChapters", new Set(data.inspectData!.chapters.map((c) => c.id)))
              }
              onClear={() => update("selectedChapters", new Set())}
              onGrouping={(g) => update("grouping", g)}
              onVolumeSize={(v) => update("volumeSize", v)}
              onVolumeMode={(m) => update("volumeMode", m)}
              onVolumeSizes={(v) => update("volumeSizes", v)}
            />
          )}
          {step === 2 && data.inspectData && (
            <StepCovers
              series={data.inspectData}
              selectedChapters={data.selectedChapters}
              mode={data.coverMode}
              assignments={data.coverAssignments}
              onMode={(m) => update("coverMode", m)}
              onAssign={(key, ref) =>
                update("coverAssignments", { ...data.coverAssignments, [key]: ref })
              }
            />
          )}
          {step === 3 && <StepConvert data={data} update={update} />}
          {step === 4 && <StepDelivery data={data} update={update} onEdit={goto} />}
        </ComicPanel>

        <div className="mt-8 flex items-center justify-between gap-4">
          <Button
            type="button"
            onClick={back}
            disabled={step === 0}
            variant="outline"
            className="border-[3px] border-ink shadow-comic-sm font-display text-lg disabled:opacity-40"
          >
            <ArrowLeft className="mr-1" /> Voltar
          </Button>
          <Link
            to="/"
            className="font-display text-sm underline underline-offset-4 hover:text-comic-red"
          >
            Cancelar
          </Link>
          <Button
            type="button"
            onClick={next}
            disabled={(step !== 4 && !canNext) || finishing}
            className="bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display text-lg disabled:opacity-40 hover:-translate-y-0.5"
          >
            {finishing ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Iniciando…
              </>
            ) : step === 4 ? (
              <>
                Converter <ArrowRight className="ml-1" />
              </>
            ) : (
              <>
                Próximo <ArrowRight className="ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Step components ---------- */

function StepOrigin({
  url,
  scraping,
  onUrlChange,
  onFetch,
}: {
  url: string;
  scraping: ReturnType<typeof useScraping>;
  onUrlChange: (v: string) => void;
  onFetch: () => void;
}) {
  const { state } = scraping;
  const isLoading = state.status === "processing";
  const isReady = state.status === "ready";
  const isFailed = state.status === "failed";

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Download />}
        title="De onde vem o mangá?"
        subtitle="Cole o link da obra que você quer levar pro Kindle."
      />
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="https://exemplo.com/manga/meu-mangá"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          className="border-[3px] border-ink h-12 text-base shadow-comic-sm focus-visible:ring-comic-blue"
          onKeyDown={(e) => e.key === "Enter" && onFetch()}
        />
        <Button
          onClick={onFetch}
          disabled={isLoading || !url}
          className="bg-comic-blue text-accent-foreground hover:bg-comic-blue h-12 border-[3px] border-ink shadow-comic font-display text-lg disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Buscando…
            </>
          ) : (
            <>
              <Search className="mr-1" /> Buscar
            </>
          )}
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <SpeechBubble variant="blue" tail="left" className="animate-comic-shake">
            {state.message ?? "Vasculhando os arquivos secretos…"}
          </SpeechBubble>
          {state.progress > 0 && (
            <div className="h-2 w-full border-2 border-ink rounded-full bg-card overflow-hidden">
              <div
                className="h-full bg-comic-blue transition-all duration-300"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {isFailed && (
        <ComicPanel bg="red" padding="md" className="animate-comic-pop">
          <p className="font-display text-lg">Erro ao inspecionar a URL</p>
          <p className="text-sm font-medium opacity-80 mt-1">{state.error}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={onFetch}
            className="mt-2 border-[2.5px] border-ink shadow-comic-sm font-display"
          >
            Tentar novamente
          </Button>
        </ComicPanel>
      )}

      {isReady && state.metadata && (
        <ComicPanel bg="yellow" padding="md" className="animate-comic-pop">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-full border-[3px] border-ink bg-comic-red text-primary-foreground flex items-center justify-center shadow-comic-sm">
              <Check className="h-7 w-7" strokeWidth={3} />
            </div>
            <div>
              <p className="font-display text-2xl leading-none">{state.metadata.metadata.title}</p>
              <p className="text-sm font-medium mt-1">
                {state.metadata.statistics.chapters} capítulos encontrados
                {state.metadata.metadata.author && ` • ${state.metadata.metadata.author}`}
              </p>
            </div>
          </div>
        </ComicPanel>
      )}
    </div>
  );
}

function StepChapters({
  chapters,
  selected,
  grouping,
  volumeSize,
  volumeMode,
  volumeSizes,
  onToggle,
  onSelectAll,
  onClear,
  onGrouping,
  onVolumeSize,
  onVolumeMode,
  onVolumeSizes,
}: {
  chapters: Chapter[];
  selected: Set<string>;
  grouping: "single" | "separate";
  volumeSize: number;
  volumeMode: VolumeMode;
  volumeSizes: number[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onGrouping: (g: "single" | "separate") => void;
  onVolumeSize: (v: number) => void;
  onVolumeMode: (m: VolumeMode) => void;
  onVolumeSizes: (v: number[]) => void;
}) {
  const sorted = useMemo(
    () => [...chapters].sort((a, b) => parseFloat(a.number) - parseFloat(b.number)),
    [chapters],
  )
  const effectiveChapters =
    selected.size > 0 ? sorted.filter((c) => selected.has(c.id)) : sorted;
  const effectiveTotal = effectiveChapters.length;

  const calculateVolume = (chapterId: string): number => {
    const idx = effectiveChapters.findIndex((c) => c.id === chapterId);
    if (idx === -1) {
      // fallback: full list index
      const fallbackIdx = sorted.findIndex((c) => c.id === chapterId);
      if (fallbackIdx === -1) return 1;
      if (volumeMode === "fixed") return Math.floor(fallbackIdx / volumeSize) + 1;
      let fi = fallbackIdx;
      for (let v = 0; v < volumeSizes.length; v++) {
        if (fi < volumeSizes[v]) return v + 1;
        fi -= volumeSizes[v];
      }
      return volumeSizes.length + 1;
    }
    if (volumeMode === "fixed") {
      return Math.floor(idx / volumeSize) + 1;
    }
    let i = idx;
    for (let v = 0; v < volumeSizes.length; v++) {
      if (i < volumeSizes[v]) return v + 1;
      i -= volumeSizes[v];
    }
    return volumeSizes.length + 1;
  };

  const customTotalAssigned = volumeSizes.reduce((a, b) => a + b, 0);
  const customRemaining = effectiveTotal - customTotalAssigned;

  const addCustomVolume = () => {
    onVolumeSizes([...volumeSizes, Math.min(volumeSize, Math.max(1, customRemaining))]);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<BookOpen />}
        title="Quais capítulos?"
        subtitle={`${selected.size} de ${sorted.length} selecionados`}
      />

      {/* Volume config */}
      <div className="border-[3px] border-dashed border-ink rounded-lg p-4 space-y-3">
        <p className="font-display text-xl">Capítulos por volume</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            active={volumeMode === "fixed"}
            onClick={() => onVolumeMode("fixed")}
            title="Quantidade fixa"
            text="Mesmo número de capítulos em cada volume."
          />
          <ChoiceCard
            active={volumeMode === "custom"}
            onClick={() => {
              onVolumeMode("custom");
              if (volumeSizes.length === 0) {
                const volCount = Math.ceil(effectiveTotal / volumeSize);
                const base = Math.floor(effectiveTotal / volCount);
                const remainder = effectiveTotal - base * volCount;
                const sizes: number[] = [];
                for (let i = 0; i < volCount; i++) {
                  sizes.push(base + (i < remainder ? 1 : 0));
                }
                onVolumeSizes(sizes);
              }
            }}
            title="Quantidade por volume"
            text="Defina quantos capítulos em cada volume."
          />
        </div>

        {volumeMode === "fixed" ? (
          <div className="flex items-center gap-3">
            <Label className="font-display text-sm">Capítulos por volume:</Label>
            <Input
              type="number"
              min={1}
               max={effectiveTotal}
               value={volumeSize}
               onChange={(e) => {
                 const v = Math.max(1, Math.min(effectiveTotal, Number(e.target.value) || 1));
                 onVolumeSize(v);
               }}
               className="border-[3px] border-ink h-10 w-24 shadow-comic-sm"
             />
             <span className="text-sm font-medium opacity-70">
               = {Math.ceil(effectiveTotal / volumeSize)} volume(s)
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {volumeSizes.map((size, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="font-display text-xs">Vol.{i + 1}:</span>
                  <Input
                    type="number"
                    min={1}
                    value={size}
                    onChange={(e) => {
                      const next = [...volumeSizes];
                      next[i] = Math.max(1, Number(e.target.value) || 1);
                      onVolumeSizes(next);
                    }}
                    className="border-[2.5px] border-ink h-9 w-16 shadow-comic-sm text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onVolumeSizes(volumeSizes.filter((_, j) => j !== i))}
                    className="border-[2px] border-ink shadow-comic-sm font-display h-7 w-7 p-0"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={addCustomVolume}
                disabled={customRemaining <= 0}
                className="border-[2.5px] border-ink shadow-comic-sm font-display"
              >
                + Adicionar volume
              </Button>
              <span className="text-xs font-medium opacity-70">
                {customRemaining > 0
                  ? `${customRemaining} capítulo(s) restantes`
                  : customRemaining < 0
                    ? `${Math.abs(customRemaining)} capítulo(s) excedentes`
                    : "Todos os capítulos distribuídos"}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onSelectAll}
          variant="outline"
          className="border-[3px] border-ink shadow-comic-sm font-display"
        >
          Selecionar todos
        </Button>
        <Button
          onClick={onClear}
          variant="outline"
          className="border-[3px] border-ink shadow-comic-sm font-display"
        >
          Limpar
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 max-h-72 overflow-auto pr-1">
        {sorted.map((c) => {
          const checked = selected.has(c.id);
          const vol = calculateVolume(c.id);
          return (
            <label
              key={c.id}
              className={cn(
                "flex items-center gap-3 border-[3px] border-ink rounded-lg p-3 cursor-pointer transition-all shadow-comic-sm",
                checked ? "bg-secondary -translate-y-0.5" : "bg-card hover:-translate-y-0.5",
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => onToggle(c.id)}
                className="h-5 w-5 border-[2.5px] border-ink data-[state=checked]:bg-comic-red data-[state=checked]:border-ink"
              />
              <div className="flex-1">
                <p className="font-display text-lg leading-none">Cap. {c.number}</p>
                <p className="text-xs font-medium opacity-80">
                  Vol. {vol} • {c.title} • {c.pages != null ? `${c.pages}p` : "—"}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      <div>
        <p className="font-display text-xl mb-3">Como entregar?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            active={grouping === "single"}
            onClick={() => onGrouping("single")}
            icon={<FileStack />}
            title="Arquivo único"
            text="Junta tudo num só arquivo."
          />
          <ChoiceCard
            active={grouping === "separate"}
            onClick={() => onGrouping("separate")}
            icon={<BookOpen />}
            title="Arquivos separados"
            text="Um arquivo por capítulo/volume."
          />
        </div>
      </div>
    </div>
  );
}

function StepCovers({
  series,
  selectedChapters,
  mode,
  assignments,
  onMode,
  onAssign,
}: {
  series: SourceInspectResponse;
  selectedChapters: Set<string>;
  mode: CoverMode;
  assignments: Record<string, CoverRef>;
  onMode: (m: CoverMode) => void;
  onAssign: (key: string, ref: CoverRef) => void;
}) {
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const usedChapters = series.chapters.filter((c) => selectedChapters.has(c.id));
  // volumes: usar índices fixos (1..N) baseado nos capítulos disponíveis agrupados
  const volSize = 8;
  const volumes = Array.from(
    { length: Math.ceil(usedChapters.length / volSize) },
    (_, i) => i + 1,
  );

  const targets =
    mode === "single"
      ? [{ key: "all", label: "Todos os capítulos" }]
      : mode === "per-volume"
        ? volumes.map((v) => ({
            key: `vol-${v}`,
            label: `Volume ${v} (${usedChapters.filter((_, i) => Math.floor(i / volSize) + 1 === v).length} caps)`,
          }))
        : usedChapters.map((c) => ({ key: c.id, label: `Cap. ${c.number} • ${c.title}` }));

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<ImageIcon />}
        title="Capas"
        subtitle="Mesma capa pra tudo, uma por volume ou uma por capítulo."
      />

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <ChoiceCard
          active={mode === "single"}
          onClick={() => onMode("single")}
          icon={<Layers />}
          title="Uma só capa"
          text="Aplica a capa original em todos."
        />
        <ChoiceCard
          active={mode === "per-volume"}
          onClick={() => onMode("per-volume")}
          icon={<BookOpen />}
          title="Por volume"
          text="Uma capa por volume."
        />
        <ChoiceCard
          active={mode === "per-chapter"}
          onClick={() => onMode("per-chapter")}
          icon={<FileStack />}
          title="Por capítulo"
          text="Capa diferente em cada um."
        />
      </div>

      {usedChapters.length === 0 ? (
        <p className="text-sm font-medium opacity-70">Selecione capítulos na etapa anterior.</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-auto pr-1">
          {targets.map((t) => {
            const ref = assignments[t.key];
            return (
              <div
                key={t.key}
                className="flex items-center gap-3 border-[3px] border-ink rounded-lg p-3 bg-card shadow-comic-sm"
              >
                <CoverPreview ref={ref} covers={series.covers} />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base truncate">{t.label}</p>
                  <p className="text-xs font-medium opacity-70">
                    {describeRef(ref, series.covers)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPickerFor(t.key)}
                  className="border-[2.5px] border-ink shadow-comic-sm font-display"
                >
                  Escolher
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!pickerFor} onOpenChange={(o) => !o && setPickerFor(null)}>
        <DialogContent className="border-[3px] border-ink shadow-comic-lg max-w-2xl">
          <DialogTitle className="font-display text-2xl">Escolher capa</DialogTitle>
          <div className="space-y-4">
            <Button
              onClick={() => {
                onAssign(pickerFor!, { kind: "original" });
                setPickerFor(null);
              }}
              variant="outline"
              className="w-full border-[3px] border-ink shadow-comic-sm font-display justify-start"
            >
              Usar capa original
            </Button>
            <div>
              <p className="font-display text-sm mb-2">Da galeria</p>
              <div className="grid gap-2 grid-cols-3 sm:grid-cols-4">
                {series.covers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onAssign(pickerFor!, { kind: "gallery", coverId: c.id });
                      setPickerFor(null);
                    }}
                    className="border-[3px] border-ink rounded-md overflow-hidden shadow-comic-sm hover:-translate-y-0.5 transition-transform"
                  >
                    <div
                      className="aspect-[2/3] flex items-end p-1"
                      style={{ background: `hsl(${(c.id.length * 45) % 360} 80% 60%)` }}
                    >
                      <span className="font-display text-[10px] text-comic-ink bg-comic-yellow px-1 border-2 border-ink">
                        {c.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <label className="block border-[3px] border-dashed border-ink rounded-lg p-4 text-center cursor-pointer hover:bg-muted">
              <Upload className="mx-auto h-6 w-6 mb-1" />
              <span className="font-display">Subir minha imagem</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    onAssign(pickerFor!, { kind: "upload", uploadId: f.name, name: f.name });
                    setPickerFor(null);
                  }
                }}
              />
            </label>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CoverPreview({
  ref,
  covers,
}: {
  ref: CoverRef | undefined;
  covers: SourceInspectResponse["covers"];
}) {
  const cls = "h-12 w-9 border-[2.5px] border-ink rounded shrink-0";
  if (!ref || ref.kind === "original")
    return (
      <div
        className={cn(
          cls,
          "bg-comic-yellow flex items-center justify-center text-[9px] font-display",
        )}
      >
        ORIG
      </div>
    );
  if (ref.kind === "upload")
    return (
      <div
        className={cn(
          cls,
          "bg-comic-blue flex items-center justify-center text-[9px] font-display text-accent-foreground",
        )}
      >
        UP
      </div>
    );
  const c = covers.find((cv) => cv.id === ref.coverId);
  return (
    <div
      className={cls}
      style={{ background: c ? `hsl(${(c.id.length * 45) % 360} 80% 60%)` : undefined }}
    />
  );
}

function describeRef(ref: CoverRef | undefined, covers: SourceInspectResponse["covers"]): string {
  if (!ref || ref.kind === "original") return "Capa original";
  if (ref.kind === "gallery") {
    const c = covers.find((cv) => cv.id === ref.coverId);
    return c ? `Galeria · ${c.label}` : `Galeria · ${ref.coverId}`;
  }
  return `Upload · ${ref.name}`;
}

function StepConvert({
  data,
  update,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
}) {
  const { data: options, isLoading: optLoading } = useConversionOptions();
  const [previewChapterId, setPreviewChapterId] = useState("");
  const [previewPage, setPreviewPage] = useState(1);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewSeed, setPreviewSeed] = useState(0);
  const [previewDarkMode, setPreviewDarkMode] = useState(false);
  const [doublePageSplit, setDoublePageSplit] = useState(false);

  // Inicializa device/format/preset com primeiro valor do catálogo, se ainda não definido
  useEffect(() => {
    if (!options) return;
    if (!data.device && options.devices.length > 0) update("device", options.devices[0].id);
    if (!data.format && options.formats.length > 0) update("format", options.formats[0].id);
    if (!data.preset && options.presets.length > 0) update("preset", options.presets[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  const presetFilter: Record<string, string> = {
    default: "contrast(1) brightness(1)",
    manga: "grayscale(100%) contrast(1.2) brightness(1)",
    webtoon: "contrast(1.05) brightness(1.05)",
    highQuality: "grayscale(100%) contrast(1.1)",
    noProcessing: "none",
    comic: "contrast(1.15) brightness(1.05)",
  };
  const deviceFrame: Record<string, { w: number; h: number }> = {
    kpw_11: { w: 180, h: 240 },
    kpw_signature: { w: 180, h: 240 },
    k_oasis: { w: 184, h: 245 },
    k_scribe: { w: 200, h: 267 },
    k_basic: { w: 170, h: 230 },
    k_colorsoft: { w: 184, h: 245 },
    k_voyage: { w: 175, h: 233 },
    k_fire_hd: { w: 240, h: 150 },
  };
  const frame = deviceFrame[data.device] ?? deviceFrame.kpw_11;
  const filter = presetFilter[data.preset] ?? "none";

  const selectedChapters =
    data.inspectData?.chapters.filter((c) => data.selectedChapters.has(c.id)) ?? [];
  const currentChapter = selectedChapters.find((c) => c.id === previewChapterId);
  const maxPage = currentChapter?.pages ?? 1;

  // Estimate time: ~0.5s per page total
  const totalPages = selectedChapters.reduce((s, c) => s + (c.pages ?? 20), 0);
  const estSeconds = Math.max(5, Math.round(totalPages * 0.5));
  const estMin = Math.floor(estSeconds / 60);
  const estSec = estSeconds % 60;
  const estLabel = estMin > 0 ? `~${estMin}min ${estSec}s` : `~${estSec}s`;

  const handleGeneratePreview = async () => {
    if (!previewChapterId) {
      toast.error("Selecione um capítulo primeiro");
      return;
    }
    setPreviewLoading(true);
    setPreviewReady(false);
    await new Promise((r) => setTimeout(r, 1500));
    setPreviewSeed(Number(previewChapterId.replace(/\D/g, "")) * previewPage);
    setPreviewReady(true);
    setPreviewLoading(false);
    toast.success("Preview gerado com sucesso!");
  };

  const kindleLabel = options?.devices.find((d) => d.id === data.device)?.name ?? data.device ?? "";

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Settings2 />}
        title="Configurações"
        subtitle="Ajuste pro seu Kindle e veja o preview."
      />

      {optLoading ? (
        <div className="flex items-center gap-2 opacity-60">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-display text-base">Carregando opções…</span>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="font-display text-base flex items-center gap-1">
              <Tablet className="h-4 w-4" /> Perfil do dispositivo
            </Label>
            <Select value={data.device} onValueChange={(v) => update("device", v)}>
              <SelectTrigger className="border-[3px] border-ink h-11 shadow-comic-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[3px] border-ink">
                {(options?.devices ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-display text-base">Formato de saída</Label>
            <Select value={data.format} onValueChange={(v) => update("format", v)}>
              <SelectTrigger className="border-[3px] border-ink h-11 shadow-comic-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[3px] border-ink">
                {(options?.formats ?? []).map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label className="font-display text-base">Preset</Label>
            <Select value={data.preset} onValueChange={(v) => update("preset", v)}>
              <SelectTrigger className="border-[3px] border-ink h-11 shadow-comic-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[3px] border-ink">
                {(options?.presets ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-display mr-2">{p.name}</span>
                    <span className="opacity-70 text-xs">— {p.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs font-medium opacity-70">
              {options?.presets.find((p) => p.id === data.preset)?.description}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="font-display text-base">Título (opcional)</Label>
            <Input
              value={data.meta.title}
              onChange={(e) => update("meta", { ...data.meta, title: e.target.value })}
              className="border-[3px] border-ink h-11 shadow-comic-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-display text-base">Autor (opcional)</Label>
            <Input
              value={data.meta.author}
              onChange={(e) => update("meta", { ...data.meta, author: e.target.value })}
              className="border-[3px] border-ink h-11 shadow-comic-sm"
            />
          </div>
        </div>
      )}

        {/* Estratégia de páginas corrompidas */}
        {!optLoading && (
          <div className="space-y-2 md:col-span-2">
            <Label className="font-display text-base flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" /> Páginas indisponíveis na origem
            </Label>
            <Select
              value={data.errorHandlingStrategy}
              onValueChange={(v) => update("errorHandlingStrategy", v as "ignore" | "skip_chapter" | "abort")}
            >
              <SelectTrigger className="border-[3px] border-ink h-11 shadow-comic-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[3px] border-ink">
                <SelectItem value="ignore">
                  Ignorar e continuar (placeholder)
                </SelectItem>
                <SelectItem value="skip_chapter">
                  Pular capítulo
                </SelectItem>
                <SelectItem value="abort">
                  Abortar tudo
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs font-medium opacity-70">
              {data.errorHandlingStrategy === "ignore"
                ? "Substitui páginas corrompidas por um aviso visual e finaliza a conversão."
                : data.errorHandlingStrategy === "skip_chapter"
                  ? "Cancela apenas o capítulo com erro, mas continua convertendo o resto."
                  : "Para todo o processo imediatamente ao encontrar a primeira página corrompida."}
            </p>
          </div>
        )}

        {/* Time estimate */}
      <ComicPanel bg="blue" padding="md" tilt="left">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-display text-lg">Tempo estimado: {estLabel}</p>
            <p className="text-xs font-medium opacity-80">
              {selectedChapters.length} capítulos • {totalPages} páginas • preset "{data.preset}"
            </p>
          </div>
        </div>
      </ComicPanel>

      {/* Preview */}
      <div className="border-t-[3px] border-dashed border-ink pt-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display text-2xl flex-1">Preview da página</h3>
          <span className="font-display text-xs bg-comic-blue text-accent-foreground border-[2.5px] border-ink shadow-comic-sm px-2 py-0.5 rounded">
            servidor
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="font-display text-sm">Capítulo</Label>
            <Select
              value={previewChapterId}
              onValueChange={(v) => {
                setPreviewChapterId(v);
                setPreviewReady(false);
              }}
            >
              <SelectTrigger className="border-[2.5px] border-ink h-10 shadow-comic-sm">
                <SelectValue placeholder="Selecione um capítulo" />
              </SelectTrigger>
              <SelectContent className="border-[2.5px] border-ink">
                {selectedChapters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    Cap. {c.number} — {c.title} ({c.pages}p)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="font-display text-sm">Página</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={maxPage}
                value={previewPage}
                onChange={(e) => {
                  setPreviewPage(Number(e.target.value));
                  setPreviewReady(false);
                }}
                className="border-[2.5px] border-ink h-10 shadow-comic-sm w-24"
                disabled={!previewChapterId}
              />
              <span className="text-xs font-medium opacity-70">
                de {currentChapter ? maxPage : "—"}
              </span>
            </div>
          </div>
        </div>

        <Button
          onClick={handleGeneratePreview}
          disabled={!previewChapterId || previewLoading}
          className="bg-comic-blue text-accent-foreground hover:bg-comic-blue border-[3px] border-ink shadow-comic font-display"
        >
          {previewLoading ? (
            <>
              <span className="animate-spin mr-2">⏳</span> Gerando no servidor…
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-1" /> Gerar Preview
            </>
          )}
        </Button>

        {previewReady ? (
          <div className="space-y-4">
            {/* Controls row */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={previewDarkMode ? "default" : "outline"}
                onClick={() => setPreviewDarkMode((v) => !v)}
                className={cn(
                  "border-[2.5px] border-ink shadow-comic-sm font-display text-sm",
                  previewDarkMode && "bg-comic-ink text-comic-cream",
                )}
              >
                <Moon className="h-3.5 w-3.5 mr-1" /> Modo escuro Kindle
              </Button>
              <Button
                size="sm"
                variant={doublePageSplit ? "default" : "outline"}
                onClick={() => setDoublePageSplit((v) => !v)}
                className={cn(
                  "border-[2.5px] border-ink shadow-comic-sm font-display text-sm",
                  doublePageSplit && "bg-comic-red text-primary-foreground",
                )}
              >
                <Split className="h-3.5 w-3.5 mr-1" /> Split página dupla
              </Button>
            </div>

            {/* Double page split detection mock */}
            {doublePageSplit && (
              <ComicPanel bg="red" padding="sm" tilt="left" className="animate-comic-pop">
                <div className="flex items-center gap-2">
                  <Split className="h-4 w-4" />
                  <p className="font-display text-sm">
                    Página dupla detectada! Será dividida automaticamente.
                  </p>
                </div>
              </ComicPanel>
            )}

            {/* Preview display */}
            {previewDarkMode ? (
              <div className="space-y-2">
                <p className="font-display text-sm opacity-80">No {kindleLabel} (modo escuro)</p>
                <div
                  className="border-[3px] border-ink rounded-md p-1.5 bg-zinc-800 shadow-comic-sm inline-block"
                  style={{ width: frame.w + 14 }}
                >
                  <div style={{ filter: `${filter} invert(1) hue-rotate(180deg)` }}>
                    <MockPage seed={previewSeed} width={frame.w} height={frame.h} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 items-start">
                <div className="space-y-2">
                  <p className="font-display text-sm opacity-80">Original</p>
                  <div className="inline-block">
                    <ComparisonSlider
                      left={<MockPage seed={previewSeed} width={frame.w} height={frame.h} />}
                      right={
                        <div style={{ filter }}>
                          <MockPage seed={previewSeed} width={frame.w} height={frame.h} />
                        </div>
                      }
                      leftLabel="Original"
                      rightLabel="Convertido"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="font-display text-sm opacity-80">No {kindleLabel}</p>
                  <div
                    className="border-[3px] border-ink rounded-md p-1.5 bg-zinc-200 shadow-comic-sm inline-block"
                    style={{ width: frame.w + 14 }}
                  >
                    <div style={{ filter }}>
                      <MockPage seed={previewSeed} width={frame.w} height={frame.h} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border-[3px] border-dashed border-ink rounded-lg p-8 text-center">
            <p className="font-display text-sm opacity-60">
              {previewChapterId
                ? 'Clique em "Gerar Preview" para ver a conversão no servidor.'
                : 'Selecione um capítulo e uma página, depois clique em "Gerar Preview".'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StepDelivery({
  data,
  update,
  onEdit,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
  onEdit: (i: number) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Send />}
        title="Como receber?"
        subtitle="Baixe ou envie direto pro seu Kindle."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          active={data.delivery === "download"}
          onClick={() => update("delivery", "download")}
          icon={<Download />}
          title="Baixar arquivo"
          text="Baixe agora no navegador."
        />
        <ChoiceCard
          active={data.delivery === "kindle"}
          onClick={() => update("delivery", "kindle")}
          icon={<Mail />}
          title="Enviar pro Kindle"
          text="Recebe direto no seu leitor."
        />
      </div>

      {data.delivery === "kindle" && (
        <div className="space-y-2">
          <Label className="font-display text-base">Seu e-mail Kindle</Label>
          <Input
            type="email"
            placeholder="seu-nome@kindle.com"
            value={data.kindleEmail}
            onChange={(e) => update("kindleEmail", e.target.value)}
            className="border-[3px] border-ink h-11 shadow-comic-sm"
          />
          <p className="text-xs font-medium opacity-70">
            Lembre de autorizar <strong>noreply@mangaforge.app</strong> em Amazon → Manage Your
            Content and Devices → Preferences → Personal Document Settings.
          </p>
        </div>
      )}

      <div>
        <p className="font-display text-xl mb-3">Resumo</p>
        <ComicPanel bg="halftone" padding="md" className="space-y-2 text-sm font-medium">
          <SummaryRow
            label="Origem"
            value={data.inspectData?.metadata.title ?? "—"}
            onEdit={() => onEdit(0)}
          />
          <SummaryRow
            label="Capítulos"
            value={`${data.selectedChapters.size} • ${data.grouping === "single" ? "junto" : "separado"}`}
            onEdit={() => onEdit(1)}
          />
          <SummaryRow
            label="Capas"
            value={coverModeLabel(data.coverMode)}
            onEdit={() => onEdit(2)}
          />
          <SummaryRow
            label="Dispositivo"
            value={`${data.device || "—"} • ${data.format}`}
            onEdit={() => onEdit(3)}
          />
          <SummaryRow
            label="Envio"
            value={
              data.delivery === "kindle" ? `Kindle: ${data.kindleEmail || "—"}` : "Download direto"
            }
            onEdit={() => onEdit(4)}
          />
        </ComicPanel>
      </div>

      <SizeBudget chapters={data.selectedChapters.size} delivery={data.delivery} />
    </div>
  );
}

function SizeBudget({ chapters, delivery }: { chapters: number; delivery: Delivery }) {
  const estMB = Math.max(0.1, chapters * 1.2);
  const isKindle = delivery === "kindle";
  const pct = isKindle ? Math.min(100, (estMB / 25) * 100) : 100;
  const over = isKindle && estMB > 25;
  return (
    <ComicPanel bg={over ? "red" : "yellow"} padding="md" tilt="left">
      <div className="flex items-center gap-3 flex-wrap mb-2">
        {isKindle ? <Mail className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        <p className="font-display text-lg flex-1">
          Tamanho estimado: <strong>{estMB.toFixed(1)} MB</strong>
          {isKindle ? " / 25 MB (limite do Kindle)" : " — Download sem restrições"}
        </p>
        {over && (
          <span className="font-display text-sm bg-card text-foreground border-[3px] border-ink shadow-comic-sm px-2 py-0.5 rounded-md">
            Vou dividir em partes
          </span>
        )}
      </div>
      {isKindle ? (
        <div className="h-3 w-full border-[2.5px] border-ink rounded-full bg-card overflow-hidden">
          <div
            className={cn("h-full", over ? "bg-comic-red" : "bg-comic-blue")}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <p className="text-sm font-medium opacity-80">
          Arquivos baixados diretamente não têm limite de tamanho. Só o envio por email (Kindle) tem
          o limite de 25 MB.
        </p>
      )}
    </ComicPanel>
  );
}

function coverModeLabel(m: CoverMode) {
  return m === "single" ? "Capa única" : m === "per-volume" ? "Por volume" : "Por capítulo";
}

/* ---------- Shared bits ---------- */

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-lg border-[3px] border-ink bg-comic-yellow flex items-center justify-center shadow-comic-sm">
        {icon}
      </div>
      <div>
        <h2 className="font-display text-2xl md:text-3xl leading-none">{title}</h2>
        {subtitle && <p className="text-sm font-medium opacity-80 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  icon,
  title,
  text,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left border-[3px] border-ink rounded-lg p-4 transition-all shadow-comic-sm",
        active
          ? "bg-comic-red text-primary-foreground -translate-y-1 shadow-comic"
          : "bg-card hover:-translate-y-0.5",
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon && <span>{icon}</span>}
        <span className="font-display text-xl">{title}</span>
      </div>
      <p className="text-sm font-medium opacity-90">{text}</p>
    </button>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b-2 border-dashed border-ink/30 pb-2 last:border-0 last:pb-0">
      <div>
        <span className="font-display text-base mr-2">{label}:</span>
        <span>{value}</span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onEdit}
        className="border-[2.5px] border-ink shadow-comic-sm font-display h-7 px-2"
      >
        Editar
      </Button>
    </div>
  );
}
