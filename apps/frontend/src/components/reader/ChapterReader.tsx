import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, RefreshCw } from "lucide-react";
import { useChapterPages } from "@/hooks/useChapterPages";
import { useChapterDownload } from "@/hooks/useChapterDownload";
import { ReaderFloatingMenu } from "@/components/reader/ReaderFloatingMenu";
import { ReaderSettingsDrawer } from "@/components/reader/ReaderSettingsDrawer";
import { ReaderChapterIndex } from "@/components/reader/ReaderChapterIndex";
import type { Chapter } from "@/types/scraping";

interface ChapterReaderProps {
  sourceId: string;
  chapterId: string;
  mangaMode?: boolean;
  cached?: boolean;
  cachedTotalPages?: number;
  estimatedTotalPages?: number;
  onRetry?: () => void;
  mangaTitle?: string;
  chapterTitle?: string;
  backUrl: string;
  chapters?: Chapter[];
  prevChapterId?: string | null;
  nextChapterId?: string | null;
  onNavigateChapter?: (chapterId: string) => void;
}

export function ChapterReader({
  sourceId,
  chapterId,
  mangaMode = false,
  cached = false,
  cachedTotalPages,
  estimatedTotalPages,
  onRetry,
  mangaTitle,
  chapterTitle,
  backUrl,
  chapters = [],
  prevChapterId,
  nextChapterId,
  onNavigateChapter,
}: ChapterReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [showUI, setShowUI] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const navigate = useNavigate();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showIndex, setShowIndex] = useState(false);
  const [chapterTransitioning, setChapterTransitioning] = useState(false);
  const prevChapterIdRef = useRef(chapterId);
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);
  const [readingMode, setReadingMode] = useState("horizontal");
  const [showProgressBar, setShowProgressBar] = useState(true);
  const [showScrollbar, setShowScrollbar] = useState(false);
  const [progressPosition, setProgressPosition] = useState<"top" | "bottom">("bottom");
  const [progressStyle, setProgressStyle] = useState<"segmented" | "circular">("segmented");
  const [filterSepia, setFilterSepia] = useState(false);
  const [filterBW, setFilterBW] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  
  const [containToWidth, setContainToWidth] = useState(true);
  const [containToHeight, setContainToHeight] = useState(false);
  const [stretchSmallPages, setStretchSmallPages] = useState(false);
  const [limitMaxWidth, setLimitMaxWidth] = useState(false);
  const [maxWidthPixels, setMaxWidthPixels] = useState(800);
  const [limitMaxHeight, setLimitMaxHeight] = useState(false);
  const [maxHeightPixels, setMaxHeightPixels] = useState(1200);
  const [hoverPage, setHoverPage] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const savedScrollPositions = useRef<Record<number, { top: number; left: number }>>({});

  const { status: downloadStatus, totalImages: sseTotal } = useChapterDownload(
    sourceId,
    chapterId,
    !cached,
  );

  const effectiveTotal = cached
    ? (cachedTotalPages ?? estimatedTotalPages ?? 0)
    : sseTotal > 0
      ? sseTotal
      : estimatedTotalPages != null
        ? estimatedTotalPages
        : 1;

  const pageUrls = useChapterPages(sourceId, chapterId, effectiveTotal);

  useEffect(() => {
    const isChapterChange = prevChapterIdRef.current !== chapterId;
    prevChapterIdRef.current = chapterId;

    setCurrentPage(0);
    setFailedImages(new Set());
    setShowUI(false);
    setImageLoaded(false);
    setShowSettings(false);
    setShowIndex(false);

    if (isChapterChange) {
      setChapterTransitioning(true);
    }
  }, [sourceId, chapterId]);

  useEffect(() => {
    setImageLoaded(false);
  }, [currentPage]);

  const updatePage = useCallback((newPage: number | ((p: number) => number)) => {
    setCurrentPage((prev) => {
      const next = typeof newPage === "function" ? newPage(prev) : newPage;
      if (next !== prev && containerRef.current) {
        savedScrollPositions.current[prev] = {
          top: containerRef.current.scrollTop,
          left: containerRef.current.scrollLeft,
        };
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (progressStyle === "circular" && progressPosition === "top") {
      setProgressPosition("bottom");
    }
  }, [progressStyle, progressPosition]);

  const goNext = useCallback(() => {
    updatePage((p) => Math.min(p + 1, Math.max(0, effectiveTotal - 1)));
  }, [effectiveTotal, updatePage]);

  const goPrev = useCallback(() => {
    updatePage((p) => Math.max(p - 1, 0));
  }, [updatePage]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        if (mangaMode) {
          goPrev();
        } else {
          goNext();
        }
      } else if (e.key === "ArrowLeft") {
        if (mangaMode) {
          goNext();
        } else {
          goPrev();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, mangaMode]);

  const handleImageError = (index: number) => {
    setFailedImages((prev) => new Set(prev).add(index));
  };

  const hasDownloadFailed = !cached && downloadStatus === "failed";

  const toggleUI = useCallback(() => setShowUI((v) => !v), []);

  const handlePrevClick = useCallback(() => {
    if (mangaMode) {
      goNext();
    } else {
      goPrev();
    }
  }, [mangaMode, goNext, goPrev]);

  const handleNextClick = useCallback(() => {
    if (mangaMode) {
      goPrev();
    } else {
      goNext();
    }
  }, [mangaMode, goPrev, goNext]);

  const handleBack = useCallback(() => {
    navigate({ to: backUrl });
  }, [navigate, backUrl]);

  const handleDoubleClick = useCallback(() => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (!zoomEnabled) return;
    if (isZoomed) {
      setZoomLevel(1);
      setIsZoomed(false);
    } else {
      setShowUI(false);
      setZoomLevel(1.5);
      setIsZoomed(true);
    }
  }, [zoomEnabled, isZoomed]);



  const handleCenterClick = useCallback(() => {
    if (!zoomEnabled) {
      toggleUI();
      return;
    }

    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      return;
    }

    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      toggleUI();
    }, 200);
  }, [toggleUI, zoomEnabled]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((z) => {
      const nz = Math.min(z + 0.1, 3);
      if (nz > 1) setIsZoomed(true);
      return nz;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((z) => {
      const nz = Math.max(z - 0.1, 1);
      if (nz <= 1) setIsZoomed(false);
      return nz;
    });
  }, []);

  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore clicks on the scrollbar
    const target = e.target as HTMLElement;
    const currentTarget = e.currentTarget;
    if (e.clientX > currentTarget.getBoundingClientRect().left + currentTarget.clientWidth) {
      return;
    }

    const width = window.innerWidth;
    const x = e.clientX;
    const pct = x / width;

    if (pct < 0.3) {
      handlePrevClick();
    } else if (pct > 0.7) {
      handleNextClick();
    } else {
      handleCenterClick();
    }
  }, [handlePrevClick, handleNextClick, handleCenterClick]);

  const handleContainerDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const width = window.innerWidth;
    const x = e.clientX;
    const pct = x / width;

    if (pct >= 0.3 && pct <= 0.7) {
      handleDoubleClick();
    }
  }, [handleDoubleClick]);

  const imageStyle = useMemo(() => {
    const filters: string[] = [];
    if (filterSepia) filters.push("sepia(100%)");
    if (filterBW) filters.push("grayscale(100%)");
    filters.push(`brightness(${brightness}%)`);
    filters.push(`contrast(${contrast}%)`);
    filters.push(`saturate(${saturation}%)`);
    return {
      filter: filters.join(" "),
    };
  }, [filterSepia, filterBW, brightness, contrast, saturation]);

  const imageDims = useMemo(() => {
    let w = "auto";
    let h = "auto";
    let mw = "none";
    let mh = "none";

    if (containToWidth) mw = "100%";
    if (containToHeight) mh = "100dvh";

    if (stretchSmallPages) {
      if (containToWidth) w = "100%";
      if (containToHeight) h = "100dvh";
    }

    if (limitMaxWidth) {
      mw = mw === "100%" ? `min(100%, ${maxWidthPixels}px)` : `${maxWidthPixels}px`;
    }
    if (limitMaxHeight) {
      mh = mh === "100dvh" ? `min(100dvh, ${maxHeightPixels}px)` : `${maxHeightPixels}px`;
    }

    if (isZoomed) {
      const scale = (val: string) =>
        val.replace(/(\d+)(%|dvh|px)/g, (_, p1, p2) => `${Number(p1) * zoomLevel}${p2}`);
      
      if (w !== "auto") w = scale(w);
      if (h !== "auto") h = scale(h);
      if (mw !== "none") mw = scale(mw);
      if (mh !== "none") mh = scale(mh);

      if (w === "auto" && mw !== "none") w = mw;
      if (h === "auto" && mh !== "none") h = mh;
    }

    return { width: w, height: h, maxWidth: mw, maxHeight: mh, objectFit: "contain" as const };
  }, [
    containToWidth,
    containToHeight,
    stretchSmallPages,
    limitMaxWidth,
    maxWidthPixels,
    limitMaxHeight,
    maxHeightPixels,
    isZoomed,
    zoomLevel,
  ]);

  const progressPct =
    effectiveTotal > 1 ? Math.round((currentPage / (effectiveTotal - 1)) * 100) : 0;

  const showPage = pageUrls.length > 0 && currentPage < pageUrls.length;

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setChapterTransitioning(false);

    if (containerRef.current) {
      const pos = savedScrollPositions.current[currentPage];
      if (pos) {
        containerRef.current.scrollTop = pos.top;
        containerRef.current.scrollLeft = pos.left;
      } else {
        containerRef.current.scrollTop = 0;
        containerRef.current.scrollLeft =
          (containerRef.current.scrollWidth - containerRef.current.clientWidth) / 2;
      }
    }
  }, [currentPage]);

  const maxImageWidth = 4000;

  const handleResetFilters = useCallback(() => {
    setFilterSepia(false);
    setFilterBW(false);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setContainToWidth(true);
    setContainToHeight(false);
    setStretchSmallPages(false);
    setLimitMaxWidth(false);
    setMaxWidthPixels(800);
    setLimitMaxHeight(false);
    setMaxHeightPixels(1200);
  }, []);

  const handleHitboxMouseMove = useCallback((e: React.MouseEvent) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setHoverPage(Math.round(pct * (effectiveTotal - 1)));
    setHoverX(e.clientX);
  }, [effectiveTotal]);

  const handleHitboxMouseLeave = useCallback(() => {
    setHoverPage(null);
    setHoverX(null);
  }, []);

  const handleHitboxClick = useCallback((e: React.MouseEvent) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    const page = Math.round(pct * (effectiveTotal - 1));
    updatePage(Math.max(0, Math.min(page, effectiveTotal - 1)));
  }, [effectiveTotal, updatePage]);

  if (effectiveTotal === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-6">
        <BookOpen className="w-14 h-14 text-comic-blue/20 animate-pulse" strokeWidth={1.5} />
        <p className="text-xl font-display tracking-[0.3em] text-white/[0.15]">MANGAINK</p>
        {hasDownloadFailed ? (
          <div className="flex flex-col items-center gap-4 mt-4">
            <p className="text-sm text-white/50">Nao foi possivel carregar as paginas</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-white/[0.12]">Carregando capítulo...</p>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black select-none">
      {chapterTransitioning && (
        <div className="fixed inset-0 z-60 bg-black flex flex-col items-center justify-center gap-6">
          <BookOpen className="w-14 h-14 text-comic-blue/20 animate-pulse" strokeWidth={1.5} />
          <p className="text-xl font-display tracking-[0.3em] text-white/[0.15]">MANGAINK</p>
          <p className="text-xs text-white/[0.12]">Carregando capítulo...</p>
        </div>
      )}
      {showProgressBar && progressStyle === "segmented" && effectiveTotal > 0 && (
        progressPosition === "bottom" ? (
          <div
            className="fixed bottom-0 left-0 right-0 z-20 h-[50px] cursor-pointer group"
            onMouseMove={handleHitboxMouseMove}
            onMouseLeave={handleHitboxMouseLeave}
            onClick={handleHitboxClick}
          >
            {hoverPage !== null && hoverX !== null && (
              <div
                className="fixed pointer-events-none z-30"
                style={{
                  left: hoverX,
                  bottom: "60px",
                  transform: "translateX(-50%)",
                }}
              >
                <div className="bg-zinc-700 text-white text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-lg">
                  {hoverPage + 1}
                </div>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-[3px] group-hover:h-[42px] transition-all duration-200 ease-in-out overflow-hidden">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-white/[0.04]" />
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${progressPct}%`,
                    background: "var(--theme-primary, oklch(0.88 0.18 95))",
                  }}
                />
              </div>
              <div className="absolute inset-0 z-10 bg-zinc-800/95 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="flex items-center gap-3 px-3 h-full">
                  <span className="text-white/60 text-xs font-medium tabular-nums min-w-[1.5rem] text-right">
                    {currentPage + 1}
                  </span>
                  <div
                    ref={barRef}
                    className="flex-1 h-4 flex gap-[2px]"
                  >
                    {Array.from({ length: effectiveTotal }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1"
                        style={{
                          background:
                            i <= currentPage
                              ? "var(--theme-primary, oklch(0.88 0.18 95))"
                              : "rgba(255,255,255,0.06)",
                          opacity: i <= currentPage ? 0.8 : undefined,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-white/60 text-xs font-medium tabular-nums min-w-[1.5rem]">
                    {effectiveTotal}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="fixed top-0 left-0 right-0 z-20 h-[36px] flex gap-px items-start">
            {Array.from({ length: effectiveTotal }).map((_, i) => (
              <div
                key={i}
                className="flex-1 transition-all duration-200 relative group cursor-pointer h-[2px] hover:h-[24px]"
                style={{
                  background:
                    i <= currentPage
                      ? "var(--theme-primary, oklch(0.88 0.18 95))"
                      : "rgba(255,255,255,0.04)",
                  opacity: i <= currentPage ? 0.5 : undefined,
                }}
                onClick={() => updatePage(i)}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black/80 text-white/90 text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {i + 1} / {effectiveTotal}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {showProgressBar && progressStyle === "circular" && effectiveTotal > 1 && (
        <svg
          className={`fixed z-20 w-7 h-7 ${
            progressPosition === "top" ? "top-3" : "bottom-6"
          } ${progressPosition === "top" ? "right-3" : "right-6"}`}
          viewBox="0 0 36 36"
        >
          <path
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="2.5"
            d="M18 3a15 15 0 1 1 0 30 15 15 0 1 1 0-30"
          />
          <path
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${progressPct}, 100`}
            d="M18 3a15 15 0 1 1 0 30 15 15 0 1 1 0-30"
          />
        </svg>
      )}

      <div
        ref={containerRef}
        className={`w-full h-[100dvh] overflow-auto relative ${
          showScrollbar
            ? ""
            : "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        }`}
        onClick={handleContainerClick}
        onDoubleClick={handleContainerDoubleClick}
      >
        {showPage && !failedImages.has(currentPage) ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <BookOpen
                  className="w-10 h-10 text-comic-blue/20 animate-pulse"
                  strokeWidth={1.5}
                />
              </div>
            )}
            <div className="min-w-full min-h-full grid place-items-center">
              <img
                src={pageUrls[currentPage]}
                alt={`Pagina ${currentPage + 1}`}
                className="flex-shrink-0 transition-none"
                style={{
                  filter: imageStyle.filter,
                  ...imageDims,
                }}
                onLoad={handleImageLoad}
                onError={() => handleImageError(currentPage)}
              />
            </div>
          </>
        ) : (
          <p className="text-white/60 font-display text-lg">Pagina indisponivel</p>
        )}

        <div
          data-testid="zone-prev"
          className="absolute inset-y-0 left-0 w-[30%] z-[1]"
          onClick={(e) => { e.stopPropagation(); handlePrevClick(); }}
        />
        <div
          data-testid="zone-toggle"
          className="absolute inset-y-0 left-[30%] w-[40%] z-[1]"
          onClick={(e) => { e.stopPropagation(); handleCenterClick(); }}
        />
        <div
          data-testid="zone-next"
          className="absolute inset-y-0 right-0 w-[30%] z-[1]"
          onClick={(e) => { e.stopPropagation(); handleNextClick(); }}
        />
      </div>

      <div
        data-testid="reader-topbar"
        className={`absolute top-0 left-0 right-0 z-10 transition-transform duration-300 ${
          showUI ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="bg-black/95 px-4 sm:px-6 py-3 sm:py-4 grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleBack();
            }}
            className="h-10 w-10 border-[3px] border-ink rounded-lg bg-white flex items-center justify-center shadow-comic-sm hover:-translate-y-0.5 transition-transform shrink-0 justify-self-start"
          >
            <ArrowLeft className="w-5 h-5 text-comic-ink" />
          </button>
          <span className="font-display text-base sm:text-lg text-white/90 truncate text-center min-w-0">
            {mangaTitle ?? ""}
          </span>
          <span className="text-xs sm:text-sm text-white/55 truncate text-right justify-self-end font-display tracking-wider">
            {chapterTitle ?? ""}
          </span>
        </div>
      </div>

      <div
        data-testid="reader-bubble"
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-10 transition-all duration-300 ${
          showUI ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-1.5 shadow-[2px_2px_0_0_rgba(0,0,0,0.4)] flex items-center gap-2">
          <span className="font-display text-sm text-white/90 tracking-wider whitespace-nowrap">
            {currentPage + 1} / {effectiveTotal}
          </span>
        </div>
      </div>

      <ReaderFloatingMenu
        showUI={showUI}
        hasPrevChapter={!!prevChapterId}
        hasNextChapter={!!nextChapterId}
        onPrevChapter={() => onNavigateChapter?.(prevChapterId!)}
        onNextChapter={() => onNavigateChapter?.(nextChapterId!)}
        onOpenIndex={() => setShowIndex(true)}
        onOpenSettings={() => setShowSettings(true)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />

      <ReaderSettingsDrawer
        open={showSettings}
        onOpenChange={setShowSettings}
        hideOverlay
        readingMode={readingMode}
        onReadingModeChange={setReadingMode}
        zoomEnabled={zoomEnabled}
        onZoomEnabledChange={setZoomEnabled}
        zoomLevel={zoomLevel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        showScrollbar={showScrollbar}
        onShowScrollbarChange={setShowScrollbar}
        showProgress={showProgressBar}
        onShowProgressChange={setShowProgressBar}
        progressPosition={progressPosition}
        onProgressPositionChange={setProgressPosition}
        progressStyle={progressStyle}
        onProgressStyleChange={setProgressStyle}
        filterSepia={filterSepia}
        onFilterSepiaChange={setFilterSepia}
        filterBW={filterBW}
        onFilterBWChange={setFilterBW}
        brightness={brightness}
        onBrightnessChange={setBrightness}
        contrast={contrast}
        onContrastChange={setContrast}
        saturation={saturation}
        onSaturationChange={setSaturation}
        containToWidth={containToWidth}
        onContainToWidthChange={setContainToWidth}
        containToHeight={containToHeight}
        onContainToHeightChange={setContainToHeight}
        stretchSmallPages={stretchSmallPages}
        onStretchSmallPagesChange={setStretchSmallPages}
        limitMaxWidth={limitMaxWidth}
        onLimitMaxWidthChange={setLimitMaxWidth}
        maxWidthPixels={maxWidthPixels}
        onMaxWidthPixelsChange={setMaxWidthPixels}
        limitMaxHeight={limitMaxHeight}
        onLimitMaxHeightChange={setLimitMaxHeight}
        maxHeightPixels={maxHeightPixels}
        onMaxHeightPixelsChange={setMaxHeightPixels}
        onResetFilters={handleResetFilters}
      />

      <ReaderChapterIndex
        open={showIndex}
        onOpenChange={setShowIndex}
        chapters={chapters}
        currentChapterId={chapterId}
        onSelectChapter={(cid) => onNavigateChapter?.(cid)}
      />
    </div>
  );
}
