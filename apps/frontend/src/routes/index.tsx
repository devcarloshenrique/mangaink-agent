import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SpotlightCard } from "@/components/dashboard/SpotlightCard";
import { LibraryCarousel } from "@/components/dashboard/LibraryCarousel";
import { NewChapters } from "@/components/dashboard/NewChapters";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { EmptyHero } from "@/components/dashboard/empty/EmptyHero";
import { ComicEmptyState } from "@/components/dashboard/empty/ComicEmptyState";
import { GuidedTour, type TourStep } from "@/components/onboarding/GuidedTour";
import {
  useConversionsList,
  useActiveConversions,
  consolidateLibraryWithConversions,
} from "@/hooks/useConversions";
import { useLibrary } from "@/hooks/useLibrary";
import { authGuard } from "./-authGuard";
import { HomeSearchBar } from "@/components/dashboard/HomeSearchBar";
import { HomeSearchResults } from "@/components/dashboard/HomeSearchResults";
import { ActiveFilterChips } from "@/components/dashboard/ActiveFilterChips";
import { SearchFilters } from "@/components/dashboard/search-filter.types";
import { useProviderSearch } from "@/hooks/useProviderSearch";
import { useProviders } from "@/hooks/useProviders";
import {
  applySearchFilters,
  getStoredKnownProviders,
  hasStoredFilters,
  loadSearchFilters,
  reconcileProviders,
  resolveEffectiveProviders,
  saveSearchFilters,
} from "@/lib/search-filters";

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
];

function Dashboard() {
  const { data: convData, isLoading: convLoading } = useConversionsList({ limit: 100 });
  const { data: activeData } = useActiveConversions();
  const { data: libraryData, isLoading: libraryLoading } = useLibrary();
  const { data: provData } = useProviders();
  const providers = useMemo(() => provData?.providers ?? [], [provData?.providers]);
  const [filters, setFilters] = useState<SearchFilters>(() => loadSearchFilters());

  // Marca todos os provedores reais na 1ª visita; com filtros persistidos,
  // reconcilia novos provedores mantendo desativações explícitas do usuário
  const hasInitializedProvidersRef = useRef(false);
  useEffect(() => {
    if (!hasInitializedProvidersRef.current && providers.length > 0) {
      hasInitializedProvidersRef.current = true;
      const realSlugs = providers.map((p) => p.slug);
      setFilters((prev) => {
        const storedKnown = getStoredKnownProviders();
        const updatedProviders = reconcileProviders(prev.providers, realSlugs, storedKnown);
        const updated = {
          ...prev,
          providers: updatedProviders,
        };
        saveSearchFilters(updated, realSlugs);
        return updated;
      });
    }
  }, [providers]);

  // Persistência dos filtros em localStorage (somente após inicializar os provedores reais)
  useEffect(() => {
    if (hasInitializedProvidersRef.current && providers.length > 0) {
      saveSearchFilters(
        filters,
        providers.map((p) => p.slug),
      );
    }
  }, [filters, providers]);
  const effectiveSlugs = useMemo(
    () => resolveEffectiveProviders(filters, providers),
    [filters, providers],
  );
  const {
    query,
    setQuery,
    debouncedQuery,
    data: searchData,
    isFetching: searchFetching,
    error: searchError,
    refetch: refetchSearch,
    loadProviderPage,
  } = useProviderSearch(effectiveSlugs, filters.language);
  const isSearching = query.trim().length >= 2;

  // Aplicação reativa dos filtros no resultado de busca (shape array da API)
  const filteredSearchData = useMemo(
    () => (searchData ? applySearchFilters(searchData, filters, providers) : searchData),
    [searchData, filters, providers],
  );

  const groups = useMemo(() => {
    const allConvs = convData?.items ?? [];
    const activeConvs = activeData?.items ?? [];

    // Mescla as conversões ativas garantindo os dados mais atualizados
    const convMap = new Map<string, (typeof allConvs)[0]>();
    for (const c of allConvs) {
      convMap.set(c.conversionId, c);
    }
    for (const active of activeConvs) {
      convMap.set(active.conversionId, active);
    }

    return consolidateLibraryWithConversions(
      libraryData?.items ?? [],
      Array.from(convMap.values()),
    );
  }, [libraryData?.items, convData?.items, activeData?.items]);

  const isLoading = convLoading || libraryLoading;

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
  if (isSearching) {
    return (
      <div className="flex-1 bg-background">
        <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 pb-10">
          <HomeSearchBar
            query={query}
            onChange={setQuery}
            isFetching={searchFetching}
            filters={filters}
            onFiltersChange={setFilters}
            availableProviders={providers}
          />
          <ActiveFilterChips filters={filters} onChange={setFilters} providers={providers} />
          <HomeSearchResults
            providers={providers}
            debouncedQuery={debouncedQuery}
            data={filteredSearchData}
            isFetching={searchFetching}
            error={searchError}
            refetch={refetchSearch}
            onLoadMore={loadProviderPage}
          />
        </main>
      </div>
    );
  }

  // Se a biblioteca estiver vazia, exibe visão de onboarding + Guided Tour com persistência
  if (groups.length === 0) {
    return (
      <div className="flex-1 bg-background">
        <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 pb-10">
          <HomeSearchBar
            query={query}
            onChange={setQuery}
            isFetching={searchFetching}
            filters={filters}
            onFiltersChange={setFilters}
            availableProviders={providers}
          />

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

          {/* Novos capítulos */}
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
        </main>

        {/* Guided tour automático na primeira visita */}
        <GuidedTour steps={ONBOARDING_STEPS} storageKey="mangaink.onboarding.dashboard.seen" />
      </div>
    );
  }

  // Visão completa com dados reais no Banner e Biblioteca + Mocks em Novos Capítulos
  return (
    <div className="flex-1 bg-background">
      <main className="mx-auto max-w-6xl space-y-10 px-4 py-6 pb-12">
        <HomeSearchBar
          query={query}
          onChange={setQuery}
          isFetching={searchFetching}
          filters={filters}
          onFiltersChange={setFilters}
          availableProviders={providers}
        />

        <SpotlightCard items={groups} />

        {/* Biblioteca — todas as obras da coleção na estante */}
        <LibraryCarousel items={groups} />

        {/* Novos capítulos das assinaturas em prateleira horizontal */}
        <NewChapters />
      </main>
    </div>
  );
}
