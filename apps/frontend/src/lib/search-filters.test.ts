import { describe, expect, it, beforeEach } from "vitest";
import {
  applySearchFilters,
  resolveEffectiveProviders,
  loadSearchFilters,
  saveSearchFilters,
  hasStoredFilters,
  FILTERS_STORAGE_KEY,
} from "./search-filters";
import { DEFAULT_FILTERS, SearchFilters } from "@/components/dashboard/search-filter.types";
import type { ProviderRecord, SearchSourcesResponse } from "@/types/scraping";

const PROVIDERS: ProviderRecord[] = [
  {
    slug: "mangadex",
    name: "MangaDex",
    engine: "api",
    tags: ["mangá", "pt-BR", "en", "api", "scans"],
    status: "active",
    homepage: null,
    rateLimit: { maxConcurrent: 6, minTime: 50, reservoir: null, reservoirRefreshInterval: null },
  },
  {
    slug: "mangalivre",
    name: "MangaLivre",
    engine: "cheerio",
    tags: ["mangá", "pt-BR", "scans"],
    status: "active",
    homepage: null,
    rateLimit: { maxConcurrent: 6, minTime: 50, reservoir: null, reservoirRefreshInterval: null },
  },
  {
    slug: "imperiodabritannia",
    name: "Império da Britannia",
    engine: "api",
    tags: ["manhwa", "pt-br"],
    status: "active",
    homepage: null,
    rateLimit: { maxConcurrent: 6, minTime: 50, reservoir: null, reservoirRefreshInterval: null },
  },
  {
    slug: "webtoonxyz",
    name: "Webtoon XYZ",
    engine: "cheerio",
    tags: ["webtoon", "en"],
    status: "active",
    homepage: null,
    rateLimit: { maxConcurrent: 6, minTime: 50, reservoir: null, reservoirRefreshInterval: null },
  },
];

type TaggedSearchResult = SearchSourcesResponse["results"][number] & {
  type?: string | null;
  genres?: string[] | null;
};

function makeData(results: TaggedSearchResult[]): SearchSourcesResponse {
  return {
    query: "one piece",
    results,
    errors: [],
    searchedProviders: ["mangadex", "mangalivre"],
    truncated: false,
  };
}

function filters(overrides: Partial<SearchFilters> = {}): SearchFilters {
  return { ...DEFAULT_FILTERS, providers: PROVIDERS.map((p) => p.slug), ...overrides };
}

describe("applySearchFilters", () => {
  it("mantém os dados inalterados quando não há resultados", () => {
    const data = makeData([]);
    expect(applySearchFilters(data, filters(), PROVIDERS)).toBe(data);
  });

  it("não quebra com o shape real da API (array plano) e preserva os itens", () => {
    const data = makeData([
      { providerSlug: "mangadex", title: "One Piece", url: "https://mangadex.org/title/x" },
      { providerSlug: "mangalivre", title: "One Piece", url: "https://mangalivre.net/one-piece" },
    ]);

    const out = applySearchFilters(data, filters(), PROVIDERS);

    expect(out.results).toBeInstanceOf(Array);
    expect(out.results).toHaveLength(2);
    expect(out.results[0]).toMatchObject({ providerSlug: "mangadex", title: "One Piece" });
  });

  it("filtra por provider (slugs não selecionados são removidos)", () => {
    const data = makeData([
      { providerSlug: "mangadex", title: "One Piece", url: "u1" },
      { providerSlug: "mangalivre", title: "One Piece", url: "u2" },
    ]);

    const out = applySearchFilters(data, filters({ providers: ["mangadex"] }), PROVIDERS);

    expect(out.results.map((r) => r.providerSlug)).toEqual(["mangadex"]);
  });

  it("filtra por engine (api)", () => {
    const data = makeData([
      { providerSlug: "mangadex", title: "One Piece", url: "u1" },
      { providerSlug: "mangalivre", title: "One Piece", url: "u2" },
    ]);

    const out = applySearchFilters(data, filters({ engines: ["api"] }), PROVIDERS);

    expect(out.results.map((r) => r.providerSlug)).toEqual(["mangadex"]);
  });

  it("filtra por idioma pt-br usando as tags do provider", () => {
    const data = makeData([
      { providerSlug: "mangadex", title: "One Piece", url: "u1" },
      { providerSlug: "mangalivre", title: "One Piece", url: "u2" },
      { providerSlug: "imperiodabritannia", title: "One Piece", url: "u3" },
      { providerSlug: "webtoonxyz", title: "One Piece", url: "u4" },
    ]);

    const out = applySearchFilters(data, filters({ language: "pt-br" }), PROVIDERS);

    expect(out.results.map((r) => r.providerSlug).sort()).toEqual([
      "imperiodabritannia",
      "mangadex",
      "mangalivre",
    ]);
  });

  it("filtra por idioma estrangeiro (en) usando as tags do provider", () => {
    const data = makeData([
      { providerSlug: "mangadex", title: "One Piece", url: "u1" },
      { providerSlug: "mangalivre", title: "One Piece", url: "u2" },
      { providerSlug: "webtoonxyz", title: "One Piece", url: "u4" },
    ]);

    const out = applySearchFilters(data, filters({ language: "en" }), PROVIDERS);

    expect(out.results.map((r) => r.providerSlug).sort()).toEqual(["mangadex", "webtoonxyz"]);
  });

  it("trata providers sem tag de idioma como pt-br (heurística)", () => {
    const noLangProvider: ProviderRecord = {
      slug: "semidioma",
      name: "Sem Idioma",
      engine: "cheerio",
      tags: ["manga"],
      status: "active",
      homepage: null,
      rateLimit: { maxConcurrent: 6, minTime: 50, reservoir: null, reservoirRefreshInterval: null },
    };
    const data = makeData([{ providerSlug: "semidioma", title: "One Piece", url: "u1" }]);

    const out = applySearchFilters(data, filters({ language: "pt-br", providers: ["semidioma"] }), [
      ...PROVIDERS,
      noLangProvider,
    ]);

    expect(out.results).toHaveLength(1);
  });

  it("mantém itens sem type/genres quando o filtro de tipo de obra está restrito (no-op seguro)", () => {
    const data = makeData([
      { providerSlug: "mangadex", title: "One Piece", url: "u1" },
      { providerSlug: "mangalivre", title: "One Piece", url: "u2" },
    ]);

    const out = applySearchFilters(data, filters({ workTypes: ["comic"] }), PROVIDERS);

    expect(out.results).toHaveLength(2);
  });

  it("filtra por tipo de obra quando o item expõe type/genres", () => {
    const data = makeData([
      { providerSlug: "mangadex", title: "One Piece", url: "u1", type: "manga" },
      { providerSlug: "mangalivre", title: "Solo Leveling", url: "u2", genres: ["manhwa"] },
    ]);

    const out = applySearchFilters(data, filters({ workTypes: ["manga"] }), PROVIDERS);

    expect(out.results.map((r) => r.title)).toEqual(["One Piece"]);
  });
});

describe("resolveEffectiveProviders", () => {
  it("retorna array vazio quando nenhum provider está selecionado", () => {
    const out = resolveEffectiveProviders(filters({ providers: [] }), PROVIDERS);
    expect(out).toEqual([]);
  });

  it("retorna os slugs selecionados que atendem aos filtros de engine e idioma", () => {
    const out = resolveEffectiveProviders(
      filters({
        providers: ["mangadex", "mangalivre", "webtoonxyz"],
        engines: ["api"],
        language: "pt-br",
      }),
      PROVIDERS,
    );
    expect(out).toEqual(["mangadex"]);
  });

  it("exclui providers cujo idioma não corresponde", () => {
    const out = resolveEffectiveProviders(
      filters({
        providers: ["mangadex", "mangalivre", "webtoonxyz"],
        engines: ["api", "cheerio", "playwright"],
        language: "en",
      }),
      PROVIDERS,
    );
    expect(out).toEqual(["mangadex", "webtoonxyz"]);
  });
});

describe("storage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retorna DEFAULT_FILTERS quando localStorage está vazio", () => {
    expect(loadSearchFilters()).toEqual(DEFAULT_FILTERS);
    expect(hasStoredFilters()).toBe(false);
  });

  it("persiste e recupera filtros corretamente", () => {
    const custom = filters({ language: "en", engines: ["api"], providers: ["mangadex"] });
    saveSearchFilters(custom);
    expect(hasStoredFilters()).toBe(true);

    const loaded = loadSearchFilters();
    expect(loaded.language).toBe("en");
    expect(loaded.engines).toEqual(["api"]);
    expect(loaded.providers).toEqual(["mangadex"]);
  });

  it("trata JSON inválido com fallback para DEFAULT_FILTERS", () => {
    localStorage.setItem(FILTERS_STORAGE_KEY, "invalid json");
    expect(loadSearchFilters()).toEqual(DEFAULT_FILTERS);
  });
});
