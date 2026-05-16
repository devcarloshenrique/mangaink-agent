import { createFileRoute, Link } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Download, Mail, Trash2 } from "lucide-react";

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
      </div>
    </div>
  );
}
