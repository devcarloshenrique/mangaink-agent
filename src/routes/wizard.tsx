import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { StepIndicator } from "@/components/comic/StepIndicator";
import { RequireAuth } from "@/components/auth/RequireAuth";
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
import { useConversion } from "@/hooks/useConversion";
import {
  KINDLE_DEVICES,
  OUTPUT_FORMATS,
  PRESETS,
  type OutputFormat,
  type PresetId,
} from "@/lib/kindle-presets";
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
} from "lucide-react";
import { MockPage } from "@/components/comic/MockPage";
import { ComparisonSlider } from "@/components/wizard/ComparisonSlider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wizard")({
  component: () => (
    <RequireAuth>
      <WizardPage />
    </RequireAuth>
  ),
});

const STEPS = [
  { label: "Origem", short: "Origem" },
  { label: "Capítulos", short: "Caps" },
  { label: "Capas", short: "Capas" },
  { label: "Configurações", short: "Config" },
  { label: "Envio", short: "Envio" },
];

interface Chapter {
  id: string;
  number: string;
  title: string;
  pages: number;
  volume: number;
}

interface Cover {
  id: string;
  label: string;
  hue: number;
}

interface Series {
  title: string;
  author: string;
  chapters: Chapter[];
  covers: Cover[];
}

type CoverMode = "per-chapter" | "per-volume" | "single";
type CoverRef =
  | { kind: "original" }
  | { kind: "gallery"; coverId: string }
  | { kind: "upload"; name: string };

type Delivery = "download" | "kindle";
type VolumeMode = "fixed" | "custom";

interface WizardData {
  url: string;
  series: Series | null;
  selectedChapters: Set<string>;
  grouping: "single" | "separate";
  coverMode: CoverMode;
  coverAssignments: Record<string, CoverRef>;
  device: string;
  format: OutputFormat;
  preset: PresetId;
  meta: { title: string; author: string };
  delivery: Delivery;
  kindleEmail: string;
  volumeSize: number;
  volumeMode: VolumeMode;
  volumeSizes: number[];
}

function mockFetchSeries(url: string, volumeSize?: number): Promise<Series> {
  const size = volumeSize || 8;
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const u = new URL(url);
        const slug = u.pathname.split("/").filter(Boolean).pop() || "manga-misterioso";
        const pretty = slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const chapters: Chapter[] = Array.from({ length: 24 }, (_, i) => ({
          id: `ch-${i + 1}`,
          number: String(i + 1),
          title: i === 0 ? "O início" : `Capítulo ${i + 1}`,
          pages: 18 + ((i * 7) % 14),
          volume: Math.floor(i / size) + 1,
        }));
        const covers: Cover[] = Array.from({ length: 8 }, (_, i) => ({
          id: `cv-${i + 1}`,
          label: `Capa ${i + 1}`,
          hue: (i * 45) % 360,
        }));
        resolve({ title: pretty, author: "Autor Desconhecido", chapters, covers });
      } catch {
        reject(new Error("URL inválida"));
      }
    }, 900);
  });
}

function WizardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { startJob } = useConversion();
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WizardData>({
    url: "",
    series: null,
    selectedChapters: new Set(),
    grouping: "single",
    coverMode: "per-volume",
    coverAssignments: {},
    device: KINDLE_DEVICES[0].id,
    format: "EPUB",
    preset: "manga",
    meta: { title: "", author: "" },
    delivery: "kindle",
    kindleEmail: "",
    volumeSize: 8,
    volumeMode: "fixed",
    volumeSizes: [],
  });

  const update = <K extends keyof WizardData>(k: K, v: WizardData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const goto = (i: number) => i <= visited && setStep(i);

  const cost = data.selectedChapters.size;
  const credits = 0;
  const enoughCredits = cost > 0;

  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return !!data.series;
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
  }, [step, data]);

  const next = () => {
    if (step === 4) return finish();
    const n = step + 1;
    setStep(n);
    setVisited((v) => Math.max(v, n));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const handleFetch = async () => {
    if (!data.url) return;
    setLoading(true);
    try {
      const series = await mockFetchSeries(data.url, data.volumeSize);
      setData((d) => ({
        ...d,
        series,
        selectedChapters: new Set(),
        meta: { title: series.title, author: series.author },
      }));
      setVisited((v) => Math.max(v, 1));
      toast.success("Capítulos encontrados!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleChapter = (id: string) => {
    setData((d) => {
      const s = new Set(d.selectedChapters);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return { ...d, selectedChapters: s };
    });
  };

  const finish = () => {
    if (!user) {
      toast.error("Você precisa estar logado para converter.");
      return;
    }
    if (!data.series) {
      toast.error("Nenhuma série carregada. Volte ao passo 1.");
      return;
    }
    if (cost === 0) {
      toast.error("Selecione ao menos um capítulo.");
      return;
    }
    if (data.delivery === "kindle" && !data.kindleEmail) {
      toast.error("Informe seu e-mail Kindle para envio.");
      return;
    }
    if (
      data.delivery === "kindle" &&
      !/^\S+@(kindle\.com|free\.kindle\.com)$/i.test(data.kindleEmail)
    ) {
      toast.error("E-mail Kindle inválido. Use um endereço @kindle.com ou @free.kindle.com.");
      return;
    }

    const jobId = startJob({
      series: data.series,
      selectedChapters: data.selectedChapters,
      meta: data.meta,
      format: data.format,
      delivery: data.delivery,
      kindleEmail: data.kindleEmail,
      volumeSize: data.volumeSize,
    });

    toast.success(`Conversão de "${data.series.title}" iniciada!`);

    navigate({ to: "/biblioteca/converter/$jobId", params: { jobId } });
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
              series={data.series}
              loading={loading}
              volumeSize={data.volumeSize}
              onUrlChange={(v) => update("url", v)}
              onFetch={handleFetch}
            />
          )}
          {step === 1 && data.series && (
            <StepChapters
              series={data.series}
              selected={data.selectedChapters}
              grouping={data.grouping}
              volumeSize={data.volumeSize}
              volumeMode={data.volumeMode}
              volumeSizes={data.volumeSizes}
              onToggle={toggleChapter}
              onSelectAll={() =>
                update("selectedChapters", new Set(data.series!.chapters.map((c) => c.id)))
              }
              onClear={() => update("selectedChapters", new Set())}
              onGrouping={(g) => update("grouping", g)}
              onVolumeSize={(v) => update("volumeSize", v)}
              onVolumeMode={(m) => update("volumeMode", m)}
              onVolumeSizes={(v) => update("volumeSizes", v)}
            />
          )}
          {step === 2 && data.series && (
            <StepCovers
              series={data.series}
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
          {step === 4 && (
            <StepDelivery
              data={data}
              update={update}
              onEdit={goto}
              cost={cost}
              credits={credits}
              enough={enoughCredits}
            />
          )}
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
            disabled={step !== 4 && !canNext}
            className="bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display text-lg disabled:opacity-40 hover:-translate-y-0.5"
          >
            {step === 4 ? `Converter (${cost} créditos)` : "Próximo"}
            <ArrowRight className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Step components ---------- */

function StepOrigin({
  url,
  series,
  loading,
  onUrlChange,
  onFetch,
  volumeSize,
}: {
  url: string;
  series: Series | null;
  loading: boolean;
  onUrlChange: (v: string) => void;
  onFetch: () => void;
  volumeSize: number;
}) {
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
          disabled={loading || !url}
          className="bg-comic-blue text-accent-foreground hover:bg-comic-blue h-12 border-[3px] border-ink shadow-comic font-display text-lg disabled:opacity-50"
        >
          {loading ? (
            "Buscando…"
          ) : (
            <>
              <Search className="mr-1" /> Buscar
            </>
          )}
        </Button>
      </div>

      {loading && (
        <SpeechBubble variant="blue" tail="left" className="animate-comic-shake">
          Vasculhando os arquivos secretos…
        </SpeechBubble>
      )}

      {series && !loading && (
        <ComicPanel bg="yellow" padding="md" className="animate-comic-pop">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-full border-[3px] border-ink bg-comic-red text-primary-foreground flex items-center justify-center shadow-comic-sm">
              <Check className="h-7 w-7" strokeWidth={3} />
            </div>
            <div>
              <p className="font-display text-2xl leading-none">{series.title}</p>
              <p className="text-sm font-medium mt-1">
                {series.chapters.length} capítulos •{" "}
                {Math.ceil(series.chapters.length / volumeSize)} volumes
              </p>
            </div>
          </div>
        </ComicPanel>
      )}
    </div>
  );
}

function StepChapters({
  series,
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
  series: Series;
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
  const totalChapters = series.chapters.length;

  const calculateVolume = (chapterIndex: number): number => {
    if (volumeMode === "fixed") {
      return Math.floor(chapterIndex / volumeSize) + 1;
    }
    let idx = chapterIndex;
    for (let v = 0; v < volumeSizes.length; v++) {
      if (idx < volumeSizes[v]) return v + 1;
      idx -= volumeSizes[v];
    }
    return volumeSizes.length + 1;
  };

  const customTotalAssigned = volumeSizes.reduce((a, b) => a + b, 0);
  const customRemaining = totalChapters - customTotalAssigned;

  const addCustomVolume = () => {
    onVolumeSizes([...volumeSizes, Math.min(volumeSize, Math.max(1, customRemaining))]);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<BookOpen />}
        title="Quais capítulos?"
        subtitle={`${selected.size} de ${series.chapters.length} selecionados • 1 crédito por capítulo`}
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
                const volCount = Math.ceil(totalChapters / volumeSize);
                const base = Math.floor(totalChapters / volCount);
                const remainder = totalChapters - base * volCount;
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
              max={totalChapters}
              value={volumeSize}
              onChange={(e) => {
                const v = Math.max(1, Math.min(totalChapters, Number(e.target.value) || 1));
                onVolumeSize(v);
              }}
              className="border-[3px] border-ink h-10 w-24 shadow-comic-sm"
            />
            <span className="text-sm font-medium opacity-70">
              = {Math.ceil(totalChapters / volumeSize)} volume(s)
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
        {series.chapters.map((c, i) => {
          const checked = selected.has(c.id);
          const vol = calculateVolume(i);
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
                  Vol. {vol} • {c.title} • {c.pages}p
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
  series: Series;
  selectedChapters: Set<string>;
  mode: CoverMode;
  assignments: Record<string, CoverRef>;
  onMode: (m: CoverMode) => void;
  onAssign: (key: string, ref: CoverRef) => void;
}) {
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const usedChapters = series.chapters.filter((c) => selectedChapters.has(c.id));
  const volumes = Array.from(new Set(usedChapters.map((c) => c.volume))).sort((a, b) => a - b);

  const targets =
    mode === "single"
      ? [{ key: "all", label: "Todos os capítulos" }]
      : mode === "per-volume"
        ? volumes.map((v) => ({
            key: `vol-${v}`,
            label: `Volume ${v} (${usedChapters.filter((c) => c.volume === v).length} caps)`,
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
          text="Aplica a mesma em todos."
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
                  <p className="text-xs font-medium opacity-70">{describeRef(ref)}</p>
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
                      style={{ background: `hsl(${c.hue} 80% 60%)` }}
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
                    onAssign(pickerFor!, { kind: "upload", name: f.name });
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

function CoverPreview({ ref, covers }: { ref: CoverRef | undefined; covers: Cover[] }) {
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
  const c = covers.find((c) => c.id === ref.coverId);
  return <div className={cls} style={{ background: c ? `hsl(${c.hue} 80% 60%)` : undefined }} />;
}

function describeRef(ref: CoverRef | undefined): string {
  if (!ref || ref.kind === "original") return "Capa original";
  if (ref.kind === "gallery") return `Galeria · ${ref.coverId}`;
  return `Upload · ${ref.name}`;
}

function StepConvert({
  data,
  update,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
}) {
  const [previewChapterId, setPreviewChapterId] = useState("");
  const [previewPage, setPreviewPage] = useState(1);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewSeed, setPreviewSeed] = useState(0);
  const [previewDarkMode, setPreviewDarkMode] = useState(false);
  const [doublePageSplit, setDoublePageSplit] = useState(false);

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
    data.series?.chapters.filter((c) => data.selectedChapters.has(c.id)) ?? [];
  const currentChapter = selectedChapters.find((c) => c.id === previewChapterId);
  const maxPage = currentChapter?.pages ?? 1;

  // Estimate time: ~0.5s per page total
  const totalPages = selectedChapters.reduce((s, c) => s + c.pages, 0);
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

  const kindleLabel = KINDLE_DEVICES.find((d) => d.id === data.device)?.label ?? "";

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Settings2 />}
        title="Configurações"
        subtitle="Ajuste pro seu Kindle e veja o preview."
      />

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
              {KINDLE_DEVICES.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="font-display text-base">Formato de saída</Label>
          <Select value={data.format} onValueChange={(v) => update("format", v as OutputFormat)}>
            <SelectTrigger className="border-[3px] border-ink h-11 shadow-comic-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[3px] border-ink">
              {OUTPUT_FORMATS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label className="font-display text-base">Preset</Label>
          <Select value={data.preset} onValueChange={(v) => update("preset", v as PresetId)}>
            <SelectTrigger className="border-[3px] border-ink h-11 shadow-comic-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[3px] border-ink">
              {PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="font-display mr-2">{p.label}</span>
                  <span className="opacity-70 text-xs">— {p.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs font-medium opacity-70">
            {PRESETS.find((p) => p.id === data.preset)?.description}
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
  cost,
  credits,
  enough,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
  onEdit: (i: number) => void;
  cost: number;
  credits: number;
  enough: boolean;
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
          <SummaryRow label="Origem" value={data.series?.title ?? "—"} onEdit={() => onEdit(0)} />
          <SummaryRow
            label="Capítulos"
            value={`${data.selectedChapters.size} • ${data.grouping === "single" ? "junto" : "separado"}`}
            onEdit={() => onEdit(1)}
          />
          <SummaryRow label="Capas" value={describeMode(data.coverMode)} onEdit={() => onEdit(2)} />
          <SummaryRow
            label="Kindle"
            value={`${KINDLE_DEVICES.find((d) => d.id === data.device)?.label} • ${data.format} • preset ${data.preset}`}
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

      <SizeBudget chapters={cost} delivery={data.delivery} />
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

function describeMode(m: CoverMode) {
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
