import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { useChapterPages } from "@/hooks/useChapterPages";
import { useChapterDownload } from "@/hooks/useChapterDownload";
import { ReaderToolbar } from "@/components/reader/ReaderToolbar";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { Button } from "@/components/ui/button";

interface ChapterReaderProps {
  sourceId: string;
  chapterId: string;
  mangaMode?: boolean;
  cached?: boolean;
  cachedTotalPages?: number;
  estimatedTotalPages?: number;
  onRetry?: () => void;
}

export function ChapterReader({
  sourceId,
  chapterId,
  mangaMode = false,
  cached = false,
  cachedTotalPages,
  estimatedTotalPages,
  onRetry,
}: ChapterReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  const {
    status: downloadStatus,
    totalImages: sseTotal,
    downloadedImages,
    progress,
  } = useChapterDownload(sourceId, chapterId, !cached);

  // Para capítulos nao cacheados, prioriza o total via SSE.
  // Se o SSE ainda nao reportou, usa o estimatedTotalPages como fallback.
  // Se nenhum dos dois está disponivel, assume 1 pagina otimisticamente
  // para que o leitor exiba a primeira imagem via proxy imediatamente.
  // O poll/SSE atualiza o total real assim que disponivel.
  const effectiveTotal = cached
    ? (cachedTotalPages ?? estimatedTotalPages ?? 0)
    : sseTotal > 0
      ? sseTotal
      : estimatedTotalPages != null
        ? estimatedTotalPages
        : 1;

  const pageUrls = useChapterPages(sourceId, chapterId, effectiveTotal);

  useEffect(() => {
    setCurrentPage(0);
    setFailedImages(new Set());
  }, [sourceId, chapterId]);

  const goNext = useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, Math.max(0, effectiveTotal - 1)));
  }, [effectiveTotal]);

  const goPrev = useCallback(() => {
    setCurrentPage((p) => Math.max(p - 1, 0));
  }, []);

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

  const isDownloading =
    !cached && sseTotal > 0 && downloadStatus !== "ready" && downloadStatus !== "failed";
  const hasDownloadFailed = !cached && downloadStatus === "failed";

  // Sem total de paginas = aguardando metadados ou manifest
  if (effectiveTotal === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <ComicPanel bg="yellow" padding="md">
          <p className="text-center font-display text-lg">Carregando...</p>
        </ComicPanel>
        {hasDownloadFailed && (
          <p className="text-sm text-muted-foreground">
            Nao foi possivel carregar as paginas deste capitulo.
          </p>
        )}
        {hasDownloadFailed && onRetry && (
          <Button
            onClick={onRetry}
            className="border-[2px] border-ink bg-comic-yellow shadow-comic-sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  const isLoadingPage = pageUrls.length > 0 && currentPage < pageUrls.length;

  return (
    <div className="flex flex-col items-center">
      {/* Barra de progresso sobreposta — visivel apenas durante download */}
      {isDownloading && (
        <div className="w-full max-w-3xl mb-4">
          <ComicPanel bg="yellow" padding="sm">
            <p className="text-center font-display text-sm mb-2">Baixando paginas...</p>
            <div className="w-full h-3 border-[2px] border-ink rounded-full bg-card overflow-hidden">
              <div
                className="h-full bg-comic-red transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-xs mt-1 text-muted-foreground">
              {downloadedImages} de {sseTotal > 0 ? sseTotal : "?"} paginas
            </p>
          </ComicPanel>
        </div>
      )}

      {/* Aviso de erro no download — nao bloqueia a galeria (proxy funciona) */}
      {hasDownloadFailed && (
        <div className="w-full max-w-3xl mb-4">
          <ComicPanel bg="red" padding="sm">
            <p className="text-center text-sm">
              Erro ao baixar o capitulo em segundo plano. As imagens estao sendo carregadas via
              proxy.
            </p>
          </ComicPanel>
          {onRetry && (
            <div className="flex justify-center mt-2">
              <Button
                onClick={onRetry}
                size="sm"
                className="border-[2px] border-ink bg-comic-yellow shadow-comic-sm text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 my-4">
        <Button
          variant="outline"
          size="icon"
          onClick={mangaMode ? goNext : goPrev}
          disabled={currentPage <= 0}
          className="border-[2px] border-ink shadow-comic-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={mangaMode ? goPrev : goNext}
          disabled={currentPage >= effectiveTotal - 1}
          className="border-[2px] border-ink shadow-comic-sm"
        >
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="w-full max-w-3xl bg-[#2a2a2a] rounded-lg overflow-hidden border-[3px] border-ink shadow-comic">
        {isLoadingPage && !failedImages.has(currentPage) ? (
          <img
            src={pageUrls[currentPage]}
            alt={`Pagina ${currentPage + 1}`}
            className="w-full h-auto object-contain max-h-[70vh]"
            loading="lazy"
            onError={() => handleImageError(currentPage)}
          />
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground font-display text-lg">Pagina indisponivel</p>
          </div>
        )}
      </div>

      {effectiveTotal > 0 && (
        <ReaderToolbar currentPage={currentPage} totalPages={effectiveTotal} />
      )}
    </div>
  );
}
