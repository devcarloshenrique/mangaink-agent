import { X } from "lucide-react";
import {
  ALL_ENGINES,
  ALL_WORK_TYPES,
  DEFAULT_FILTERS,
  LANGUAGE_OPTIONS,
  SearchFilters,
} from "./search-filter.types";
import type { ProviderRecord } from "@/types/scraping";

interface ActiveFilterChipsProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  providers: ProviderRecord[];
}

interface Chip {
  key: string;
  label: string;
  clear: () => void;
}

export function ActiveFilterChips({ filters, onChange, providers }: ActiveFilterChipsProps) {
  const chips: Chip[] = [];

  const totalProviders = providers.length;
  if (totalProviders > 0 && filters.providers.length < totalProviders) {
    chips.push({
      key: "providers",
      label: `Fontes: ${filters.providers.length}/${totalProviders}`,
      clear: () => onChange({ ...filters, providers: providers.map((p) => p.slug) }),
    });
  }

  if (filters.engines.length < ALL_ENGINES.length) {
    chips.push({
      key: "engines",
      label: `Velocidade: ${filters.engines.length}/${ALL_ENGINES.length}`,
      clear: () => onChange({ ...filters, engines: [...ALL_ENGINES] }),
    });
  }

  if (filters.workTypes.length < ALL_WORK_TYPES.length) {
    chips.push({
      key: "workTypes",
      label: `Tipo: ${filters.workTypes.length}/${ALL_WORK_TYPES.length}`,
      clear: () => onChange({ ...filters, workTypes: [...ALL_WORK_TYPES] }),
    });
  }

  if (filters.language !== DEFAULT_FILTERS.language) {
    const langLabel =
      LANGUAGE_OPTIONS.find((o) => o.value === filters.language)?.shortLabel ?? filters.language;
    chips.push({
      key: "language",
      label: `Idioma: ${langLabel}`,
      clear: () => onChange({ ...filters, language: DEFAULT_FILTERS.language }),
    });
  }

  if (chips.length === 0) return null;

  const clearAll = () =>
    onChange({
      ...filters,
      workTypes: [...ALL_WORK_TYPES],
      engines: [...ALL_ENGINES],
      providers: providers.map((p) => p.slug),
    });

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros ativos">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-comic-yellow/70 px-2.5 py-0.5 text-[11px] font-bold text-ink shadow-comic-sm"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.clear}
            aria-label={`Remover filtro ${chip.label}`}
            className="grid h-4 w-4 place-items-center rounded-full text-ink/70 transition hover:bg-ink/10 hover:text-ink cursor-pointer"
          >
            <X className="h-3 w-3 stroke-[3]" />
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={clearAll}
          className="text-[11px] font-bold text-comic-red hover:underline cursor-pointer"
        >
          Limpar tudo
        </button>
      )}
    </div>
  );
}
