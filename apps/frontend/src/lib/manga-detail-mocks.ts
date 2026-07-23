import type { MangaDetails, CachedChapter } from "@/types/manga-detail";
import type { ConversionSummary, JobSummary } from "@/types/conversion";

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

export const MOCK_CONVERSIONS: ConversionSummary[] = [
  {
    conversionId: "conv-mock-one-piece",
    sourceId: "src-one-piece",
    title: "One Piece",
    status: "completed",
    progress: 100,
    totalJobs: 3,
    completedJobs: 3,
    failedJobs: 0,
    createdAt: "2026-07-21T14:00:00Z",
    updatedAt: "2026-07-21T14:30:00Z",
    finishedAt: "2026-07-21T14:30:00Z",
  },
  {
    conversionId: "conv-mock-jujutsu",
    sourceId: "src-jujutsu-kaisen",
    title: "Jujutsu Kaisen",
    status: "processing",
    progress: 50,
    totalJobs: 4,
    completedJobs: 2,
    failedJobs: 0,
    createdAt: "2026-07-22T10:00:00Z",
    updatedAt: "2026-07-22T12:15:00Z",
  },
  {
    conversionId: "conv-mock-chainsaw",
    sourceId: "src-chainsaw-man",
    title: "Chainsaw Man",
    status: "failed",
    progress: 0,
    totalJobs: 1,
    completedJobs: 0,
    failedJobs: 1,
    createdAt: "2026-07-18T08:00:00Z",
    updatedAt: "2026-07-18T08:15:00Z",
    finishedAt: "2026-07-18T08:15:00Z",
  },
];

export const MOCK_CONVERSION_JOBS: Record<string, JobSummary[]> = {
  "conv-mock-one-piece": [
    {
      jobId: "job-op-1",
      index: 0,
      title: "Vol. 1 — East Blue",
      status: "completed",
      progress: 100,
      outputFile: "One Piece - Vol. 1 - East Blue.epub",
    },
    {
      jobId: "job-op-2",
      index: 1,
      title: "Vol. 2 — Baroque Works",
      status: "completed",
      progress: 100,
      outputFile: "One Piece - Vol. 2 - Baroque Works.epub",
    },
    {
      jobId: "job-op-3",
      index: 2,
      title: "Vol. 3 — Skypiea",
      status: "completed",
      progress: 100,
      outputFile: "One Piece - Vol. 3 - Skypiea.epub",
    },
  ],
  "conv-mock-jujutsu": [
    {
      jobId: "job-jjk-1",
      index: 0,
      title: "Vol. 1 — O Inicio",
      status: "completed",
      progress: 100,
      outputFile: "Jujutsu Kaisen - Vol. 1.epub",
    },
    {
      jobId: "job-jjk-2",
      index: 1,
      title: "Vol. 2 — Maldicão",
      status: "completed",
      progress: 100,
      outputFile: "Jujutsu Kaisen - Vol. 2.epub",
    },
    {
      jobId: "job-jjk-3",
      index: 2,
      title: "Vol. 3 — Batalha de Tokyo",
      status: "converting",
      progress: 60,
    },
    {
      jobId: "job-jjk-4",
      index: 3,
      title: "Vol. 4 — Incidente de Shibuya",
      status: "queued",
      progress: 0,
    },
  ],
  "conv-mock-chainsaw": [
    {
      jobId: "job-csm-1",
      index: 0,
      title: "Vol. 1 — O Cao Motosserra",
      status: "failed",
      progress: 0,
      error: "Erro ao baixar capitulos",
    },
  ],
};
