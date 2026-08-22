import { useChapterPages } from "@/hooks/useChapterPages";
import { useChapterDownload } from "@/hooks/useChapterDownload";
import { ReaderCore } from "@/components/reader/ReaderCore";
import type { Chapter } from "@/types/scraping";

export interface ChapterReaderProps {
  sourceId: string;
  chapterId: string;
  mangaMode?: boolean;
  cached?: boolean;
  cachedTotalPages?: number;
  estimatedTotalPages?: number;
  onRetry?: () => void;
  mangaTitle?: string;
  chapterTitle?: string;
  backUrl?: string;
  onBack?: () => void;
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
  onBack,
  chapters = [],
  prevChapterId,
  nextChapterId,
  onNavigateChapter,
}: ChapterReaderProps) {
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
  const hasDownloadFailed = !cached && downloadStatus === "failed";

  const navItems = chapters.map((ch) => ({
    id: ch.id,
    title: ch.title,
    number: ch.number,
    isDownloaded: ch.isDownloaded,
  }));

  return (
    <ReaderCore
      pageUrls={pageUrls}
      totalPages={effectiveTotal}
      mangaTitle={mangaTitle}
      itemTitle={chapterTitle}
      backUrl={backUrl}
      onBack={onBack}
      mangaMode={mangaMode}
      navItems={navItems}
      currentNavId={chapterId}
      prevNavId={prevChapterId}
      nextNavId={nextChapterId}
      onNavigateNavId={onNavigateChapter}
      navItemLabel="Capítulos"
      onRetry={onRetry}
      hasError={hasDownloadFailed}
      errorMessage="Não foi possível carregar as páginas"
      transitionMessage="Carregando capítulo…"
    />
  );
}
