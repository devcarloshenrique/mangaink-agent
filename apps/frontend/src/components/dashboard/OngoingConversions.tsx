import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Download, Send, Sparkles } from "lucide-react";
import { ongoingConversions, STAGE_LABELS, type OngoingConversion } from "@/lib/dashboard-mock";

const TICK_MS = 1600;

/** Simula progresso vivo: cada job avança lentamente até 99%. */
function useLiveProgress(initial: OngoingConversion[]) {
  const [jobs, setJobs] = useState(initial);

  useEffect(() => {
    const timer = setInterval(() => {
      setJobs((prev) => {
        const allCompleted = prev.every((j) => j.progress >= 99);
        if (allCompleted) return prev;

        return prev.map((j) =>
          j.progress >= 99
            ? j
            : {
                ...j,
                progress: Math.min(99, Math.round((j.progress + Math.random() * 1.4) * 10) / 10),
              },
        );
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return jobs;
}

function ConversionPoster({ job }: { job: OngoingConversion }) {
  const [error, setError] = useState(false);
  const pct = Math.floor(job.progress);

  return (
    <Link to="/biblioteca/progresso" className="group w-40 shrink-0 snap-start sm:w-48 lg:w-56">
      <div className="relative aspect-[2/3] overflow-hidden rounded-md border-[3px] border-ink bg-card shadow-comic-sm transition-all group-hover:-translate-y-1 group-hover:shadow-comic">
        {!job.coverUrl || error ? (
          <div
            className="flex h-full w-full items-center justify-center text-3xl"
            style={{ background: `hsl(${job.hue} 70% 55%)` }}
          >
            📖
          </div>
        ) : (
          <img
            src={job.coverUrl}
            alt={job.series}
            loading="lazy"
            onError={() => setError(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}

        {/* Badges superiores: Formato e Tipo de Envio */}
        <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between gap-1">
          <span className="rounded border-2 border-ink bg-comic-yellow px-1.5 py-0.5 font-display text-[10px] uppercase text-comic-ink shadow-comic-sm">
            {job.format}
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-card text-foreground shadow-comic-sm">
            {job.delivery === "kindle" ? (
              <Send className="h-3 w-3" strokeWidth={2.5} />
            ) : (
              <Download className="h-3 w-3" strokeWidth={2.5} />
            )}
          </span>
        </div>

        {/* Barra de progresso com porcentagem em destaque na base do pôster */}
        <div className="absolute inset-x-2 bottom-2 z-10 rounded-md border-2 border-ink bg-comic-ink/90 p-1.5 shadow-comic-sm backdrop-blur-xs">
          <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-comic-cream">
            <span className="truncate opacity-80">{STAGE_LABELS[job.stage]}</span>
            <span className="tabular-nums text-comic-yellow">{pct}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full border border-ink/40 bg-muted/40">
            <div
              className="h-full bg-comic-yellow transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Overlay com detalhes extras no hover */}
        <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 pb-16">
          <p className="line-clamp-2 text-xs font-bold leading-snug text-white">{job.series}</p>
          <p className="mt-1 text-[11px] font-medium text-white/80">
            {job.book || "Volume completo"}
          </p>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-comic-yellow">
            ETA estimado: ~{job.etaMinutes} min
          </p>
        </div>
      </div>

      <p className="mt-2 truncate text-sm font-bold leading-tight">{job.series}</p>
      <p className="truncate text-[11px] font-bold opacity-60">
        {job.book || "Volume completo"} · {pct}%
      </p>
    </Link>
  );
}

export function OngoingConversions() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const jobs = useLiveProgress(ongoingConversions);
  const totalPct =
    jobs.length > 0 ? Math.round(jobs.reduce((acc, j) => acc + j.progress, 0) / jobs.length) : 0;

  function scroll(dir: 1 | -1) {
    const scrollAmount = (scrollerRef.current?.clientWidth ?? 500) * 0.75;
    scrollerRef.current?.scrollBy({ left: dir * scrollAmount, behavior: "smooth" });
  }

  return (
    <section aria-label="Conversões em andamento">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl uppercase leading-none">Conversões</h2>
          <span className="rounded-full border-2 border-ink bg-comic-red px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-comic-sm">
            {jobs.length} rodando · {totalPct}%
          </span>
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
            to="/biblioteca/progresso"
            className="inline-flex items-center gap-1.5 rounded-md border-[2.5px] border-ink bg-card px-3 py-1.5 font-display text-sm shadow-comic-sm transition-transform hover:-translate-y-0.5"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.5} /> Ver tudo
          </Link>
        </div>
      </div>

      {/* Prateleira com rolagem horizontal suave no padrão poster */}
      <div
        ref={scrollerRef}
        className="flex snap-x gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {jobs.map((j) => (
          <ConversionPoster key={j.id} job={j} />
        ))}
      </div>
    </section>
  );
}
