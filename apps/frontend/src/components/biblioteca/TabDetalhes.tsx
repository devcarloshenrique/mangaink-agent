import { useState } from "react";
import { ScrollText, User } from "lucide-react";
import { ComicPanel } from "@/components/comic/ComicPanel";
import type { MangaDetails } from "@/types/manga-detail";

interface TabDetalhesProps {
  details: MangaDetails;
}

export function TabDetalhes({ details }: TabDetalhesProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <ComicPanel bg="card" padding="md">
      <div className="space-y-6">
        {details.description && (
          <section>
            <h3 className="font-display text-lg uppercase mb-2 flex items-center gap-2">
              <ScrollText className="h-5 w-5" /> Sinopse
            </h3>
            <div className="text-sm leading-relaxed text-muted-foreground">
              <p className={expanded ? "" : "line-clamp-4"}>{details.description}</p>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="font-display text-xs text-comic-blue mt-1 hover:underline"
              >
                {expanded ? "Ver menos" : "Ver mais"}
              </button>
            </div>
          </section>
        )}

        {details.genres.length > 0 && (
          <section>
            <h3 className="font-display text-lg uppercase mb-2">Generos</h3>
            <div className="flex flex-wrap gap-2">
              {details.genres.map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1 border-[2px] border-ink rounded-full font-display text-xs bg-comic-yellow"
                >
                  {genre}
                </span>
              ))}
            </div>
          </section>
        )}

        {details.author && (
          <section>
            <h3 className="font-display text-lg uppercase mb-2">Autor</h3>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 opacity-70" />
              <span className="font-medium">{details.author}</span>
            </div>
          </section>
        )}
      </div>
    </ComicPanel>
  );
}
