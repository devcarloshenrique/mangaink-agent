import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ComicHeader } from "@/components/comic/Header";
import { ChapterReader } from "@/components/reader/ChapterReader";
import { Toaster } from "sonner";
import { ArrowLeft } from "lucide-react";
import { chaptersApi } from "@/lib/api";
import { scrapingApi } from "@/lib/api";
import { authGuard } from "./-authGuard";
import type { SourceInspectResponse } from "@/types/scraping";

export const Route = createFileRoute("/biblioteca/reader-chapter/$sourceId")({
  validateSearch: z.object({
    chapterId: z.string(),
  }),
  beforeLoad: authGuard,
  component: ChapterReaderPage,
});

function ChapterReaderPage() {
  const { sourceId } = Route.useParams();
  const { chapterId } = Route.useSearch();

  const [source, setSource] = useState<SourceInspectResponse | null>(null);
  const [cachedTotalPages, setCachedTotalPages] = useState<number | null>(null);
  const [downloadTriggered, setDownloadTriggered] = useState(false);

  useEffect(() => {
    scrapingApi.getSource(sourceId).then(setSource).catch(console.error);
  }, [sourceId]);

  const chapter = source?.chapters.find((c) => c.id === chapterId);
  const isDownloaded = chapter?.isDownloaded ?? false;

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

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <ComicHeader />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link
            to="/biblioteca/$sourceId"
            params={{ sourceId }}
            className="h-10 w-10 border-[3px] border-ink rounded-lg bg-comic-yellow flex items-center justify-center shadow-comic-sm hover:-translate-y-0.5 transition-transform"
          >
            <ArrowLeft />
          </Link>
          <h2 className="font-display text-xl uppercase">
            {chapter?.title ?? `Capítulo ${chapterId}`}
          </h2>
        </div>

        <ChapterReader
          sourceId={sourceId}
          chapterId={chapterId}
          cached={isDownloaded}
          cachedTotalPages={cachedTotalPages ?? undefined}
          estimatedTotalPages={chapter?.pages ?? undefined}
          onRetry={handleRetry}
        />
      </div>
    </div>
  );
}
