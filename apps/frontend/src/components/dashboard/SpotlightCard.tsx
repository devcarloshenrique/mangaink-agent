import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Play, Sparkles } from "lucide-react";
import { conversionsApi, scrapingApi } from "@/lib/api";
import { cn, relativeTime } from "@/lib/utils";
import type { SeriesGroup } from "@/hooks/useConversions";
import type { CoverRef } from "@/types/conversion";

const ROTATE_MS = 6000;

function getHueFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function getGroupCoverRef(group: SeriesGroup): CoverRef | undefined {
  const withCover = group.items.find((i) => i.cover);
  return withCover?.cover as CoverRef | undefined;
}

function formatStatus(status?: string | null): string {
  if (!status) return "Em lançamento";
  const s = status.toLowerCase().trim();
  if (s === "completed" || s === "finalizado" || s === "concluído" || s === "concluido") {
    return "Concluído";
  }
  if (s === "ongoing" || s === "releasing" || s === "em lançamento" || s === "em lancamento") {
    return "Em lançamento";
  }
  if (s === "hiatus" || s === "em hiato") {
    return "Em hiato";
  }
  if (s === "cancelled" || s === "cancelado") {
    return "Cancelado";
  }
  return status;
}

function SpotlightBackdrop({
  sourceId,
  coverRef,
  remoteCoverUrl,
}: {
  sourceId: string;
  coverRef?: CoverRef;
  remoteCoverUrl?: string | null;
}) {
  const [errorCount, setErrorCount] = useState(0);

  const localUrl = coverRef ? conversionsApi.coverUrl(sourceId, coverRef) : null;
  const currentSrc =
    errorCount === 0 ? localUrl || remoteCoverUrl : errorCount === 1 ? remoteCoverUrl : null;

  if (!currentSrc || errorCount >= 2) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <img
        src={currentSrc}
        alt=""
        aria-hidden="true"
        onError={() => setErrorCount((c) => c + 1)}
        className="h-full w-full object-cover scale-110 blur-[5px] select-none animate-in fade-in duration-700"
      />
    </div>
  );
}

function SpotlightCover({
  sourceId,
  coverRef,
  remoteCoverUrl,
  hue,
  alt,
}: {
  sourceId: string;
  coverRef?: CoverRef;
  remoteCoverUrl?: string | null;
  hue: number;
  alt: string;
}) {
  const [errorCount, setErrorCount] = useState(0);

  const localUrl = coverRef ? conversionsApi.coverUrl(sourceId, coverRef) : null;
  const currentSrc =
    errorCount === 0 ? localUrl || remoteCoverUrl : errorCount === 1 ? remoteCoverUrl : null;

  if (!currentSrc || errorCount >= 2) {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-5xl"
        style={{ background: `hsl(${hue} 70% 55%)` }}
      >
        📚
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setErrorCount((c) => c + 1)}
    />
  );
}

interface SpotlightCardProps {
  items: SeriesGroup[];
}

export function SpotlightCard({ items }: SpotlightCardProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Considera no máximo as 5 obras mais recentes para rotação no banner
  const activeItems = items.slice(0, 5);
  const currentItem = activeItems[index] ?? activeItems[0];

  // Busca metadados da obra para obter sinopse, capítulos e capa de fallback
  const { data: source } = useQuery({
    queryKey: ["source", currentItem?.sourceId],
    queryFn: () => scrapingApi.getSource(currentItem.sourceId),
    enabled: !!currentItem?.sourceId,
    staleTime: 60_000,
  });

  // Rotação automática — reinicia timer ao trocar de obra ou pausar
  useEffect(() => {
    if (paused || activeItems.length < 2) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % activeItems.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, index, activeItems.length]);

  if (!currentItem) {
    return null;
  }

  const hue = getHueFromString(currentItem.sourceId || currentItem.title);
  const coverRef = getGroupCoverRef(currentItem);
  const remoteCover = source?.covers?.[0]?.imageUrl ?? null;

  const description =
    source?.metadata?.description ||
    "Acesse seus volumes convertidos e retome a leitura de onde você parou no Kindle ou leitor integrado.";
  const totalChapters = source?.statistics?.chapters ?? source?.chapters?.length ?? 0;
  const statusLabel = formatStatus(source?.metadata?.status);

  return (
    <div
      className="relative h-full min-h-[300px] sm:min-h-[340px] overflow-hidden rounded-2xl border-[3.5px] border-ink bg-comic-ink text-comic-cream shadow-comic-lg"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* 1. Imagem de fundo ampliada com leve desfoque (cover backdrop texture) */}
      <SpotlightBackdrop
        key={`backdrop-${currentItem.sourceId}`}
        sourceId={currentItem.sourceId}
        coverRef={coverRef}
        remoteCoverUrl={remoteCover}
      />

      {/* 2. Gradiente escuro direcional (50% translúcido na capa à esquerda, 95% denso na sinopse à direita) */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-comic-ink/50 via-comic-ink/80 to-comic-ink/95" />

      {/* 3. Vinheta vertical suave para fechar as bordas superior e inferior */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-comic-ink/85 via-transparent to-comic-ink/30" />

      <div className="relative flex h-full flex-col gap-5 p-5 pb-12 sm:flex-row sm:p-6 sm:pb-12">
        {/* Capa com proporção mais compacta */}
        <div
          key={`cover-${currentItem.sourceId}`}
          className="relative mx-auto w-40 shrink-0 sm:mx-0 sm:w-44 md:w-48 lg:w-52"
        >
          <div className="relative aspect-[2/3] overflow-hidden rounded-xl border-[3.5px] border-ink bg-card shadow-comic-lg transition-transform duration-300 hover:scale-[1.01]">
            <SpotlightCover
              sourceId={currentItem.sourceId}
              coverRef={coverRef}
              remoteCoverUrl={remoteCover}
              hue={hue}
              alt={currentItem.title}
            />
          </div>
        </div>

        {/* Informações detalhadas da obra */}
        <div
          key={`info-${currentItem.sourceId}`}
          className="flex min-w-0 flex-1 animate-in fade-in flex-col duration-500 lg:max-w-3xl"
        >
          {/* Badges temáticos do design system */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border-2 border-ink bg-comic-red px-2.5 py-0.5 font-display text-xs uppercase tracking-wider text-primary-foreground shadow-comic-sm">
              MANGÁ
            </span>
            <span className="flex items-center gap-1.5 rounded-md border-2 border-ink bg-comic-blue px-2.5 py-0.5 font-display text-xs uppercase tracking-wider text-accent-foreground shadow-comic-sm">
              <span className="h-2 w-2 rounded-full bg-comic-yellow animate-pulse" />
              {statusLabel}
            </span>
          </div>

          {/* Título imponente limitado a no máximo 2 linhas com reticências */}
          <h2
            title={currentItem.title}
            className="mt-2.5 line-clamp-2 font-display text-3xl uppercase leading-[0.95] text-comic-yellow tracking-wide sm:text-4xl lg:text-5xl"
          >
            {currentItem.title}
          </h2>

          {/* Linha de estatísticas com ícones */}
          <div className="mt-2 flex flex-wrap items-center gap-3.5 text-xs font-bold text-comic-cream/85 sm:text-sm">
            {totalChapters > 0 && (
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-comic-yellow" strokeWidth={2.5} />
                {totalChapters} capítulos
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-comic-blue" strokeWidth={2.5} />
              {currentItem.conversionCount}{" "}
              {currentItem.conversionCount === 1 ? "conversão" : "conversões"}
            </span>
            <span className="text-comic-cream/60">
              · última atividade: {relativeTime(currentItem.lastActivity)}
            </span>
          </div>

          {/* Sinopse com contraste aprimorado e limite de 3 linhas */}
          <p className="mt-3 line-clamp-3 max-w-3xl text-xs sm:text-sm font-medium leading-relaxed text-comic-cream/90">
            {description}
          </p>

          {/* Botões de ação alinhados ao design system */}
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
            <Link
              to="/biblioteca/$sourceId"
              params={{ sourceId: currentItem.sourceId }}
              className="inline-flex items-center gap-2 rounded-md border-[3px] border-ink bg-comic-yellow px-4 py-2 font-display text-sm text-comic-ink shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 hover:bg-comic-yellow/95 cursor-pointer sm:text-base"
            >
              <Play className="h-4 w-4 fill-current" strokeWidth={3} /> Começar a ler
            </Link>
            <Link
              to="/biblioteca/$sourceId"
              params={{ sourceId: currentItem.sourceId }}
              className="inline-flex items-center gap-2 rounded-md border-[3px] border-ink bg-card px-4 py-2 font-display text-sm text-card-foreground shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 hover:bg-comic-cream cursor-pointer sm:text-base"
            >
              <BookOpen className="h-4 w-4" strokeWidth={2.5} /> Ver Detalhes
            </Link>
          </div>
        </div>
      </div>

      {/* Indicadores de navegação temáticos no rodapé com clique acessível e tamanho aprimorado */}
      {activeItems.length > 1 && (
        <div className="absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
          {activeItems.map((r, i) => (
            <button
              key={r.sourceId}
              type="button"
              aria-label={`Ver ${r.title}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "group relative flex h-6 items-center justify-center px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-comic-yellow rounded-full cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "h-2.5 rounded-full border-2 border-ink transition-all duration-300",
                  i === index
                    ? "w-8 bg-comic-yellow shadow-comic-sm"
                    : "w-3.5 bg-comic-cream/40 group-hover:w-4.5 group-hover:bg-comic-cream/80",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
