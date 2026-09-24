import {
  ALL_ENGINES,
  ALL_WORK_TYPES,
  DEFAULT_FILTERS,
  LANGUAGE_OPTIONS,
  ProviderEngine,
  SearchFilters,
  WorkType,
} from "@/components/dashboard/search-filter.types";
import type { ProviderRecord, ProviderSearchResult, SearchSourcesResponse } from "@/types/scraping";

const KNOWN_FOREIGN_LANGS = [
  "en",
  "es",
  "ja",
  "ko",
  "zh",
  "fr",
  "it",
  "de",
  "ru",
  "id",
  "vi",
  "tr",
  "pl",
  "ar",
  "th",
];

interface WorkTypeTaggedItem extends ProviderSearchResult {
  type?: string | null;
  genres?: string[] | null;
}

function providerMatchesLanguage(
  provMeta: ProviderRecord | undefined,
  language: SearchFilters["language"],
): boolean {
  if (language === "all") return true;

  const provIsPtBr =
    provMeta?.tags?.some((t) => t.toLowerCase() === "pt-br") ||
    !provMeta?.tags?.some((t) => KNOWN_FOREIGN_LANGS.includes(t.toLowerCase()));

  if (language === "pt-br") return provIsPtBr;
  return provMeta?.tags?.some((t) => t.toLowerCase() === language) ?? false;
}

function matchesWorkTypes(item: WorkTypeTaggedItem, workTypes: WorkType[]): boolean {
  const typeStr = (item.type ?? "").toLowerCase();
  const genresStr = (item.genres ?? []).join(" ").toLowerCase();
  const titleStr = item.title.toLowerCase();

  return workTypes.some((wt) => {
    if (wt === "manga") return typeStr.includes("manga") || genresStr.includes("manga");
    if (wt === "manhwa")
      return (
        typeStr.includes("manhwa") || genresStr.includes("manhwa") || genresStr.includes("corean")
      );
    if (wt === "manhua")
      return (
        typeStr.includes("manhua") || genresStr.includes("manhua") || genresStr.includes("chines")
      );
    if (wt === "webtoon")
      return (
        typeStr.includes("webtoon") || genresStr.includes("webtoon") || titleStr.includes("webtoon")
      );
    if (wt === "comic")
      return typeStr.includes("comic") || genresStr.includes("comic") || genresStr.includes("hq");
    return false;
  });
}

/**
 * Resolve os slugs efetivos para a busca server-side: providers selecionados
 * interseção com o filtro de engine e de idioma. Retorna lista vazia quando
 * nenhum provider está selecionado (busca deve ser desabilitada).
 */
export function resolveEffectiveProviders(
  filters: SearchFilters,
  providers: ProviderRecord[],
): string[] {
  if (filters.providers.length === 0) return [];

  return providers
    .filter((p) => {
      if (!filters.providers.includes(p.slug)) return false;

      const eng = (p.engine ?? "cheerio") as ProviderEngine;
      if (filters.engines && !filters.engines.includes(eng)) return false;

      return providerMatchesLanguage(p, filters.language);
    })
    .map((p) => p.slug);
}

/**
 * Aplica os filtros da HomeSearchBar sobre a resposta da busca unificada.
 * A API retorna `results` como array plano de `ProviderSearchResult` — os
 * filtros de provider/engine/idioma usam os metadados do provider (catalogado
 * via GET /providers). O filtro de tipo de obra só atua quando o item expõe
 * `type`/`genres` (metadados opcionais ainda não retornados pela API).
 */
export function applySearchFilters(
  data: SearchSourcesResponse,
  filters: SearchFilters,
  providers: ProviderRecord[],
): SearchSourcesResponse {
  if (!data.results || data.results.length === 0) return data;

  const workTypesRestricted =
    filters.workTypes.length > 0 && filters.workTypes.length < ALL_WORK_TYPES.length;

  const kept = data.results.filter((item) => {
    if (filters.providers && !filters.providers.includes(item.providerSlug)) return false;

    const provMeta = providers.find((p) => p.slug === item.providerSlug);

    const provEngine = (provMeta?.engine ?? "cheerio") as ProviderEngine;
    if (filters.engines && !filters.engines.includes(provEngine)) return false;

    if (!providerMatchesLanguage(provMeta, filters.language)) return false;

    if (workTypesRestricted) {
      const tagged = item as WorkTypeTaggedItem;
      if (tagged.type != null || (tagged.genres ?? []).length > 0) {
        return matchesWorkTypes(tagged, filters.workTypes);
      }
    }

    return true;
  });

  return { ...data, results: kept };
}

// ─── Persistência dos filtros (localStorage) ────────────────────────────────

export const FILTERS_STORAGE_KEY = "mangaink.home.filters";

function isValidStringArray<T>(value: unknown, valid: readonly string[]): value is T[] {
  return (
    Array.isArray(value) && value.every((v) => typeof v === "string" && valid.includes(v as string))
  );
}

export function loadSearchFilters(): SearchFilters {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<SearchFilters> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_FILTERS;

    const validLanguages = LANGUAGE_OPTIONS.map((o) => o.value);
    return {
      language:
        typeof parsed.language === "string" && validLanguages.includes(parsed.language)
          ? parsed.language
          : DEFAULT_FILTERS.language,
      workTypes: isValidStringArray<WorkType>(parsed.workTypes, ALL_WORK_TYPES)
        ? parsed.workTypes
        : DEFAULT_FILTERS.workTypes,
      engines: isValidStringArray<ProviderEngine>(parsed.engines, ALL_ENGINES)
        ? parsed.engines
        : DEFAULT_FILTERS.engines,
      providers: Array.isArray(parsed.providers)
        ? parsed.providers.filter((s) => typeof s === "string")
        : DEFAULT_FILTERS.providers,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function hasStoredFilters(): boolean {
  try {
    return localStorage.getItem(FILTERS_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveSearchFilters(filters: SearchFilters): void {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // localStorage indisponível (modo privado/quota) — ignora
  }
}
