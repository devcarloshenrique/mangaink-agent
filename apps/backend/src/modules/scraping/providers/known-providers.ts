import type { ProviderSeed } from './known-providers.types'

/**
 * Provider conhecido — seed estático que também carrega os `domains`
 * (não persistidos no banco; usados como fallback/validação em runtime).
 */
export interface KnownProvider extends ProviderSeed {
  domains: string[]
}

/**
 * Definição estática única dos providers suportados (MEC-31 S5).
 * Fonte de verdade usada pelo `initProviders()` do boot para semear o banco
 * e, em caso de falha de banco, como fallback dos valores estáticos.
 *
 * Conteúdo de auditoria (MEC-33/2.1) — rate limits decididos: `.env` real tem
 * precedência quando existe; providers sem entry no `.env` usam o default do
 * `env.ts`:
 *   mangalivre         10/0   (do `.env`)
 *   imperiodabritannia 2/500  (do `.env`)
 *   mangasbrasuka      3/200  (default do `env.ts`; sem entry no `.env`)
 * engines e domínios refletem as strategies existentes em `providers/*`.
 */
export const KNOWN_PROVIDERS: KnownProvider[] = [
  {
    slug: 'mangalivre',
    name: 'Manga Livre',
    engine: 'cheerio',
    domains: ['mangalivre.to'],
    tags: ['mangá', 'pt-BR', 'scans'],
    status: 'active',
    homepage: 'https://mangalivre.to',
    rateLimitMaxConcurrent: 10,
    rateLimitMinTime: 0,
  },
  {
    slug: 'imperiodabritannia',
    name: 'Imperio da Britannia',
    engine: 'api',
    domains: [
      'imperiodabritannia.net',
      'api.imperiodabritannia.net',
      'cdn.imperiodabritannia.net',
    ],
    tags: ['mangá', 'pt-BR', 'api'],
    status: 'active',
    homepage: 'https://imperiodabritannia.net',
    rateLimitMaxConcurrent: 2,
    rateLimitMinTime: 500,
  },
  {
    slug: 'mangasbrasuka',
    name: 'Mangas Brasukas',
    engine: 'api',
    domains: [
      'mangasbrasuka.com.br',
      'app.mangasbrasuka.com.br',
      'cdn.mugiverso.com',
    ],
    tags: ['mangá', 'manhwa', 'manhua', 'pt-BR', 'api'],
    status: 'active',
    homepage: 'https://mangasbrasuka.com.br',
    rateLimitMaxConcurrent: 3,
    rateLimitMinTime: 200,
  },
  {
    slug: 'mangadex',
    name: 'MangaDex',
    engine: 'api',
    domains: ['mangadex.org', 'api.mangadex.org', 'uploads.mangadex.org'],
    tags: ['mangá', 'pt-BR', 'pt', 'en', 'es', 'es-la', 'ja', 'ko', 'zh', 'zh-hk', 'api', 'scans'],
    status: 'active',
    homepage: 'https://mangadex.org',
    rateLimitMaxConcurrent: 5,
    rateLimitMinTime: 200,
  },
]
