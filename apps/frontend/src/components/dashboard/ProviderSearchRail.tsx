import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EngineBadge } from "@/components/providers/EngineBadge";
import type { ProviderRecord, ProviderSearchResult, SearchSourcesResponse } from "@/types/scraping";

interface ProviderSearchRailProps {
  slug: string;
  title: string;
  engine?: ProviderRecord["engine"];
  results: ProviderSearchResult[];
  query?: string;
  onLoadMore?: (
    slug: string,
    offset: number,
    limit: number,
    signal?: AbortSignal,
  ) => Promise<SearchSourcesResponse>;
  addingUrl: string | null;
  failedUrl?: string | null;
  inspectFailed: boolean;
  inspectError: string | null;
  onAdd: (url: string) => void;
}

const MAX_OFFSET = 100;
const PAGE_SIZE = 10;

const CARD_WIDTH_CLASSES =
  "w-[calc((100%-1.5rem)/2.3)] sm:w-[calc((100%-2.5rem)/3.5)] md:w-[calc((100%-3.5rem)/4.3)] lg:w-[calc((100%-4rem)/5.5)] shrink-0";

export function ProviderSearchRail({
  slug,
  title,
  engine,
  results,
  query,
  onLoadMore,
  addingUrl,
  failedUrl,
  inspectFailed,
  inspectError,
  onAdd,
}: ProviderSearchRailProps) {
  const [items, setItems] = useState<ProviderSearchResult[]>(results);
  const [offset, setOffset] = useState(results.length);
  // Não encerra prematuramente se o provedor retornou itens com filtro de hidratação (ex: 7 itens)
  const [hasMore, setHasMore] = useState(results.length > 0 && results.length < MAX_OFFSET);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const offsetRef = useRef(results.length);

  useEffect(() => {
    setItems(results);
    setOffset(results.length);
    offsetRef.current = results.length;
    setHasMore(results.length > 0 && results.length < MAX_OFFSET);
    setError(null);
  }, [results]);

  const fetchNextPage = useCallback(async () => {
    if (isLoadingMore || !hasMore || !onLoadMore) return;
    if (offsetRef.current >= MAX_OFFSET) {
      setHasMore(false);
      return;
    }

    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setIsLoadingMore(true);
    setError(null);

    const currentOffset = offsetRef.current;
    try {
      const resp = await onLoadMore(slug, currentOffset, PAGE_SIZE, ac.signal);
      const providerResults = (resp.results ?? []).filter(
        (r) => !r.providerSlug || r.providerSlug === slug,
      );

      let newlyAddedCount = 0;
      setItems((prev) => {
        const existingUrls = new Set(prev.map((i) => i.url));
        const filtered = providerResults.filter((r) => !existingUrls.has(r.url));
        newlyAddedCount = filtered.length;
        return [...prev, ...filtered];
      });

      const nextOffset = currentOffset + PAGE_SIZE;
      offsetRef.current = nextOffset;
      setOffset(nextOffset);

      // Exaustão só ocorre se a página vier vazia, se todos forem duplicados ou se atingir o teto
      const reachedCeiling = nextOffset >= MAX_OFFSET;
      const isExhausted = providerResults.length === 0 || newlyAddedCount === 0 || reachedCeiling;
      setHasMore(!isExhausted);

      const err = resp.errors?.find((e) => e.providerSlug === slug);
      if (err) {
        setError(err.message || "Erro ao carregar mais obras");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message || "Erro ao carregar mais obras");
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, onLoadMore, slug]);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);

    // Threshold de busca antecipada: apenas se houver overflow e rolagem próxima do fim
    if (
      el.scrollWidth > el.clientWidth &&
      el.scrollLeft > 0 &&
      el.scrollLeft + el.clientWidth >= el.scrollWidth - 300
    ) {
      void fetchNextPage();
    }
  }, [fetchNextPage]);

  const scroll = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    const handleResize = () => updateScrollState();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [items, updateScrollState]);

  const cardProps = { addingUrl, failedUrl, inspectFailed, inspectError, onAdd };

  return (
    <section aria-label={`Resultados de ${title}`}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl uppercase leading-none">{title}</h2>
            {engine && <EngineBadge engine={engine} />}
          </div>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide opacity-60">
            {items.length} {items.length === 1 ? "resultado" : "resultados"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border-[2.5px] border-ink bg-comic-yellow px-3 py-1.5 font-display text-sm text-comic-ink shadow-comic-sm transition-transform hover:-translate-y-0.5"
          >
            {expanded ? (
              <>
                <ChevronDown className="h-4 w-4 rotate-180" strokeWidth={2.5} /> Ver menos
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" strokeWidth={2.5} /> Ver mais
              </>
            )}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((r) => (
              <ResultCard key={`${slug}-${r.url}`} result={r} {...cardProps} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void fetchNextPage()}
                disabled={isLoadingMore}
                className="border-[2px] border-ink font-display uppercase shadow-comic-sm hover:shadow-comic"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando mais...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" strokeWidth={2.5} /> Carregar mais obras
                  </>
                )}
              </Button>
            </div>
          )}

          {!hasMore && items.length >= MAX_OFFSET && (
            <p className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground pt-2">
              Limite de {MAX_OFFSET} obras atingido para esta fonte
            </p>
          )}

          {error && (
            <div className="flex items-center justify-center gap-2 text-sm text-comic-red">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void fetchNextPage()}
                className="ml-1 font-bold underline hover:opacity-80"
              >
                Tentar novamente
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="relative group/rail">
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label={`Rolar ${title} para a esquerda`}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-20 grid h-10 w-10 place-items-center rounded-full border-[2.5px] border-ink bg-card/90 shadow-comic backdrop-blur-sm transition-all hover:scale-105 hover:bg-card"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={3} />
            </button>
          )}

          {canScrollRight && (
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label={`Rolar ${title} para a direita`}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-20 grid h-10 w-10 place-items-center rounded-full border-[2.5px] border-ink bg-card/90 shadow-comic backdrop-blur-sm transition-all hover:scale-105 hover:bg-card"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={3} />
            </button>
          )}

          <div
            ref={scrollerRef}
            onScroll={updateScrollState}
            className="flex gap-3.5 overflow-x-auto scroll-smooth pt-2 pb-3 -mt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((r) => (
              <div key={`${slug}-${r.url}`} className={CARD_WIDTH_CLASSES}>
                <ResultCard result={r} {...cardProps} />
              </div>
            ))}

            {isLoadingMore && (
              <div
                className={`${CARD_WIDTH_CLASSES} flex aspect-[2/3] flex-col items-center justify-center rounded-md border-[2.5px] border-dashed border-ink/40 bg-card/60`}
              >
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="mt-2 text-xs font-bold opacity-60">Carregando...</span>
              </div>
            )}

            {error && (
              <div
                className={`${CARD_WIDTH_CLASSES} flex aspect-[2/3] flex-col items-center justify-center rounded-md border-[2.5px] border-comic-red bg-comic-red/10 p-3 text-center`}
              >
                <AlertTriangle className="h-5 w-5 text-comic-red" />
                <span className="mt-1 text-xs font-bold text-comic-red">Falha ao carregar</span>
                <button
                  type="button"
                  onClick={() => void fetchNextPage()}
                  className="mt-2 text-xs font-bold underline hover:opacity-80"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {hasMore && !isLoadingMore && !error && (
              <button
                type="button"
                onClick={() => void fetchNextPage()}
                className={`group flex ${CARD_WIDTH_CLASSES} aspect-[2/3] flex-col items-center justify-center rounded-md border border-ink/20 bg-muted/30 p-3 text-center text-muted-foreground transition-colors hover:border-ink hover:text-foreground`}
              >
                <div className="grid h-8 w-8 place-items-center rounded-full border border-ink/20 bg-muted transition-transform group-hover:scale-105">
                  <Plus className="h-4 w-4" strokeWidth={2} />
                </div>
                <p className="mt-2 text-xs font-medium leading-snug">Carregar mais</p>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

interface ResultCardProps {
  result: ProviderSearchResult;
  addingUrl: string | null;
  failedUrl?: string | null;
  inspectFailed: boolean;
  inspectError: string | null;
  onAdd: (url: string) => void;
}

function ResultCard({
  result: r,
  addingUrl,
  failedUrl,
  inspectFailed,
  inspectError,
  onAdd,
}: ResultCardProps) {
  const isAdding = addingUrl === r.url;
  const isFailed = failedUrl === r.url || (inspectFailed && addingUrl === r.url);
  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        disabled={isAdding}
        onClick={() => onAdd(r.url)}
        aria-label={`Adicionar ${r.title}`}
        className="group relative block aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-md border-[3px] border-ink bg-ink shadow-comic-sm transition-all hover:-translate-y-1 hover:shadow-comic focus-visible:outline-offset-2 disabled:cursor-wait"
      >
        {r.coverUrl ? (
          <img
            src={r.coverUrl}
            alt={`Capa de ${r.title}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-muted text-xs font-medium opacity-60">
            Sem capa
          </span>
        )}
        {isAdding && (
          <span aria-hidden className="absolute inset-0 z-10 grid place-items-center bg-black/60">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </span>
        )}
      </button>
      <p className="line-clamp-2 min-h-10 text-sm font-bold leading-snug" title={r.title}>
        {r.title}
      </p>
      {isFailed && inspectError && (
        <p className="text-[11px] font-medium text-comic-red">{inspectError}</p>
      )}
    </div>
  );
}
