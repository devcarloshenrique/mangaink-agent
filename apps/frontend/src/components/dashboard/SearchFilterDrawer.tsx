import { useState, useMemo } from "react";
import { SlidersHorizontal, Search, X, Check, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  SearchFilters,
  SearchProviderOption,
  WorkType,
  WORK_TYPE_OPTIONS,
  MOCK_PROVIDERS_CATALOG,
} from "./search-filter.types";

interface SearchFilterDrawerProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  availableProviders?: Array<{ slug: string; name: string; engine?: string; tags?: string[] }>;
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

  // Combina provedores reais com catálogo mockado garantindo lista rica escalável
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
            language: p.tags?.some((t) => t.toLowerCase() === "pt-br") ? "pt-br" : undefined,
          });
        }
      }
    }

    // Adiciona mocks para demonstrar a escala de 100+ provedores
    for (const mock of MOCK_PROVIDERS_CATALOG) {
      if (!seen.has(mock.slug)) {
        seen.add(mock.slug);
        list.push(mock);
      }
    }

    return list;
  }, [availableProviders]);

  // Provedores filtrados pela busca interna do drawer
  const filteredProviders = useMemo(() => {
    if (!providerQuery.trim()) return allProviders;
    const q = providerQuery.toLowerCase();
    return allProviders.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [allProviders, providerQuery]);

  const toggleWorkType = (type: WorkType) => {
    const exists = filters.workTypes.includes(type);
    const updated = exists
      ? filters.workTypes.filter((t) => t !== type)
      : [...filters.workTypes, type];
    onChange({ ...filters, workTypes: updated });
  };

  const toggleProvider = (slug: string) => {
    const exists = filters.providers.includes(slug);
    const updated = exists
      ? filters.providers.filter((s) => s !== slug)
      : [...filters.providers, slug];
    onChange({ ...filters, providers: updated });
  };

  const selectAllProviders = () => {
    onChange({
      ...filters,
      providers: allProviders.map((p) => p.slug),
    });
  };

  const selectPtBrProviders = () => {
    const ptBrSlugs = allProviders
      .filter((p) => p.language === "pt-br" || p.tags?.some((t) => t.toLowerCase() === "pt-br"))
      .map((p) => p.slug);
    onChange({
      ...filters,
      providers: ptBrSlugs,
    });
  };

  const clearProviders = () => {
    onChange({ ...filters, providers: [] });
  };

  const handleClearAll = () => {
    onChange({
      language: filters.language, // mantém o idioma selecionado no input
      workTypes: [],
      providers: [],
      sortBy: "relevance",
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
          <SheetDescription className="text-xs text-muted-foreground text-left">
            Refine os resultados por tipo de obra e provedores homologados.
          </SheetDescription>
        </SheetHeader>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Seção 1: Tipo de Obra */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Tipo de Obra
            </label>
            <div className="flex flex-wrap gap-2">
              {WORK_TYPE_OPTIONS.map((type) => {
                const isSelected = filters.workTypes.includes(type.value);
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => toggleWorkType(type.value)}
                    className={cn(
                      "rounded-md border-2 border-ink px-3 py-1.5 text-xs font-bold transition-all shadow-comic-sm cursor-pointer",
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
          </div>

          {/* Seção 2: Provedores / Fontes */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Provedores ({allProviders.length} fontes)
              </label>
              {filters.providers.length > 0 && (
                <span className="text-[11px] font-bold text-comic-blue">
                  {filters.providers.length} selecionado(s)
                </span>
              )}
            </div>

            {/* Busca interna para escalar 100+ provedores */}
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
            <div className="flex items-center gap-2 text-[11px] pt-0.5">
              <button
                type="button"
                onClick={selectAllProviders}
                className="font-bold text-ink hover:underline cursor-pointer"
              >
                Todos
              </button>
              <span className="text-muted-foreground">•</span>
              <button
                type="button"
                onClick={selectPtBrProviders}
                className="font-bold text-comic-blue hover:underline cursor-pointer"
              >
                Apenas PT-BR
              </button>
              <span className="text-muted-foreground">•</span>
              <button
                type="button"
                onClick={clearProviders}
                className="font-bold text-muted-foreground hover:text-comic-red cursor-pointer"
              >
                Limpar seleção
              </button>
            </div>

            {/* Lista rolável de provedores */}
            <div
              tabIndex={0}
              role="region"
              aria-label="Lista de provedores disponíveis"
              className="max-h-[260px] overflow-y-auto space-y-1.5 rounded-lg border-2 border-ink/40 bg-muted/20 p-2 pr-1"
            >
              {filteredProviders.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Nenhum provedor encontrado para &ldquo;{providerQuery}&rdquo;.
                </p>
              ) : (
                filteredProviders.map((p) => {
                  const isChecked = filters.providers.includes(p.slug);
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
                        <div className="truncate">
                          <span className="font-bold text-ink">{p.name}</span>
                          {p.tags && p.tags.length > 0 && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground">
                              ({p.tags.slice(0, 2).join(", ")})
                            </span>
                          )}
                        </div>
                      </div>
                      {p.engine && (
                        <span className="shrink-0 rounded border border-ink/30 bg-muted px-1.5 py-0.5 text-[9px] font-mono uppercase text-muted-foreground">
                          {p.engine}
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Seção 3: Ordenação */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Ordenação
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...filters, sortBy: "relevance" })}
                className={cn(
                  "rounded-md border-2 border-ink p-2.5 text-left text-xs transition-all shadow-comic-sm cursor-pointer",
                  filters.sortBy === "relevance"
                    ? "bg-comic-yellow text-ink border-ink font-bold shadow-none translate-y-0.5"
                    : "bg-card text-foreground hover:bg-muted font-medium",
                )}
              >
                <div className="font-bold">Relevância</div>
                <div className="text-[10px] opacity-70">Melhor correspondência</div>
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...filters, sortBy: "alphabetical" })}
                className={cn(
                  "rounded-md border-2 border-ink p-2.5 text-left text-xs transition-all shadow-comic-sm cursor-pointer",
                  filters.sortBy === "alphabetical"
                    ? "bg-comic-yellow text-ink border-ink font-bold shadow-none translate-y-0.5"
                    : "bg-card text-foreground hover:bg-muted font-medium",
                )}
              >
                <div className="font-bold">Alfabética (A-Z)</div>
                <div className="text-[10px] opacity-70">Ordem do título</div>
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé da gaveta */}
        <SheetFooter className="p-4 border-t-[3px] border-ink bg-card flex flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground font-medium">
            {activeFilterCount === 0
              ? "Nenhum filtro ativo"
              : `${activeFilterCount} filtro(s) ativo(s)`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearAll}
              className="rounded-md border-2 border-ink bg-background px-3 py-1.5 text-xs font-bold hover:bg-muted cursor-pointer"
            >
              Limpar
            </button>
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
