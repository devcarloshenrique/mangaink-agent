import { useState, useMemo, useEffect, useCallback, memo, useLayoutEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  CheckCircle,
  CloudOff,
  ArrowDownUp,
  ArrowUpDown,
  Eye,
  EyeOff,
  BookOpen,
  Download,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { SearchBar, highlightMatch } from "@/components/biblioteca/SearchBar";
import { MoreMenu } from "@/components/biblioteca/MoreMenu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

interface ChapterRowProps {
  chapter: Chapter;
  sourceId: string;
  isRead: boolean;
  isLast: boolean;
  selectionMode: boolean;
  isSelected: boolean;
  searchQuery: string;
  menuOpen: boolean;
  onOpenChapter: (chapter: Chapter) => void;
  onToggleRead: (chapterId: string, isRead: boolean) => void;
  onDownloadRequest: (sourceId: string, chapterId: string, title: string) => void;
  onDeleteCache: (chapterId: string) => void;
  onToggleSelect: (chapterId: string) => void;
  onStartLongPress: (chapterId: string) => void;
  onCancelLongPress: () => void;
  onCheckPreventClick: () => boolean;
  onToggleMenu: (chapterId: string | null) => void;
}

const ChapterRow = memo(function ChapterRow({
  chapter,
  sourceId,
  isRead,
  isLast,
  selectionMode,
  isSelected,
  searchQuery,
  menuOpen,
  onOpenChapter,
  onToggleRead,
  onDownloadRequest,
  onDeleteCache,
  onToggleSelect,
  onStartLongPress,
  onCancelLongPress,
  onCheckPreventClick,
  onToggleMenu,
}: ChapterRowProps) {
  const downloaded = chapter.isDownloaded;

  return (
    <div
      className={`w-full flex items-center gap-3 py-3 bg-card ${
        isLast ? "" : "border-b-2 border-dashed border-ink/20"
      }`}
    >
      {selectionMode && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(chapter.id)}
          aria-label={`Selecionar capítulo ${chapter.number}`}
        />
      )}

      <button
        onClick={() => {
          if (onCheckPreventClick()) return;
          if (selectionMode) {
            onToggleSelect(chapter.id);
          } else {
            onOpenChapter(chapter);
          }
        }}
        onTouchStart={() => onStartLongPress(chapter.id)}
        onTouchEnd={onCancelLongPress}
        onTouchMove={onCancelLongPress}
        className="flex items-center gap-3 flex-1 text-left hover:bg-muted/50 transition-colors rounded cursor-pointer min-w-0"
      >
        <span className="shrink-0 font-display text-lg bg-comic-yellow border-[2px] border-ink rounded-md px-2 min-w-[2.5rem] text-center">
          {highlightMatch(chapter.number, searchQuery)}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${isRead ? "text-muted-foreground" : "font-semibold"}`}>
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

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => onToggleMenu(menuOpen ? null : chapter.id)}
          className="shrink-0 p-0.5 rounded hover:bg-muted transition-colors cursor-pointer"
          aria-label={`Ações de download para capítulo ${chapter.number}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          {downloaded ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <CloudOff className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
        {menuOpen && (
          <MoreMenu
            onClose={() => onToggleMenu(null)}
            items={
              downloaded
                ? [
                    {
                      icon: BookOpen,
                      label: "Abrir",
                      onClick: () => onOpenChapter(chapter),
                    },
                    {
                      icon: Trash2,
                      label: "Apagar do disco",
                      danger: true,
                      onClick: () => onDeleteCache(chapter.id),
                    },
                  ]
                : [
                    {
                      icon: Download,
                      label: "Baixar",
                      onClick: () => onDownloadRequest(sourceId, chapter.id, chapter.title),
                    },
                  ]
            }
          />
        )}
      </div>
    </div>
  );
});

export const TabCapitulos = memo(function TabCapitulos({
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preventNextClickRef = useRef(false);
  const selectionModeRef = useRef(false);
  selectionModeRef.current = selectionMode;

  useEffect(() => {
    setSearchQuery("");
    setOpenMenuId(null);
  }, [sourceId]);

  // Limpa o timer de long press se o componente desmontar
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

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

  /* ── Virtualização da lista (window virtualizer — usa o scroll da página) ── */

  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // Distância entre o topo do documento e o topo da lista (com resize listener).
  useLayoutEffect(() => {
    const updateScrollMargin = () => {
      const el = listRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setScrollMargin(rect.top + window.scrollY);
    };

    updateScrollMargin();
    window.addEventListener("resize", updateScrollMargin);
    return () => window.removeEventListener("resize", updateScrollMargin);
  }, [chapters.length, activeFilter, searchQuery, sortOrder, selectionMode]);

  const virtualizer = useWindowVirtualizer({
    count: sorted.length,
    estimateSize: () => 62,
    overscan: 8,
    scrollMargin,
  });

  const virtualItems = virtualizer.getVirtualItems();

  /* ── Handlers estáveis (evitam re-render das linhas memorizadas) ── */

  const toggleSelection = useCallback((chapterId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }, []);

  const checkPreventClick = useCallback(() => {
    if (preventNextClickRef.current) {
      preventNextClickRef.current = false;
      return true;
    }
    return false;
  }, []);

  const startLongPress = useCallback((chapterId: string) => {
    preventNextClickRef.current = false;
    if (selectionModeRef.current) return;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      preventNextClickRef.current = true;
      setSelectionMode(true);
      setSelectedIds(new Set([chapterId]));
      longPressTimerRef.current = null;
    }, 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleSelectionModeToggle = useCallback(() => {
    setSelectionMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedIds(new Set());
      }
      return next;
    });
    setOpenMenuId(null);
  }, []);

  const handleOpenChapter = useCallback(
    (chapter: Chapter) => {
      if (chapter.isDownloaded) {
        navigate({
          to: "/biblioteca/reader-chapter/$sourceId",
          params: { sourceId },
          search: { chapterId: chapter.id },
        });
      } else {
        onDownloadRequest(sourceId, chapter.id, chapter.title);
      }
    },
    [navigate, sourceId, onDownloadRequest],
  );

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

  const toggleSelectAll = () => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((ch) => ch.id)));
    }
  };

  const batchMarkRead = useCallback(
    async (markAsRead: boolean) => {
      const ids = [...selectedIds];
      if (ids.length === 0) return;
      setIsBatchProcessing(true);
      try {
        await batchMarkReadMutation.mutateAsync({ chapterIds: ids, markAsRead });
        toast.success(`${ids.length} capítulos ${markAsRead ? "marcados" : "desmarcados"}`);
        setSelectionMode(false);
        setSelectedIds(new Set());
      } catch {
        toast.error("Erro na operação em lote");
      } finally {
        setIsBatchProcessing(false);
      }
    },
    [selectedIds, batchMarkReadMutation],
  );

  const batchDownload = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setIsBatchProcessing(true);
    const toastId = toast.loading(`Baixando 0/${ids.length} capítulos...`);
    let failed = 0;

    try {
      for (let i = 0; i < ids.length; i++) {
        toast.loading(`Baixando ${i + 1}/${ids.length} capítulos...`, { id: toastId });
        try {
          await chaptersApi.download(sourceId, ids[i]);
        } catch {
          failed++;
        }
      }

      setSelectionMode(false);
      setSelectedIds(new Set());

      if (failed === 0) {
        toast.success(`${ids.length} capítulos baixados`, { id: toastId });
      } else {
        toast.error(`${failed} de ${ids.length} downloads falharam`, { id: toastId });
      }

      queryClient.invalidateQueries({ queryKey: ["source", sourceId] });
    } finally {
      setIsBatchProcessing(false);
    }
  }, [selectedIds, sourceId, queryClient]);

  const batchDeleteCache = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setIsBatchProcessing(true);
    const toastId = toast.loading(`Apagando 0/${ids.length} capítulos...`);
    let failed = 0;

    try {
      for (let i = 0; i < ids.length; i++) {
        toast.loading(`Apagando ${i + 1}/${ids.length} capítulos...`, { id: toastId });
        try {
          await chaptersApi.deleteCache(sourceId, ids[i]);
        } catch {
          failed++;
        }
      }

      setSelectionMode(false);
      setSelectedIds(new Set());

      if (failed === 0) {
        toast.success(`${ids.length} caches removidos`, { id: toastId });
      } else {
        toast.error(`${failed} de ${ids.length} falharam`, { id: toastId });
      }

      queryClient.invalidateQueries({ queryKey: ["source", sourceId] });
    } finally {
      setIsBatchProcessing(false);
    }
  }, [selectedIds, sourceId, queryClient]);

  if (chapters.length === 0) {
    return (
      <SpeechBubble variant="yellow" tail="left">
        Nenhum capítulo disponível.
      </SpeechBubble>
    );
  }

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

      {/* Lista virtualizada: apenas as linhas visíveis (+ overscan) estão no DOM */}
      <div ref={listRef}>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualItems.map((vi) => {
            const chapter = sorted[vi.index];
            if (!chapter) return null;
            return (
              <div
                key={chapter.id}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vi.start - virtualizer.options.scrollMargin}px)`,
                }}
              >
                <ChapterRow
                  chapter={chapter}
                  sourceId={sourceId}
                  isRead={readChapterIds.has(chapter.id)}
                  isLast={vi.index === sorted.length - 1}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.has(chapter.id)}
                  searchQuery={searchQuery}
                  menuOpen={openMenuId === chapter.id}
                  onOpenChapter={handleOpenChapter}
                  onToggleRead={onToggleRead}
                  onDownloadRequest={onDownloadRequest}
                  onDeleteCache={handleDeleteSingleCache}
                  onToggleSelect={toggleSelection}
                  onStartLongPress={startLongPress}
                  onCancelLongPress={cancelLongPress}
                  onCheckPreventClick={checkPreventClick}
                  onToggleMenu={setOpenMenuId}
                />
              </div>
            );
          })}
        </div>

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
});
