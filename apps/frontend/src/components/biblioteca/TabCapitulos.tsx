import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle, CloudOff } from "lucide-react";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { SearchBar, highlightMatch } from "@/components/biblioteca/SearchBar";
import type { Chapter } from "@/types/scraping";

interface TabCapitulosProps {
  chapters: Chapter[];
  sourceId: string;
  onDownloadRequest: (sourceId: string, chapterId: string, title: string) => void;
}

export function TabCapitulos({ chapters, sourceId, onDownloadRequest }: TabCapitulosProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  // Reseta a busca ao trocar de obra
  useEffect(() => {
    setSearchQuery("");
  }, [sourceId]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return chapters;
    return chapters.filter(
      (ch) => ch.number.toLowerCase().includes(q) || ch.title.toLowerCase().includes(q),
    );
  }, [chapters, searchQuery]);

  const isFiltering = searchQuery.trim().length > 0;

  if (chapters.length === 0) {
    return (
      <SpeechBubble variant="yellow" tail="left">
        Nenhum capitulo disponivel.
      </SpeechBubble>
    );
  }

  const handleClick = (chapter: Chapter) => {
    if (chapter.isDownloaded) {
      navigate({
        to: "/biblioteca/reader-chapter/$sourceId",
        params: { sourceId },
        search: { chapterId: chapter.id },
      });
    } else {
      onDownloadRequest(sourceId, chapter.id, chapter.title);
    }
  };

  return (
    <ComicPanel bg="card" padding="sm">
      {/* Barra de pesquisa */}
      <div className="mb-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          className="[&_input]:h-12 [&_input]:text-base [&_input]:pl-12 [&_svg]:h-5 [&_svg]:w-5"
        />
      </div>

      {/* Contador de resultados (visível apenas com filtro ativo) */}
      {isFiltering && (
        <p className="text-xs text-muted-foreground mb-3 font-display">
          {filtered.length} de {chapters.length} capítulos
        </p>
      )}

      {/* Lista de capítulos */}
      <div>
        {filtered.map((chapter, i) => (
          <button
            key={chapter.id}
            onClick={() => handleClick(chapter)}
            className={`w-full flex items-center gap-3 py-3 text-left hover:bg-muted/50 transition-colors cursor-pointer ${
              i < filtered.length - 1 ? "border-b-2 border-dashed border-ink/20" : ""
            }`}
          >
            <span className="shrink-0 font-display text-lg bg-comic-yellow border-[2px] border-ink rounded-md px-2 min-w-[2.5rem] text-center">
              {highlightMatch(chapter.number, searchQuery)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {highlightMatch(chapter.title, searchQuery)}
              </p>
              <p className="text-xs text-muted-foreground">
                {chapter.pages !== null ? `${chapter.pages} pgs` : "—"}
              </p>
            </div>
            <span className="shrink-0">
              {chapter.isDownloaded ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <CloudOff className="w-5 h-5 text-muted-foreground" />
              )}
            </span>
          </button>
        ))}

        {/* Estado vazio quando o filtro não encontra nada */}
        {isFiltering && filtered.length === 0 && (
          <div className="py-12 text-center">
            <SpeechBubble variant="yellow" tail="left">
              Nenhum capítulo encontrado para &quot;{searchQuery.trim()}&quot;
            </SpeechBubble>
          </div>
        )}
      </div>
    </ComicPanel>
  );
}
