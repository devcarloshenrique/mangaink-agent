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
    tags: ['mangá', 'português', 'scans'],
    status: 'active',
    description:
      'Acervo de mangás em português com leitura online. Requer scraping de HTML (cheerio).',
    urlExample: 'https://mangalivre.to/manga/hunter-x-hunter/',
    homepage: 'https://mangalivre.to',
    searchUrl: 'https://mangalivre.to/busca/?search=',
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
    tags: ['mangá', 'português', 'api'],
    status: 'active',
    description:
      'Site de mangás em português com API própria e imagens via CDN. Requer chamadas autenticadas por token.',
    urlExample: 'https://imperiodabritannia.net/manga/meu-manga/',
    homepage: 'https://imperiodabritannia.net',
    searchUrl: 'https://api.imperiodabritannia.net/search/',
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
    tags: ['mangá', 'manhwa', 'manhua', 'português', 'api'],
    status: 'active',
    description:
      'Site de mangás, manhwas e manhuas em português com API própria e imagens via CDN.',
    urlExample: 'https://mangasbrasuka.com.br/manga/mushoku-tensei-jobless-reincarnation/',
    homepage: 'https://mangasbrasuka.com.br',
    searchUrl: 'https://app.mangasbrasuka.com.br/api/search/',
    rateLimitMaxConcurrent: 3,
    rateLimitMinTime: 200,
  },
  {
    slug: 'mangadex',
    name: 'MangaDex',
    engine: 'api',
    domains: ['mangadex.org', 'api.mangadex.org', 'uploads.mangadex.org'],
    tags: ['mangá', 'português', 'api', 'internacional', 'scans'],
    status: 'active',
    description:
      'Plataforma global de leitura de mangás com suporte multilíngue (incluindo PT-BR) e API REST aberta.',
    urlExample: 'https://mangadex.org/title/183b5c1e-5bfd-4f7f-9b21-3ac88c584987/chi-chikyuu-no-undou-ni-tsuite',
    homepage: 'https://mangadex.org',
    searchUrl: 'https://mangadex.org/search?q=',
    rateLimitMaxConcurrent: 5,
    rateLimitMinTime: 200,
  },
]
