import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { Toaster } from "sonner";
import { ArrowLeft } from "lucide-react";
import { MangaCover } from "@/components/biblioteca/MangaCover";
import { ReadButton } from "@/components/biblioteca/ReadButton";
import { FavoriteButton } from "@/components/biblioteca/FavoriteButton";
import { TabDetalhes } from "@/components/biblioteca/TabDetalhes";
import { TabCapitulos } from "@/components/biblioteca/TabCapitulos";
import { TabConversoes } from "@/components/biblioteca/TabConversoes";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MOCK_MANGA_DETAILS, MOCK_CACHED_CHAPTERS } from "@/lib/manga-detail-mocks";

export const Route = createFileRoute("/biblioteca/$sourceId")({
  component: MangaDetailPage,
});

function MangaDetailPage() {
  const { sourceId } = Route.useParams();

  const [isFavorite, setIsFavorite] = useState(false);
  const [readingProgress] = useState<{ chapterNumber: string } | null>(null);

  const seriesTitle = MOCK_MANGA_DETAILS.title;
  const chapterCount = MOCK_CACHED_CHAPTERS.length;

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
                <TabDetalhes details={MOCK_MANGA_DETAILS} />
              </TabsContent>

              <TabsContent value="capitulos" className="mt-4 animate-slide-up min-h-[420px]">
                <TabCapitulos chapters={MOCK_CACHED_CHAPTERS} />
              </TabsContent>

              <TabsContent value="conversoes" className="mt-4 animate-slide-up min-h-[420px]">
                <TabConversoes sourceId={sourceId} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
