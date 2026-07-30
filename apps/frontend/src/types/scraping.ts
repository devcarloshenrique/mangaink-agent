// types/scraping.ts — tipos espelhando o schema do backend (scraping.routes.ts)

export interface ProviderInfo {
  slug: string;
  name: string;
  engine: "api" | "cheerio" | "playwright";
  allowedDomains?: string[];
}

export interface Chapter {
  id: string;
  number: string;
  title: string;
  url: string;
  pages: number | null;
  volume: number | null;
  isDownloaded: boolean;
  isRead: boolean;
}

export interface Cover {
  id: string;
  type: "original" | "gallery" | "upload";
  label: string;
  imageUrl: string;
}

export interface MangaMetadata {
  title: string;
  author: string | null;
  description: string | null;
  status: string | null;
  genres: string[];
}

export interface Statistics {
  chapters: number;
  covers: number;
}

export interface SourceInspectResponse {
  sourceId: string;
  status: "ready";
  provider: {
    slug: string;
    name: string;
    engine: "api" | "cheerio" | "playwright";
  };
  source: {
    url: string;
    language: string | null;
  };
  metadata: MangaMetadata;
  chapters: Chapter[];
  covers: Cover[];
  statistics: Statistics;
}

export interface InspectTriggerResponse {
  sourceId: string;
  status: "ready" | "processing";
}
