import 'dotenv/config'
import { z } from 'zod'

const numericMs = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      const cleaned = val.replace(/[^0-9.-]/g, '')
      if (cleaned === '' || cleaned === '-') return undefined
      return Number(cleaned)
    }
    return val
  },
  z.number().int().nonnegative(),
)

const positiveMs = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      const cleaned = val.replace(/[^0-9.-]/g, '')
      if (cleaned === '' || cleaned === '-') return undefined
      return Number(cleaned)
    }
    return val
  },
  z.number().int().positive(),
)

const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'test', 'production']).default('dev'),
  PORT: z.coerce.number().default(3333),
  JWT_SECRET: z.string(),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  STORAGE_PATH: z.string().default('./storage'),
  KCC_DOCKER_IMAGE: z.string().default('mangaink-kcc:10.3.0'),
  CONVERSIONS_STORAGE_PATH: z.string().default('./storage/conversions'),

  // Imagem Docker usada para extrair paginas de MOBI (preview no navegador)
  MOBI_DOCKER_IMAGE: z.string().default('mangaink-unpack:0.4.1'),
  // TTL (segundos) do cache de preview em /temp (default 24h)
  MOBI_PREVIEW_TTL_SEC: z.coerce.number().int().positive().default(86400),

  JOB_STATUS_TTL_SEC: z.coerce.number().int().positive().default(21600),

  // Rate Limiting por Provider (bottleneck) — valores em ms
  RATE_LIMIT_DEFAULT_MAX_CONCURRENT: positiveMs.default(6),
  RATE_LIMIT_DEFAULT_MIN_TIME: numericMs.default(50),
  RATE_LIMIT_MANGALIVRE_MAX_CONCURRENT: positiveMs.default(8),
  RATE_LIMIT_MANGALIVRE_MIN_TIME: numericMs.default(0),
  RATE_LIMIT_IMPERIODABRITANNIA_MAX_CONCURRENT: positiveMs.default(2),
  RATE_LIMIT_IMPERIODABRITANNIA_MIN_TIME: numericMs.default(500),
})

const _env = envSchema.safeParse(process.env)

if (_env.success === false) {
  console.error('❌ Variáveis de ambiente inválidas:', _env.error.format())
  throw new Error('Variáveis de ambiente inválidas')
}

export const env = _env.data
