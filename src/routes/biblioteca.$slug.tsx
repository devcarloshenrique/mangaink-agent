import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { MockPage } from "@/components/comic/MockPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useBiblioteca } from "@/hooks/useBiblioteca";
import { RenameSeriesDialog } from "@/components/biblioteca/RenameSeriesDialog";
import { DeleteConfirmDialog } from "@/components/biblioteca/DeleteConfirmDialog";
import { ReconvertDialog } from "@/components/biblioteca/ReconvertDialog";
import { toast, Toaster } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  Pencil,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversionStatus } from "@/lib/biblioteca-data";

export const Route = createFileRoute("/biblioteca/$slug")({
  component: SeriesPage,
});

function statusLabel(s: ConversionStatus): string {
  const map: Record<ConversionStatus, string> = {
    completed: "Concluído",
    pending: "Pendente",
    error: "Erro",
    converting: "Convertendo",
  };
  return map[s];
}

function statusColor(s: ConversionStatus): string {
  const map: Record<ConversionStatus, string> = {
    completed: "bg-comic-blue",
    pending: "bg-comic-yellow",
    error: "bg-comic-red",
    converting: "bg-comic-blue animate-pulse",
  };
  return map[s];
}

function SeriesPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const {
    getSeriesBySlug,
    renameSeries,
    deleteSeries,
    toggleFavorite,
    reconvertFile,
    reconvertChapters,
    deleteFile,
  } = useBiblioteca();

  const series = getSeriesBySlug(slug);

  // Dialog state
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteSeriesOpen, setDeleteSeriesOpen] = useState(false);
  const [reconvertOpen, setReconvertOpen] = useState(false);

  // Reader state
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerFile, setReaderFile] = useState("");
  const [readerPage, setReaderPage] = useState(0);
  const totalPages = 18;

  const openReader = (fileName: string) => {
    setReaderFile(fileName);
    setReaderPage(0);
    setReaderOpen(true);
  };

  // Rename
  const handleRename = (newTitle: string) => {
    if (!series) return;
    const newSlug = renameSeries(series.slug, newTitle);
    toast.success(`Série renomeada para "${newTitle}"`);
    setRenameOpen(false);
    navigate({ to: "/biblioteca/$slug", params: { slug: newSlug } });
  };

  // Delete series
  const handleDeleteSeries = () => {
    if (!series) return;
    deleteSeries(series.slug);
    toast.success(`"${series.title}" foi excluída`);
    setDeleteSeriesOpen(false);
    navigate({ to: "/biblioteca" });
  };

  // Delete file
  const handleDeleteFile = (fileId: string, fileName: string) => {
    if (!series) return;
    deleteFile(series.slug, fileId);
    toast.success(`"${fileName}" foi excluído`);
  };

  // Reconvert
  const handleReconvertFile = (fileId: string) => {
    if (!series) return;
    reconvertFile(series.slug, fileId);
    toast.success("Reconvertendo volume... (mock)");
    setReconvertOpen(false);
  };

  const handleReconvertChapters = (fileId: string, chapterIds: string[]) => {
    if (!series) return;
    reconvertChapters(series.slug, fileId, chapterIds);
    toast.success(`Reconvertendo ${chapterIds.length} capítulo(s)... (mock)`);
    setReconvertOpen(false);
  };

  // Not found
  if (!series) {
    return (
      <div className="min-h-screen bg-background">
        <ComicHeader />
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h1 className="font-display text-4xl uppercase mb-4">Série não encontrada</h1>
          <p className="text-sm font-medium opacity-70 mb-6">
            Essa obra pode ter sido excluída ou o link está incorreto.
          </p>
          <Link
            to="/biblioteca"
            className="inline-flex items-center gap-1 font-display text-lg border-[3px] border-ink bg-comic-yellow px-4 py-2 rounded-md shadow-comic-sm hover:-translate-y-0.5 transition-transform"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para a biblioteca
          </Link>
        </div>
      </div>
    );
  }

  const totalMB = series.files.reduce((a, f) => a + f.bytes, 0) / 1024 / 1024;

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <ComicHeader />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link
          to="/biblioteca"
          className="inline-flex items-center gap-1 font-display text-sm mb-4 underline underline-offset-4 hover:text-comic-red"
        >
          <ArrowLeft className="h-4 w-4" /> Biblioteca
        </Link>

        {/* Header */}
        <div className="flex items-start gap-5 mb-8 flex-wrap">
          <div
            className="h-36 w-24 border-[3px] border-ink rounded shadow-comic-sm shrink-0"
            style={{ background: `hsl(${series.hue} 70% 55%)` }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-4xl uppercase leading-none">{series.title}</h1>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleFavorite(series.slug)}
                className={cn(
                  "border-[2.5px] border-ink shadow-comic-sm h-8 w-8 p-0",
                  series.favorite && "bg-comic-yellow",
                )}
                title={series.favorite ? "Desfavoritar" : "Favoritar"}
              >
                <Star className={cn("h-4 w-4", series.favorite && "fill-current")} />
              </Button>
            </div>
            <p className="text-sm font-medium opacity-70 mt-1">{series.author}</p>
            <p className="text-sm font-medium opacity-80 mt-1">
              {series.files.length} arquivos • {totalMB.toFixed(1)} MB
            </p>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRenameOpen(true)}
                className="border-[2.5px] border-ink shadow-comic-sm font-display"
              >
                <Pencil className="h-3.5 w-3.5 mr-1" /> Renomear
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReconvertOpen(true)}
                className="border-[2.5px] border-ink shadow-comic-sm font-display"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reconverter
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeleteSeriesOpen(true)}
                className="border-[2.5px] border-ink shadow-comic-sm font-display text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir série
              </Button>
            </div>
          </div>
        </div>

        {/* Files list */}
        <ComicPanel bg="card" padding="md">
          <h2 className="font-display text-2xl mb-4">Arquivos</h2>
          {series.files.length === 0 ? (
            <p className="text-sm font-medium opacity-70">Nenhum arquivo nesta série.</p>
          ) : (
            <ul className="divide-y-2 divide-dashed divide-ink/30">
              {series.files.map((f) => (
                <li key={f.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div
                      className={cn(
                        "h-3 w-3 rounded-full border-2 border-ink shrink-0",
                        statusColor(f.status),
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-base truncate">{f.name}</p>
                      <p className="text-xs font-medium opacity-70">
                        {f.format} • {(f.bytes / 1024 / 1024).toFixed(1)} MB • {f.when} •{" "}
                        {f.chapters.length} capítulos
                        {f.sent && <span className="ml-1 text-comic-red">• já enviado</span>}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-display border-[2px] border-ink rounded px-1.5 py-0.5 shrink-0",
                        f.status === "completed" && "bg-comic-blue text-accent-foreground",
                        f.status === "pending" && "bg-comic-yellow",
                        f.status === "error" && "bg-comic-red text-primary-foreground",
                        f.status === "converting" &&
                          "bg-comic-blue text-accent-foreground animate-pulse",
                      )}
                    >
                      {statusLabel(f.status)}
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReader(f.name)}
                        className="border-[2.5px] border-ink shadow-comic-sm font-display h-7 px-2"
                      >
                        <BookOpen className="h-3.5 w-3.5 mr-1" /> Ler
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          reconvertFile(series.slug, f.id);
                          toast.success("Reconvertendo volume... (mock)");
                        }}
                        className="border-[2.5px] border-ink shadow-comic-sm font-display h-7 px-2"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toast.success(`Reenviando ${f.name} (mock)`)}
                        className="border-[2.5px] border-ink shadow-comic-sm font-display h-7 px-2"
                      >
                        <Mail className="h-3.5 w-3.5 mr-1" /> Enviar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toast.success("Download iniciado (mock)")}
                        className="border-[2.5px] border-ink shadow-comic-sm font-display h-7 w-7 p-0"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteFile(f.id, f.name)}
                        className="border-[2.5px] border-ink shadow-comic-sm font-display h-7 w-7 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Chapters */}
                  <div className="mt-2 ml-6 space-y-0.5">
                    {f.chapters.map((ch) => (
                      <div
                        key={ch.id}
                        className="flex items-center gap-2 text-xs font-medium py-0.5"
                      >
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full border border-ink shrink-0",
                            statusColor(ch.status),
                          )}
                        />
                        <span className="font-display">Cap. {ch.number}</span>
                        <span className="opacity-70 truncate flex-1">{ch.title}</span>
                        <span className="opacity-50 shrink-0">{statusLabel(ch.status)}</span>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ComicPanel>

        {/* Reader dialog */}
        <Dialog open={readerOpen} onOpenChange={setReaderOpen}>
          <DialogContent className="border-[3px] border-ink shadow-comic-lg max-w-3xl p-0">
            <DialogTitle className="sr-only">Leitor: {readerFile}</DialogTitle>
            <div className="bg-background rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b-[3px] border-ink bg-comic-yellow">
                <p className="font-display text-lg truncate">{readerFile}</p>
                <p className="font-display text-sm">
                  Página {readerPage + 1} de {totalPages}
                </p>
              </div>
              <div className="flex justify-center p-6 bg-zinc-200">
                <MockPage seed={readerPage} width={200} height={280} />
              </div>
              <div className="flex items-center justify-center gap-4 px-4 py-3 border-t-[3px] border-ink bg-card">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReaderPage((p) => Math.max(0, p - 1))}
                  disabled={readerPage === 0}
                  className="border-[2.5px] border-ink shadow-comic-sm font-display"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <span className="font-display text-sm min-w-[4rem] text-center">
                  {readerPage + 1} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReaderPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={readerPage === totalPages - 1}
                  className="border-[2.5px] border-ink shadow-comic-sm font-display"
                >
                  Próximo <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rename dialog */}
      <RenameSeriesDialog
        currentTitle={series.title}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        onConfirm={handleRename}
      />

      {/* Delete series dialog */}
      <DeleteConfirmDialog
        title={series.title}
        open={deleteSeriesOpen}
        onOpenChange={setDeleteSeriesOpen}
        onConfirm={handleDeleteSeries}
      />

      {/* Reconvert dialog */}
      <ReconvertDialog
        series={series}
        open={reconvertOpen}
        onOpenChange={setReconvertOpen}
        onReconvertFile={handleReconvertFile}
        onReconvertChapters={handleReconvertChapters}
      />
    </div>
  );
}
