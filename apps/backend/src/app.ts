import { shutdownTracing } from './tracing'
import { env } from './shared/config/env'
import { createServer } from './shared/server'
import { closeAllRedisConnections } from './shared/redis/safe-redis'
import { closeRedis } from './shared/redis/redis'
import { logger } from './shared/logging/logger'

async function start() {
  const app = await createServer()

  await app.listen({ port: env.PORT, host: '0.0.0.0' })

  logger.info({ port: env.PORT }, 'Backend MangaInk Agent iniciado')
  if (env.SWAGGER_ENABLED) {
    logger.info({ url: `http://localhost:${env.PORT}/api-docs` }, 'Swagger UI disponivel')
  }

  // ————————————————————————————————————————————————————————————————————————
  const shutdown = async (signal: string) => {
    logger.info({ signal }, '[Shutdown] Recebido sinal, fechando conexoes')

    await shutdownTracing()

    try {
      await app.close()
    } catch {
      // Servidor pode jÃ¡ estar fechado
    }

    await closeRedis()
    await closeAllRedisConnections()

    logger.info('[Shutdown] Encerrado com sucesso')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

start()
