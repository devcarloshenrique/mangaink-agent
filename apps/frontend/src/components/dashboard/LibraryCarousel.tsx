import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, Library } from "lucide-react";
import { conversionsApi, scrapingApi } from "@/lib/api";
import { usePreferredCover } from "@/hooks/usePreferredCover";
import {
  selectOverallProgress,
  useLiveConversionProgress,
  type LiveConversionProgress,
} from "@/hooks/useLiveConversionProgress";
import type { SeriesGroup } from "@/hooks/useConversions";
import type { CoverRef } from "@/types/conversion";

function ShelfPoster({
  item,
  liveProgress,
}: {
  item: SeriesGroup;
  liveProgress?: Map<string, LiveConversionProgress>;
}) {
  const [errorCount, setErrorCount] = useState(0);
  const { preferredCover } = usePreferredCover(item.sourceId);

  // Busca metadados da obra para obter autor, contagem de capítulos e capa remota de fallback
  const { data: source } = useQuery({
    queryKey: ["source", item.sourceId],
    queryFn: () => scrapingApi.getSource(item.sourceId),
    enabled: !!item.sourceId,
    staleTime: 60_000,
  });

  // Detecta se há conversão ativa (queued ou processing)
  const activeConv = item.items?.find((i) => i.status === "queued" || i.status === "processing");
  const isConverting = !!activeConv;
  const live = activeConv ? liveProgress?.get(activeConv.conversionId) : undefined;
  const pct = activeConv ? selectOverallProgress(live?.overall, activeConv.progress) : 0;
  const format = activeConv?.output?.format || "EPUB";
  const stageLabel =
    activeConv?.status === "queued" ? "Na fila..." : pct > 0 ? "Convertendo..." : "Baixando...";

  const activeCoverRef: CoverRef = preferredCover ?? { kind: "original" };
  const localUrl = activeCoverRef ? conversionsApi.coverUrl(item.sourceId, activeCoverRef) : null;
  const remoteCover = source?.covers?.[0]?.imageUrl ?? null;
  const currentSrc =
    errorCount === 0 ? localUrl || remoteCover : errorCount === 1 ? remoteCover : null;

  const author = source?.metadata?.author || "Autor desconhecido";
  const chaptersCount = source?.statistics?.chapters ?? source?.chapters?.length ?? 0;

  return (
    <Link
      to="/biblioteca/$sourceId"
      params={{ sourceId: item.sourceId }}
      className="group w-40 shrink-0 snap-start sm:w-48 lg:w-56"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md border-[3px] border-ink bg-card shadow-comic-sm transition-all group-hover:-translate-y-1 group-hover:shadow-comic">
        {!currentSrc || errorCount >= 2 ? (
          <div className="flex h-full w-full items-center justify-center bg-comic-blue/30 text-3xl">
            📖
          </div>
        ) : (
          <img
            src={currentSrc}
            alt={item.title}
            loading="lazy"
            onError={() => setErrorCount((c) => c + 1)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}

        {/* Badges superiores se houver conversão ativa */}
        {isConverting && (
          <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between gap-1">
            <span className="rounded border-2 border-ink bg-comic-yellow px-1.5 py-0.5 font-display text-[10px] uppercase text-comic-ink shadow-comic-sm">
              {format}
            </span>
            <span className="flex items-center gap-1 rounded border-2 border-ink bg-comic-blue px-1.5 py-0.5 font-display text-[10px] uppercase text-comic-cream shadow-comic-sm">
              <span className="animate-pulse">⚡</span> CONVERTENDO
            </span>
          </div>
        )}

        {/* Pílula de progresso na base da capa se houver conversão ativa */}
        {isConverting && (
          <div className="absolute inset-x-2 bottom-2 z-10 rounded-md border-2 border-ink bg-comic-ink/90 p-1.5 shadow-comic-sm backdrop-blur-xs">
            <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-comic-cream">
              <span className="truncate opacity-80">{stageLabel}</span>
              <span className="tabular-nums text-comic-yellow">{pct}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full border border-ink/40 bg-muted/40">
              <div
                className="h-full bg-comic-yellow transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Overlay com informações no hover (padrão biblioteca) */}
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 z-20">
          <p
            className="font-display text-base leading-tight text-white line-clamp-2"
            title={item.title}
          >
            {item.title}
          </p>
          <p className="mt-1 truncate text-[11px] font-medium text-white/80">{author}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-comic-yellow">
            {chaptersCount} {chaptersCount === 1 ? "capítulo" : "capítulos"}
          </p>
          {isConverting && (
            <p className="mt-1.5 text-[10px] font-bold text-comic-cream/90">
              ⚡ Conversão em andamento ({pct}%)
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

interface LibraryCarouselProps {
  items: SeriesGroup[];
}

export function LibraryCarousel({ items }: LibraryCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Coleta os IDs de todas as conversões ativas dos itens
  const activeConversionIds = useMemo(() => {
    const ids: string[] = [];
    for (const group of items) {
      if (!group.items) continue;
      for (const conv of group.items) {
        if (conv.status === "queued" || conv.status === "processing") {
          ids.push(conv.conversionId);
        }
      }
    }
    return ids;
  }, [items]);

  const liveProgress = useLiveConversionProgress(activeConversionIds);

  // Exibe todas as obras da coleção na prateleira (até 24 obras com scroll horizontal suave)
  const shelfItems = items.slice(0, 24);
  const hasMoreThanShelf = items.length > 24;

  function scroll(dir: 1 | -1) {
    const scrollAmount = (scrollerRef.current?.clientWidth ?? 500) * 0.75;
    scrollerRef.current?.scrollBy({ left: dir * scrollAmount, behavior: "smooth" });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-label="Sua biblioteca">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl uppercase leading-none">Sua biblioteca</h2>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide opacity-60">
            {items.length} {items.length === 1 ? "obra na coleção" : "obras na coleção"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Rolar para a esquerda"
            className="grid h-8 w-8 place-items-center rounded-md border-[2.5px] border-ink bg-card shadow-comic-sm transition-transform hover:-translate-y-0.5"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label="Rolar para a direita"
            className="grid h-8 w-8 place-items-center rounded-md border-[2.5px] border-ink bg-card shadow-comic-sm transition-transform hover:-translate-y-0.5"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={3} />
          </button>
          <Link
            to="/biblioteca"
            className="inline-flex items-center gap-1.5 rounded-md border-[2.5px] border-ink bg-comic-yellow px-3 py-1.5 font-display text-sm text-comic-ink shadow-comic-sm transition-transform hover:-translate-y-0.5"
          >
            <Library className="h-4 w-4" strokeWidth={2.5} /> Ver tudo
          </Link>
        </div>
      </div>

      {/* Prateleira com rolagem horizontal suave */}
      <div
        ref={scrollerRef}
        className="flex snap-x gap-4 overflow-x-auto scroll-smooth pt-2 pb-3 -mt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {shelfItems.map((s) => (
          <ShelfPoster key={s.sourceId} item={s} liveProgress={liveProgress} />
        ))}

        {/* Card especial de "Ver Mais" ao final da fila se houver muitas obras */}
        {hasMoreThanShelf && (
          <Link
            to="/biblioteca"
            className="group flex w-36 shrink-0 snap-start flex-col items-center justify-center rounded-md border-[3px] border-dashed border-ink/40 bg-card/60 p-4 text-center shadow-comic-sm transition-all hover:border-ink hover:bg-comic-yellow hover:shadow-comic sm:w-44"
          >
            <div className="grid h-12 w-12 place-items-center rounded-full border-[2.5px] border-ink bg-card shadow-comic-sm group-hover:scale-110">
              <ArrowRight className="h-5 w-5" strokeWidth={3} />
            </div>
            <p className="mt-3 font-display text-base uppercase leading-tight">
              Ver todas as {items.length} obras
            </p>
          </Link>
        )}
      </div>
    </section>
  );
}
