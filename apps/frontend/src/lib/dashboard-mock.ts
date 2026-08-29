// ─── Dados mockados da home (bento grid) ─────────────────────────────────────
// Protótipo 100% mockado para validar o layout antes de plugar dados reais.
// As obras de "Continuar lendo" e "Sua biblioteca" usam dados REAIS da
// biblioteca (sourceIds e capas servidas pelo backend).

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type ConversionStage = "downloading" | "converting" | "generating" | "sending";

export const STAGE_ORDER: ConversionStage[] = [
  "downloading",
  "converting",
  "generating",
  "sending",
];

export const STAGE_LABELS: Record<ConversionStage, string> = {
  downloading: "Baixando imagens",
  converting: "Convertendo páginas",
  generating: "Gerando arquivo",
  sending: "Enviando pro Kindle",
};

// ─── Obras reais da biblioteca (fonte única) ─────────────────────────────────

const MUSHOKU_DESC =
  "Morto enquanto salvava um estranho de uma colisão de trânsito, um NEET de 34 anos " +
  "reencarna em um mundo de magia como Rudeus Greyrat, um bebê recém-nascido — decidido a " +
  "viver plenamente e não repetir os erros do passado.";

const HUNTER_DESC =
  "Gon Freecss descobre que o pai, dado como morto, está vivo e é um lendário Hunter. " +
  "Determinado a encontrá-lo, decide ele próprio se tornar um Hunter e parte em jornada.";

const MUSHOKU = {
  title: "Mushoku Tensei: Jobless Reincarnation",
  sourceId: "src-mushoku-tensei-jobless-reincarnation-3b1c3f7a",
  coverUrl:
    "/api/conversions/source/src-mushoku-tensei-jobless-reincarnation-3b1c3f7a/covers/original",
  author: "Rifujin na Magonote, Sirotaka",
  description: MUSHOKU_DESC,
};

const HUNTER = {
  title: "HUNTER x HUNTER",
  sourceId: "src-hunter-x-hunter-cb3c9071",
  coverUrl: "/api/conversions/source/src-hunter-x-hunter-cb3c9071/covers/original",
  author: "Togashi Yoshihiro",
  description: HUNTER_DESC,
};

// ─── Spotlight — continuar lendo (rotação automática) ────────────────────────

export interface RecentRead {
  title: string;
  sourceId: string;
  coverUrl: string;
  author: string;
  description: string;
  /** cor sólida de fallback caso a capa não carregue */
  hue: number;
}

export const recentReads: RecentRead[] = [
  { ...MUSHOKU, hue: 265 },
  { ...HUNTER, hue: 130 },
];

// ─── Conversões em andamento ─────────────────────────────────────────────────

export interface OngoingConversion {
  id: string;
  series: string;
  book?: string;
  coverUrl?: string;
  hue: number;
  format: "EPUB" | "MOBI" | "CBZ";
  delivery: "kindle" | "download";
  stage: ConversionStage;
  /** 0–100 */
  progress: number;
  etaMinutes: number;
}

export const ongoingConversions: OngoingConversion[] = [
  {
    id: "conv-1",
    series: "Chainsaw Man",
    book: "Vol. 13–15",
    coverUrl: "https://cdn.myanimelist.net/images/manga/3/216464.jpg",
    hue: 350,
    format: "EPUB",
    delivery: "kindle",
    stage: "downloading",
    progress: 64,
    etaMinutes: 6,
  },
  {
    id: "conv-2",
    series: "Monster",
    book: "Edição completa",
    coverUrl: "https://cdn.myanimelist.net/images/manga/3/258224.jpg",
    hue: 210,
    format: "MOBI",
    delivery: "download",
    stage: "converting",
    progress: 31,
    etaMinutes: 14,
  },
];

// ─── Novos capítulos das assinaturas ─────────────────────────────────────────

export interface NewChapterItem {
  series: string;
  chapter: number;
  coverUrl?: string;
  hue: number;
  when: string;
  isNew: boolean;
}

export const newChapters: NewChapterItem[] = [
  {
    series: "One Piece",
    chapter: 1109,
    coverUrl: "https://cdn.myanimelist.net/images/manga/2/253146.jpg",
    hue: 35,
    when: "há 3h",
    isNew: true,
  },
  {
    series: "Jujutsu Kaisen",
    chapter: 260,
    coverUrl: "https://cdn.myanimelist.net/images/manga/3/210341.jpg",
    hue: 265,
    when: "há 7h",
    isNew: true,
  },
  {
    series: "Chainsaw Man",
    chapter: 181,
    coverUrl: "https://cdn.myanimelist.net/images/manga/3/216464.jpg",
    hue: 350,
    when: "ontem",
    isNew: true,
  },
  {
    series: "Vinland Saga",
    chapter: 212,
    coverUrl: "https://cdn.myanimelist.net/images/manga/2/188925.jpg",
    hue: 190,
    when: "há 2 dias",
    isNew: false,
  },
  {
    series: "Hajime no Ippo",
    chapter: 1451,
    coverUrl: "https://cdn.myanimelist.net/images/manga/2/257880.jpg",
    hue: 120,
    when: "há 3 dias",
    isNew: false,
  },
];

// ─── Próximo agendamento ─────────────────────────────────────────────────────

export const nextSchedule = {
  series: "One Piece",
  chapter: 1110,
  etaDays: 3,
};

// ─── Sua biblioteca — pôsteres estilo AniList (obras reais repetidas) ────────

export interface ShelfSeries {
  title: string;
  sourceId: string;
  coverUrl: string;
  author: string;
  description: string;
  formats: string;
  conversions: number;
}

const SHELF_MUSHOKU: ShelfSeries = { ...MUSHOKU, formats: "PDF · K11", conversions: 1 };
const SHELF_HUNTER: ShelfSeries = { ...HUNTER, formats: "PDF · EPUB · K11", conversions: 4 };

export const libraryShelf: ShelfSeries[] = [
  SHELF_MUSHOKU,
  SHELF_HUNTER,
  SHELF_HUNTER,
  SHELF_MUSHOKU,
  SHELF_HUNTER,
  SHELF_MUSHOKU,
  SHELF_HUNTER,
  SHELF_MUSHOKU,
];

// ─── Estatísticas (rodapé) ───────────────────────────────────────────────────

export const stats = {
  chaptersConverted: 127,
  storageGb: 12.4,
};
