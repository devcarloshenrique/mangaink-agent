import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
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
import { scrapingApi } from "@/lib/api";
import type { SourceInspectResponse, Chapter } from "@/types/scraping";
import type { Book, CoverRef, ConversionConfig } from "@/types/conversion";
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
  RotateCcw,
} from "lucide-react";
import { MockPage } from "@/components/comic/MockPage";
import { ComparisonSlider } from "@/components/wizard/ComparisonSlider";
import { ConversionFieldGroup } from "@/components/wizard/ConversionFieldGroup";
import { Accordion } from "@/components/ui/accordion";
import type {
  ConversionField,
  ConversionPreset,
  FieldGroupId,
  UserPresetResponse,
} from "@/types/conversion";
import { useUserPresets } from "@/hooks/useUserPresets";
import { PresetSelector } from "@/components/wizard/PresetSelector";
import { SavePresetDialog } from "@/components/wizard/SavePresetDialog";
import { FIELD_CONFLICTS } from "@/types/conversion";
import { cn } from "@/lib/utils";
import { authGuard } from "./-authGuard";

const wizardSearchSchema = z.object({
  sourceId: z.string().optional(),
  conversionId: z.string().optional(),
});

export const Route = createFileRoute("/wizard")({
  beforeLoad: authGuard,
  validateSearch: wizardSearchSchema,
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
  const search = Route.useSearch();
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
  }, [scraping.state.status, scraping.state.sourceId, scraping.state.metadata]);

  // Pre-fill wizard data from reconvert (search params)
  useEffect(() => {
    if (!search.sourceId) return;
    let cancelled = false;

    async function prefill() {
      try {
        const source = await scrapingApi.getSource(search.sourceId);
        if (cancelled) return;

        setData((d) => ({
          ...d,
          url: source.source.url,
          sourceId: source.sourceId,
          inspectData: source,
          meta: {
            title: source.metadata.title,
            author: source.metadata.author ?? "",
          },
        }));

        if (search.conversionId) {
          const conv = await conversionsApi.get(search.conversionId);
          const config = conv.config as ConversionConfig;
          if (!cancelled) {
            setData((d) => ({
              ...d,
              sourceId: config.sourceId,
              selectedChapters: new Set(config.books.flatMap((b) => b.chapters)),
              coverMode: config.books.length === 1 ? "single" : "per-volume",
              volumeMode: "fixed",
              volumeSize: config.books[0]?.chapters.length ?? 10,
              device: config.output.deviceId,
              format: config.output.format,
              fieldOptions: config.options as Record<string, string | number | boolean>,
              meta: {
                title: config.metadata.title ?? source.metadata.title,
                author: config.metadata.author ?? source.metadata.author ?? "",
              },
              errorHandlingStrategy: config.errorHandlingStrategy ?? "ignore",
              cover: config.cover,
            }));
          }
        }

        setStep(1);
        setVisited(1);
      } catch {
        toast.error("Erro ao carregar dados para reconversão");
      }
    }

    prefill();
    return () => {
      cancelled = true;
    };
  }, [search.sourceId, search.conversionId]);

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
  );
  const effectiveChapters = selected.size > 0 ? sorted.filter((c) => selected.has(c.id)) : sorted;
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
  const volumes = Array.from({ length: Math.ceil(usedChapters.length / volSize) }, (_, i) => i + 1);

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

function buildEffectiveState(
  fields: ConversionField[],
  fieldOptions: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const base: Record<string, string | number | boolean> = {};
  for (const f of fields) {
    base[f.id] = fieldOptions[f.id] ?? f.default;
  }
  return base;
}

function isPresetMatch(
  effective: Record<string, string | number | boolean>,
  preset: { values: Record<string, string | number | boolean> },
): boolean {
  const presetKeys = Object.keys(preset.values);
  if (presetKeys.length === 0) return false;
  for (const key of presetKeys) {
    if (effective[key] !== preset.values[key]) return false;
  }
  return true;
}

const GROUP_ORDER: string[] = ["reading", "processing", "image", "output"];

function StepConvert({
  data,
  update,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
}) {
  const { data: options, isLoading: optLoading } = useConversionOptions();
  const {
    presets: userPresets,
    isLoading: userPresetsLoading,
    isAtLimit,
    create: createPreset,
    updateMeta,
    updateValues,
    remove: removePreset,
  } = useUserPresets();
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [savePresetMode, setSavePresetMode] = useState<"create" | "edit">("create");
  const [editingPreset, setEditingPreset] = useState<UserPresetResponse | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [lastUserPresetId, setLastUserPresetId] = useState<string | null>(null);
  const [previewChapterId, setPreviewChapterId] = useState("");
  const [previewPage, setPreviewPage] = useState(1);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewSeed, setPreviewSeed] = useState(0);
  const [previewDarkMode, setPreviewDarkMode] = useState(false);
  const [doublePageSplit, setDoublePageSplit] = useState(false);

  useEffect(() => {
    if (!options) return;
    if (!data.device && options.devices.length > 0) update("device", options.devices[0].id);
    if (!data.format && options.formats.length > 0) update("format", options.formats[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  // --- Preset ↔ Fields sync logic ---
  const groupedFields = useMemo(() => {
    if (!options?.fields) return {} as Record<string, ConversionField[]>;
    const groups: Record<string, ConversionField[]> = {};
    for (const field of options.fields) {
      (groups[field.group] ??= []).push(field);
    }
    return groups;
  }, [options?.fields]);

  const effectiveState = useMemo(() => {
    if (!options?.fields) return {};
    return buildEffectiveState(options.fields, data.fieldOptions);
  }, [data.fieldOptions, options?.fields]);

  const activePresetId = useMemo(() => {
    if (!options?.presets) return null;
    // User presets first (priority)
    for (const preset of userPresets) {
      if (isPresetMatch(effectiveState, preset)) return preset.id;
    }
    for (const preset of options.presets) {
      if (isPresetMatch(effectiveState, preset)) return preset.id;
    }
    return null;
  }, [effectiveState, options?.presets, userPresets]);

  const activePresetSource = useMemo((): "system" | "user" | null => {
    if (!activePresetId) return null;
    if (userPresets.some((p) => p.id === activePresetId)) return "user";
    return "system";
  }, [activePresetId, userPresets]);

  const hasUnsavedChanges = useMemo(() => {
    if (!lastUserPresetId) return false;
    const lastPreset = userPresets.find((p) => p.id === lastUserPresetId);
    if (!lastPreset) return false;
    const presetValues = lastPreset.values;
    const hasDiff =
      Object.entries(presetValues).some(([k, v]) => data.fieldOptions[k] !== v) ||
      Object.keys(data.fieldOptions).some((k) => !(k in presetValues));
    return hasDiff && Object.keys(data.fieldOptions).length > 0;
  }, [lastUserPresetId, userPresets, data.fieldOptions]);

  const isNoProcessing = data.fieldOptions.noProcessing === true;

  const handlePresetChange = useCallback(
    (presetId: string) => {
      if (!presetId) return;
      const preset =
        options?.presets.find((p) => p.id === presetId) ??
        userPresets.find((p) => p.id === presetId);
      if (!preset) return;

      const previous = { ...data.fieldOptions };
      update("preset", presetId);

      if ("exclusive" in preset && (preset as ConversionPreset).exclusive) {
        update("fieldOptions", { ...preset.values });
      } else {
        update("fieldOptions", { ...data.fieldOptions, ...preset.values });
      }

      const changedKeys = Object.keys(preset.values);
      const sameAsBefore = changedKeys.every((k) => data.fieldOptions[k] === preset.values[k]);
      if (!sameAsBefore) {
        const changedCount = changedKeys.filter(
          (k) => data.fieldOptions[k] !== preset.values[k],
        ).length;
        toast.success(
          `Preset "${preset.name}" — ${changedCount} opção${changedCount > 1 ? "ões" : ""} ajustada${changedCount > 1 ? "s" : ""}`,
          {
            action: {
              label: "Desfazer",
              onClick: () => update("fieldOptions", previous),
            },
          },
        );
      }
    },
    [options?.presets, userPresets, data.fieldOptions, update],
  );

  const handleFieldChange = useCallback(
    (id: string, value: string | number | boolean) => {
      const next = { ...data.fieldOptions, [id]: value };
      const isTruthy =
        typeof value === "boolean" ? value : value !== false && value !== "" && value !== 0;
      if (isTruthy && FIELD_CONFLICTS[id]) {
        for (const conflictId of FIELD_CONFLICTS[id]) {
          delete next[conflictId];
        }
      }
      update("fieldOptions", next);
    },
    [data.fieldOptions, update],
  );

  const handleFieldReset = useCallback(
    (id: string) => {
      const next = { ...data.fieldOptions };
      delete next[id];
      update("fieldOptions", next);
    },
    [data.fieldOptions, update],
  );

  const handleGroupReset = useCallback(
    (fieldIds: string[]) => {
      const next = { ...data.fieldOptions };
      for (const id of fieldIds) {
        delete next[id];
      }
      update("fieldOptions", next);
    },
    [data.fieldOptions, update],
  );

  const handleResetDefaults = useCallback(() => {
    if (Object.keys(data.fieldOptions).length > 0) {
      if (
        !window.confirm(
          "Restaurar todos os campos para os valores padrão? Esta ação não pode ser desfeita.",
        )
      ) {
        return;
      }
    }
    update("fieldOptions", {});
    if (options?.presets.length) {
      update("preset", options.presets[0].id);
    }
  }, [options?.presets, data.fieldOptions, update]);

  const conflictDisabledFields = useMemo(() => {
    const disabled = new Set<string>();
    for (const [sourceId, targets] of Object.entries(FIELD_CONFLICTS)) {
      if (data.fieldOptions[sourceId] === true) {
        for (const targetId of targets) {
          if (!data.fieldOptions[targetId]) {
            disabled.add(targetId);
          }
        }
      }
    }
    return disabled;
  }, [data.fieldOptions]);

  const conflictReasons = useMemo(() => {
    const reasons = new Map<string, string>();
    for (const [sourceId, targets] of Object.entries(FIELD_CONFLICTS)) {
      if (data.fieldOptions[sourceId] === true) {
        const sourceField = options?.fields?.find((f) => f.id === sourceId);
        const sourceLabel = sourceField?.label ?? sourceId;
        for (const targetId of targets) {
          if (!data.fieldOptions[targetId]) {
            reasons.set(targetId, sourceLabel);
          }
        }
      }
    }
    return reasons;
  }, [data.fieldOptions, options?.fields]);

  // --- End sync logic ---

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
  const filter = data.preset ? (presetFilter[data.preset] ?? "none") : "none";

  const selectedChapters =
    data.inspectData?.chapters.filter((c) => data.selectedChapters.has(c.id)) ?? [];
  const currentChapter = selectedChapters.find((c) => c.id === previewChapterId);
  const maxPage = currentChapter?.pages ?? 1;

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

  const presetOptions = options?.presets ?? [];
  const presetDisplayName = activePresetId
    ? [...userPresets, ...presetOptions].find((p) => p.id === activePresetId)?.name
    : "Personalizado";

  const renderGroup = (groupId: string, fields: ConversionField[]) => {
    if (!fields || fields.length === 0) return null;
    const groupFieldIds = fields.map((f) => f.id);
    const groupHasOverrides = groupFieldIds.some((id) => id in data.fieldOptions);
    const groupOverrideCount = groupFieldIds.filter((id) => id in data.fieldOptions).length;
    return (
      <ConversionFieldGroup
        key={groupId}
        groupId={groupId as FieldGroupId}
        fields={fields}
        values={data.fieldOptions}
        onChange={handleFieldChange}
        onReset={handleFieldReset}
        onResetGroup={() => handleGroupReset(groupFieldIds)}
        disabled={isNoProcessing}
        disabledFieldIds={conflictDisabledFields}
        conflictReasons={conflictReasons}
        hasOverrides={groupHasOverrides}
        overrideCount={groupOverrideCount}
      />
    );
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Settings2 />}
        title="Configurações"
        subtitle="Ajuste pro seu Kindle e veja o preview."
      />

      {optLoading ? (
        <div className="space-y-5 animate-pulse">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <div className="h-5 w-32 bg-muted rounded border-[2px] border-ink/20" />
              <div className="h-11 bg-muted rounded border-[2px] border-ink/20" />
            </div>
            <div className="space-y-2">
              <div className="h-5 w-28 bg-muted rounded border-[2px] border-ink/20" />
              <div className="h-11 bg-muted rounded border-[2px] border-ink/20" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="h-5 w-20 bg-muted rounded border-[2px] border-ink/20" />
              <div className="h-11 bg-muted rounded border-[2px] border-ink/20" />
            </div>
            <div className="space-y-2">
              <div className="h-5 w-24 bg-muted rounded border-[2px] border-ink/20" />
              <div className="h-11 bg-muted rounded border-[2px] border-ink/20" />
            </div>
            <div className="space-y-2">
              <div className="h-5 w-20 bg-muted rounded border-[2px] border-ink/20" />
              <div className="h-11 bg-muted rounded border-[2px] border-ink/20" />
            </div>
          </div>
          <div className="h-11 bg-muted rounded border-[2px] border-ink/20" />
          <div className="h-[72px] bg-muted rounded-lg border-[3px] border-ink/20" />
        </div>
      ) : (
        <>
          <div className="lg:grid lg:grid-cols-[1fr,400px] lg:gap-6">
            <div className="space-y-5">
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
                  <Label className="font-display text-base flex items-center gap-1">
                    Formato de saída
                  </Label>
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
                  <PresetSelector
                    presets={options?.presets ?? []}
                    userPresets={userPresets}
                    activePresetId={activePresetId}
                    activePresetSource={activePresetSource}
                    isAtLimit={isAtLimit}
                    onSelectPreset={(id) => {
                      handlePresetChange(id);
                      if (userPresets.some((p) => p.id === id)) {
                        setLastUserPresetId(id);
                      }
                    }}
                    onSaveAsPreset={() => {
                      setSavePresetMode("create");
                      setEditingPreset(undefined);
                      setSavePresetOpen(true);
                    }}
                    onEditPreset={(preset) => {
                      setSavePresetMode("edit");
                      setEditingPreset(preset);
                      setSavePresetOpen(true);
                    }}
                    onDeletePreset={async (preset) => {
                      if (!window.confirm(`Excluir preset "${preset.name}"?`)) return;
                      await removePreset(preset.id);
                      if (activePresetId === preset.id) {
                        update("preset", "");
                      }
                      toast.success(`Preset "${preset.name}" excluido`);
                    }}
                    onToggleDefault={async (preset) => {
                      await updateMeta(preset.id, { isDefault: !preset.isDefault });
                    }}
                    onCustomMode={() => update("preset", "")}
                    onUpdateValues={async (preset) => {
                      try {
                        await updateValues(preset.id, data.fieldOptions);
                        toast.success(`Preset "${preset.name}" atualizado`);
                      } catch {
                        toast.error("Erro ao atualizar preset");
                      }
                    }}
                  />
                  {hasUnsavedChanges && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[2px] border-ink shadow-comic-sm font-display text-xs"
                        onClick={async () => {
                          try {
                            await updateValues(lastUserPresetId!, data.fieldOptions);
                            toast.success("Preset atualizado");
                          } catch {
                            toast.error("Erro ao atualizar preset");
                          }
                        }}
                      >
                        Atualizar{" "}
                        {userPresets.find((p) => p.id === lastUserPresetId)?.name ?? "preset"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[2px] border-ink shadow-comic-sm font-display text-xs"
                        onClick={() => {
                          setSavePresetMode("create");
                          setEditingPreset(undefined);
                          setSavePresetOpen(true);
                        }}
                      >
                        Salvar como novo
                      </Button>
                    </div>
                  )}
                  <p className="text-xs font-medium opacity-70">
                    {activePresetId
                      ? ([...userPresets, ...(options?.presets ?? [])].find(
                          (p) => p.id === activePresetId,
                        )?.description ?? "")
                      : "Configurações personalizadas — nenhum preset corresponde exatamente."}
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

              <div className="space-y-2">
                <Label className="font-display text-base flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Páginas indisponíveis na origem
                </Label>
                <Select
                  value={data.errorHandlingStrategy}
                  onValueChange={(v) =>
                    update("errorHandlingStrategy", v as "ignore" | "skip_chapter" | "abort")
                  }
                >
                  <SelectTrigger className="border-[3px] border-ink h-11 shadow-comic-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[3px] border-ink">
                    <SelectItem value="ignore">Ignorar e continuar (placeholder)</SelectItem>
                    <SelectItem value="skip_chapter">Pular capítulo</SelectItem>
                    <SelectItem value="abort">Abortar tudo</SelectItem>
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

              <div className="border-t-[3px] border-dashed border-ink pt-5 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-2xl flex-1">Opções de conversão</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetDefaults}
                    className="border-[2.5px] border-ink shadow-comic-sm font-display h-8"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar padrões
                  </Button>
                </div>
                {options?.fields && options.fields.length > 0 ? (
                  <Accordion type="single" collapsible defaultValue="reading">
                    {GROUP_ORDER.map((groupId) => renderGroup(groupId, groupedFields[groupId]))}
                    {Object.keys(groupedFields)
                      .filter((gid) => !GROUP_ORDER.includes(gid) && gid !== "format")
                      .map((groupId) => renderGroup(groupId, groupedFields[groupId]))}
                  </Accordion>
                ) : (
                  <p className="text-sm font-medium opacity-60">Nenhuma opção disponível.</p>
                )}
              </div>

              <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b-[3px] border-ink/20 lg:hidden">
                <div className="flex items-center gap-3 text-sm font-medium">
                  <span className="font-display">{kindleLabel}</span>
                  <span className="opacity-40">|</span>
                  <span className="font-display text-comic-blue">{presetDisplayName}</span>
                  <span className="opacity-40">|</span>
                  <Clock className="h-3.5 w-3.5" />
                  <span>{estLabel}</span>
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="sticky top-4 space-y-4">
                <ComicPanel bg="blue" padding="md" tilt="left">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-display text-base">Tempo estimado: {estLabel}</p>
                      <p className="text-[11px] font-medium opacity-80">
                        {selectedChapters.length} cap &bull; {totalPages} p&aacute;g
                      </p>
                    </div>
                  </div>
                </ComicPanel>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-base flex-1">Preview da p&aacute;gina</h3>
                    <span className="font-display text-[10px] bg-comic-blue text-accent-foreground border-[2px] border-ink shadow-comic-sm px-1.5 py-0.5 rounded">
                      servidor
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-display text-sm">Cap&iacute;tulo</Label>
                    <Select
                      value={previewChapterId}
                      onValueChange={(v) => {
                        setPreviewChapterId(v);
                        setPreviewReady(false);
                      }}
                    >
                      <SelectTrigger className="border-[2.5px] border-ink h-9 shadow-comic-sm">
                        <SelectValue placeholder="Selecione um cap&iacute;tulo" />
                      </SelectTrigger>
                      <SelectContent className="border-[2.5px] border-ink">
                        {selectedChapters.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            Cap. {c.number} &mdash; {c.title} ({c.pages}p)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-display text-sm">P&aacute;gina</Label>
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
                        className="border-[2.5px] border-ink h-9 shadow-comic-sm w-20"
                        disabled={!previewChapterId}
                      />
                      <span className="text-xs font-medium opacity-70">
                        de {currentChapter ? maxPage : "&mdash;"}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={handleGeneratePreview}
                    disabled={!previewChapterId || previewLoading}
                    size="sm"
                    className="bg-comic-blue text-accent-foreground hover:bg-comic-blue border-[2.5px] border-ink shadow-comic font-display"
                  >
                    {previewLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Gerando&hellip;
                      </>
                    ) : (
                      <>
                        <Zap className="h-3.5 w-3.5 mr-1" /> Gerar Preview
                      </>
                    )}
                  </Button>

                  {previewReady ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant={previewDarkMode ? "default" : "outline"}
                          onClick={() => setPreviewDarkMode((v) => !v)}
                          className={cn(
                            "border-[2.5px] border-ink shadow-comic-sm font-display text-xs h-7",
                            previewDarkMode && "bg-comic-ink text-comic-cream",
                          )}
                        >
                          <Moon className="h-3 w-3 mr-0.5" /> Modo escuro
                        </Button>
                        <Button
                          size="sm"
                          variant={doublePageSplit ? "default" : "outline"}
                          onClick={() => setDoublePageSplit((v) => !v)}
                          className={cn(
                            "border-[2.5px] border-ink shadow-comic-sm font-display text-xs h-7",
                            doublePageSplit && "bg-comic-red text-primary-foreground",
                          )}
                        >
                          <Split className="h-3 w-3 mr-0.5" /> Split dupla
                        </Button>
                      </div>

                      {doublePageSplit && (
                        <ComicPanel bg="red" padding="sm" tilt="left" className="animate-comic-pop">
                          <div className="flex items-center gap-2">
                            <Split className="h-4 w-4" />
                            <p className="font-display text-sm">
                              P&aacute;gina dupla detectada! Ser&aacute; dividida automaticamente.
                            </p>
                          </div>
                        </ComicPanel>
                      )}

                      {previewDarkMode ? (
                        <div className="space-y-2">
                          <p className="font-display text-sm opacity-80">
                            No {kindleLabel} (modo escuro)
                          </p>
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
                        <div>
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
                      )}
                    </div>
                  ) : (
                    <div className="border-[3px] border-dashed border-ink rounded-lg p-6 text-center">
                      <p className="font-display text-xs opacity-60">
                        {previewChapterId
                          ? 'Clique em "Gerar Preview" para ver a convers&atilde;o.'
                          : 'Selecione cap&iacute;tulo e p&aacute;gina, depois clique em "Gerar Preview".'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <ComicPanel bg="blue" padding="md" tilt="left" className="lg:hidden">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 shrink-0" />
              <div>
                <p className="font-display text-lg">Tempo estimado: {estLabel}</p>
                <p className="text-xs font-medium opacity-80">
                  {selectedChapters.length} capítulos &bull; {totalPages} páginas
                </p>
              </div>
            </div>
          </ComicPanel>

          <div className="lg:hidden border-t-[3px] border-dashed border-ink pt-5 space-y-3">
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
                        Cap. {c.number} &mdash; {c.title} ({c.pages}p)
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
                    de {currentChapter ? maxPage : "&mdash;"}
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
                  <Loader2 className="h-4 w-4 animate-spin mr-1" /> Gerando&hellip;
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-1" /> Gerar Preview
                </>
              )}
            </Button>

            {previewReady ? (
              <div className="space-y-4">
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

                {previewDarkMode ? (
                  <div className="space-y-2">
                    <p className="font-display text-sm opacity-80">
                      No {kindleLabel} (modo escuro)
                    </p>
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
        </>
      )}

      <SavePresetDialog
        open={savePresetOpen}
        onOpenChange={setSavePresetOpen}
        onSave={async (data) => {
          setIsSaving(true);
          try {
            if (savePresetMode === "edit" && editingPreset) {
              await updateMeta(editingPreset.id, data);
            } else {
              await createPreset(data);
            }
            setSavePresetOpen(false);
            toast.success(savePresetMode === "edit" ? "Preset atualizado" : "Preset salvo");
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Erro ao salvar";
            toast.error(msg);
          } finally {
            setIsSaving(false);
          }
        }}
        fieldOptions={data.fieldOptions}
        mode={savePresetMode}
        existingPreset={editingPreset}
        existingNames={userPresets.map((p) => p.name)}
        isSaving={isSaving}
      />
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
