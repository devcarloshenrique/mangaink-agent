import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { Toaster } from "sonner";
import { ArrowLeft } from "lucide-react";
import { MangaCover } from "@/components/biblioteca/MangaCover";
import { ReadButton } from "@/components/biblioteca/ReadButton";
import { FavoriteButton } from "@/components/biblioteca/FavoriteButton";
import { TabDetalhes } from "@/components/biblioteca/TabDetalhes";
import { TabCapitulos } from "@/components/biblioteca/TabCapitulos";
import { TabConversoes } from "@/components/biblioteca/TabConversoes";
import { DownloadChapterDialog } from "@/components/biblioteca/DownloadChapterDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useScraping } from "@/hooks/useScraping";
import { scrapingApi } from "@/lib/api";
import { chaptersApi } from "@/lib/api";
import { authGuard } from "./-authGuard";
import type { SourceInspectResponse } from "@/types/scraping";
import {
  MOCK_MANGA_DETAILS,
  MOCK_CONVERSIONS,
  MOCK_CONVERSION_JOBS,
} from "@/lib/manga-detail-mocks";

export const Route = createFileRoute("/biblioteca/$sourceId")({
  beforeLoad: authGuard,
  component: MangaDetailPage,
});

function MangaDetailPage() {
  const { sourceId } = Route.useParams();
  const navigate = useNavigate();

  const [isFavorite, setIsFavorite] = useState(false);
  const [readingProgress] = useState<{ chapterNumber: string } | null>(null);
  const [source, setSource] = useState<SourceInspectResponse | null>(null);

  const [downloadTarget, setDownloadTarget] = useState<{
    sourceId: string;
    chapterId: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    scrapingApi.getSource(sourceId).then(setSource).catch(console.error);
  }, [sourceId]);

  const seriesTitle = source?.metadata.title ?? MOCK_MANGA_DETAILS.title;
  const chapters = source?.chapters ?? [];
  const chapterCount = chapters.length;

  const handleDownloadConfirm = async () => {
    if (!downloadTarget) return;
    try {
      await chaptersApi.download(downloadTarget.sourceId, downloadTarget.chapterId);
      navigate({
        to: "/biblioteca/reader-chapter/$sourceId",
        params: { sourceId: downloadTarget.sourceId },
        search: { chapterId: downloadTarget.chapterId },
      });
    } catch (err) {
      console.error("Erro ao iniciar download:", err);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <ComicHeader />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link
            to="/biblioteca"
            className="h-10 w-10 border-[3px] border-ink rounded-lg bg-comic-yellow flex items-center justify-center shadow-comic-sm hover:-translate-y-0.5 transition-transform"
          >
            <ArrowLeft />
          </Link>
        </div>

        <div className="grid md:grid-cols-[320px_1fr] gap-8">
          <div className="space-y-6 md:max-w-[320px] mx-auto md:mx-0 w-full">
            <MangaCover sourceId={sourceId} className="aspect-[2/3]" />
            <ReadButton readingProgress={readingProgress} sourceId={sourceId} />
            <FavoriteButton isFavorite={isFavorite} onToggle={() => setIsFavorite(!isFavorite)} />
          </div>

          <div className="min-w-0">
            <h1 className="font-display text-3xl md:text-4xl uppercase text-center mb-6">
              {seriesTitle}
            </h1>

            <Tabs defaultValue="detalhes">
              <TabsList className="border-[3px] border-ink rounded-xl shadow-comic bg-card p-0 w-full flex overflow-hidden h-auto">
                <TabsTrigger
                  value="detalhes"
                  className="flex-1 font-display text-lg uppercase tracking-wider py-4 px-6 first:rounded-l-md last:rounded-r-md rounded-none transition-all border-r-2 border-ink data-[state=active]:bg-comic-red data-[state=active]:text-primary-foreground data-[state=inactive]:bg-muted hover:data-[state=inactive]:bg-muted/80"
                >
                  Detalhes
                </TabsTrigger>
                <TabsTrigger
                  value="capitulos"
                  className="flex-1 font-display text-lg uppercase tracking-wider py-4 px-6 first:rounded-l-md last:rounded-r-md rounded-none transition-all border-r-2 border-ink data-[state=active]:bg-comic-red data-[state=active]:text-primary-foreground data-[state=inactive]:bg-muted hover:data-[state=inactive]:bg-muted/80"
                >
                  Capitulos ({chapterCount})
                </TabsTrigger>
                <TabsTrigger
                  value="conversoes"
                  className="flex-1 font-display text-lg uppercase tracking-wider py-4 px-6 first:rounded-l-md last:rounded-r-md rounded-none transition-all data-[state=active]:bg-comic-red data-[state=active]:text-primary-foreground data-[state=inactive]:bg-muted hover:data-[state=inactive]:bg-muted/80"
                >
                  Conversoes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="detalhes" className="mt-4 animate-slide-up min-h-[420px]">
                <TabDetalhes
                  details={
                    source?.metadata
                      ? {
                          title: source.metadata.title,
                          author: source.metadata.author ?? "",
                          status: source.metadata.status ?? "",
                          description: source.metadata.description ?? "",
                          genres: source.metadata.genres,
                        }
                      : MOCK_MANGA_DETAILS
                  }
                />
              </TabsContent>

              <TabsContent value="capitulos" className="mt-4 animate-slide-up min-h-[420px]">
                <TabCapitulos
                  chapters={chapters}
                  sourceId={sourceId}
                  onDownloadRequest={(sid, cid, title) =>
                    setDownloadTarget({ sourceId: sid, chapterId: cid, title })
                  }
                />
              </TabsContent>

              <TabsContent value="conversoes" className="mt-4 animate-slide-up min-h-[420px]">
                <TabConversoes
                  sourceId={sourceId}
                  conversions={MOCK_CONVERSIONS}
                  jobsMap={MOCK_CONVERSION_JOBS}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <DownloadChapterDialog
        open={downloadTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDownloadTarget(null);
        }}
        chapterTitle={downloadTarget?.title ?? ""}
        onConfirm={handleDownloadConfirm}
      />
    </div>
  );
}
