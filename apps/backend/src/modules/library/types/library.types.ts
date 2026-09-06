export interface LibraryItem {
  id: string
  userId: string
  sourceId: string
  title: string
  author: string | null
  coverUrl: string | null
  chaptersCount: number
  isFavorite: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

export interface UserLibrary {
  id: string
  userId: string
  sourceId: string
  isFavorite: boolean
  createdAt: Date | string
  updatedAt: Date | string
}
