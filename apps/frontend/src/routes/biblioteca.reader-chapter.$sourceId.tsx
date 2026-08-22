import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ChapterReader } from "@/components/reader/ChapterReader";
import { chaptersApi } from "@/lib/api";
import { scrapingApi } from "@/lib/api";
import type { SourceInspectResponse } from "@/types/scraping";

export const Route = createFileRoute("/biblioteca/reader-chapter/$sourceId")({
  validateSearch: z.object({
    chapterId: z.string(),
  }),
  component: ChapterReaderPage,
});

function ChapterReaderPage() {
  const { sourceId } = Route.useParams();
  const { chapterId } = Route.useSearch();
  const nav = useNavigate();

  const [source, setSource] = useState<SourceInspectResponse | null>(null);
  const [cachedTotalPages, setCachedTotalPages] = useState<number | null>(null);
  const [downloadTriggered, setDownloadTriggered] = useState(false);

  useEffect(() => {
    setDownloadTriggered(false);
    setCachedTotalPages(null);
  }, [chapterId]);

  useEffect(() => {
    scrapingApi.getSource(sourceId).then(setSource).catch(console.error);
  }, [sourceId]);

  const chapter = source?.chapters.find((c) => c.id === chapterId);
  const isDownloaded = chapter?.isDownloaded ?? false;

  const chapterIndex = source ? source.chapters.findIndex((c) => c.id === chapterId) : -1;
  const prevChapterId = chapterIndex > 0 ? source!.chapters[chapterIndex - 1].id : null;
  const nextChapterId =
    chapterIndex >= 0 && chapterIndex < (source?.chapters.length ?? 1) - 1
      ? source!.chapters[chapterIndex + 1].id
      : null;

  // Cache hit: busca totalImages exato do manifest.json
  useEffect(() => {
    if (!chapter || !isDownloaded) return;

    chaptersApi
      .getDownloadStatus(sourceId, chapterId)
      .then((result) => {
        if (result.totalImages != null) {
          setCachedTotalPages(result.totalImages);
        }
      })
      .catch(console.error);
  }, [sourceId, chapterId, chapter, isDownloaded]);

  // Cache miss: dispara download assíncrono e renderiza o reader imediatamente
  // O proxy inteligente do backend serve as imagens mesmo sem cache
  useEffect(() => {
    if (!chapter) return;
    if (isDownloaded) return;
    if (downloadTriggered) return;

    chaptersApi
      .download(sourceId, chapterId)
      .then(() => setDownloadTriggered(true))
      .catch(console.error);

    setDownloadTriggered(true);
  }, [sourceId, chapterId, chapter, isDownloaded, downloadTriggered]);

  const handleRetry = () => {
    chaptersApi
      .download(sourceId, chapterId)
      .then(() => setDownloadTriggered(true))
      .catch(console.error);
  };

  const handleNavigateChapter = (newChapterId: string) => {
    nav({
      to: "/biblioteca/reader-chapter/$sourceId",
      params: { sourceId },
      search: { chapterId: newChapterId },
    });
  };

  const handleBack = () => {
    nav({
      to: "/biblioteca/$sourceId",
      params: { sourceId },
      search: { tab: "capitulos" },
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-reader-bg">
      <ChapterReader
        sourceId={sourceId}
        chapterId={chapterId}
        cached={isDownloaded}
        cachedTotalPages={cachedTotalPages ?? undefined}
        estimatedTotalPages={chapter?.pages ?? undefined}
        onRetry={handleRetry}
        mangaTitle={source?.metadata?.title}
        chapterTitle={chapter?.title ?? `Capítulo ${chapterId}`}
        onBack={handleBack}
        chapters={source?.chapters ?? []}
        prevChapterId={prevChapterId}
        nextChapterId={nextChapterId}
        onNavigateChapter={handleNavigateChapter}
      />
    </div>
  );
}
