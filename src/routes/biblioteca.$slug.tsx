import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { MockPage } from "@/components/comic/MockPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { toast, Toaster } from "sonner";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Download, Mail, Trash2 } from "lucide-react";

export const Route = createFileRoute("/biblioteca/$slug")({
  component: () => (
    <RequireAuth>
      <SeriesPage />
    </RequireAuth>
  ),
});

function SeriesPage() {
  const { slug } = Route.useParams();
  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  const files = Array.from({ length: 8 }, (_, i) => ({
    name: `${slug}-vol-${String(i + 1).padStart(2, "0")}.epub`,
    bytes: 8 * 1024 * 1024 + i * 1024 * 1024,
    when: `${i + 1}d atrás`,
    format: "EPUB",
    sent: i < 3,
  }));

  const [readerOpen, setReaderOpen] = useState(false);
  const [readerFile, setReaderFile] = useState("");
  const [readerPage, setReaderPage] = useState(0);
  const totalPages = 18;

  const openReader = (fileName: string) => {
    setReaderFile(fileName);
    setReaderPage(0);
    setReaderOpen(true);
  };

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

        <div className="flex items-end gap-5 mb-8">
          <div
            className="h-36 w-24 border-[3px] border-ink rounded shadow-comic-sm shrink-0"
            style={{ background: `hsl(${(slug.length * 37) % 360} 70% 55%)` }}
          />
          <div>
            <h1 className="font-display text-4xl uppercase leading-none">{title}</h1>
            <p className="text-sm font-medium opacity-80 mt-2">
              {files.length} arquivos • {(files.reduce((a, f) => a + f.bytes, 0) / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
        </div>

        <ComicPanel bg="card" padding="md">
          <ul className="divide-y-2 divide-dashed divide-ink/30">
            {files.map((f) => (
              <li key={f.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base truncate">{f.name}</p>
                  <p className="text-xs font-medium opacity-70">
                    {f.format} • {(f.bytes / 1024 / 1024).toFixed(1)} MB • {f.when}
                    {f.sent && <span className="ml-2 text-comic-red">• já enviado</span>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openReader(f.name)}
                    className="border-[2.5px] border-ink shadow-comic-sm font-display"
                  >
                    <BookOpen className="h-4 w-4 mr-1" /> Ler
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.success(`Reenviando ${f.name} (mock)`)}
                    className="border-[2.5px] border-ink shadow-comic-sm font-display"
                  >
                    <Mail className="h-4 w-4 mr-1" /> Enviar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.success("Download iniciado (mock)")}
                    className="border-[2.5px] border-ink shadow-comic-sm font-display"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast("Arquivo apagado (mock)")}
                    className="border-[2.5px] border-ink shadow-comic-sm font-display"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </ComicPanel>

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
    </div>
  );
}
