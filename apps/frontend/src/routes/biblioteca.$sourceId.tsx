import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, Loader2, BookOpen } from "lucide-react";
import { MangaCover } from "@/components/biblioteca/MangaCover";
import { ReadButton } from "@/components/biblioteca/ReadButton";
import { FavoriteButton } from "@/components/biblioteca/FavoriteButton";
import { TabDetalhes } from "@/components/biblioteca/TabDetalhes";
import { TabCapitulos } from "@/components/biblioteca/TabCapitulos";
import { TabConversoes } from "@/components/biblioteca/TabConversoes";
import { DownloadChapterDialog } from "@/components/biblioteca/DownloadChapterDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { scrapingApi, chaptersApi } from "@/lib/api";
import { useReadingProgress, useToggleRead } from "@/hooks/useReadingProgress";
import type { SourceInspectResponse } from "@/types/scraping";

const mangaDetailSearchSchema = z.object({
  tab: z.enum(["detalhes", "capitulos", "conversoes"]).optional().default("detalhes"),
});

export const Route = createFileRoute("/biblioteca/$sourceId")({
  validateSearch: mangaDetailSearchSchema,
  component: MangaDetailPage,
});

function MangaDetailPage() {
  const { sourceId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();

  // Local state for instant tab switching; initialize from URL search param
  const [activeTab, setActiveTab] = useState<string>(search.tab ?? "detalhes");
  const rafRef = useRef<number>(0);

  // Sync state if URL search param changes externally (e.g. Back button from Reader)
  useEffect(() => {
    if (search.tab && search.tab !== activeTab) {
      setActiveTab(search.tab);
    }
  }, [search.tab, activeTab]);

  const [isFavorite, setIsFavorite] = useState(false);

  const {
    data: source,
    isLoading: sourceLoading,
    isError,
  } = useQuery<SourceInspectResponse>({
    queryKey: ["source", sourceId],
    queryFn: () => scrapingApi.getSource(sourceId),
    staleTime: 30_000,
    enabled: !!sourceId,
  });

  const { data: progress, isLoading: progressLoading } = useReadingProgress(sourceId);
  const toggleRead = useToggleRead(sourceId);

  const [downloadTarget, setDownloadTarget] = useState<{
    sourceId: string;
    chapterId: string;
    title: string;
  } | null>(null);

  const readChapterIds = useMemo<Set<string>>(
    () => new Set(progress?.readChapterIds ?? []),
    [progress],
  );

  const chapters = source?.chapters ?? [];
  const seriesTitle = source?.metadata?.title ?? "";
  const chapterCount = chapters.length;
  const isLoading = sourceLoading || progressLoading;

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

  // Instant local tab switch + lightweight URL sync (no router overhead)
  const handleTabChange = useCallback((newTab: string) => {
    setActiveTab(newTab);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", newTab);
      window.history.replaceState(window.history.state, "", url.toString());
    });
  }, []);

  const handleToggleRead = useCallback(
    (chapterId: string, isRead: boolean) => toggleRead.mutate({ chapterId, isRead }),
    [toggleRead],
  );

  const handleDownloadRequest = useCallback(
    (sid: string, cid: string, title: string) =>
      setDownloadTarget({ sourceId: sid, chapterId: cid, title }),
    [],
  );

  const mangaDetails = useMemo(
    () => ({
      title: source?.metadata?.title ?? "",
      author: source?.metadata?.author ?? "",
      status: source?.metadata?.status ?? null,
      description: source?.metadata?.description ?? "Nenhuma sinopse informada.",
      genres: source?.metadata?.genres ?? [],
    }),
    [source?.metadata],
  );

  if (!sourceLoading && (isError || !source)) {
    return (
      <div className="flex-1 bg-background">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex items-center gap-3 mb-8">
            <Link
              to="/biblioteca"
              className="h-10 w-10 border-[3px] border-ink rounded-lg bg-comic-yellow flex items-center justify-center shadow-comic-sm hover:-translate-y-0.5 transition-transform"
            >
              <ArrowLeft />
            </Link>
          </div>
          <div className="text-center py-20">
            <ComicPanel bg="card" padding="lg" className="max-w-md mx-auto">
              <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h1 className="font-display text-3xl uppercase mb-2">Obra não encontrada</h1>
              <p className="text-sm font-medium opacity-70 mb-6">
                Não foi possível carregar as informações dessa obra.
              </p>
              <Link
                to="/biblioteca"
                className="inline-flex items-center gap-2 bg-comic-yellow text-comic-ink border-[3px] border-ink shadow-comic-sm font-display text-base px-4 py-2 rounded-md hover:-translate-y-0.5 transition-transform"
              >
                Voltar à biblioteca
              </Link>
            </ComicPanel>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background">
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
            <MangaCover sourceId={sourceId} title={seriesTitle} className="aspect-[2/3]" />
            <ReadButton
              sourceId={sourceId}
              readChapterIds={readChapterIds}
              chapters={chapters}
              isLoading={isLoading}
            />
            <FavoriteButton isFavorite={isFavorite} onToggle={() => setIsFavorite(!isFavorite)} />
          </div>

          <div className="min-w-0">
            <h1 className="font-display text-3xl md:text-4xl uppercase text-center mb-6">
              {sourceLoading ? (
                <span className="inline-flex items-center gap-2 opacity-50">
                  <Loader2 className="h-7 w-7 animate-spin text-comic-blue" />
                  Carregando obra…
                </span>
              ) : (
                seriesTitle || "Obra"
              )}
            </h1>

            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="border-[3px] border-ink rounded-xl shadow-comic bg-card p-0 w-full flex overflow-hidden h-auto">
                <TabsTrigger
                  value="detalhes"
                  className="flex-1 font-display text-lg uppercase tracking-wider py-4 px-6 first:rounded-l-md last:rounded-r-md rounded-none transition-all border-r-2 border-ink data-[state=active]:bg-comic-red data-[state=active]:text-primary-foreground data-[state=inactive]:bg-muted hover:data-[state=inactive]:bg-muted/80 cursor-pointer"
                >
                  Detalhes
                </TabsTrigger>
                <TabsTrigger
                  value="capitulos"
                  className="flex-1 font-display text-lg uppercase tracking-wider py-4 px-6 first:rounded-l-md last:rounded-r-md rounded-none transition-all border-r-2 border-ink data-[state=active]:bg-comic-red data-[state=active]:text-primary-foreground data-[state=inactive]:bg-muted hover:data-[state=inactive]:bg-muted/80 cursor-pointer"
                >
                  Capítulos {sourceLoading ? "" : `(${chapterCount})`}
                </TabsTrigger>
                <TabsTrigger
                  value="conversoes"
                  className="flex-1 font-display text-lg uppercase tracking-wider py-4 px-6 first:rounded-l-md last:rounded-r-md rounded-none transition-all data-[state=active]:bg-comic-red data-[state=active]:text-primary-foreground data-[state=inactive]:bg-muted hover:data-[state=inactive]:bg-muted/80 cursor-pointer"
                >
                  Conversões
                </TabsTrigger>
              </TabsList>

              <TabsContent value="detalhes" className="mt-4 animate-fade-in min-h-[420px]">
                {sourceLoading ? (
                  <ComicPanel bg="card" padding="md">
                    <div className="space-y-4 py-8 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-comic-blue" />
                      <p className="font-display text-base opacity-70">
                        Carregando detalhes da obra…
                      </p>
                    </div>
                  </ComicPanel>
                ) : (
                  <TabDetalhes details={mangaDetails} />
                )}
              </TabsContent>

              <TabsContent value="capitulos" className="mt-4 animate-fade-in min-h-[420px]">
                {sourceLoading ? (
                  <ComicPanel bg="card" padding="md">
                    <div className="space-y-4 py-8 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-comic-blue" />
                      <p className="font-display text-base opacity-70">Carregando capítulos…</p>
                    </div>
                  </ComicPanel>
                ) : (
                  <TabCapitulos
                    chapters={chapters}
                    sourceId={sourceId}
                    readChapterIds={readChapterIds}
                    onToggleRead={handleToggleRead}
                    onDownloadRequest={handleDownloadRequest}
                  />
                )}
              </TabsContent>

              <TabsContent value="conversoes" className="mt-4 animate-fade-in min-h-[420px]">
                <TabConversoes sourceId={sourceId} seriesTitle={seriesTitle} />
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
