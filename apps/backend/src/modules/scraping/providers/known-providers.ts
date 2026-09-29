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
  {
    slug: 'taiyo',
    name: 'Taiyo',
    engine: 'api',
    domains: ['taiyo.moe', 'cdn.taiyo.moe', 'meilisearch.taiyo.moe'],
    tags: ['mangá', 'manhwa', 'pt-BR', 'api'],
    status: 'active',
    homepage: 'https://taiyo.moe',
    rateLimitMaxConcurrent: 5,
    rateLimitMinTime: 200,
  },
  {
    slug: 'mangapill',
    name: 'Mangapill',
    engine: 'cheerio',
    domains: ['mangapill.com', 'cdn.readdetectiveconan.com'],
    tags: ['mangá', 'en', 'scans'],
    status: 'active',
    homepage: 'https://mangapill.com',
    rateLimitMaxConcurrent: 3,
    rateLimitMinTime: 300,
  },
  {
    slug: 'mangaread',
    name: 'MangaRead',
    engine: 'cheerio',
    domains: ['mangaread.org', 'www.mangaread.org'],
    tags: ['mangá', 'manhwa', 'en', 'scans'],
    status: 'active',
    homepage: 'https://www.mangaread.org',
    rateLimitMaxConcurrent: 3,
    rateLimitMinTime: 300,
  },
  {
    slug: 'flamecomics',
    name: 'Flame Comics',
    engine: 'cheerio',
    domains: [
      'flamecomics.xyz',
      'www.flamecomics.xyz',
      'flamecomics.me',
      'www.flamecomics.me',
      'flamecomics.com',
      'www.flamecomics.com',
      'cdn.flamecomics.xyz',
      'flamescans.org',
    ],
    tags: ['mangá', 'manhwa', 'en', 'scans'],
    status: 'active',
    homepage: 'https://flamecomics.xyz',
    rateLimitMaxConcurrent: 3,
    rateLimitMinTime: 300,
  },
  {
    slug: 'asurascans',
    name: 'Asura Scans',
    engine: 'cheerio',
    domains: [
      'asurascans.com',
      'www.asurascans.com',
      'asuracomics.com',
      'www.asuracomics.com',
      'asuracomic.net',
      'cdn.asurascans.com',
    ],
    tags: ['mangá', 'manhwa', 'en', 'scans'],
    status: 'active',
    homepage: 'https://asurascans.com',
    rateLimitMaxConcurrent: 3,
    rateLimitMinTime: 300,
  },
  {
    slug: 'mangakakalot',
    name: 'MangaKakalot',
    engine: 'cheerio',
    domains: [
      'mangakakalot.gg',
      'www.mangakakalot.gg',
      'mangakakalot.com',
      'www.mangakakalot.com',
      'mangakakalot.tv',
      'www.mangakakalot.tv',
      'mangakakalot.to',
      'www.mangakakalot.to',
      'mangakakalot.org',
      'www.mangakakalot.org',
      'mangakakalot.fun',
      'www.mangakakalot.fun',
      '2xstorage.com',
      'imgs-2.2xstorage.com',
      'img-r1.2xstorage.com',
      'mkklcdnv6temp.com',
      'v1.mkklcdnv6temp.com',
      'v2.mkklcdnv6temp.com',
      'v3.mkklcdnv6temp.com',
      'v4.mkklcdnv6temp.com',
      'v5.mkklcdnv6temp.com',
      'v6.mkklcdnv6temp.com',
      'v7.mkklcdnv6temp.com',
      'v8.mkklcdnv6temp.com',
      'avt.mkklcdnv6temp.com',
      'mghcdn.com',
      'imgx.mghcdn.com',
      'thumb.mghcdn.com',
    ],
    tags: ['mangá', 'en', 'scans'],
    status: 'active',
    homepage: 'https://www.mangakakalot.gg',
    rateLimitMaxConcurrent: 3,
    rateLimitMinTime: 300,
  },
  {
    slug: 'mangafire',
    name: 'MangaFire',
    engine: 'api',
    domains: [
      'mangafire.to',
      'www.mangafire.to',
      'mangafire.sx',
      'www.mangafire.sx',
      'mangafire.is',
      'www.mangafire.is',
      's.mfcdn.nl',
      'static.mfcdn.nl',
    ],
    tags: ['mangá', 'manhwa', 'manhua', 'en', 'pt-BR', 'es', 'es-la', 'fr', 'ja', 'api'],
    status: 'active',
    homepage: 'https://mangafire.to',
    rateLimitMaxConcurrent: 4,
    rateLimitMinTime: 250,
  },
]
