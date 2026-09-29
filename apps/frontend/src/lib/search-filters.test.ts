import { describe, expect, it, beforeEach } from "vitest";
import {
  applySearchFilters,
  resolveEffectiveProviders,
  loadSearchFilters,
  saveSearchFilters,
  hasStoredFilters,
  getStoredKnownProviders,
  reconcileProviders,
  providerMatchesLanguage,
  providerMatchesWorkTypes,
  getProviderWorkTypes,
  LEGACY_KNOWN_PROVIDERS,
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
  it("inclui providers com tag multi-idioma para qualquer idioma selecionado", () => {
    const multiProviders: ProviderRecord[] = [
      {
        slug: "mangadex",
        name: "MangaDex",
        engine: "api",
        tags: ["manga", "multi-idioma"],
        status: "active",
        homepage: null,
        rateLimit: {
          maxConcurrent: 6,
          minTime: 50,
          reservoir: null,
          reservoirRefreshInterval: null,
        },
      },
      {
        slug: "mangalivre",
        name: "MangaLivre",
        engine: "cheerio",
        tags: ["manga", "pt-br"],
        status: "active",
        homepage: null,
        rateLimit: {
          maxConcurrent: 6,
          minTime: 50,
          reservoir: null,
          reservoirRefreshInterval: null,
        },
      },
    ];

    const outEs = resolveEffectiveProviders(
      filters({
        providers: ["mangadex", "mangalivre"],
        engines: ["api", "cheerio", "playwright"],
        language: "es",
      }),
      multiProviders,
    );
    expect(outEs).toEqual(["mangadex"]);
  });

  it("exclui providers cujo tipo de obra não foi selecionado", () => {
    // PROVIDERS tem: mangalivre (mangá), imperiodabritannia (manhwa), webtoonxyz (webtoon)
    const outManhwa = resolveEffectiveProviders(
      filters({
        providers: ["mangalivre", "imperiodabritannia", "webtoonxyz"],
        workTypes: ["manhwa"],
      }),
      PROVIDERS,
    );
    expect(outManhwa).toEqual(["imperiodabritannia"]);

    const outWebtoon = resolveEffectiveProviders(
      filters({
        providers: ["mangalivre", "imperiodabritannia", "webtoonxyz"],
        workTypes: ["webtoon"],
        language: "en",
      }),
      PROVIDERS,
    );
    expect(outWebtoon).toEqual(["webtoonxyz"]);

    const outNone = resolveEffectiveProviders(
      filters({
        providers: ["mangalivre", "imperiodabritannia"],
        workTypes: [],
      }),
      PROVIDERS,
    );
    expect(outNone).toEqual([]);
  });
});

describe("providerMatchesLanguage", () => {
  it("retorna true para 'all' independente das tags", () => {
    expect(providerMatchesLanguage({ tags: ["en"] }, "all")).toBe(true);
    expect(providerMatchesLanguage({ tags: ["pt-br"] }, "all")).toBe(true);
    expect(providerMatchesLanguage(undefined, "all")).toBe(true);
  });

  it("identifica provedores pt-br com tags pt-br ou default nacional", () => {
    expect(providerMatchesLanguage({ tags: ["mangá", "pt-br"] }, "pt-br")).toBe(true);
    expect(providerMatchesLanguage({ tags: ["mangá", "pt-BR"] }, "pt-br")).toBe(true);
    // Sem tag estrangeira -> assume pt-br nacional
    expect(providerMatchesLanguage({ tags: ["mangá", "scans"] }, "pt-br")).toBe(true);
    // Com tag en -> não é pt-br
    expect(providerMatchesLanguage({ tags: ["mangá", "en"] }, "pt-br")).toBe(false);
  });

  it("identifica provedores de outros idiomas", () => {
    expect(providerMatchesLanguage({ tags: ["mangá", "en"] }, "en")).toBe(true);
    expect(providerMatchesLanguage({ tags: ["mangá", "pt-br"] }, "en")).toBe(false);
    expect(providerMatchesLanguage({ tags: ["mangá", "es"] }, "es")).toBe(true);
  });

  it("sempre inclui provedores com tag multi-idioma", () => {
    expect(providerMatchesLanguage({ tags: ["multi-idioma"] }, "en")).toBe(true);
    expect(providerMatchesLanguage({ tags: ["multi-idioma"] }, "pt-br")).toBe(true);
    expect(providerMatchesLanguage({ tags: ["multi-idioma"] }, "ja")).toBe(true);
  });
});

describe("getProviderWorkTypes e providerMatchesWorkTypes", () => {
  it("extrai tipos de obra a partir de tags variadas", () => {
    expect(Array.from(getProviderWorkTypes({ tags: ["mangá", "pt-br"] }))).toEqual(["manga"]);
    expect(Array.from(getProviderWorkTypes({ tags: ["manga", "manhwa"] })).sort()).toEqual([
      "manga",
      "manhwa",
    ]);
    expect(
      Array.from(getProviderWorkTypes({ tags: ["manhua", "webtoon", "comic"] })).sort(),
    ).toEqual(["comic", "manhua", "webtoon"]);
  });

  it("retorna fallback manga quando tags estão vazias ou ausentes", () => {
    expect(Array.from(getProviderWorkTypes(undefined))).toEqual(["manga"]);
    expect(Array.from(getProviderWorkTypes({ tags: [] }))).toEqual(["manga"]);
    expect(Array.from(getProviderWorkTypes({ tags: ["scans", "pt-br"] }))).toEqual(["manga"]);
  });

  it("retorna true se todas as flags de tipos de obra estiverem marcadas", () => {
    expect(
      providerMatchesWorkTypes({ tags: ["manhwa"] }, [
        "manga",
        "manhwa",
        "manhua",
        "webtoon",
        "comic",
      ]),
    ).toBe(true);
  });

  it("retorna false se nenhuma flag estiver marcada", () => {
    expect(providerMatchesWorkTypes({ tags: ["manhwa"] }, [])).toBe(false);
  });

  it("filtra corretamente quando flags específicas são marcadas/desmarcadas", () => {
    const mangaOnly = { tags: ["mangá", "pt-br"] };
    const manhwaOnly = { tags: ["manhwa", "pt-br"] };
    const hybrid = { tags: ["mangá", "manhwa", "manhua"] };

    // Se usuário seleciona apenas manhwa:
    expect(providerMatchesWorkTypes(mangaOnly, ["manhwa"])).toBe(false);
    expect(providerMatchesWorkTypes(manhwaOnly, ["manhwa"])).toBe(true);
    expect(providerMatchesWorkTypes(hybrid, ["manhwa"])).toBe(true);

    // Se usuário desmarca mangá (sobrando manhwa e manhua):
    expect(providerMatchesWorkTypes(mangaOnly, ["manhwa", "manhua"])).toBe(false);
    expect(providerMatchesWorkTypes(manhwaOnly, ["manhwa", "manhua"])).toBe(true);
    expect(providerMatchesWorkTypes(hybrid, ["manhwa", "manhua"])).toBe(true);

    // Se usuário desmarca manhwa e manhua (sobrando apenas comic):
    expect(providerMatchesWorkTypes(mangaOnly, ["comic"])).toBe(false);
    expect(providerMatchesWorkTypes(hybrid, ["comic"])).toBe(false);
  });
});

describe("reconcileProviders", () => {
  const ALL_10_SLUGS = [
    "mangalivre",
    "imperiodabritannia",
    "mangadex",
    "taiyo",
    "mangapill",
    "mangaread",
    "flamecomics",
    "asurascans",
    "mangakakalot",
    "mangafire",
  ];

  it("ativa todos os 10 provedores quando usuário vem do formato legado com os 3 originais ativos", () => {
    const legacySaved = ["mangalivre", "imperiodabritannia", "mangadex"];
    const result = reconcileProviders(legacySaved, ALL_10_SLUGS, null);
    expect(result).toEqual(ALL_10_SLUGS);
    expect(result).toHaveLength(10);
  });

  it("preserva desativação explícita no formato legado e ativa os 7 novos", () => {
    // Usuário desmarcou 'imperiodabritannia' no passado (tinha 2 de 3)
    const legacySaved = ["mangalivre", "mangadex"];
    const result = reconcileProviders(legacySaved, ALL_10_SLUGS, null);

    expect(result).not.includes("imperiodabritannia");
    expect(result).includes("taiyo");
    expect(result).includes("asurascans");
    expect(result).toHaveLength(9);
  });

  it("ativa novos provedores adicionados futuramente quando há knownProviders moderno", () => {
    const known10 = [...ALL_10_SLUGS];
    // Usuário tinha todos os 10 ativos
    const saved10 = [...ALL_10_SLUGS];
    // Um 11º provedor foi adicionado ao catálogo
    const slugs11 = [...ALL_10_SLUGS, "novo_provedor_11"];

    const result = reconcileProviders(saved10, slugs11, known10);
    expect(result).toEqual(slugs11);
    expect(result).includes("novo_provedor_11");
  });

  it("preserva desmarcação explícita com knownProviders moderno ao adicionar novo provedor", () => {
    const known10 = [...ALL_10_SLUGS];
    // Usuário desmarcou mangaread
    const saved9 = ALL_10_SLUGS.filter((s) => s !== "mangaread");
    const slugs11 = [...ALL_10_SLUGS, "novo_provedor_11"];

    const result = reconcileProviders(saved9, slugs11, known10);
    expect(result).not.includes("mangaread");
    expect(result).includes("novo_provedor_11");
    expect(result).toHaveLength(10);
  });

  it("respeita quando o usuário desmarcou intencionalmente todos ('Nenhum')", () => {
    const known10 = [...ALL_10_SLUGS];
    const result = reconcileProviders([], ALL_10_SLUGS, known10);
    expect(result).toEqual([]);
  });

  it("ativa todos os provedores reais em primeiro acesso (sem filtros persistidos)", () => {
    const result = reconcileProviders([], ALL_10_SLUGS, null);
    expect(result).toEqual(ALL_10_SLUGS);
  });

  it("retorna array vazio quando realSlugs está vazio", () => {
    const result = reconcileProviders(["mangalivre"], [], null);
    expect(result).toEqual([]);
  });

  it("descarta provedores persistidos que não existem mais em realSlugs", () => {
    const saved = ["mangalivre", "provedor_removido"];
    const real = ["mangalivre", "taiyo"];
    const result = reconcileProviders(saved, real, ["mangalivre", "provedor_removido"]);
    expect(result).toEqual(["mangalivre", "taiyo"]);
  });
});

describe("storage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retorna DEFAULT_FILTERS quando localStorage está vazio", () => {
    expect(loadSearchFilters()).toEqual(DEFAULT_FILTERS);
    expect(hasStoredFilters()).toBe(false);
    expect(getStoredKnownProviders()).toBeNull();
  });

  it("persiste e recupera filtros e knownProviders corretamente", () => {
    const custom = filters({ language: "en", engines: ["api"], providers: ["mangadex"] });
    saveSearchFilters(custom, ["mangadex", "taiyo"]);
    expect(hasStoredFilters()).toBe(true);

    const loaded = loadSearchFilters();
    expect(loaded.language).toBe("en");
    expect(loaded.engines).toEqual(["api"]);
    expect(loaded.providers).toEqual(["mangadex"]);

    const known = getStoredKnownProviders();
    expect(known).toEqual(["mangadex", "taiyo"]);
  });

  it("trata JSON inválido com fallback para DEFAULT_FILTERS", () => {
    localStorage.setItem(FILTERS_STORAGE_KEY, "invalid json");
    expect(loadSearchFilters()).toEqual(DEFAULT_FILTERS);
    expect(getStoredKnownProviders()).toBeNull();
  });
});
