import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  // Vite/electron-vite dev definem NODE_ENV='development' — normaliza para 'dev'
  NODE_ENV: z
    .preprocess((val) => (val === 'development' ? 'dev' : val), z.enum(['dev', 'test', 'production']))
    .default('dev'),
  PORT: z.coerce.number().default(3333),
  JWT_SECRET: z.string(),
  DATABASE_URL: z.string(),

  // Modo embedded: backend embarcado no app desktop (true apenas para '1' ou 'true')
  MI_EMBEDDED_MODE: z
    .string()
    .optional()
    .transform((value) => value === '1' || value === 'true'),

  // Caminho raiz do runtime embarcado (usado apenas no modo embedded)
  MI_EMBEDDED_RUNTIME_PATH: z.string().optional(),

  // Ignorado no modo embedded (MI_EMBEDDED_MODE=1)
  REDIS_URL: z.string().optional().default('redis://localhost:6379'),
  STORAGE_PATH: z.string().default('./storage'),
  KCC_DOCKER_IMAGE: z.string().default('mangaink-kcc:10.3.0'),
  CONVERSIONS_STORAGE_PATH: z.string().default('./storage/conversions'),

  // Imagem Docker usada para extrair paginas de MOBI (preview no navegador)
  MOBI_DOCKER_IMAGE: z.string().default('mangaink-unpack:0.4.1'),
  // TTL (segundos) do cache de preview em /temp (default 24h)
  MOBI_PREVIEW_TTL_SEC: z.coerce.number().int().positive().default(86400),

  JOB_STATUS_TTL_SEC: z.coerce.number().int().positive().default(21600),

  MAX_USER_PRESETS: z.coerce.number().int().positive().default(20),
})

const _env = envSchema.safeParse(process.env)

if (_env.success === false) {
  console.error('❌ Variáveis de ambiente inválidas:', _env.error.format())
  throw new Error('Variáveis de ambiente inválidas')
}

export const env = _env.data
