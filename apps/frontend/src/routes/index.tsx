import { createFileRoute, Link } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { OnomatopoeiaBadge } from "@/components/comic/OnomatopoeiaBadge";
import { useAuth } from "@/hooks/useAuth";
import { LastReadCard } from "@/components/dashboard/LastReadCard";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { NextScheduleBanner } from "@/components/dashboard/NextScheduleBanner";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { Calendar, Library, Sparkles, Wand2 } from "lucide-react";
import { authGuard } from "./-authGuard";

export const Route = createFileRoute("/")({
  beforeLoad: authGuard,
  component: Dashboard,
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
              Mangaink
            </span>
          </h1>
        </div>
      </section>

      {/* Tiles de navegação */}
      <section className="mx-auto max-w-6xl px-4 pt-8">
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

      {/* Última leitura + próximo agendamento */}
      <section className="mx-auto max-w-6xl px-4 pt-10">
        <h2 className="font-display text-3xl mb-1 uppercase">Continuar lendo</h2>
        <p className="text-sm font-medium opacity-70 mb-4">Retome de onde parou e veja o próximo agendamento.</p>
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LastReadCard />
          </div>
          <div className="flex">
            <NextScheduleBanner />
          </div>
        </div>
      </section>

      {/* Stats animados */}
      <section className="mx-auto max-w-6xl px-4 pt-8">
        <h2 className="font-display text-3xl mb-1 uppercase">Estatísticas</h2>
        <p className="text-sm font-medium opacity-70 mb-4">Visão geral da sua biblioteca e conversões.</p>
        <StatsRow />
      </section>

      {/* Atividade recente */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="font-display text-3xl mb-1 uppercase">Atividade recente</h2>
        <p className="text-sm font-medium opacity-70 mb-4">Últimas conversões, envios e agendamentos.</p>
        <ActivityFeed />
      </section>
    </div>
  );
}
