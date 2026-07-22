import type { MangaMetadata } from "@/types/scraping";

export type MangaDetails = MangaMetadata;

export interface CachedChapter {
  id: string;
  number: string;
  title: string;
  pages: number | null;
  cachedAt: string;
}
