import { KNOWN_PROVIDERS } from '../providers/known-providers'
import { toProviderResponse, type ProviderResponse } from '../dtos/provider.dto'
import type { ProviderRepository } from '../repositories/provider.repository'

/**
 * Caso de uso: listar todos os providers a partir do banco (fonte de verdade).
 *
 * Fallback: se o banco falhar, responde os valores estáticos de
 * `known-providers.ts` (mesmo conteúdo do seed do boot).
 *
 * Decisão (documentada): o endpoint é público e não deve quebrar por
 * indisponibilidade temporária do banco — dados estáticos consistentes valem
 * mais que um 500. TRADEOFF assumido: o catch engole QUALQUER erro (inclusive
 * bugs reais de leitura), não apenas falha de conexão; bugs reais aparecem no
 * `console.warn` abaixo (a camada de use-case não tem acesso ao logger do
 * Fastify). Se no futuro for desejado diferenciar "banco indisponível" de
 * "bug real", restringir o catch a erros de conexão/Prisma (P1001/P1008 etc.)
 * e deixar os demais propagarem.
 */
export class ListProvidersUseCase {
  constructor(private readonly repository: ProviderRepository) {}

  async execute(): Promise<ProviderResponse[]> {
    try {
      const providers = await this.repository.findAll()
      return providers.map(toProviderResponse)
    } catch (error) {
      console.warn(
        '[ListProvidersUseCase] falha ao ler providers do banco; usando known-providers.ts como fallback',
        error,
      )
      return KNOWN_PROVIDERS.map(toProviderResponse)
    }
  }
}
