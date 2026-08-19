import 'dotenv/config'
import { z } from 'zod'

// Secrets JWT conhecidos como inseguros/previsíveis (VULN-3/MEC-79). O boot
// recusa qualquer um deles, independente de NODE_ENV (fail-fast no import).
const KNOWN_INSECURE_JWT_SECRETS = [
  'mangaink-agent-secret-change-in-production',
  'sua-chave-secreta-aqui-min-32-chars',
  'mangaink-agent-secret',
  'change-me-in-production',
]

const envSchema = z.object({
  // Vite/electron-vite dev definem NODE_ENV='development' — normaliza para 'dev'
  NODE_ENV: z
    .preprocess((val) => (val === 'development' ? 'dev' : val), z.enum(['dev', 'test', 'production']))
    .default('dev'),
  PORT: z.coerce.number().default(3333),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET deve ter ao menos 32 caracteres')
    .refine((val) => !KNOWN_INSECURE_JWT_SECRETS.includes(val), {
      message: 'JWT_SECRET não pode usar o valor default conhecido',
    }),
  DATABASE_URL: z.string(),
  // Token da API do Imperio da Britannia (VULN-2/MEC-78) — obrigatória: boot
  // falha se ausente (mesmo padrão do JWT_SECRET). Não usar default vazio.
  X_API_TOKEN: z.string().min(1, 'X_API_TOKEN é obrigatória'),

  // Nível do logger estruturado (pino). Padrão: 'info' em dev/produção e
  // 'silent' em testes (evita flood no output do Vitest). Produção nunca roda
  // em 'debug' por padrão — detalhes sensíveis (ex.: sourceId) ficam em logs
  // de debug e podem ser suprimidos via env.
  LOG_LEVEL: z
    .preprocess((val) => {
      if (val !== undefined) return val
      const nodeEnv = process.env.NODE_ENV === 'development' ? 'dev' : process.env.NODE_ENV
      return nodeEnv === 'test' ? 'silent' : 'info'
    }, z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])),

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

  // Habilita/desabilita o Swagger /api-docs (VULN-9/MEC-85). Sem a env, ativo
  // em dev/test e bloqueado em produção; "true"/"false" força o estado.
  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => {
      if (val !== undefined) return val === 'true'
      return process.env.NODE_ENV !== 'production'
    }),

  // Política de retenção/limpeza de storage órfão de conversões (VULN-8)
  // Intervalo entre varreduras do sweeper de storage órfão (ms) — default 6h
  STORAGE_SWEEPER_INTERVAL_MS: z.coerce.number().int().positive().default(6 * 60 * 60 * 1000),
  // Idade mínima (ms) de um diretório sem registro no banco para ser removido
  // (grace period anti-race com a criação da conversão) — default 24h
  STORAGE_SWEEPER_MIN_ORPHAN_AGE_MS: z.coerce.number().int().positive().default(24 * 60 * 60 * 1000),
})

const _env = envSchema.safeParse(process.env)
if (_env.success === false) {
  console.error('❌ Variáveis de ambiente inválidas:', _env.error.format())
  throw new Error('Variáveis de ambiente inválidas')
}

export const env = _env.data
