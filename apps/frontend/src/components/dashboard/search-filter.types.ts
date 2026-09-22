export type SearchLanguage =
  | "all"
  | "pt-br"
  | "en"
  | "es"
  | "ja"
  | "ko"
  | "zh"
  | "fr"
  | "it"
  | "de"
  | "ru"
  | "id"
  | "vi"
  | "tr"
  | "pl"
  | "ar"
  | "th";

export type WorkType = "manga" | "manhwa" | "manhua" | "webtoon" | "comic";

export type SortOption = "relevance" | "alphabetical";

export interface SearchFilters {
  language: SearchLanguage;
  workTypes: WorkType[];
  providers: string[]; // slugs dos provedores selecionados
  sortBy: SortOption;
}

export const DEFAULT_FILTERS: SearchFilters = {
  language: "pt-br",
  workTypes: [],
  providers: [],
  sortBy: "relevance",
};

export interface LanguageOption {
  value: SearchLanguage;
  label: string;
  shortLabel: string;
  popular?: boolean;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "all", label: "Todos os Idiomas", shortLabel: "TODOS", popular: true },
  { value: "pt-br", label: "Português", shortLabel: "PT-BR", popular: true },
  { value: "en", label: "Inglês", shortLabel: "EN", popular: true },
  { value: "es", label: "Espanhol", shortLabel: "ES", popular: true },
  { value: "ja", label: "Japonês", shortLabel: "JA", popular: true },
  { value: "ko", label: "Coreano", shortLabel: "KO", popular: true },
  { value: "zh", label: "Chinês", shortLabel: "ZH", popular: true },
  { value: "fr", label: "Francês", shortLabel: "FR" },
  { value: "it", label: "Italiano", shortLabel: "IT" },
  { value: "de", label: "Alemão", shortLabel: "DE" },
  { value: "ru", label: "Russo", shortLabel: "RU" },
  { value: "id", label: "Indonésio", shortLabel: "ID" },
  { value: "vi", label: "Vietnamita", shortLabel: "VI" },
  { value: "tr", label: "Turco", shortLabel: "TR" },
  { value: "pl", label: "Polonês", shortLabel: "PL" },
  { value: "ar", label: "Árabe", shortLabel: "AR" },
  { value: "th", label: "Tailandês", shortLabel: "TH" },
];

export const WORK_TYPE_OPTIONS: Array<{
  value: WorkType;
  label: string;
  description: string;
}> = [
  { value: "manga", label: "Mangá", description: "Quadrinhos japoneses" },
  { value: "manhwa", label: "Manhwa", description: "Quadrinhos coreanos" },
  { value: "manhua", label: "Manhua", description: "Quadrinhos chineses" },
  { value: "webtoon", label: "Webtoon", description: "Formato scroll vertical" },
  { value: "comic", label: "Comic / HQ", description: "Quadrinhos ocidentais" },
];

export interface SearchProviderOption {
  slug: string;
  name: string;
  engine?: string;
  tags?: string[];
  language?: SearchLanguage | string;
}

/** Provedores padrão e mockados para demonstração de escala (100+ provedores). */
export const MOCK_PROVIDERS_CATALOG: SearchProviderOption[] = [
  {
    slug: "mangalivre",
    name: "MangaLivre",
    engine: "cheerio",
    tags: ["manga", "pt-br"],
    language: "pt-br",
  },
  {
    slug: "imperiodabritannia",
    name: "Império da Britannia",
    engine: "api",
    tags: ["manhwa", "pt-br"],
    language: "pt-br",
  },
  {
    slug: "mangasbrasuka",
    name: "Mangás Brasuka",
    engine: "api",
    tags: ["manga", "pt-br"],
    language: "pt-br",
  },
  {
    slug: "mangadex",
    name: "MangaDex",
    engine: "api",
    tags: ["manga", "multi-idioma"],
    language: "all",
  },
  {
    slug: "asurascans",
    name: "Asura Scans",
    engine: "cheerio",
    tags: ["manhwa", "webtoon"],
    language: "en",
  },
  {
    slug: "flamecomics",
    name: "Flame Comics",
    engine: "cheerio",
    tags: ["manhwa", "webtoon"],
    language: "en",
  },
  {
    slug: "reaperscans",
    name: "Reaper Scans",
    engine: "api",
    tags: ["manhwa", "pt-br"],
    language: "pt-br",
  },
  {
    slug: "brmangas",
    name: "BR Mangás",
    engine: "cheerio",
    tags: ["manga", "pt-br"],
    language: "pt-br",
  },
  {
    slug: "neoxscans",
    name: "Neox Scans",
    engine: "cheerio",
    tags: ["manhwa", "pt-br"],
    language: "pt-br",
  },
  {
    slug: "tsundoku",
    name: "Tsundoku Traduções",
    engine: "cheerio",
    tags: ["manga", "pt-br"],
    language: "pt-br",
  },
  {
    slug: "sinensis",
    name: "Sinensis Scan",
    engine: "cheerio",
    tags: ["manhua", "pt-br"],
    language: "pt-br",
  },
  {
    slug: "webtoonxyz",
    name: "Webtoon XYZ",
    engine: "cheerio",
    tags: ["webtoon", "en"],
    language: "en",
  },
  {
    slug: "mangahost",
    name: "MangaHost",
    engine: "cheerio",
    tags: ["manga", "pt-br"],
    language: "pt-br",
  },
  {
    slug: "lermanga",
    name: "Ler Mangá",
    engine: "cheerio",
    tags: ["manga", "manhwa", "pt-br"],
    language: "pt-br",
  },
  {
    slug: "comick",
    name: "ComicK",
    engine: "api",
    tags: ["manga", "multi-idioma"],
    language: "all",
  },
  {
    slug: "mangapark",
    name: "MangaPark",
    engine: "cheerio",
    tags: ["manga", "en"],
    language: "en",
  },
  { slug: "mangafox", name: "MangaFox", engine: "cheerio", tags: ["manga", "en"], language: "en" },
  {
    slug: "manganelo",
    name: "Manganelo",
    engine: "cheerio",
    tags: ["manga", "en"],
    language: "en",
  },
  { slug: "mangasee", name: "MangaSee", engine: "cheerio", tags: ["manga", "en"], language: "en" },
  {
    slug: "mangakakalot",
    name: "MangaKakalot",
    engine: "cheerio",
    tags: ["manga", "en"],
    language: "en",
  },
  {
    slug: "mangaplus",
    name: "MangaPlus",
    engine: "api",
    tags: ["shounen", "oficial", "pt-br"],
    language: "pt-br",
  },
  {
    slug: "webtoons",
    name: "Webtoons Official",
    engine: "api",
    tags: ["webtoon", "oficial"],
    language: "en",
  },
  {
    slug: "randomscan",
    name: "Random Scan",
    engine: "cheerio",
    tags: ["manhwa", "pt-br"],
    language: "pt-br",
  },
  {
    slug: "hunterscan",
    name: "Hunter Scan",
    engine: "cheerio",
    tags: ["manhwa", "pt-br"],
    language: "pt-br",
  },
  {
    slug: "prismascan",
    name: "Prisma Scan",
    engine: "cheerio",
    tags: ["manga", "pt-br"],
    language: "pt-br",
  },
  {
    slug: "remangas",
    name: "Remangas",
    engine: "cheerio",
    tags: ["manga", "pt-br"],
    language: "pt-br",
  },
  {
    slug: "tumangaonline",
    name: "TuMangaOnline",
    engine: "api",
    tags: ["manga", "es"],
    language: "es",
  },
  { slug: "rawkuma", name: "Rawkuma", engine: "cheerio", tags: ["manga", "ja"], language: "ja" },
  { slug: "klmanga", name: "KlManga", engine: "cheerio", tags: ["manga", "ja"], language: "ja" },
];
