import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, Library } from "lucide-react";
import { conversionsApi, scrapingApi } from "@/lib/api";
import type { SeriesGroup } from "@/hooks/useConversions";
import type { CoverRef } from "@/types/conversion";

function getGroupCoverRef(group: SeriesGroup): CoverRef | undefined {
  const withCover = group.items.find((i) => i.cover);
  return withCover?.cover as CoverRef | undefined;
}

function ShelfPoster({ item }: { item: SeriesGroup }) {
  const [errorCount, setErrorCount] = useState(0);

  // Busca metadados da obra para obter a descrição e capa remota de fallback
  const { data: source } = useQuery({
    queryKey: ["source", item.sourceId],
    queryFn: () => scrapingApi.getSource(item.sourceId),
    enabled: !!item.sourceId,
    staleTime: 60_000,
  });

  const coverRef = getGroupCoverRef(item);
  const localUrl = coverRef ? conversionsApi.coverUrl(item.sourceId, coverRef) : null;
  const remoteCover = source?.covers?.[0]?.imageUrl ?? null;
  const currentSrc =
    errorCount === 0 ? localUrl || remoteCover : errorCount === 1 ? remoteCover : null;

  const formats = [...new Set(item.items.map((i) => i.output?.format).filter(Boolean))].join(" · ");
  const description =
    source?.metadata?.description ||
    "Acesse seus volumes convertidos e continue a leitura na biblioteca.";

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

        {/* Overlay com descrição no hover */}
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/55 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <p className="line-clamp-4 text-[11px] font-medium leading-snug text-white/95">
            {description}
          </p>
          <p className="mt-2 truncate text-[10px] font-bold uppercase tracking-wide text-white/80">
            {formats || "Volume"} · {item.conversionCount}{" "}
            {item.conversionCount === 1 ? "conversão" : "conversões"}
          </p>
        </div>
      </div>

      <p className="mt-2 truncate text-sm font-bold leading-tight">{item.title}</p>
      <p className="truncate text-[11px] font-bold opacity-60">
        {item.conversionCount} {item.conversionCount === 1 ? "volume" : "volumes"}
      </p>
    </Link>
  );
}

interface LibraryCarouselProps {
  items: SeriesGroup[];
}

export function LibraryCarousel({ items }: LibraryCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

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
        className="flex snap-x gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {shelfItems.map((s) => (
          <ShelfPoster key={s.sourceId} item={s} />
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
