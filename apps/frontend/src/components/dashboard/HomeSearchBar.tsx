import { useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { LanguageSelectorPopover } from "./LanguageSelectorPopover";
import { SearchFilterDrawer } from "./SearchFilterDrawer";
import {
  DEFAULT_FILTERS,
  MOCK_PROVIDERS_CATALOG,
  SearchFilters,
  SearchLanguage,
} from "./search-filter.types";

export interface HomeSearchBarProps {
  query: string;
  onChange: (value: string) => void;
  isFetching: boolean;
  filters?: SearchFilters;
  onFiltersChange?: (filters: SearchFilters) => void;
  availableProviders?: Array<{ slug: string; name: string; engine?: string; tags?: string[] }>;
}

export function HomeSearchBar({
  query,
  onChange,
  isFetching,
  filters,
  onFiltersChange,
  availableProviders,
}: HomeSearchBarProps) {
  const [internalFilters, setInternalFilters] = useState<SearchFilters>(DEFAULT_FILTERS);

  const activeFilters = filters ?? internalFilters;

  const handleFiltersChange = (updated: SearchFilters) => {
    setInternalFilters(updated);
    onFiltersChange?.(updated);
  };

  const handleLanguageChange = (lang: SearchLanguage) => {
    handleFiltersChange({
      ...activeFilters,
      language: lang,
    });
  };

  const totalProvidersCount =
    availableProviders && availableProviders.length > 0
      ? availableProviders.length
      : MOCK_PROVIDERS_CATALOG.length;

  const enginesRestricted = activeFilters.engines && activeFilters.engines.length < 3 ? 1 : 0;
  const providersRestricted =
    activeFilters.providers && activeFilters.providers.length < totalProvidersCount ? 1 : 0;

  const activeFilterCount =
    activeFilters.workTypes.length + enginesRestricted + providersRestricted;

  return (
    <section aria-label="Buscar mangá" className="w-full">
      <div className="flex items-stretch gap-2.5">
        {/* Input unificado com segmento integrado de idioma */}
        <div className="relative flex flex-1 items-center h-11 rounded-md border-[3px] border-ink bg-background transition-colors focus-within:border-comic-blue">
          <Search className="pointer-events-none absolute left-3.5 h-5 w-5 text-ink/70" />
          <input
            type="text"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) onChange("");
            }}
            placeholder="Buscar mangá — ex.: one piece"
            aria-label="Buscar mangá"
            className="h-full w-full bg-transparent pl-11 pr-2 text-sm font-medium text-ink placeholder:text-muted-foreground focus:outline-none"
          />

          {/* Loader e botão de limpar */}
          <div className="flex items-center gap-1.5 pr-2 shrink-0">
            {isFetching && <Loader2 className="h-4 w-4 animate-spin opacity-70 text-ink" />}
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => onChange("")}
                aria-label="Limpar busca"
                title="Limpar busca"
                className="grid h-5 w-5 place-items-center rounded-full border border-ink/40 bg-card text-ink opacity-70 transition hover:opacity-100 hover:border-ink cursor-pointer"
              >
                <X className="h-3 w-3 stroke-[3]" />
              </button>
            )}
          </div>

          {/* Divisória vertical elegante */}
          <div className="h-6 w-[2px] bg-ink/20 shrink-0" aria-hidden="true" />

          {/* Segmento integrado de idioma como parte nativa do input */}
          <div className="h-full shrink-0 flex items-stretch">
            <LanguageSelectorPopover
              value={activeFilters.language}
              onChange={handleLanguageChange}
            />
          </div>
        </div>

        {/* Botão Filtro fora do input */}
        <SearchFilterDrawer
          filters={activeFilters}
          onChange={handleFiltersChange}
          availableProviders={availableProviders}
          activeFilterCount={activeFilterCount}
        />
      </div>
    </section>
  );
}
