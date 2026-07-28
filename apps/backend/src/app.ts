import { env } from './shared/config/env'
import { createServer } from './shared/server'
import { closeAllRedisConnections } from './shared/redis/safe-redis'
import { closeRedis } from './shared/redis/redis'

async function start() {
  const app = await createServer()

  await app.listen({ port: env.PORT, host: '0.0.0.0' })

  console.log(`🚀 Backend MangaInk Agent rodando em http://localhost:${env.PORT}`)
  console.log(`📚 Swagger UI disponível em http://localhost:${env.PORT}/api-docs`)

  // ── Graceful Shutdown ──────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`\n[Shutdown] Recebido ${signal}, fechando conexões…`)

    try {
      await app.close()
    } catch {
      // Servidor pode já estar fechado
    }

    await closeRedis()
    await closeAllRedisConnections()

    console.log('[Shutdown] Encerrado com sucesso')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

start()
