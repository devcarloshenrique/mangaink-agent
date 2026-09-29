/**
 * Tipos brutos da API e HTML do Asura Scans.
 *
 * Estes tipos refletem a estrutura de dados retornada pelo site
 * asurascans.com / asuracomics.com.
 */

export interface AsuraScansSearchItem {
  id: string
  title: string
  url: string
  coverUrl?: string | null
  status?: string | null
}

export interface RawAsuraScansChapter {
  id: string
  url: string
  chapterNumber: string
  title: string
  releaseDate?: string | null
}

export interface RawAsuraScansComic {
  title: string
  url: string
  coverUrl: string | null
  synopsis: string | null
  status: string | null
  author: string | null
  artist: string | null
  genres: string[]
  chapters: RawAsuraScansChapter[]
}
