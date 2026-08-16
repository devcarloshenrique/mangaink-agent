import type { MangaDetails, CachedChapter } from "@/types/manga-detail";

export const MOCK_MANGA_DETAILS: MangaDetails = {
  title: "Boruto: Two Blue Vortex",
  author: "Masashi Kishimoto",
  description:
    "Após a queda de Konoha e o selamento do Deus Árvore, o mundo vive sob uma trégua tensa. Enquanto Sarada e Mitsuki seguem seus próprios caminhos, Boruto retorna com um poder novo e incontrolável — o mesmo dos Otsutsuki.",
  status: null,
  genres: ["Acao", "Shounen", "Aventura"],
};

export const MOCK_CACHED_CHAPTERS: CachedChapter[] = [
  {
    id: "ch-1",
    number: "1",
    title: "Boruto Two Blue Vortex",
    pages: 22,
    cachedAt: "2026-07-20T14:30:00Z",
  },
  {
    id: "ch-2",
    number: "2",
    title: "Almas Gêmeas",
    pages: 21,
    cachedAt: "2026-07-20T14:32:00Z",
  },
  {
    id: "ch-3",
    number: "3",
    title: "Kawaki",
    pages: 20,
    cachedAt: "2026-07-20T14:35:00Z",
  },
  {
    id: "ch-4",
    number: "4",
    title: "O Retorno de Boruto",
    pages: 25,
    cachedAt: "2026-07-20T14:40:00Z",
  },
  {
    id: "ch-5",
    number: "5",
    title: "A Árvore Divina",
    pages: null,
    cachedAt: "2026-07-19T10:15:00Z",
  },
  {
    id: "ch-6",
    number: "6",
    title: "Sasuke e o Desconhecido",
    pages: 18,
    cachedAt: "2026-07-19T10:20:00Z",
  },
  {
    id: "ch-7",
    number: "7",
    title: "Garou",
    pages: 21,
    cachedAt: "2026-07-18T08:00:00Z",
  },
  {
    id: "ch-8",
    number: "8",
    title: "Missão Impossível",
    pages: 23,
    cachedAt: "2026-07-18T08:05:00Z",
  },
];

/* ── C07c · Lotes de conversão (dados mockados) ─────────────── */

export type MockVolState =
  "sent" | "ready" | "done" | "converting" | "queued" | "downloading" | "failed" | "cancelled";

export interface MockVol {
  vol: string;
  ch: string;
  size: string;
  state: MockVolState;
  sentAt?: string;
  pct?: number;
  err?: string;
}

export type MockLotStatus =
  "completed" | "processing" | "failed" | "partial" | "queued" | "downloading";

export interface MockLot {
  id: string;
  title: string;
  device: string;
  format: "MOBI" | "PDF" | "EPUB" | "CBZ";
  status: MockLotStatus;
  createdAt: string;
  totalMB: string;
  live?: boolean;
  series?: string;
  vols: MockVol[];
}

export const MOCK_LOTS: MockLot[] = [
  {
    id: "l1",
    title: "MOBI · 12 jul",
    device: "Paperwhite 11",
    format: "MOBI",
    status: "completed",
    createdAt: "12 jul",
    totalMB: "74,0 MB",
    vols: [
      { vol: "Vol. 1", ch: "Cap. 1 – 5", size: "12,4 MB", state: "sent", sentAt: "há 2d" },
      { vol: "Vol. 2", ch: "Cap. 6 – 11", size: "11,8 MB", state: "sent", sentAt: "há 2d" },
      { vol: "Vol. 3", ch: "Cap. 12 – 17", size: "13,2 MB", state: "ready" },
      { vol: "Vol. 4", ch: "Cap. 18 – 23", size: "12,9 MB", state: "ready" },
      { vol: "Vol. 5", ch: "Cap. 24 – 29", size: "12,1 MB", state: "ready" },
      { vol: "Vol. 6", ch: "Cap. 30 – 34", size: "11,6 MB", state: "ready" },
    ],
  },
  {
    id: "l2",
    title: "PDF · 3 jul",
    device: "Kindle Scribe",
    format: "PDF",
    status: "processing",
    createdAt: "3 jul",
    totalMB: "40,9 MB",
    live: true,
    vols: [
      { vol: "Vol. 1", ch: "Cap. 1 – 5", size: "14,2 MB", state: "done" },
      { vol: "Vol. 2", ch: "Cap. 6 – 11", size: "13,7 MB", state: "done" },
      { vol: "Vol. 3", ch: "Cap. 12 – 17", size: "13,0 MB", state: "converting", pct: 60 },
      { vol: "Vol. 4", ch: "Cap. 18 – 23", size: "—", state: "queued" },
    ],
  },
  {
    id: "l3",
    title: "EPUB · 28 jun",
    device: "Paperwhite 11",
    format: "EPUB",
    status: "failed",
    createdAt: "28 jun",
    totalMB: "8,1 MB",
    vols: [
      {
        vol: "Vol. 1",
        ch: "Cap. 1 – 5",
        size: "8,1 MB",
        state: "failed",
        err: "Erro ao baixar capítulos (HTTP 503)",
      },
    ],
  },
  {
    id: "l4",
    title: "CBZ · 15 jun",
    device: "Kindle Oasis",
    format: "CBZ",
    status: "partial",
    createdAt: "15 jun",
    totalMB: "27,3 MB",
    vols: [
      { vol: "Vol. 1", ch: "Cap. 1 – 5", size: "9,4 MB", state: "done" },
      { vol: "Vol. 2", ch: "Cap. 6 – 11", size: "9,1 MB", state: "cancelled" },
      { vol: "Vol. 3", ch: "Cap. 12 – 17", size: "8,8 MB", state: "cancelled" },
    ],
  },
  {
    id: "l5",
    title: "MOBI · 9 jun",
    device: "Kindle Basic",
    format: "MOBI",
    status: "queued",
    createdAt: "9 jun",
    totalMB: "18,6 MB",
    vols: [
      { vol: "Vol. 1", ch: "Cap. 1 – 5", size: "9,5 MB", state: "queued" },
      { vol: "Vol. 2", ch: "Cap. 6 – 11", size: "9,1 MB", state: "queued" },
    ],
  },
  {
    id: "l6",
    title: "EPUB · 2 jun",
    device: "Kindle Scribe",
    format: "EPUB",
    status: "downloading",
    createdAt: "2 jun",
    totalMB: "31,2 MB",
    live: true,
    vols: [
      { vol: "Vol. 1", ch: "Cap. 1 – 5", size: "10,8 MB", state: "done" },
      { vol: "Vol. 2", ch: "Cap. 6 – 11", size: "10,2 MB", state: "downloading", pct: 35 },
      { vol: "Vol. 3", ch: "Cap. 12 – 17", size: "10,2 MB", state: "queued" },
    ],
  },
  {
    id: "l7",
    title: "PDF · 26 mai",
    device: "Paperwhite 11",
    format: "PDF",
    status: "completed",
    createdAt: "26 mai",
    totalMB: "23,4 MB",
    vols: [
      { vol: "Vol. 1", ch: "Cap. 1 – 5", size: "12,0 MB", state: "sent", sentAt: "há 1d" },
      { vol: "Vol. 2", ch: "Cap. 6 – 11", size: "11,4 MB", state: "sent", sentAt: "há 1d" },
    ],
  },
  {
    id: "l8",
    title: "MOBI · 8 jul",
    device: "Paperwhite 11",
    format: "MOBI",
    status: "processing",
    createdAt: "8 jul",
    series: "One Piece",
    totalMB: "325,0 MB",
    live: true,
    vols: Array.from({ length: 26 }, (_, i) => {
      const n = i + 1;
      const st: MockVolState = n <= 23 ? "ready" : n <= 25 ? "converting" : "queued";
      return {
        vol: "Vol. " + n,
        ch: "Cap. " + (n * 5 - 4) + " – " + n * 5,
        size: (11.5 + (n % 5) * 0.5).toFixed(1).replace(".", ",") + " MB",
        state: st,
        pct: st === "converting" ? (n === 24 ? 60 : 40) : undefined,
      };
    }),
  },
];
