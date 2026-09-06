import type { LibraryItem, UserLibrary } from '../types/library.types'

export interface LibraryRepository {
  listByUser(userId: string, options?: { isFavorite?: boolean; query?: string }): Promise<LibraryItem[]>
  findByUserAndSource(userId: string, sourceId: string): Promise<UserLibrary | null>
  add(userId: string, sourceId: string): Promise<UserLibrary>
  remove(userId: string, sourceId: string): Promise<void>
  setFavorite(userId: string, sourceId: string, isFavorite: boolean): Promise<UserLibrary>
}
