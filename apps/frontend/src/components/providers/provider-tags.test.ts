import { describe, expect, it } from "vitest";
import type { ProviderRecord } from "@/types/scraping";
import { applyProviderFilters, collectContentTags, tagLabel } from "./provider-tags";

function provider(slug: string, tags: string[], extra?: Partial<ProviderRecord>): ProviderRecord {
  return {
    slug,
    name: slug,
    engine: "api",
    tags,
    status: "active",
    homepage: null,
    rateLimit: { maxConcurrent: 6, minTime: 50, reservoir: null, reservoirRefreshInterval: null },
    ...extra,
  };
}

describe("provider-tags", () => {
  it("exibe labels pt-BR e preserva desconhecidas cruas", () => {
    expect(tagLabel("mangá")).toBe("Mangá");
    expect(tagLabel("manhwa")).toBe("Manhwa");
    expect(tagLabel("pt-BR")).toBe("Português");
    expect(tagLabel("en")).toBe("Inglês");
    expect(tagLabel("es-la")).toBe("Espanhol (América Latina)");
    expect(tagLabel("zh-hk")).toBe("Chinês (Hong Kong)");
    expect(tagLabel("tag-nova-qualquer")).toBe("tag-nova-qualquer");
  });

  it("filtro de tags continua por inclusão (every/includes)", () => {
    const providers = [
      provider("a", ["mangá", "pt-BR"]),
      provider("b", ["mangá", "manhwa", "pt-BR"]),
    ];
    const result = applyProviderFilters(providers, {
      query: "",
      status: "all",
      selectedTags: ["mangá", "manhwa"],
    });
    expect(result.map((p) => p.slug)).toEqual(["b"]);
  });

  it("idioma IETF é tag normal: filtra por inclusão como qualquer tag", () => {
    const providers = [
      provider("a", ["mangá", "pt-BR"]),
      provider("b", ["mangá", "en"]),
      provider("c", ["manhwa", "pt-BR"]),
    ];
    const byLang = applyProviderFilters(providers, {
      query: "",
      status: "all",
      selectedTags: ["pt-BR"],
    });
    expect(byLang.map((p) => p.slug).sort()).toEqual(["a", "c"]);

    const combined = applyProviderFilters(providers, {
      query: "",
      status: "all",
      selectedTags: ["manhwa", "pt-BR"],
    });
    expect(combined.map((p) => p.slug)).toEqual(["c"]);
  });

  it("busca local encontra por label pt-BR e código IETF cru", () => {
    const providers = [
      provider("mangalivre", ["mangá", "pt-BR"], { name: "Manga Livre" }),
      provider("other", ["manhwa", "en"], { name: "Other" }),
    ];
    const byLabel = applyProviderFilters(providers, {
      query: "manhwa",
      status: "all",
      selectedTags: [],
    });
    expect(byLabel.map((p) => p.slug)).toEqual(["other"]);

    const byLanguageLabel = applyProviderFilters(providers, {
      query: "português",
      status: "all",
      selectedTags: [],
    });
    expect(byLanguageLabel.map((p) => p.slug)).toEqual(["mangalivre"]);

    const byCode = applyProviderFilters(providers, {
      query: "pt-br",
      status: "all",
      selectedTags: [],
    });
    expect(byCode.map((p) => p.slug)).toEqual(["mangalivre"]);
  });

  it("coleta todas as tags crus, incluindo idioma IETF e legadas", () => {
    const providers = [provider("a", ["mangá", "pt-BR", "api"])];
    expect(collectContentTags(providers).sort()).toEqual(["api", "mangá", "pt-BR"]);
  });

  it("mangadex expõe todos os idiomas do catálogo, sem tag internacional", () => {
    const providers = [
      provider("mangadex", [
        "mangá",
        "pt-BR",
        "pt",
        "en",
        "es",
        "es-la",
        "ja",
        "ko",
        "zh",
        "zh-hk",
        "api",
        "scans",
      ]),
    ];
    const tags = collectContentTags(providers);
    expect(tags).not.toContain("internacional");
    for (const code of ["pt-BR", "pt", "en", "es", "es-la", "ja", "ko", "zh", "zh-hk"]) {
      expect(tags).toContain(code);
    }
    expect(tagLabel("es-la")).toBe("Espanhol (América Latina)");
    const byLang = applyProviderFilters(providers, {
      query: "",
      status: "all",
      selectedTags: ["es-la"],
    });
    expect(byLang.map((p) => p.slug)).toEqual(["mangadex"]);
  });
});
