/**
 * Seletores CSS do Manga Livre.
 * Centralizados aqui para facilitar manutenção quando o HTML mudar.
 */
export const MANGALIVRE_SELECTORS = {
  title: 'h1',
  author: 'a[href*="/manga-author/"]',
  description: '.description, .summary, .desc, .manga-synopsis',
  cover: '.summary_image img, .tab-summary img, .post-content img, img.wp-post-image',
  genres: '.genres-content a[href*="/genero/"]',
  fallbackGenres: 'a[href*="/genero/"]',
  chapters: 'a[href*="/capitulo-"]',
  ogTitle: 'meta[property="og:title"]',
  ogImage: 'meta[property="og:image"]',
  ogDescription: 'meta[property="og:description"]',

  // ── Seletores de capítulo (página do leitor) ──────────────────────
  /** Container principal do leitor de capítulos */
  readerContainer: '#reader, .reader-container, .reading-content, .chapter-content, .entry-content',
  /** Imagens dentro do leitor */
  chapterImages: '#reader img, .reader-container img, .reading-content img, .chapter-content img, .entry-content img',
  /** Imagens com lazy loading (data-src) */
  chapterImagesLazy: 'img[data-src*="mangalivre"], img[data-src*="wp-content"], img[data-lazy-src]',
  /** Possível script com array de imagens */
  imageScript: 'script:contains("images"), script:contains("imgs"), script:contains("pages")',
} as const
