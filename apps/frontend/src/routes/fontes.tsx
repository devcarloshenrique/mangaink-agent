import { createFileRoute } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { SuggestSourceForm } from "@/components/fontes/SuggestSourceForm";
import { Sparkles, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { authGuard } from "./-authGuard";

export const Route = createFileRoute("/fontes")({
  beforeLoad: authGuard,
  component: FontesPage,
});

type SourceStatus = "active" | "slow" | "beta" | "offline" | "soon";

interface Source {
  id: string;
  name: string;
  status: SourceStatus;
  description: string;
  urlExample: string;
  homepage: string;
  hue: number;
  latency?: number;
  uptime?: number;
}

const SOURCES: Source[] = [
  {
    id: "mangadex",
    name: "MangaDex",
    status: "active",
    description: "Catálogo enorme com tradução comunitária em vários idiomas. API oficial.",
    urlExample: "https://mangadex.org/title/<id>/<slug>",
    homepage: "https://mangadex.org",
    hue: 200,
    latency: 120,
    uptime: 99.8,
  },
  {
    id: "mangalivre",
    name: "MangaLivre",
    status: "slow",
    description: "Scraping da Mangá Livre (PT-BR). Funciona pra maioria das obras populares.",
    urlExample: "https://mangalivre.net/manga/<slug>",
    homepage: "https://mangalivre.net",
    hue: 15,
    latency: 850,
    uptime: 94.2,
  },
  {
    id: "mangasee",
    name: "MangaSee",
    status: "active",
    description: "Biblioteca vasta em inglês. Imagens de alta qualidade e download direto.",
    urlExample: "https://mangasee123.com/manga/<slug>",
    homepage: "https://mangasee123.com",
    hue: 140,
    latency: 200,
    uptime: 98.5,
  },
  {
    id: "mangakakalot",
    name: "MangaKakalot",
    status: "beta",
    description: "Um dos maiores agregadores. Scraping em fase de testes.",
    urlExample: "https://mangakakalot.com/manga/<slug>",
    homepage: "https://mangakakalot.com",
    hue: 320,
    latency: 450,
    uptime: 91.0,
  },
  {
    id: "mangapark",
    name: "MangaPark",
    status: "active",
    description: "Interface limpa, múltiplos scanlators. Bom pra obras em inglês.",
    urlExample: "https://mangapark.net/title/<id>/<slug>",
    homepage: "https://mangapark.net",
    hue: 60,
    latency: 180,
    uptime: 97.3,
  },
  {
    id: "comick",
    name: "ComicK",
    status: "active",
    description: "Agregador com foco em qualidade. API semi-pública disponível.",
    urlExample: "https://comick.io/comic/<slug>",
    homepage: "https://comick.io",
    hue: 270,
    latency: 150,
    uptime: 99.1,
  },
  {
    id: "guya",
    name: "Guya",
    status: "offline",
    description: "Específico para obras do tipo 4-koma e doujinshi. Temporariamente offline.",
    urlExample: "https://guya.moe/read/manga/<slug>",
    homepage: "https://guya.moe",
    hue: 180,
    latency: undefined,
    uptime: 0,
  },
  {
    id: "mangaplus",
    name: "MangaPlus (Shueisha)",
    status: "soon",
    description: "Fonte oficial da Shueisha. Em homologação — suporte parcial em breve.",
    urlExample: "https://mangaplus.shueisha.co.jp/titles/<id>",
    homepage: "https://mangaplus.shueisha.co.jp",
    hue: 0,
    latency: undefined,
    uptime: undefined,
  },
];

const STATUS_CONFIG: Record<SourceStatus, { label: string; color: string; dot: string }> = {
  active: { label: "online", color: "text-comic-blue", dot: "bg-comic-blue" },
  slow: { label: "lento", color: "text-comic-yellow", dot: "bg-comic-yellow" },
  beta: { label: "beta", color: "text-comic-yellow", dot: "bg-comic-yellow" },
  offline: { label: "offline", color: "text-comic-red", dot: "bg-comic-red" },
  soon: { label: "em breve", color: "opacity-60", dot: "bg-muted-foreground" },
};

function StatusIndicator({ status }: { status: SourceStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full border border-ink shrink-0",
          config.dot,
          status === "active" && "animate-pulse",
          status === "slow" && "animate-pulse",
        )}
      />
      <span className={cn("font-display text-xs", config.color)}>
        {config.label}
        {status === "active" && " ✓"}
        {status === "slow" && " ⚠"}
        {status === "offline" && " ✗"}
      </span>
    </div>
  );
}

function FontesPage() {
  return (
    <div className="min-h-screen bg-background">
      <ComicHeader />
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-lg border-[3px] border-ink bg-comic-yellow flex items-center justify-center shadow-comic-sm">
            <Sparkles />
          </div>
          <div>
            <h1 className="font-display text-4xl uppercase leading-none">Fontes homologadas</h1>
            <p className="text-sm font-medium opacity-80 mt-1">
              Os sites que o Mangaink sabe ler.
            </p>
          </div>
        </div>

        <SpeechBubble variant="blue" tail="left" className="max-w-md">
          Status atualizado em tempo real (mock). Mais fontes em breve!
        </SpeechBubble>

        <div className="grid gap-5 md:grid-cols-2">
          {SOURCES.map((s, i) => (
            <ComicPanel key={s.id} bg="card" padding="md" tilt={i % 2 === 0 ? "left" : "right"}>
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="h-12 w-12 rounded-lg border-[3px] border-ink shrink-0 shadow-comic-sm"
                  style={{ background: `hsl(${s.hue} 75% 55%)` }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display text-2xl leading-none">{s.name}</h2>
                    <StatusIndicator status={s.status} />
                  </div>
                  {s.latency !== undefined && (
                    <p className="text-[10px] font-medium opacity-50 mt-0.5">
                      {s.latency}ms • {s.uptime}% uptime
                    </p>
                  )}
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

        <SuggestSourceForm />
      </div>
    </div>
  );
}
