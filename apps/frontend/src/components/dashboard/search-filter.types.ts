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

export type ProviderEngine = "api" | "cheerio" | "playwright";
export const ALL_ENGINES: ProviderEngine[] = ["api", "cheerio", "playwright"];

export interface SearchFilters {
  language: SearchLanguage;
  workTypes: WorkType[];
  engines: ProviderEngine[];
  providers: string[]; // slugs dos provedores selecionados
}

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
  { value: "comic", label: "Comic/HQ", description: "Quadrinhos ocidentais" },
];

export const ALL_WORK_TYPES: WorkType[] = WORK_TYPE_OPTIONS.map((o) => o.value);

export interface SearchProviderOption {
  slug: string;
  name: string;
  engine?: string;
  tags?: string[];
  language?: SearchLanguage | string;
  status?: string;
}

export const DEFAULT_FILTERS: SearchFilters = {
  language: "pt-br",
  workTypes: [...ALL_WORK_TYPES],
  engines: ["api", "cheerio", "playwright"],
  // Populado ao carregar os providers reais (veja useEffect em routes/index.tsx)
  providers: [],
};
