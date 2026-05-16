import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Library, FileText, LayoutGrid, List } from "lucide-react";

export const Route = createFileRoute("/biblioteca")({
  component: () => (
    <RequireAuth>
      <BibliotecaPage />
    </RequireAuth>
  ),
});

const SERIES = [
  { slug: "berserk", title: "Berserk", files: 12, hue: 0, lastConverted: "há 2h" },
  { slug: "vagabond", title: "Vagabond", files: 9, hue: 35, lastConverted: "ontem" },
  { slug: "one-piece", title: "One Piece", files: 47, hue: 200, lastConverted: "3 dias" },
  { slug: "vinland-saga", title: "Vinland Saga", files: 8, hue: 140, lastConverted: "há 5h" },
  { slug: "chainsaw-man", title: "Chainsaw Man", files: 11, hue: 15, lastConverted: "ontem" },
  { slug: "monster", title: "Monster", files: 18, hue: 280, lastConverted: "1 semana" },
];

function BibliotecaPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <div className="min-h-screen bg-background">
      <ComicHeader />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-lg border-[3px] border-ink bg-comic-yellow flex items-center justify-center shadow-comic-sm">
            <Library />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-4xl uppercase leading-none">Biblioteca</h1>
            <p className="text-sm font-medium opacity-80 mt-1">
              Arquivos salvos em <code>/data/library/&lt;obra&gt;/</code>
            </p>
          </div>
          <div className="flex border-[3px] border-ink rounded-md overflow-hidden shadow-comic-sm">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-colors ${viewMode === "grid" ? "bg-comic-red text-primary-foreground" : "bg-card hover:bg-muted"}`}
              title="Visualização em grade"
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors border-l-[3px] border-ink ${viewMode === "list" ? "bg-comic-red text-primary-foreground" : "bg-card hover:bg-muted"}`}
              title="Visualização em lista"
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>

        <SpeechBubble variant="yellow" tail="left" className="mb-6 max-w-md">
          {SERIES.length} obras na sua estante. Bem servido, hein?
        </SpeechBubble>

        {viewMode === "grid" ? (
          <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {SERIES.map((s, i) => (
              <Link key={s.slug} to="/biblioteca/$slug" params={{ slug: s.slug }} className="group">
                <ComicPanel
                  bg="card"
                  padding="sm"
                  tilt={i % 2 === 0 ? "left" : "right"}
                  className="transition-transform group-hover:-translate-y-1"
                >
                  <div
                    className="aspect-[2/3] border-[3px] border-ink rounded mb-2 flex items-end p-2 shadow-comic-sm"
                    style={{ background: `hsl(${s.hue} 70% 55%)` }}
                  >
                    <div className="bg-comic-yellow border-[2.5px] border-ink px-1.5 py-0.5 font-display text-xs">
                      {s.title}
                    </div>
                  </div>
                  <p className="font-display text-base truncate">{s.title}</p>
                  <p className="text-xs font-medium opacity-70 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> {s.files} arquivos
                  </p>
                </ComicPanel>
              </Link>
            ))}
          </div>
        ) : (
          <ComicPanel bg="card" padding="md">
            <div className="space-y-0">
              {SERIES.map((s, i) => (
                <Link
                  key={s.slug}
                  to="/biblioteca/$slug"
                  params={{ slug: s.slug }}
                  className={`flex items-center gap-4 py-3 border-b-2 border-dashed border-ink/30 last:border-0 last:pb-0 ${i === 0 ? "pt-0" : ""} hover:bg-muted/50 rounded transition-colors -mx-2 px-2`}
                >
                  <div
                    className="h-16 w-12 shrink-0 border-[3px] border-ink rounded shadow-comic-sm"
                    style={{ background: `hsl(${s.hue} 70% 55%)` }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-xl leading-none truncate">{s.title}</p>
                    <p className="text-xs font-medium opacity-70 mt-1">
                      <FileText className="h-3 w-3 inline mr-1" />
                      {s.files} arquivos
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium opacity-70">Última conversão</p>
                    <p className="font-display text-sm">{s.lastConverted}</p>
                  </div>
                </Link>
              ))}
            </div>
          </ComicPanel>
        )}
      </div>
    </div>
  );
}
