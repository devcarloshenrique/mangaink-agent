import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { scrapingApi } from "@/lib/api";
import type { ProviderRecord, ProviderUpdateInput } from "@/types/scraping";
import { STATUS_CONFIG, type SourceStatus } from "./constants";
import { Loader2, Save, X } from "lucide-react";

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
  const [description, setDescription] = useState(provider.description ?? "");
  const [urlExample, setUrlExample] = useState(provider.urlExample ?? "");
  const [homepage, setHomepage] = useState(provider.homepage ?? "");
  const [searchUrl, setSearchUrl] = useState(provider.searchUrl ?? "");
  const [tagsText, setTagsText] = useState((provider.tags ?? []).join(", "));
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

  const tags = useMemo(() => splitTags(tagsText), [tagsText]);

  const removeTag = (tag: string) => {
    setTagsText(
      splitTags(tagsText)
        .filter((t) => t !== tag)
        .join(", "),
    );
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
      description,
      urlExample,
      homepage,
      searchUrl,
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
        <Label className="font-display">Descrição</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="O que esse site oferece..."
          rows={3}
          className="border-[3px] border-ink shadow-comic-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="font-display">URL exemplo</Label>
        <Input
          value={urlExample}
          onChange={(e) => setUrlExample(e.target.value)}
          placeholder="https://mangalivre.net/manga/x"
          className="border-[3px] border-ink h-11 shadow-comic-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="font-display">Homepage</Label>
        <Input
          value={homepage}
          onChange={(e) => setHomepage(e.target.value)}
          placeholder="https://mangalivre.net"
          className="border-[3px] border-ink h-11 shadow-comic-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="font-display">Search URL</Label>
        <Input
          value={searchUrl}
          onChange={(e) => setSearchUrl(e.target.value)}
          placeholder="https://mangalivre.net/busca/{termo}"
          className="border-[3px] border-ink h-11 shadow-comic-sm"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="font-display">Tags</Label>
        <Input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="pt-BR, sem ads, rápido"
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

      <div className="sm:col-span-2">
        <Label className="font-display">Rate limit</Label>
        <div className="grid gap-3 sm:grid-cols-2 mt-1.5">
          <div className="space-y-1.5">
            <Input
              type="number"
              min={1}
              step={1}
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(e.target.value)}
              placeholder="maxConcurrent (>= 1)"
              className="border-[3px] border-ink h-11 shadow-comic-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Input
              type="number"
              min={0}
              step={1}
              value={minTime}
              onChange={(e) => setMinTime(e.target.value)}
              placeholder="minTime ms (>= 0)"
              className="border-[3px] border-ink h-11 shadow-comic-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Input
              type="number"
              min={1}
              step={1}
              value={reservoir}
              onChange={(e) => setReservoir(e.target.value)}
              placeholder="reservoir (vazio = null)"
              className="border-[3px] border-ink h-11 shadow-comic-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Input
              type="number"
              min={100}
              step={100}
              value={reservoirRefreshInterval}
              onChange={(e) => setReservoirRefreshInterval(e.target.value)}
              placeholder="reservoirRefreshInterval (>= 100)"
              className="border-[3px] border-ink h-11 shadow-comic-sm"
            />
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
