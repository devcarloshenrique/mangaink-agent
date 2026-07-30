import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, CloudOff, ArrowDownUp, ArrowUpDown, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { SearchBar, highlightMatch } from "@/components/biblioteca/SearchBar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { chaptersApi } from "@/lib/api";
import { useBatchMarkRead } from "@/hooks/useReadingProgress";
import type { Chapter } from "@/types/scraping";

type ChapterFilter = "all" | "unread" | "downloaded";

interface TabCapitulosProps {
  chapters: Chapter[];
  sourceId: string;
  readChapterIds: Set<string>;
  onToggleRead: (chapterId: string, isRead: boolean) => void;
  onDownloadRequest: (sourceId: string, chapterId: string, title: string) => void;
}

export function TabCapitulos({
  chapters,
  sourceId,
  readChapterIds,
  onToggleRead,
  onDownloadRequest,
}: TabCapitulosProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const batchMarkReadMutation = useBatchMarkRead(sourceId);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [activeFilter, setActiveFilter] = useState<ChapterFilter>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchQuery("");
  }, [sourceId]);

  const unreadCount = useMemo(
    () => chapters.filter((ch) => !readChapterIds.has(ch.id)).length,
    [chapters, readChapterIds],
  );

  const downloadCount = useMemo(() => chapters.filter((ch) => ch.isDownloaded).length, [chapters]);

  const filtered = useMemo(() => {
    let list = [...chapters];
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (ch) => ch.number.toLowerCase().includes(q) || ch.title.toLowerCase().includes(q),
      );
    }
    if (activeFilter === "unread") {
      list = list.filter((ch) => !readChapterIds.has(ch.id));
    }
    if (activeFilter === "downloaded") {
      list = list.filter((ch) => ch.isDownloaded);
    }
    return list;
  }, [chapters, searchQuery, activeFilter, readChapterIds]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortOrder === "desc") list.reverse();
    return list;
  }, [filtered, sortOrder]);

  const isFiltering = searchQuery.trim().length > 0;

  const toggleSelection = (chapterId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((ch) => ch.id)));
    }
  };

  const startLongPress = (chapterId: string) => {
    if (selectionMode) return;
    const timer = setTimeout(() => {
      setSelectionMode(true);
      setSelectedIds(new Set([chapterId]));
    }, 500);
    setLongPressTimer(timer);
  };

  const cancelLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleSelectionModeToggle = () => {
    setSelectionMode((prev) => !prev);
    if (selectionMode) {
      setSelectedIds(new Set());
    }
  };

  const batchMarkRead = useCallback(
    async (markAsRead: boolean) => {
      const ids = [...selectedIds];
      setIsBatchProcessing(true);
      try {
        await batchMarkReadMutation.mutateAsync({ chapterIds: ids, markAsRead });
        toast.success(`${ids.length} capítulos ${markAsRead ? "marcados" : "desmarcados"}`);
      } catch {
        toast.error("Erro na operação em lote");
      }
      setIsBatchProcessing(false);
      setSelectionMode(false);
      setSelectedIds(new Set());
    },
    [selectedIds, batchMarkReadMutation],
  );

  const batchDownload = useCallback(async () => {
    const ids = [...selectedIds];
    setIsBatchProcessing(true);
    const toastId = toast.loading(`Baixando 0/${ids.length} capítulos...`);
    let failed = 0;

    for (let i = 0; i < ids.length; i++) {
      toast.loading(`Baixando ${i + 1}/${ids.length} capítulos...`, { id: toastId });
      try {
        await chaptersApi.download(sourceId, ids[i]);
      } catch {
        failed++;
      }
    }

    setIsBatchProcessing(false);
    setSelectionMode(false);
    setSelectedIds(new Set());

    if (failed === 0) {
      toast.success(`${ids.length} capítulos baixados`, { id: toastId });
    } else {
      toast.error(`${failed} de ${ids.length} downloads falharam`, { id: toastId });
    }

    queryClient.invalidateQueries({ queryKey: ["source", sourceId] });
  }, [selectedIds, sourceId, queryClient]);

  const batchDeleteCache = useCallback(async () => {
    const ids = [...selectedIds];
    setIsBatchProcessing(true);
    const toastId = toast.loading(`Apagando 0/${ids.length} capítulos...`);
    let failed = 0;

    for (let i = 0; i < ids.length; i++) {
      toast.loading(`Apagando ${i + 1}/${ids.length} capítulos...`, { id: toastId });
      try {
        await chaptersApi.deleteCache(sourceId, ids[i]);
      } catch {
        failed++;
      }
    }

    setIsBatchProcessing(false);
    setSelectionMode(false);
    setSelectedIds(new Set());

    if (failed === 0) {
      toast.success(`${ids.length} caches removidos`, { id: toastId });
    } else {
      toast.error(`${failed} de ${ids.length} falharam`, { id: toastId });
    }

    queryClient.invalidateQueries({ queryKey: ["source", sourceId] });
  }, [selectedIds, sourceId, queryClient]);

  const handleDeleteSingleCache = useCallback(
    async (chapterId: string) => {
      try {
        await chaptersApi.deleteCache(sourceId, chapterId);
      } catch {
        toast.error("Erro ao remover cache");
      }
    },
    [sourceId],
  );

  if (chapters.length === 0) {
    return (
      <SpeechBubble variant="yellow" tail="left">
        Nenhum capítulo disponível.
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
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          className="flex-1 min-w-0 [&_input]:h-12 [&_input]:text-base [&_input]:pl-12 [&_svg]:h-5 [&_svg]:w-5"
        />
        <button
          type="button"
          onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
          className="h-12 w-12 border-[3px] border-ink rounded-lg bg-comic-yellow flex items-center justify-center shadow-comic-sm hover:-translate-y-0.5 transition-transform shrink-0"
          aria-label={sortOrder === "asc" ? "Ordenar decrescente" : "Ordenar crescente"}
        >
          {sortOrder === "asc" ? (
            <ArrowDownUp className="h-5 w-5" />
          ) : (
            <ArrowUpDown className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Filtros rápidos */}
      <div className="flex gap-2 mb-3 flex-wrap" role="tablist" aria-label="Filtros de capítulos">
        {[
          { key: "all" as const, label: "Todos", count: chapters.length },
          { key: "unread" as const, label: "Não lidos", count: unreadCount },
          { key: "downloaded" as const, label: "Baixados", count: downloadCount },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeFilter === key}
            onClick={() => setActiveFilter(key)}
            className={`font-display text-sm px-3 py-1.5 rounded-md border-[2px] border-ink transition-colors ${
              activeFilter === key
                ? "bg-comic-yellow shadow-comic-sm"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSelectionModeToggle}
          className="font-display text-xs border-[2px] border-ink"
          aria-label={selectionMode ? "Cancelar seleção" : "Selecionar capítulos"}
        >
          {selectionMode ? "Cancelar" : "Selecionar"}
        </Button>
        {selectionMode && sorted.length > 0 && (
          <Checkbox
            checked={selectedIds.size === sorted.length}
            onCheckedChange={toggleSelectAll}
            aria-label="Selecionar todos os capítulos"
          >
            <span className="font-display text-xs ml-2">Todos</span>
          </Checkbox>
        )}
        {selectionMode && selectedIds.size > 0 && (
          <span className="font-display text-xs text-muted-foreground ml-auto">
            {selectedIds.size} selecionados
          </span>
        )}
      </div>

      {isFiltering && (
        <p className="text-xs text-muted-foreground mb-3 font-display">
          {sorted.length} de {chapters.length} capítulos
        </p>
      )}

      <div>
        {sorted.map((chapter, i) => {
          const isRead = readChapterIds.has(chapter.id);
          return (
            <div
              key={chapter.id}
              className={`w-full flex items-center gap-3 py-3 ${
                i < sorted.length - 1 ? "border-b-2 border-dashed border-ink/20" : ""
              }`}
            >
              {selectionMode && (
                <Checkbox
                  checked={selectedIds.has(chapter.id)}
                  onCheckedChange={() => toggleSelection(chapter.id)}
                  aria-label={`Selecionar capítulo ${chapter.number}`}
                />
              )}

              <button
                onClick={() => {
                  if (selectionMode) {
                    toggleSelection(chapter.id);
                  } else {
                    handleClick(chapter);
                  }
                }}
                onTouchStart={() => startLongPress(chapter.id)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                className="flex items-center gap-3 flex-1 text-left hover:bg-muted/50 transition-colors rounded cursor-pointer"
              >
                <span className="shrink-0 font-display text-lg bg-comic-yellow border-[2px] border-ink rounded-md px-2 min-w-[2.5rem] text-center">
                  {highlightMatch(chapter.number, searchQuery)}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm truncate ${
                      isRead ? "text-muted-foreground" : "font-semibold"
                    }`}
                  >
                    {highlightMatch(chapter.title, searchQuery)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {chapter.pages !== null ? `${chapter.pages} pgs` : "—"}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onToggleRead(chapter.id, !isRead)}
                className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                aria-label={isRead ? "Desmarcar como lido" : "Marcar como lido"}
                aria-pressed={isRead}
              >
                {isRead ? (
                  <EyeOff className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  className="shrink-0"
                  aria-label={`Ações de download para capítulo ${chapter.number}`}
                >
                  {chapter.isDownloaded ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <CloudOff className="w-5 h-5 text-muted-foreground" />
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {chapter.isDownloaded ? (
                    <>
                      <DropdownMenuItem onClick={() => handleClick(chapter)}>
                        Abrir
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteSingleCache(chapter.id)}>
                        Apagar do disco
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => onDownloadRequest(sourceId, chapter.id, chapter.title)}
                    >
                      Baixar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}

        {isFiltering && sorted.length === 0 && (
          <div className="py-12 text-center">
            <SpeechBubble variant="yellow" tail="left">
              Nenhum capítulo encontrado para &quot;{searchQuery.trim()}&quot;
            </SpeechBubble>
          </div>
        )}
      </div>

      {selectionMode && selectedIds.size > 0 && (
        <div className="sticky bottom-0 mt-4 p-4 border-[3px] border-ink rounded-xl bg-card shadow-comic flex flex-wrap gap-2 justify-center">
          <Button
            variant="default"
            size="sm"
            onClick={() => batchMarkRead(true)}
            disabled={isBatchProcessing}
            className="font-display text-xs bg-comic-red border-[2px] border-ink"
          >
            Marcar {selectedIds.size} como lidos
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={batchDownload}
            disabled={isBatchProcessing}
            className="font-display text-xs bg-comic-blue border-[2px] border-ink text-ink"
          >
            Baixar {selectedIds.size} capítulos
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={batchDeleteCache}
            disabled={isBatchProcessing}
            className="font-display text-xs bg-comic-yellow border-[2px] border-ink text-ink"
          >
            Apagar {selectedIds.size} do disco
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectionMode(false);
              setSelectedIds(new Set());
            }}
            className="font-display text-xs border-[2px] border-ink"
          >
            Cancelar
          </Button>
        </div>
      )}
    </ComicPanel>
  );
}
