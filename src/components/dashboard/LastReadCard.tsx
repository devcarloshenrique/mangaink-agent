import { Link } from "@tanstack/react-router";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { OnomatopoeiaBadge } from "@/components/comic/OnomatopoeiaBadge";
import { lastRead } from "@/lib/dashboard-mock";
import { BookOpen } from "lucide-react";

export function LastReadCard() {
  const pct = Math.round((lastRead.currentChapter / lastRead.totalChapters) * 100);
  return (
    <div className="relative">
      <ComicPanel bg="card" padding="md" className="h-full">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-24 w-20 shrink-0 items-center justify-center rounded-md border-[3px] border-ink shadow-comic-sm text-4xl ${lastRead.coverBg}`}
          >
            {lastRead.cover}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider opacity-70">Última leitura</p>
            <h3 className="font-display text-3xl leading-none mt-1">{lastRead.title}</h3>
            <p className="text-sm font-medium mt-1 opacity-80">
              Cap. {lastRead.currentChapter} de {lastRead.totalChapters}
            </p>

            <div className="mt-3">
              <div className="h-3 w-full border-[2.5px] border-ink rounded-full bg-card overflow-hidden">
                <div
                  className="h-full bg-comic-red transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[11px] font-bold mt-1 opacity-70">{pct}% completo</p>
            </div>

            <Link
              to="/biblioteca/$slug"
              params={{ slug: lastRead.slug }}
              className="inline-flex items-center gap-1.5 mt-3 border-[2.5px] border-ink bg-comic-yellow px-3 py-1.5 rounded-md shadow-comic-sm font-display text-sm hover:-translate-y-0.5 transition-transform"
            >
              <BookOpen className="h-4 w-4" /> Continuar lendo
            </Link>
          </div>
        </div>
      </ComicPanel>
      <div className="absolute -top-3 -left-2">
        <OnomatopoeiaBadge variant="red" size="sm">
          ZAP!
        </OnomatopoeiaBadge>
      </div>
    </div>
  );
}
