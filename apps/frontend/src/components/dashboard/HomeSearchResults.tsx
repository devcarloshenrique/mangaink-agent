import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, SearchX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AddMangaDialog } from "@/components/biblioteca/AddMangaDialog";
import { ProviderSearchRail } from "@/components/dashboard/ProviderSearchRail";
import { scrapingApi } from "@/lib/api";
import { useScraping } from "@/hooks/useScraping";
import type {
  ProviderRecord,
  SearchSourcesResponse,
  SourceInspectResponse,
} from "@/types/scraping";

interface HomeSearchResultsProps {
  providers: ProviderRecord[];
  debouncedQuery: string;
  data: SearchSourcesResponse | undefined;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
  onLoadMore?: (
    slug: string,
    offset: number,
    limit: number,
    signal?: AbortSignal,
  ) => Promise<SearchSourcesResponse>;
}

export function HomeSearchResults({
  providers,
  debouncedQuery,
  data,
  isFetching,
  error,
  refetch,
  onLoadMore,
}: HomeSearchResultsProps) {
  const [addingUrl, setAddingUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [dialogData, setDialogData] = useState<{
    sourceId: string;
    metadata: SourceInspectResponse;
  } | null>(null);
  const { state, inspect, reset } = useScraping();
  const queryClient = useQueryClient();
  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    return () => {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, []);

  const providerBySlug = useMemo(() => new Map(providers.map((p) => [p.slug, p])), [providers]);

  const grouped = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof data>["results"]>();
    for (const r of data?.results ?? []) {
      const list = groups.get(r.providerSlug) ?? [];
      list.push(r);
      groups.set(r.providerSlug, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [data]);

  const failedSlugs = useMemo(() => (data?.errors ?? []).map((e) => e.providerSlug), [data]);

  const handleLoadMore = useCallback(
    (slug: string, offset: number, limit: number, signal?: AbortSignal) => {
      if (onLoadMore) {
        return onLoadMore(slug, offset, limit, signal);
      }
      return scrapingApi.search(debouncedQuery, { providers: slug, limit, offset }, signal);
    },
    [onLoadMore, debouncedQuery],
  );

  const handleAdd = async (url: string) => {
    reset();
    setFailedUrl(null);
    setAddingUrl(url);

    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
    }
    toastIdRef.current = toast.loading("Analisando obra e coletando capítulos...");

    try {
      await inspect(url);
    } catch {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      toast.error("Falha ao iniciar a inspeção da obra.");
      setFailedUrl(url);
      setAddingUrl(null);
    }
  };

  // Quando o inspect do resultado avança ou conclui, atualiza toast e abre o dialog.
  useEffect(() => {
    if (state.status === "processing" && toastIdRef.current && state.message) {
      const label = state.progress > 0 ? `${state.message} (${state.progress}%)` : state.message;
      toast.loading(label, { id: toastIdRef.current });
    }

    if (state.status === "ready" && state.metadata && state.sourceId && addingUrl) {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      toast.success("Obra analisada com sucesso!");
      setDialogData({ sourceId: state.sourceId, metadata: state.metadata });
      setAddingUrl(null);
    }

    if (state.status === "failed" && addingUrl) {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      toast.error(state.error || "Não foi possível carregar os detalhes desta obra.");
      setFailedUrl(addingUrl);
      setAddingUrl(null);
    }
  }, [
    state.status,
    state.metadata,
    state.sourceId,
    state.message,
    state.progress,
    state.error,
    addingUrl,
  ]);
  const inspectFailed = state.status === "failed";

  const results = data?.results ?? [];

  if (!data && !error) {
    return (
      <section aria-label="Resultados da busca" className="w-full space-y-8">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-3" aria-hidden>
            <div className="h-7 w-48 animate-pulse rounded border-[3px] border-ink bg-muted" />
            <div className="h-56 animate-pulse rounded-md border-[3px] border-ink bg-muted" />
          </div>
        ))}
      </section>
    );
  }

  if (error) {
    return (
      <section aria-label="Resultados da busca" className="w-full">
        <div className="flex items-center gap-2 py-2 text-sm">
          <AlertTriangle className="h-5 w-5 text-comic-red" />
          <span className="font-medium">Falha na busca. </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="border-[2px] border-ink"
          >
            <RefreshCw className="mr-1 h-3 w-3" /> Tentar novamente
          </Button>
        </div>
      </section>
    );
  }

  if (!isFetching && data && results.length === 0) {
    if (data.errors.length > 0) {
      return (
        <section aria-label="Resultados da busca" className="w-full">
          <div className="flex items-center gap-2 py-2 text-sm">
            <AlertTriangle className="h-5 w-5 text-comic-red" />
            <span className="font-medium">
              Falha na busca
              {failedSlugs.length > 0 && ` (${failedSlugs.join(", ")})`}.{" "}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              className="border-[2px] border-ink"
            >
              <RefreshCw className="mr-1 h-3 w-3" /> Tentar novamente
            </Button>
          </div>
        </section>
      );
    }
    return (
      <section aria-label="Resultados da busca" className="w-full">
        <div className="flex items-center gap-2 py-4 text-sm font-medium opacity-70">
          <SearchX className="h-5 w-5" />
          Nenhum resultado para “{data.query}”.
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Resultados da busca" className="w-full space-y-8">
      {debouncedQuery.length >= 2 && data?.truncated && (
        <p className="text-xs font-medium opacity-70">
          Busca em {data.searchedProviders.length} fontes.
        </p>
      )}

      {data && data.errors.length > 0 && results.length > 0 && (
        <p className="text-xs font-medium opacity-70">
          {data.errors.length} fonte{data.errors.length > 1 ? "s" : ""}{" "}
          {data.errors.length > 1 ? "falharam" : "falhou"}
          {failedSlugs.length > 0 && ` (${failedSlugs.join(", ")})`} — mostrando resultados
          parciais.
        </p>
      )}

      {grouped.map(([slug, providerResults]) => {
        const provider = providerBySlug.get(slug);
        return (
          <ProviderSearchRail
            key={`${slug}-${debouncedQuery}`}
            slug={slug}
            title={provider?.name ?? slug}
            engine={provider?.engine}
            results={providerResults}
            query={debouncedQuery}
            onLoadMore={handleLoadMore}
            addingUrl={addingUrl}
            failedUrl={failedUrl}
            inspectFailed={inspectFailed}
            inspectError={state.error}
            onAdd={(url) => void handleAdd(url)}
          />
        );
      })}

      {dialogData && (
        <AddMangaDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDialogData(null);
              reset();
              void queryClient.invalidateQueries({ queryKey: ["library"] });
            }
          }}
          sourceId={dialogData.sourceId}
          metadata={dialogData.metadata}
        />
      )}
    </section>
  );
}
