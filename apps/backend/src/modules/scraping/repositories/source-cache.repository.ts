import type { SourceMetadataFile } from '../types/metadata.types'
import type { MetadataCache } from '../types/metadata.types'

/**
 * Interface/Porta do repositório de cache de sources.
 * O use-case depende desta abstração, não da implementação concreta.
 *
 * Implementações: FilesystemSourceRepository, PrismaSourceRepository.
 */
export interface SourceCacheRepository {
  /** Verifica se a source já existe no storage. */
  exists(sourceId: string): Promise<boolean>

  /** Carrega o metadata.json completo (com campos de cache). Retorna null se não existir. */
  load(sourceId: string): Promise<SourceMetadataFile | null>

  /** Persiste o metadata.json completo (substituição total). Cria diretórios se necessário. */
  save(sourceId: string, data: SourceMetadataFile): Promise<void>

  /** Atualiza apenas campos específicos do objeto cache sem reescrever tudo. */
  update(sourceId: string, patch: Partial<MetadataCache>): Promise<void>

  /** Remove completamente a pasta da source do storage. */
  delete(sourceId: string): Promise<void>

  /** Obtém índices de páginas placeholder de um capítulo (corrupção). */
  getPlaceholderIndices(sourceId: string, chapterId: string): Promise<number[]>

  /** Atualiza índices de páginas placeholder de um capítulo. */
  updatePlaceholderIndices(sourceId: string, chapterId: string, indices: number[]): Promise<void>

  /** Atualiza motivo de indisponibilidade de um capítulo (ou limpa passando null). */
  updateChapterUnavailableReason(sourceId: string, chapterId: string, reason: string | null): Promise<void>
}
