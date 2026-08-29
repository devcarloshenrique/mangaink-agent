import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SpotlightCard } from "@/components/dashboard/SpotlightCard";
import { LibraryCarousel } from "@/components/dashboard/LibraryCarousel";
import { NewChapters } from "@/components/dashboard/NewChapters";
import { OngoingConversions } from "@/components/dashboard/OngoingConversions";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { EmptyHero } from "@/components/dashboard/empty/EmptyHero";
import { ComicEmptyState } from "@/components/dashboard/empty/ComicEmptyState";
import { GuidedTour, type TourStep } from "@/components/onboarding/GuidedTour";
import { useConversionsList, groupConversionsBySource } from "@/hooks/useConversions";
import { authGuard } from "./-authGuard";

export const Route = createFileRoute("/")({
  beforeLoad: authGuard,
  component: Dashboard,
});

const ONBOARDING_STEPS: TourStep[] = [
  {
    element: "[data-tour='hero']",
    title: "Este é o seu painel",
    description:
      "Tudo o que importa fica aqui: o que você está lendo, suas conversões e novidades das assinaturas.",
  },
  {
    element: "[data-tour='cta-converter']",
    title: "Comece por aqui",
    description:
      "O wizard converte qualquer mangá de um site homologado pro seu Kindle em 5 passos simples.",
  },
  {
    element: "[data-tour='biblioteca']",
    title: "Sua biblioteca",
    description:
      "Cada obra convertida vira um card aqui, com capa, descrição e acesso rápido aos arquivos.",
  },
  {
    element: "[data-tour='novos-capitulos']",
    title: "Novos capítulos",
    description:
      "Assine suas obras favoritas e os capítulos novos aparecem nesta lista assim que saem.",
  },
  {
    element: "[data-tour='conversoes']",
    title: "Conversões em andamento",
    description:
      "Quando você iniciar uma conversão, o progresso aparece aqui em tempo real — baixando, convertendo e enviando.",
  },
];

function Dashboard() {
  const { data: convData, isLoading } = useConversionsList({ limit: 100 });
  const groups = useMemo(() => groupConversionsBySource(convData?.items ?? []), [convData?.items]);

  if (isLoading) {
    return (
      <div className="flex-1 bg-background">
        <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 pb-10">
          <div className="h-[340px] animate-pulse rounded-xl border-[3px] border-ink bg-card shadow-comic" />
          <div className="h-60 animate-pulse rounded-xl border-[3px] border-ink bg-card shadow-comic" />
        </main>
      </div>
    );
  }

  // Se a biblioteca estiver vazia, exibe visão de onboarding + Guided Tour com persistência
  if (groups.length === 0) {
    return (
      <div className="flex-1 bg-background">
        <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 pb-10">
          {/* Hero de boas-vindas */}
          <EmptyHero />

          {/* Biblioteca vazia */}
          <section data-tour="biblioteca" aria-label="Sua biblioteca">
            <h2 className="mb-3 font-display text-2xl uppercase leading-none">Sua biblioteca</h2>
            <ComicPanel bg="card" padding="md">
              <ComicEmptyState
                emoji="📚"
                title="Nada por aqui ainda"
                text="Converta seu primeiro mangá e ele aparece aqui, organizado por obra."
                ctaTo="/wizard"
                ctaLabel="Converter agora"
              />
            </ComicPanel>
          </section>

          {/* Novos capítulos + conversões vazias */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div data-tour="novos-capitulos" className="min-w-0">
              <ComicPanel bg="card" padding="md" className="flex h-full flex-col">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-xl uppercase leading-none">Novos capítulos</h3>
                  <span className="text-[11px] font-bold uppercase tracking-wide opacity-60">
                    das suas assinaturas
                  </span>
                </div>
                <ComicEmptyState
                  className="flex-1"
                  emoji="📅"
                  title="Nenhuma assinatura ainda"
                  text="Explore as fontes homologadas e assine obras pra receber capítulos novos automaticamente."
                  ctaTo="/fontes"
                  ctaLabel="Explorar fontes"
                />
              </ComicPanel>
            </div>

            <div data-tour="conversoes" className="min-w-0">
              <ComicPanel bg="card" padding="md" className="flex h-full flex-col">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-xl uppercase leading-none">Conversões</h3>
                </div>
                <ComicEmptyState
                  className="flex-1"
                  emoji="⚡"
                  title="Nada convertendo agora"
                  text="Quando você iniciar uma conversão, o progresso ao vivo aparece aqui."
                  ctaTo="/wizard"
                  ctaLabel="Iniciar conversão"
                />
              </ComicPanel>
            </div>
          </div>
        </main>

        {/* Guided tour automático na primeira visita */}
        <GuidedTour steps={ONBOARDING_STEPS} storageKey="mangaink.onboarding.dashboard.seen" />
      </div>
    );
  }

  // Visão completa com dados reais no Banner e Biblioteca + Mocks em Novos Capítulos e Conversões
  return (
    <div className="flex-1 bg-background">
      <main className="mx-auto max-w-6xl space-y-10 px-4 py-6 pb-12">
        {/* Continuar lendo — Top 5 obras mais recentes */}
        <SpotlightCard items={groups} />

        {/* Biblioteca — todas as obras da coleção na estante */}
        <LibraryCarousel items={groups} />

        {/* Novos capítulos das assinaturas em prateleira horizontal */}
        <NewChapters />

        {/* Conversões em andamento em esteira horizontal de cards */}
        <OngoingConversions />
      </main>
    </div>
  );
}
