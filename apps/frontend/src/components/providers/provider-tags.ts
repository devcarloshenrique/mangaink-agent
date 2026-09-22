// components/providers/provider-tags.ts — catálogo curado de tags dos providers.
//
// CONTRATO (não muda o backend):
// - O PATCH /api/conversions/source/providers/:slug continua trafegando apenas
//   os slugs crus em `tags: string[]` (ex.: "mangá", "pt-BR", "manhwa").
// - Este módulo é SÓ apresentação + filtro local: exibe labels pt-BR bonitas.
// - Tags de idioma são códigos IETF / BCP 47 (ex.: "pt-BR", "en", "ja")
//   guardados como tags normais — sem seção, badge ou filtro separado de idioma.

import type { ProviderRecord } from "@/types/scraping";

// ─── Tags curadas ───────────────────────────────────────────────────────────

export type ProviderTagGroup = "conteúdo" | "extras";

export interface CuratedTag {
  slug: string;
  label: string;
  group: ProviderTagGroup;
}

export const CURATED_TAGS: CuratedTag[] = [
  { slug: "mangá", label: "Mangá", group: "conteúdo" },
  { slug: "manhwa", label: "Manhwa", group: "conteúdo" },
  { slug: "manhua", label: "Manhua", group: "conteúdo" },
  { slug: "webtoon", label: "Webtoon", group: "conteúdo" },
];

const TAG_LABEL_BY_SLUG: Record<string, string> = Object.fromEntries(
  CURATED_TAGS.map((t) => [t.slug.trim().toLowerCase(), t.label]),
);

/** Código de idioma IETF / BCP 47 (minúsculo) → label pt-BR. Cobre o catálogo
 * de idiomas do MangaDex (`availableTranslatedLanguages`) + os 6 códigos base. */
const LANGUAGE_LABEL_BY_TAG: Record<string, string> = {
  "pt-br": "Português",
  pt: "Português (Portugal)",
  en: "Inglês",
  es: "Espanhol",
  "es-la": "Espanhol (América Latina)",
  ja: "Japonês",
  ko: "Coreano",
  zh: "Chinês",
  "zh-hk": "Chinês (Hong Kong)",
  ar: "Árabe",
  az: "Azerbaijano",
  be: "Bielorrusso",
  bg: "Búlgaro",
  bn: "Bengali",
  ca: "Catalão",
  cs: "Tcheco",
  cv: "Chuvash",
  da: "Dinamarquês",
  de: "Alemão",
  el: "Grego",
  eo: "Esperanto",
  et: "Estoniano",
  eu: "Basco",
  fa: "Persa",
  fi: "Finlandês",
  fr: "Francês",
  ga: "Irlandês",
  gl: "Galego",
  he: "Hebraico",
  hi: "Híndi",
  hr: "Croata",
  hu: "Húngaro",
  id: "Indonésio",
  is: "Islandês",
  it: "Italiano",
  jv: "Javanês",
  ka: "Georgiano",
  kk: "Cazaque",
  la: "Latim",
  lt: "Lituano",
  mn: "Mongol",
  ms: "Malaio",
  my: "Birmanês",
  ne: "Nepalês",
  nl: "Holandês",
  no: "Norueguês",
  pl: "Polonês",
  ro: "Romeno",
  ru: "Russo",
  sl: "Esloveno",
  sq: "Albanês",
  sr: "Sérvio",
  sv: "Sueco",
  ta: "Tâmil",
  te: "Télugo",
  th: "Tailandês",
  tl: "Tagalo",
  tr: "Turco",
  uk: "Ucraniano",
  ur: "Urdu",
  uz: "Uzbeque",
  vi: "Vietnamita",
};

/** Label pt-BR amigável para um slug cru; desconhecidas voltam cruas. */
export function tagLabel(tag: string): string {
  const key = tag.trim().toLowerCase();
  return TAG_LABEL_BY_SLUG[key] ?? LANGUAGE_LABEL_BY_TAG[key] ?? tag;
}

// ─── Filtro local (puro, testável) ──────────────────────────────────────────

export interface ProviderFilterInput {
  query: string;
  status: string;
  selectedTags: readonly string[];
}

function matchesQuery(p: ProviderRecord, q: string): boolean {
  // Busca local: nome, slug, tags crus e labels pt-BR.
  const tags = p.tags ?? [];
  const haystack = [p.name, p.slug, ...tags, ...tags.map(tagLabel)]
    .filter((v): v is string => Boolean(v))
    .map((v) => v.toLowerCase());
  return haystack.some((v) => v.includes(q));
}

/**
 * Filtro local da página /fontes. Semântica: tags por inclusão
 * (every/includes).
 */
export function applyProviderFilters(
  providers: ProviderRecord[],
  filters: ProviderFilterInput,
): ProviderRecord[] {
  let result = providers;
  const q = filters.query.trim().toLowerCase();
  if (q) {
    result = result.filter((p) => matchesQuery(p, q));
  }
  if (filters.status !== "all") {
    result = result.filter((p) => p.status === filters.status);
  }
  if (filters.selectedTags.length > 0) {
    result = result.filter((p) => filters.selectedTags.every((t) => (p.tags ?? []).includes(t)));
  }
  return result;
}

/** Tags únicas (slugs crus) presentes nos providers, ordenadas. */
export function collectContentTags(providers: ProviderRecord[]): string[] {
  const set = new Set<string>();
  for (const p of providers) {
    for (const t of p.tags ?? []) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
