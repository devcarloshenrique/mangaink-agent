import { env } from './shared/config/env'
import { createServer } from './shared/server'

async function start() {
  const app = await createServer()

  await app.listen({ port: env.PORT, host: '0.0.0.0' })

  console.log(`🚀 Backend MangaInk Agent rodando em http://localhost:${env.PORT}`)
  console.log(`📚 Swagger UI disponível em http://localhost:${env.PORT}/api-docs`)
}

start()
