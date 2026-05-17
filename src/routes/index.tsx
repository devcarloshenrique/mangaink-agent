import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { OnomatopoeiaBadge } from "@/components/comic/OnomatopoeiaBadge";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, Library, Sparkles, Wand2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: () => (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  ),
});

const TILES = [
  {
    to: "/wizard" as const,
    icon: Wand2,
    title: "Converter",
    text: "Cole uma URL e mande pro Kindle em 5 passos.",
    bg: "bg-comic-red text-primary-foreground",
    badge: "GO!",
    badgeVariant: "yellow" as const,
  },
  {
    to: "/biblioteca" as const,
    icon: Library,
    title: "Biblioteca",
    text: "Tudo o que você já converteu, organizado por obra.",
    bg: "bg-comic-yellow",
    badge: "POW!",
    badgeVariant: "red" as const,
  },
  {
    to: "/agendamentos" as const,
    icon: Calendar,
    title: "Agendamentos",
    text: "Assine obras e receba capítulos novos automaticamente.",
    bg: "bg-comic-blue text-accent-foreground",
    badge: "TIC!",
    badgeVariant: "yellow" as const,
  },
  {
    to: "/fontes" as const,
    icon: Sparkles,
    title: "Fontes",
    text: "Veja os sites homologados pra baixar mangás.",
    bg: "bg-card",
    badge: "INFO",
    badgeVariant: "blue" as const,
  },
];

const RECENT = [
  { title: "Berserk", chapter: "Cap. 374", when: "há 2h" },
  { title: "Vagabond", chapter: "Cap. 327", when: "ontem" },
  { title: "One Piece", chapter: "Cap. 1110", when: "3 dias" },
];

function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <ComicHeader />

      <section className="border-b-[3px] border-ink bg-comic-yellow relative overflow-hidden">
        <div className="absolute inset-0 bg-halftone opacity-25 pointer-events-none" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 md:py-14">
          <SpeechBubble variant="white" tail="bottom" className="max-w-md mb-4">
            Olá, <strong>{user?.username ?? "leitor"}</strong>! O que vamos converter hoje?
          </SpeechBubble>
          <h1 className="font-display text-4xl md:text-6xl uppercase leading-[0.95]">
            Painel
            <span className="inline-block ml-3 bg-comic-red text-primary-foreground px-3 -rotate-2 border-[3px] border-ink shadow-comic">
              MangaForge
            </span>
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TILES.map((t, i) => {
            const Icon = t.icon;
            return (
              <Link key={t.to} to={t.to} className="group relative block focus:outline-none">
                <ComicPanel
                  bg="card"
                  padding="md"
                  tilt={i % 2 === 0 ? "left" : "right"}
                  className={`${t.bg} h-full transition-transform group-hover:-translate-y-1`}
                >
                  <Icon className="h-9 w-9 mb-3" strokeWidth={2.5} />
                  <h3 className="font-display text-2xl">{t.title}</h3>
                  <p className="text-sm font-medium mt-1 opacity-90">{t.text}</p>
                </ComicPanel>
                <div className="absolute -top-3 -right-2">
                  <OnomatopoeiaBadge variant={t.badgeVariant} size="sm">
                    {t.badge}
                  </OnomatopoeiaBadge>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="font-display text-3xl mb-4 uppercase">Últimas conversões</h2>
        <ComicPanel bg="card" padding="md">
          <ul className="divide-y-2 divide-dashed divide-ink/30">
            {RECENT.map((r) => (
              <li
                key={r.title + r.chapter}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-display text-xl leading-none">{r.title}</p>
                  <p className="text-xs font-medium opacity-70 mt-1">
                    {r.chapter} • {r.when}
                  </p>
                </div>
                <Link
                  to="/biblioteca"
                  className="font-display text-sm border-[2.5px] border-ink shadow-comic-sm px-3 py-1 rounded-md bg-comic-yellow hover:-translate-y-0.5 transition-transform"
                >
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        </ComicPanel>
      </section>
    </div>
  );
}
