import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { newChapters, type NewChapterItem } from "@/lib/dashboard-mock";

function ChapterPoster({ item }: { item: NewChapterItem }) {
  const [error, setError] = useState(false);

  return (
    <Link to="/agendamentos" className="group w-40 shrink-0 snap-start sm:w-48 lg:w-56">
      <div className="relative aspect-[2/3] overflow-hidden rounded-md border-[3px] border-ink bg-card shadow-comic-sm transition-all group-hover:-translate-y-1 group-hover:shadow-comic">
        {!item.coverUrl || error ? (
          <div
            className="flex h-full w-full items-center justify-center text-3xl"
            style={{ background: `hsl(${item.hue} 70% 55%)` }}
          >
            📖
          </div>
        ) : (
          <img
            src={item.coverUrl}
            alt={item.series}
            loading="lazy"
            onError={() => setError(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}

        {/* Badge NOVO! */}
        {item.isNew && (
          <div className="absolute top-2 left-2 z-10">
            <span className="inline-block -rotate-3 rounded border-2 border-ink bg-comic-red px-2 py-0.5 font-display text-xs uppercase text-primary-foreground shadow-comic-sm">
              Novo!
            </span>
          </div>
        )}

        {/* Overlay com detalhes no hover */}
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/55 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <p className="line-clamp-2 text-xs font-bold leading-snug text-white">{item.series}</p>
          <div className="mt-2 flex items-center justify-between gap-1">
            <span className="rounded border border-white/40 bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Cap. {item.chapter}
            </span>
            <span className="text-[10px] font-bold text-white/80">{item.when}</span>
          </div>
        </div>
      </div>

      <p className="mt-2 truncate text-sm font-bold leading-tight">{item.series}</p>
      <p className="truncate text-[11px] font-bold opacity-60">
        Capítulo {item.chapter} · {item.when}
      </p>
    </Link>
  );
}

export function NewChapters() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scroll(dir: 1 | -1) {
    const scrollAmount = (scrollerRef.current?.clientWidth ?? 500) * 0.75;
    scrollerRef.current?.scrollBy({ left: dir * scrollAmount, behavior: "smooth" });
  }

  return (
    <section aria-label="Novos capítulos">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl uppercase leading-none">Novos capítulos</h2>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide opacity-60">
            {newChapters.length} lançamentos recentes
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
            to="/agendamentos"
            className="inline-flex items-center gap-1.5 rounded-md border-[2.5px] border-ink bg-comic-yellow px-3 py-1.5 font-display text-sm text-comic-ink shadow-comic-sm transition-transform hover:-translate-y-0.5"
          >
            <Calendar className="h-4 w-4" strokeWidth={2.5} /> Ver agenda
          </Link>
        </div>
      </div>

      {/* Prateleira com rolagem horizontal suave */}
      <div
        ref={scrollerRef}
        className="flex snap-x gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {newChapters.map((c) => (
          <ChapterPoster key={`${c.series}-${c.chapter}`} item={c} />
        ))}
      </div>
    </section>
  );
}
