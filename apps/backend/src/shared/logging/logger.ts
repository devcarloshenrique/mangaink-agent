import pino from 'pino'
import { env } from '../config/env'

/**
 * Logger estruturado global do backend (pino).
 *
 * Compartilhado por toda a aplicação — servidor Fastify, workers BullMQ e
 * camadas sem acesso a request (repositories, services). O nível é controlado
 * por `LOG_LEVEL` (env.ts), garantindo que produção não rode em `debug` por
 * padrão e que detalhes operacionais (ex.: sourceId) possam ser suprimidos.
 */
export const logger = pino({
  // Fallback 'info' cobre testes que mockam config/env sem LOG_LEVEL.
  level: env.LOG_LEVEL ?? 'info',
})
