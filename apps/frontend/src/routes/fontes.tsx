import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SearchBar, highlightMatch } from "@/components/biblioteca/SearchBar";
import { Button } from "@/components/ui/button";
import { Toaster } from "sonner";
import {
  Sparkles,
  ExternalLink,
  Loader2,
  SearchX,
  RefreshCw,
  AlertTriangle,
  Check,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, type SourceStatus } from "@/components/providers/constants";
import { EngineBadge } from "@/components/providers/EngineBadge";
import { ProviderConfigDialog } from "@/components/providers/ProviderConfigDialog";
import { useProviders } from "@/hooks/useProviders";
import type { ProviderRecord } from "@/types/scraping";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authGuard } from "./-authGuard";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/fontes")({
  beforeLoad: authGuard,
  component: FontesPage,
});

type SortBy = "name" | "status" | "engine";

const STATUS_ORDER: SourceStatus[] = ["active", "slow", "beta", "offline", "soon"];

function isSourceStatus(status: string): status is SourceStatus {
  return status in STATUS_CONFIG;
}

function asStatus(status: string): SourceStatus {
  return isSourceStatus(status) ? status : "soon";
}

function StatusIndicator({ status }: { status: string }) {
  const config = STATUS_CONFIG[asStatus(status)];
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full border border-ink shrink-0",
          config.dot,
          status === "active" && "animate-pulse",
          status === "slow" && "animate-pulse",
        )}
      />
      <span className={cn("font-display text-xs", config.color)}>
        {config.label}
        {status === "active" && " ✓"}
        {status === "slow" && " ⚠"}
        {status === "offline" && " ✗"}
      </span>
    </div>
  );
}

function chipCls(active: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border-[2.5px] font-display text-sm transition-all",
    active
      ? "bg-comic-red text-primary-foreground border-ink shadow-comic-sm"
      : "bg-card border-ink hover:-translate-y-0.5 shadow-comic-sm",
  );
}

function FontesPage() {
  const { data, isLoading, isError, refetch } = useProviders();
  const providers = useMemo(() => data?.providers ?? [], [data]);
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SourceStatus | "all">("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [configSlug, setConfigSlug] = useState<string | null>(null);

  const allTags = useMemo(
    () =>
      Array.from(new Set(providers.flatMap((p) => p.tags))).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [providers],
  );

  const hasFilters = query.trim() !== "" || statusFilter !== "all" || selectedTags.length > 0;

  const filtered = useMemo(() => {
    let result = providers;
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((p) =>
        [p.name, p.slug, p.description, ...(p.tags ?? [])]
          .filter((v): v is string => Boolean(v))
          .some((v) => v.toLowerCase().includes(q)),
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (selectedTags.length > 0) {
      result = result.filter((p) => selectedTags.every((t) => (p.tags ?? []).includes(t)));
    }
    const sorted = [...result];
    switch (sortBy) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        break;
      case "status":
        sorted.sort(
          (a, b) =>
            STATUS_ORDER.indexOf(asStatus(a.status)) - STATUS_ORDER.indexOf(asStatus(b.status)),
        );
        break;
      case "engine":
        sorted.sort((a, b) => a.engine.localeCompare(b.engine));
        break;
    }
    return sorted;
  }, [providers, query, statusFilter, selectedTags, sortBy]);

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setSelectedTags([]);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <ComicHeader />
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-lg border-[3px] border-ink bg-comic-yellow flex items-center justify-center shadow-comic-sm">
            <Sparkles />
          </div>
          <div>
            <h1 className="font-display text-4xl uppercase leading-none">Fontes homologadas</h1>
            <p className="text-sm font-medium opacity-80 mt-1">Os sites que o Mangaink sabe ler.</p>
          </div>
        </div>

        <SearchBar value={query} onChange={setQuery} placeholder="Buscar fonte..." />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={chipCls(statusFilter === "all")}
          >
            Todos
          </button>
          {STATUS_ORDER.map((s) => {
            const active = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(active ? "all" : s)}
                className={chipCls(active)}
              >
                <span
                  className={cn("h-2 w-2 rounded-full border border-ink", STATUS_CONFIG[s].dot)}
                />
                {STATUS_CONFIG[s].label}
              </button>
            );
          })}
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={chipCls(active)}
                >
                  {active && <Check className="h-3 w-3" />}
                  {tag}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-sm opacity-70">
            {hasFilters
              ? `${filtered.length} de ${providers.length} fontes`
              : `${providers.length} fontes`}
          </p>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="h-11 w-56 border-[3px] border-ink bg-card shadow-comic-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[3px] border-ink">
              <SelectItem value="name">Nome A–Z</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="engine">Engine</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-comic-blue" />
          </div>
        )}

        {isError && (
          <div className="text-center py-16">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-ink bg-comic-red shadow-comic-sm">
              <AlertTriangle className="h-10 w-10 text-primary-foreground" />
            </div>
            <h2 className="font-display text-3xl uppercase mb-3">
              Não foi possível carregar as fontes
            </h2>
            <p className="text-sm font-medium opacity-70 mb-6 max-w-md mx-auto">
              Houve um problema ao consultar os providers. Tente novamente.
            </p>
            <Button
              onClick={() => refetch()}
              className="bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display"
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Tentar novamente
            </Button>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-ink bg-comic-yellow shadow-comic-sm">
              <SearchX className="h-10 w-10" />
            </div>
            <h2 className="font-display text-3xl uppercase mb-3">Nenhuma fonte encontrada</h2>
            <p className="text-sm font-medium opacity-70 mb-6 max-w-md mx-auto">
              {hasFilters
                ? "Ajuste a busca ou limpe os filtros para ver todas as fontes."
                : "Ainda não há fontes homologadas."}
            </p>
            {hasFilters && (
              <Button
                onClick={clearFilters}
                className="bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display"
              >
                <RefreshCw className="h-4 w-4 mr-1" /> Limpar filtros
              </Button>
            )}
          </div>
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ComicPanel key={p.slug} bg="card" padding="sm" className="flex flex-col">
                <div className="flex items-start gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-display text-lg leading-none truncate">
                        {highlightMatch(p.name, query)}
                      </h2>
                      <StatusIndicator status={p.status} />
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <EngineBadge engine={p.engine} />
                      <span className="text-[10px] font-medium opacity-50 truncate">
                        {highlightMatch(`#${p.slug}`, query)}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setConfigSlug(p.slug)}
                    aria-label={`Configurar ${p.name}`}
                    title="Configurar fonte (Admin)"
                    className="ml-auto shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border-[3px] border-ink bg-muted text-foreground shadow-comic-sm transition-all hover:-translate-y-0.5 hover:bg-comic-yellow hover:text-comic-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-comic-blue active:translate-y-0"
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                  )}
                </div>
                {p.description && (
                  <p className="text-xs font-medium opacity-70 mb-2 line-clamp-2">
                    {highlightMatch(p.description, query)}
                  </p>
                )}
                {p.urlExample && (
                  <code className="block text-[10px] bg-muted border-[2px] border-ink rounded px-2 py-1 mb-3 truncate">
                    {p.urlExample}
                  </code>
                )}
                {p.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3 mt-auto">
                    {p.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 bg-muted border-[2px] border-ink rounded"
                      >
                        {highlightMatch(tag, query)}
                      </span>
                    ))}
                  </div>
                )}
                {p.homepage && (
                  <a
                    href={p.homepage}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-display text-xs underline underline-offset-4 hover:text-comic-red"
                  >
                    Abrir site <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </ComicPanel>
            ))}
          </div>
        )}

        {isAdmin && (
        <ProviderConfigDialog
          provider={providers.find((p) => p.slug === configSlug) ?? null}
          open={configSlug !== null}
          onOpenChange={(open) => {
            if (!open) setConfigSlug(null);
          }}
        />
        )}
      </div>
    </div>
  );
}
