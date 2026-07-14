import { prisma } from '../src/shared/database/prisma'
import { PrismaSourceRepository } from '../src/modules/scraping/repositories/prisma-source.repository'

const SOURCE_ID = 'smoke-test-00000001'
const now = new Date().toISOString()

const payload = {
  sourceId: SOURCE_ID,
  status: 'ready' as const,
  provider: { slug: 'mangalivre', name: 'Mangá Livre', engine: 'cheerio' as const },
  source: { url: 'https://mangalivre.net/manga/one-piece/19', language: 'pt-br' },
  metadata: { title: 'One Piece', author: 'Eiichiro Oda', description: null, status: 'ongoing', genres: ['Ação', 'Aventura'] },
  chapters: [
    { id: 'ch_smoke_001', number: '1', title: 'Romance Dawn', url: 'https://example.com/1', pages: 53, volume: 1 },
    { id: 'ch_smoke_002', number: '2', title: 'Luffy vs Alvida', url: 'https://example.com/2', pages: 19, volume: 1 },
  ],
  covers: [
    { id: 'cv_smoke_001', type: 'original' as const, label: 'Capa Volume 1', imageUrl: 'https://example.com/cover.jpg' },
  ],
  statistics: { chapters: 2, covers: 1 },
  cache: { createdAt: now, updatedAt: now, lastAccessAt: now, cacheTtlHours: 24, retentionDays: 30 },
}

async function main() {
  const repo = new PrismaSourceRepository()

  console.log('🔍 Smoke test: PrismaSourceRepository\n')

  // Cleanup
  await prisma.chapter.deleteMany({ where: { sourceId: SOURCE_ID } })
  await prisma.cover.deleteMany({ where: { sourceId: SOURCE_ID } })
  await prisma.source.deleteMany({ where: { sourceId: SOURCE_ID } })

  // 1. exists (antes)
  let exists = await repo.exists(SOURCE_ID)
  console.log(`1. exists antes do save = ${exists} ${!exists ? '✅' : '❌'}`)

  // 2. save
  await repo.save(SOURCE_ID, payload)
  console.log('2. save() executado ✅')

  // 3. exists (depois)
  exists = await repo.exists(SOURCE_ID)
  console.log(`3. exists depois do save = ${exists} ${exists ? '✅' : '❌'}`)

  // 4. load
  const loaded = await repo.load(SOURCE_ID)
  if (!loaded) throw new Error('load retornou null inesperadamente')
  console.log(`4. load() → title="${loaded.metadata.title}", chapters=${loaded.chapters.length}, covers=${loaded.covers.length} ✅`)

  // 5. Verificar chapters no banco
  const dbChapters = await prisma.chapter.findMany({ where: { sourceId: SOURCE_ID }, orderBy: { number: 'asc' } })
  console.log(`5. DB: ${dbChapters.length} chapters na tabela ✅`)
  for (const ch of dbChapters) {
    console.log(`   → chapter_id="${ch.chapterId}", number="${ch.number}", title="${ch.title}"`)
  }

  // 6. Verificar covers no banco
  const dbCovers = await prisma.cover.findMany({ where: { sourceId: SOURCE_ID } })
  console.log(`6. DB: ${dbCovers.length} covers na tabela ✅`)

  // 7. Placeholders round-trip
  await repo.updatePlaceholderIndices(SOURCE_ID, 'ch_smoke_001', [3, 7, 12])
  const indices = await repo.getPlaceholderIndices(SOURCE_ID, 'ch_smoke_001')
  console.log(`7. placeholderIndices: [${indices}] ${JSON.stringify(indices) === '[3,7,12]' ? '✅' : '❌'}`)

  // 8. update parcial
  await repo.update(SOURCE_ID, { lastAccessAt: '2026-07-09T00:00:00Z' })
  const afterUpdate = await repo.load(SOURCE_ID)
  console.log(`8. update lastAccessAt: ${afterUpdate?.cache.lastAccessAt.startsWith('2026-07-09') ? '✅' : '❌'}`)

  // 9. delete com cascade
  await repo.delete(SOURCE_ID)
  const afterDelete = await repo.exists(SOURCE_ID)
  console.log(`9. delete → exists=${afterDelete} ${!afterDelete ? '✅' : '❌'}`)

  const chAfterDelete = await prisma.chapter.count({ where: { sourceId: SOURCE_ID } })
  const cvAfterDelete = await prisma.cover.count({ where: { sourceId: SOURCE_ID } })
  console.log(`10. cascade: chapters=${chAfterDelete}, covers=${cvAfterDelete} ${chAfterDelete === 0 && cvAfterDelete === 0 ? '✅' : '❌'}`)

  // 11. load após delete
  const nullLoad = await repo.load(SOURCE_ID)
  console.log(`11. load após delete = ${nullLoad === null ? 'null ✅' : '❌'}`)

  console.log('\n🏁 Todos os testes passaram!')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
