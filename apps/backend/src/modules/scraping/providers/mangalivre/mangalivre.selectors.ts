/**
 * Seletores CSS do Manga Livre.
 * Centralizados aqui para facilitar manutenção quando o HTML mudar.
 */
export const MANGALIVRE_SELECTORS = {
  title: 'h1',
  author: 'a[href*="/manga-author/"]',
  description: '.description, .summary, .desc, .manga-synopsis',
  cover: '.summary_image img, .tab-summary img, .post-content img, img.wp-post-image',
  genres: '.genres-content a[href*="/genero/"], a[href*="/genero/"]',
  chapters: 'a[href*="/capitulo-"]',
  ogTitle: 'meta[property="og:title"]',
  ogImage: 'meta[property="og:image"]',
  ogDescription: 'meta[property="og:description"]',
} as const
