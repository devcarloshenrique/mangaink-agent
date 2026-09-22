import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { scrapingApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ProviderRecord, ProviderUpdateInput } from "@/types/scraping";
import { STATUS_CONFIG, type SourceStatus } from "./constants";
import { CURATED_TAGS, tagLabel } from "./provider-tags";

import { Check, Copy, Loader2, Save, X } from "lucide-react";
const STATUS_OPTIONS: SourceStatus[] = ["active", "slow", "beta", "offline", "soon"];

function isSourceStatus(status: string): status is SourceStatus {
  return status in STATUS_CONFIG;
}

function splitTags(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

interface ProviderEditorFormProps {
  provider: ProviderRecord;
  onSaved?: () => void;
}

export function ProviderEditorForm({ provider, onSaved }: ProviderEditorFormProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SourceStatus>(
    isSourceStatus(provider.status) ? provider.status : "soon",
  );
  const homepage = provider.homepage ?? "";
  const [tagsText, setTagsText] = useState(() => (provider.tags ?? []).join(", "));
  const [maxConcurrent, setMaxConcurrent] = useState(String(provider.rateLimit.maxConcurrent));
  const [minTime, setMinTime] = useState(String(provider.rateLimit.minTime));
  const [reservoir, setReservoir] = useState(
    provider.rateLimit.reservoir === null ? "" : String(provider.rateLimit.reservoir),
  );
  const [reservoirRefreshInterval, setReservoirRefreshInterval] = useState(
    provider.rateLimit.reservoirRefreshInterval === null
      ? ""
      : String(provider.rateLimit.reservoirRefreshInterval),
  );
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const contentTags = useMemo(() => splitTags(tagsText), [tagsText]);
  const tags = useMemo(() => Array.from(new Set(contentTags)), [contentTags]);

  const toggleContentTag = (slug: string) => {
    const current = splitTags(tagsText);
    setTagsText(
      current.includes(slug)
        ? current.filter((t) => t !== slug).join(", ")
        : [...current, slug].join(", "),
    );
  };

  const removeTag = (tag: string) => {
    setTagsText(
      splitTags(tagsText)
        .filter((t) => t !== tag)
        .join(", "),
    );
  };

  const handleCopyHomepage = async () => {
    if (!homepage) {
      toast.error("Este provider não tem homepage cadastrada");
      return;
    }
    try {
      await navigator.clipboard.writeText(homepage);
      toast.success("Link copiado");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const buildPatch = (): ProviderUpdateInput | null => {
    const maxC = Number(maxConcurrent);
    const minT = Number(minTime);
    const res = reservoir === "" ? null : Number(reservoir);
    const rri = reservoirRefreshInterval === "" ? null : Number(reservoirRefreshInterval);

    if (!Number.isInteger(maxC) || maxC < 1) {
      toast.error("maxConcurrent deve ser um número inteiro >= 1");
      return null;
    }
    if (!Number.isInteger(minT) || minT < 0) {
      toast.error("minTime deve ser um número inteiro >= 0");
      return null;
    }
    if (res !== null && (!Number.isInteger(res) || res < 1)) {
      toast.error("reservoir deve ser um número inteiro >= 1 ou vazio");
      return null;
    }
    if (rri !== null && (!Number.isInteger(rri) || rri < 100)) {
      toast.error("reservoirRefreshInterval deve ser >= 100 ou vazio");
      return null;
    }

    return {
      status,
      tags,
      rateLimit: {
        maxConcurrent: maxC,
        minTime: minT,
        reservoir: res,
        reservoirRefreshInterval: rri,
      },
    };
  };

  const handleSave = async () => {
    const patch = buildPatch();
    if (!patch) return;
    setSaving(true);
    try {
      await scrapingApi.updateProvider(provider.slug, patch);
      toast.success(`Provider "${provider.name}" salvo`);
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      onSaved?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar provider");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="font-display">Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as SourceStatus)}>
          <SelectTrigger className="h-11 border-[3px] border-ink bg-background shadow-comic-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-[3px] border-ink">
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="font-display">Homepage</Label>
        <div className="flex gap-2">
          <Input
            value={homepage}
            readOnly
            placeholder="Sem homepage cadastrada"
            aria-label="Homepage do provider (somente leitura)"
            className="border-[3px] border-ink h-11 shadow-comic-sm flex-1 bg-muted/50"
          />
          <Button
            type="button"
            onClick={handleCopyHomepage}
            disabled={!homepage}
            aria-label="Copiar link da homepage"
            title="Copiar link"
            className={cn(
              "h-11 w-11 shrink-0 border-[3px] border-ink shadow-comic-sm",
              copied
                ? "bg-comic-blue text-primary-foreground hover:bg-comic-blue"
                : "bg-comic-yellow text-comic-ink hover:bg-comic-yellow/90",
            )}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[11px] font-medium opacity-70">
          Endereço oficial da fonte. Somente leitura — use o botão ao lado para copiar.
        </p>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="font-display">Tags</Label>
        <div className="flex flex-wrap gap-1.5">
          {CURATED_TAGS.map(({ slug }) => {
            const active = contentTags.includes(slug);
            return (
              <button
                key={slug}
                type="button"
                onClick={() => toggleContentTag(slug)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-md border-[2.5px] font-display text-xs transition-all",
                  active
                    ? "bg-comic-red text-primary-foreground border-ink shadow-comic-sm"
                    : "bg-card border-ink hover:-translate-y-0.5 shadow-comic-sm",
                )}
              >
                {tagLabel(slug)}
              </button>
            );
          })}
        </div>
        <Input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="mangá, manhwa, manhua, webtoon..."
          aria-label="Tags personalizadas (separadas por vírgula)"
          className="border-[3px] border-ink h-11 shadow-comic-sm"
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-muted border-[2px] border-ink rounded"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="opacity-60 hover:opacity-100"
                  aria-label={`Remover tag ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="sm:col-span-2 space-y-1.5">
        <Label className="font-display">Rate limit</Label>
        <div className="grid gap-3 sm:grid-cols-2 mt-1.5">
          <div className="space-y-1.5">
            <Label htmlFor="rl-max-concurrent" className="font-display">
              Máx. simultâneas
            </Label>
            <Input
              id="rl-max-concurrent"
              type="number"
              min={1}
              step={1}
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(e.target.value)}
              placeholder="Ex.: 6"
              className="border-[3px] border-ink h-11 shadow-comic-sm"
            />
            <p className="text-[11px] font-medium opacity-70">
              Quantas requisições simultâneas ao site.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rl-min-time" className="font-display">
              Intervalo mínimo (ms)
            </Label>
            <Input
              id="rl-min-time"
              type="number"
              min={0}
              step={1}
              value={minTime}
              onChange={(e) => setMinTime(e.target.value)}
              placeholder="Ex.: 50"
              className="border-[3px] border-ink h-11 shadow-comic-sm"
            />
            <p className="text-[11px] font-medium opacity-70">
              Intervalo mínimo entre requisições, em ms.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rl-reservoir" className="font-display">
              Teto por janela
            </Label>
            <Input
              id="rl-reservoir"
              type="number"
              min={1}
              step={1}
              value={reservoir}
              onChange={(e) => setReservoir(e.target.value)}
              placeholder="Vazio = sem teto"
              className="border-[3px] border-ink h-11 shadow-comic-sm"
            />
            <p className="text-[11px] font-medium opacity-70">Teto de requisições por janela.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rl-reservoir-refresh" className="font-display">
              Duração da janela (ms)
            </Label>
            <Input
              id="rl-reservoir-refresh"
              type="number"
              min={100}
              step={100}
              value={reservoirRefreshInterval}
              onChange={(e) => setReservoirRefreshInterval(e.target.value)}
              placeholder="Ex.: 60000"
              className="border-[3px] border-ink h-11 shadow-comic-sm"
            />
            <p className="text-[11px] font-medium opacity-70">Duração da janela do teto, em ms.</p>
          </div>
        </div>
      </div>

      <div className="sm:col-span-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
