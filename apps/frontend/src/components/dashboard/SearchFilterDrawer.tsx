import { useState, useMemo } from "react";
import {
  SlidersHorizontal,
  Search,
  X,
  Check,
  RotateCcw,
  Zap,
  Rocket,
  Globe,
  ChevronDown,
} from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EngineBadge } from "@/components/providers/EngineBadge";
import { STATUS_CONFIG, SourceStatus } from "@/components/providers/constants";
import {
  SearchFilters,
  SearchProviderOption,
  WorkType,
  WORK_TYPE_OPTIONS,
  ALL_WORK_TYPES,
  ProviderEngine,
  ALL_ENGINES,
} from "./search-filter.types";
import { providerMatchesLanguage, providerMatchesWorkTypes } from "@/lib/search-filters";

interface SearchFilterDrawerProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  availableProviders?: Array<{
    slug: string;
    name: string;
    engine?: string;
    tags?: string[];
    status?: string;
  }>;
  activeFilterCount: number;
}

export function SearchFilterDrawer({
  filters,
  onChange,
  availableProviders,
  activeFilterCount,
}: SearchFilterDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [providerQuery, setProviderQuery] = useState("");
  const [sectionsOpen, setSectionsOpen] = useState({
    workTypes: true,
    engines: true,
    providers: true,
  });

  const toggleSection = (section: "workTypes" | "engines" | "providers") => {
    setSectionsOpen((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Apenas provedores reais (GET /providers)
  const allProviders = useMemo<SearchProviderOption[]>(() => {
    const list: SearchProviderOption[] = [];
    const seen = new Set<string>();

    if (availableProviders && availableProviders.length > 0) {
      for (const p of availableProviders) {
        if (!seen.has(p.slug)) {
          seen.add(p.slug);
          list.push({
            slug: p.slug,
            name: p.name,
            engine: p.engine,
            tags: p.tags,
            status: p.status,
            language: p.tags?.some((t) => t.toLowerCase() === "pt-br") ? "pt-br" : undefined,
          });
        }
      }
    }

    return list;
  }, [availableProviders]);

  const ENGINE_OPTIONS: Array<{
    value: ProviderEngine;
    label: string;
    desc: string;
    icon: typeof Zap;
    activeClass: string;
  }> = [
    {
      value: "cheerio",
      label: "Ultra Rápido",
      desc: "HTML direto (~1s)",
      icon: Zap,
      activeClass: "bg-comic-yellow text-comic-ink",
    },
    {
      value: "api",
      label: "Rápido",
      desc: "Conexão API (~2s)",
      icon: Rocket,
      activeClass: "bg-comic-blue text-white",
    },
    {
      value: "playwright",
      label: "Padrão",
      desc: "Navegador web (~8s)",
      icon: Globe,
      activeClass: "bg-comic-red text-white",
    },
  ];

  // Provedores que correspondem aos critérios globais de filtro (idioma, tipos de obra e engines)
  const matchingProviders = useMemo(() => {
    return allProviders.filter((p) => {
      if (filters.engines && filters.engines.length > 0) {
        const eng = (p.engine || "cheerio") as ProviderEngine;
        if (!filters.engines.includes(eng)) return false;
      }

      if (!providerMatchesLanguage(p, filters.language)) {
        return false;
      }

      if (!providerMatchesWorkTypes(p, filters.workTypes)) {
        return false;
      }

      return true;
    });
  }, [allProviders, filters.engines, filters.language, filters.workTypes]);

  // Provedores filtrados adicionalmente pela busca interna do drawer
  const filteredProviders = useMemo(() => {
    if (!providerQuery.trim()) return matchingProviders;
    const q = providerQuery.toLowerCase();
    return matchingProviders.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [matchingProviders, providerQuery]);

  const activeMatchingCount = useMemo(() => {
    return matchingProviders.filter((p) => filters.providers.includes(p.slug)).length;
  }, [matchingProviders, filters.providers]);

  const allMatchingSelected =
    matchingProviders.length > 0 &&
    matchingProviders.every((p) => filters.providers.includes(p.slug));

  const noneMatchingSelected =
    matchingProviders.length === 0 ||
    matchingProviders.every((p) => !filters.providers.includes(p.slug));

  const toggleWorkType = (type: WorkType) => {
    const exists = filters.workTypes.includes(type);
    const updated = exists
      ? filters.workTypes.filter((t) => t !== type)
      : [...filters.workTypes, type];
    onChange({ ...filters, workTypes: updated });
  };

  const toggleEngine = (engine: ProviderEngine) => {
    const current = filters.engines || ALL_ENGINES;
    const exists = current.includes(engine);
    const updated = exists ? current.filter((e) => e !== engine) : [...current, engine];
    onChange({ ...filters, engines: updated });
  };

  const toggleProvider = (slug: string) => {
    const exists = filters.providers.includes(slug);
    const updated = exists
      ? filters.providers.filter((s) => s !== slug)
      : [...filters.providers, slug];
    onChange({ ...filters, providers: updated });
  };

  const selectAllProviders = () => {
    const visibleSlugs = matchingProviders.map((p) => p.slug);
    const updated = Array.from(new Set([...filters.providers, ...visibleSlugs]));
    onChange({
      ...filters,
      providers: updated,
    });
  };

  const clearProviders = () => {
    const visibleSlugs = new Set(matchingProviders.map((p) => p.slug));
    const updated = filters.providers.filter((slug) => !visibleSlugs.has(slug));
    onChange({ ...filters, providers: updated });
  };

  const handleClearAll = () => {
    onChange({
      language: filters.language, // mantém o idioma selecionado no input
      workTypes: [...ALL_WORK_TYPES],
      engines: [...ALL_ENGINES],
      providers: allProviders.map((p) => p.slug),
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Filtro"
          className={cn(
            "h-11 flex items-center justify-center gap-2 px-4 rounded-md border-[3px] border-ink bg-comic-yellow text-ink font-display text-sm tracking-wide transition-colors hover:bg-amber-300 active:bg-amber-400 cursor-pointer whitespace-nowrap select-none shrink-0",
            activeFilterCount > 0 && "bg-amber-400",
          )}
        >
          <SlidersHorizontal className="h-4 w-4 text-ink shrink-0 stroke-[2.5]" />
          <span>Filtro</span>
          {activeFilterCount > 0 && (
            <span
              data-testid="filter-badge"
              className="flex h-5 min-w-5 items-center justify-center rounded-full bg-comic-red px-1.5 text-[11px] font-bold text-white border-2 border-ink"
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-md border-l-[3px] border-ink bg-background p-0 flex flex-col h-full shadow-comic-lg"
      >
        <SheetHeader className="p-5 border-b-[3px] border-ink bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-comic-blue stroke-[2.5]" />
              <SheetTitle className="font-display text-2xl tracking-wide text-ink">
                Filtros de Busca
              </SheetTitle>
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs font-bold text-comic-red hover:underline cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Limpar tudo
              </button>
            )}
          </div>
        </SheetHeader>

        {/* Corpo com scroll */}
        <div className="flex-1 flex flex-col gap-6 p-5 min-h-0 overflow-y-auto">
          {/* Seção 1: Tipo de Obra */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => toggleSection("workTypes")}
              className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer select-none"
              aria-expanded={sectionsOpen.workTypes}
            >
              <span>Tipo de Obra</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground lowercase">
                  {filters.workTypes.length}/{ALL_WORK_TYPES.length} ativos
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200 stroke-[2.5]",
                    sectionsOpen.workTypes && "rotate-180",
                  )}
                />
              </div>
            </button>
            {sectionsOpen.workTypes && (
              <div className="grid grid-cols-5 gap-2">
                {WORK_TYPE_OPTIONS.map((type) => {
                  const isSelected = filters.workTypes.includes(type.value);
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => toggleWorkType(type.value)}
                      aria-pressed={isSelected}
                      className={cn(
                        "min-w-0 rounded-md border-2 border-ink px-1 py-1.5 text-[11px] font-bold transition-all shadow-comic-sm cursor-pointer truncate",
                        isSelected
                          ? "bg-comic-blue text-white translate-y-0.5 shadow-none"
                          : "bg-card text-foreground hover:bg-muted",
                      )}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seção 2: Velocidade de Busca */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => toggleSection("engines")}
              className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer select-none"
              aria-expanded={sectionsOpen.engines}
            >
              <span>Velocidade de Busca</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground lowercase">
                  {(filters.engines || ALL_ENGINES).length}/3 ativas
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200 stroke-[2.5]",
                    sectionsOpen.engines && "rotate-180",
                  )}
                />
              </div>
            </button>
            {sectionsOpen.engines && (
              <div className="grid grid-cols-3 gap-2">
                {ENGINE_OPTIONS.map((eng) => {
                  const isSelected = (filters.engines || ALL_ENGINES).includes(eng.value);
                  const Icon = eng.icon;
                  return (
                    <button
                      key={eng.value}
                      type="button"
                      onClick={() => toggleEngine(eng.value)}
                      aria-pressed={isSelected}
                      aria-label={`Filtro velocidade ${eng.label}`}
                      title={eng.desc}
                      className={cn(
                        "flex items-center justify-center gap-1.5 h-9 px-2 rounded-md border-2 border-ink text-xs transition-all shadow-comic-sm cursor-pointer select-none",
                        isSelected
                          ? cn(eng.activeClass, "font-bold shadow-none translate-y-0.5")
                          : "bg-card text-muted-foreground opacity-60 hover:opacity-100 hover:bg-muted font-medium",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" />
                      <span className="font-sans font-bold text-[11px] tracking-tight leading-none truncate">
                        {eng.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seção 3: Provedores / Fontes */}
          <div className="flex-1 flex flex-col space-y-2.5 min-h-0">
            <button
              type="button"
              onClick={() => toggleSection("providers")}
              className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer select-none"
              aria-expanded={sectionsOpen.providers}
            >
              <span>Provedores ({matchingProviders.length} fontes)</span>
              <div className="flex items-center gap-1.5">
                {matchingProviders.length > 0 && (
                  <span className="text-[11px] font-bold text-comic-blue lowercase">
                    {activeMatchingCount}/{matchingProviders.length}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200 stroke-[2.5]",
                    sectionsOpen.providers && "rotate-180",
                  )}
                />
              </div>
            </button>

            {sectionsOpen.providers && (
              <>
                {/* Busca interna para escalar provedores */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={providerQuery}
                    onChange={(e) => setProviderQuery(e.target.value)}
                    placeholder="Filtrar por nome ou tag..."
                    aria-label="Filtrar provedores"
                    className="h-9 pl-8 pr-7 text-xs border-2 border-ink bg-card"
                  />
                  {providerQuery.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setProviderQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Limpar busca de provedores"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Ações rápidas */}
                <div className="flex items-center justify-between pt-0.5">
                  <button
                    type="button"
                    onClick={selectAllProviders}
                    className={cn(
                      "rounded-md border-2 border-ink px-3 py-1.5 text-xs font-bold transition-all shadow-comic-sm cursor-pointer",
                      allMatchingSelected
                        ? "bg-comic-blue text-white translate-y-0.5 shadow-none"
                        : "bg-card text-foreground hover:bg-muted",
                    )}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={clearProviders}
                    className={cn(
                      "text-xs font-bold cursor-pointer shrink-0",
                      noneMatchingSelected
                        ? "text-comic-red"
                        : "text-muted-foreground hover:text-comic-red hover:underline",
                    )}
                  >
                    Limpar seleção
                  </button>
                </div>

                {/* Lista rolável de provedores */}
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Lista de provedores disponíveis"
                  className="flex-1 min-h-[200px] overflow-y-auto space-y-1.5 rounded-lg border-2 border-ink/40 bg-muted/20 p-2 pr-1"
                >
                  {filteredProviders.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      {providerQuery ? (
                        <>Nenhum provedor encontrado para &ldquo;{providerQuery}&rdquo;.</>
                      ) : (
                        <>Nenhum provedor corresponde aos filtros selecionados.</>
                      )}
                    </p>
                  ) : (
                    filteredProviders.map((p) => {
                      const isChecked = filters.providers.includes(p.slug);
                      const statusCfg = p.status
                        ? STATUS_CONFIG[p.status as SourceStatus]
                        : undefined;
                      return (
                        <label
                          key={p.slug}
                          className={cn(
                            "flex items-center justify-between rounded-md border border-ink/30 bg-card p-2 text-xs transition-colors hover:bg-muted cursor-pointer select-none",
                            isChecked && "border-ink bg-comic-yellow/15",
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-ink transition-colors",
                                isChecked ? "bg-comic-blue text-white" : "bg-background",
                              )}
                            >
                              {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleProvider(p.slug)}
                              className="sr-only"
                              aria-label={`Selecionar provedor ${p.name}`}
                            />
                            <div className="truncate flex items-center gap-1.5">
                              {statusCfg && (
                                <span
                                  className={cn("h-2 w-2 rounded-full shrink-0", statusCfg.dot)}
                                  title={`Status: ${statusCfg.label}`}
                                />
                              )}
                              <span className="font-bold text-ink truncate">{p.name}</span>
                              {p.tags && p.tags.length > 0 && (
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  ({p.tags.slice(0, 2).join(", ")})
                                </span>
                              )}
                            </div>
                          </div>
                          {p.engine && (
                            <EngineBadge
                              engine={p.engine as ProviderEngine}
                              size="sm"
                              className="shrink-0 scale-90"
                            />
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Rodapé da gaveta */}
        <SheetFooter className="p-4 border-t-[3px] border-ink bg-card flex flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClearAll}
            className={cn(
              "text-xs font-bold cursor-pointer shrink-0",
              activeFilterCount === 0
                ? "text-comic-red"
                : "text-muted-foreground hover:text-comic-red hover:underline",
            )}
          >
            Limpar
          </button>
          <div className="flex items-center gap-2">
            <SheetClose asChild>
              <button
                type="button"
                className="rounded-md border-[3px] border-ink bg-comic-red px-4 py-1.5 font-display text-sm text-white shadow-comic-sm hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                Aplicar
              </button>
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
