import * as cheerio from 'cheerio'
import { describe, expect, it } from 'vitest'
import { parseChapters, parseMetadata } from '../../providers/mangalivre/mangalivre.parser'

const SOURCE_URL = 'https://mangalivre.to/manga/hunter-x-hunter/'
const BASE_URL = 'https://mangalivre.to'

describe('MangaLivre parser', () => {
  it('prioriza os generos da obra quando .genres-content existe', () => {
    const $ = cheerio.load(`
      <main>
        <h1>Hunter x Hunter</h1>
        <div class="genres-content">
          <a href="/genero/acao/">Ação</a>
          <a href="/genero/shounen/">Shounen</a>
        </div>
      </main>
      <aside>
        <a href="/genero/romance/">Romance (55)</a>
        <a href="/genero/webtoon/">Webtoon (2)</a>
      </aside>
    `)

    expect(parseMetadata($, SOURCE_URL).genres).toEqual(['Ação', 'Shounen'])
  })

  it('usa fallback global de generos apenas quando nao ha bloco escopado', () => {
    const $ = cheerio.load(`
      <h1>Obra sem bloco</h1>
      <a href="/genero/acao/">Ação</a>
      <a href="/genero/aventura/">Aventura</a>
    `)

    expect(parseMetadata($, SOURCE_URL).genres).toEqual(['Ação', 'Aventura'])
  })

  it('extrai apenas capitulos da obra atual e preserva decimais no id', () => {
    const $ = cheerio.load(`
      <a href="/manga/hunter-x-hunter/capitulo-0-5/">Capitulo 0.5</a>
      <a href="/manga/hunter-x-hunter/capitulo-3_1/">Capitulo 3.1</a>
      <a href="/manga/hunter-x-hunter/capitulo-340-6/">Capitulo 340.6</a>
      <a href="/manga/solo-leveling-ragnarok/capitulo-67/">Capitulo 67</a>
    `)

    expect(parseChapters($, BASE_URL, SOURCE_URL)).toEqual([
      expect.objectContaining({
        id: 'chap_0000_5',
        number: '0.5',
        url: 'https://mangalivre.to/manga/hunter-x-hunter/capitulo-0-5/',
      }),
      expect.objectContaining({
        id: 'chap_0003_1',
        number: '3.1',
        url: 'https://mangalivre.to/manga/hunter-x-hunter/capitulo-3_1/',
      }),
      expect.objectContaining({
        id: 'chap_0340_6',
        number: '340.6',
        url: 'https://mangalivre.to/manga/hunter-x-hunter/capitulo-340-6/',
      }),
    ])
  })
})
