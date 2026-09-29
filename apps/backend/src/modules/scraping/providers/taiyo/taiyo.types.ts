export interface TaiyoMediaTitle {
  title: string
  language: string
}

export interface TaiyoMeiliHit {
  id: string
  synopsis?: string | null
  mainCoverId?: string | null
  status?: string | null
  genres?: string[]
  titles: TaiyoMediaTitle[]
}

export interface TaiyoChapterSummary {
  id: string
  number: number
  volume?: number | null
  title?: string | null
  language?: string | null
  createdAt?: string
}

export interface TaiyoChapterDetail {
  id: string
  number: number
  volume?: number | null
  title?: string | null
  pages: Array<{
    id: string
    extension?: string
    pageNumber?: number
  }>
}
