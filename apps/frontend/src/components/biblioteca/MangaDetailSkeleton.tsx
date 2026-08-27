import { Skeleton } from "@/components/ui/skeleton";
import { ComicPanel } from "@/components/comic/ComicPanel";

export function MangaDetailSkeleton() {
  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-8 animate-pulse">
      {/* Coluna esquerda: Capa e botões */}
      <div className="space-y-6 md:max-w-[320px] mx-auto md:mx-0 w-full">
        <div className="border-[3px] border-ink/40 rounded-xl overflow-hidden shadow-comic-sm bg-card aspect-[2/3] flex items-center justify-center">
          <Skeleton className="w-full h-full" />
        </div>
        <Skeleton className="h-12 w-full rounded-md border-[2px] border-ink/30" />
        <Skeleton className="h-10 w-full rounded-md border-[2px] border-ink/30" />
      </div>

      {/* Coluna direita: Título, Abas e Listagem */}
      <div className="min-w-0 space-y-6">
        <div className="flex justify-center">
          <Skeleton className="h-10 w-3/4 max-w-md rounded-lg" />
        </div>

        {/* Abas */}
        <div className="border-[3px] border-ink/30 rounded-xl bg-card flex overflow-hidden h-14">
          <Skeleton className="flex-1 h-full rounded-none border-r-2 border-ink/20" />
          <Skeleton className="flex-1 h-full rounded-none border-r-2 border-ink/20" />
          <Skeleton className="flex-1 h-full rounded-none" />
        </div>

        {/* Tabela de capítulos skeleton */}
        <ComicPanel bg="card" padding="sm" className="border-ink/40">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-12 flex-1 rounded-md" />
            <Skeleton className="h-12 w-12 rounded-lg" />
          </div>

          <div className="flex gap-2 mb-4">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>

          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2.5 border-b border-ink/10 last:border-0"
              >
                <Skeleton className="h-8 w-12 rounded-md shrink-0" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <Skeleton className="h-4 w-2/3 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
                <Skeleton className="h-6 w-6 rounded shrink-0" />
                <Skeleton className="h-6 w-6 rounded shrink-0" />
              </div>
            ))}
          </div>
        </ComicPanel>
      </div>
    </div>
  );
}
