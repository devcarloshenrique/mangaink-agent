import type { MangaDetails, CachedChapter } from "@/types/manga-detail";

export const MOCK_MANGA_DETAILS: MangaDetails = {
  title: "Shingeki no Kyojin",
  author: "Hajime Isayama",
  description:
    "Ha mais de um seculo, a humanidade foi dizimada pelo surgimento de criaturas gigantes chamadas Titas. Os sobreviventes se refugiaram atras de tres muralhas gigantescas: Maria, Rose e Sina. Eren Yeager, um jovem que vive no distrito de Shiganshina, sonha em explorar o mundo alem das muralhas, assim como seu idolo, o Corpo de Exploracao. No entanto, sua vida muda para sempre quando um Tita Colossal aparece e destroi a Muralha Maria, desencadeando uma invasao que forca Eren e seus amigos Mikasa e Armin a enfrentar a dura realidade de um mundo dominado pelo medo.",
  status: null,
  genres: ["Acao", "Drama", "Fantasia", "Shounen", "Misterio"],
};

export const MOCK_CACHED_CHAPTERS: CachedChapter[] = [
  {
    id: "ch-1",
    number: "1",
    title: "Para voce, daqui a 2000 anos",
    pages: 22,
    cachedAt: "2026-07-20T14:30:00Z",
  },
  {
    id: "ch-2",
    number: "2",
    title: "Aquele dia",
    pages: 20,
    cachedAt: "2026-07-20T14:32:00Z",
  },
  {
    id: "ch-3",
    number: "3",
    title: "Noite da cerimonia de formatacao",
    pages: 19,
    cachedAt: "2026-07-20T14:35:00Z",
  },
  {
    id: "ch-4",
    number: "4",
    title: "Primeira batalha",
    pages: 25,
    cachedAt: "2026-07-20T14:40:00Z",
  },
  {
    id: "ch-5",
    number: "5",
    title: "Um brilho no meio do desespero",
    pages: null,
    cachedAt: "2026-07-19T10:15:00Z",
  },
  {
    id: "ch-6",
    number: "6",
    title: "O mundo que a garota viu",
    pages: 18,
    cachedAt: "2026-07-19T10:20:00Z",
  },
  {
    id: "ch-7",
    number: "7",
    title: "Lamina pequena",
    pages: 21,
    cachedAt: "2026-07-18T08:00:00Z",
  },
  {
    id: "ch-8",
    number: "8",
    title: "Rugido",
    pages: 23,
    cachedAt: "2026-07-18T08:05:00Z",
  },
];
