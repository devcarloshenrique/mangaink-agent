import { createFileRoute } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Sparkles, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fontes")({
  component: () => (
    <RequireAuth>
      <FontesPage />
    </RequireAuth>
  ),
});

const SOURCES = [
  {
    id: "mangadex",
    name: "MangaDex",
    status: "active" as const,
    description: "Catálogo enorme com tradução comunitária em vários idiomas. API oficial.",
    urlExample: "https://mangadex.org/title/<id>/<slug>",
    homepage: "https://mangadex.org",
    hue: 200,
  },
  {
    id: "mangalivre",
    name: "MangaLivre",
    status: "beta" as const,
    description: "Scraping da Mangá Livre (PT-BR). Funciona pra maioria das obras populares.",
    urlExample: "https://mangalivre.net/manga/<slug>",
    homepage: "https://mangalivre.net",
    hue: 15,
  },
];

const STATUS_STYLE: Record<string, string> = {
  active: "bg-comic-blue text-accent-foreground",
  beta: "bg-comic-yellow text-secondary-foreground",
  soon: "bg-card",
};
const STATUS_LABEL: Record<string, string> = {
  active: "✅ ativo",
  beta: "🚧 beta",
  soon: "⏳ em breve",
};

function FontesPage() {
  return (
    <div className="min-h-screen bg-background">
      <ComicHeader />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-lg border-[3px] border-ink bg-comic-yellow flex items-center justify-center shadow-comic-sm">
            <Sparkles />
          </div>
          <div>
            <h1 className="font-display text-4xl uppercase leading-none">Fontes homologadas</h1>
            <p className="text-sm font-medium opacity-80 mt-1">Os sites que o MangaForge sabe ler.</p>
          </div>
        </div>

        <SpeechBubble variant="blue" tail="left" className="mb-6 max-w-md">
          Mais fontes em breve! Sugestão? Abre uma issue.
        </SpeechBubble>

        <div className="grid gap-5 md:grid-cols-2">
          {SOURCES.map((s, i) => (
            <ComicPanel
              key={s.id}
              bg="card"
              padding="md"
              tilt={i % 2 === 0 ? "left" : "right"}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="h-12 w-12 rounded-lg border-[3px] border-ink shrink-0 shadow-comic-sm"
                  style={{ background: `hsl(${s.hue} 75% 55%)` }}
                />
                <div className="flex-1 min-w-0">
                  <h2 className="font-display text-2xl leading-none">{s.name}</h2>
                  <span
                    className={cn(
                      "inline-block mt-1 font-display text-xs border-[2.5px] border-ink shadow-comic-sm px-2 py-0.5 rounded",
                      STATUS_STYLE[s.status],
                    )}
                  >
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>
              </div>
              <p className="text-sm font-medium mb-3">{s.description}</p>
              <code className="block text-xs bg-muted border-[2px] border-ink rounded px-2 py-1 mb-3 truncate">
                {s.urlExample}
              </code>
              <a
                href={s.homepage}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-display text-sm underline underline-offset-4 hover:text-comic-red"
              >
                Abrir site <ExternalLink className="h-3 w-3" />
              </a>
            </ComicPanel>
          ))}
        </div>
      </div>
    </div>
  );
}
