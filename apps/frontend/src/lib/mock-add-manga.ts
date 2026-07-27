// Mock 100% front-end do fluxo "Adicionar obra" -> selecionar capitulos -> progresso.
// Nenhuma chamada de backend e feita aqui.
import mockCover from "@/assets/mock-manga-cover.jpg";

export interface MockChapter {
  id: string;
  number: string;
  title: string;
  pages: number;
  releasedAt: string;
}

export interface MockManga {
  id: string;
  title: string;
  altTitle: string;
  author: string;
  artist: string;
  year: number;
  status: string;
  rating: number;
  genres: string[];
  description: string;
  cover: string;
  chapters: MockChapter[];
}

const CHAPTER_TITLES = [
  "Para voce, daqui a 2000 anos",
  "Aquele dia",
  "Noite da cerimonia de formatura",
  "Primeira batalha",
  "Um brilho no meio do desespero",
  "O mundo que a garota viu",
  "Lamina pequena",
  "Rugido",
  "O som dos passos",
  "Resposta a esquerda",
  "Reacao",
  "Ferida",
  "Armas primitivas",
  "Um ao outro",
  "Solidao especial",
  "Necessidade",
  "Doutrina de armas",
  "Agora, o que devemos fazer?",
  "Ainda nao consigo ver",
  "Corpo de Exploracao",
  "A garota de olhos glaciais",
  "A formacao de longo alcance",
  "Golpe fatal",
  "Fraqueza",
];

export const MOCK_ADD_MANGA: MockManga = {
  id: "src-shingeki-no-kyojin",
  title: "Shingeki no Kyojin",
  altTitle: "Attack on Titan",
  author: "Hajime Isayama",
  artist: "Hajime Isayama",
  year: 2009,
  status: "Finalizado",
  rating: 4.8,
  genres: ["Acao", "Drama", "Fantasia", "Shounen", "Misterio"],
  description:
    "Ha mais de um seculo, a humanidade foi dizimada pelo surgimento de criaturas gigantes chamadas Titas. Os sobreviventes se refugiaram atras de tres muralhas: Maria, Rose e Sina. Eren Yeager sonha em explorar o mundo alem das muralhas — ate que um Tita Colossal derruba a Muralha Maria e muda o destino de todos.",
  cover: mockCover,
  chapters: CHAPTER_TITLES.map((title, i) => ({
    id: `ch-${i + 1}`,
    number: String(i + 1),
    title,
    pages: 18 + ((i * 7) % 12),
    releasedAt: new Date(2026, 0, 5 + i * 6).toISOString(),
  })),
};

// ── Store em memoria para passar a selecao entre a modal e a tela de progresso ──

export interface MockConversionRequest {
  mangaTitle: string;
  author: string;
  cover: string;
  format: string;
  chapters: MockChapter[];
}

let currentRequest: MockConversionRequest | null = null;

export function setMockConversionRequest(req: MockConversionRequest) {
  currentRequest = req;
}

export function getMockConversionRequest(): MockConversionRequest {
  return (
    currentRequest ?? {
      mangaTitle: MOCK_ADD_MANGA.title,
      author: MOCK_ADD_MANGA.author,
      cover: MOCK_ADD_MANGA.cover,
      format: "EPUB",
      chapters: MOCK_ADD_MANGA.chapters.slice(0, 6),
    }
  );
}
