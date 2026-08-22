import { mkdir, writeFile, readdir, copyFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { getPrisma } from '../src/shared/database/prisma'
import { env } from '../src/shared/config/env'

const STORAGE_ROOT = join(process.cwd(), 'storage')
const SOURCES_DIR = join(STORAGE_ROOT, 'sources')

async function getAllSourceImages(sourceId: string, chapterList: string[]): Promise<string[]> {
  const images: string[] = []
  
  for (const chap of chapterList) {
    const chapDir = join(SOURCES_DIR, sourceId, 'chapters', chap)
    if (existsSync(chapDir)) {
      const files = await readdir(chapDir)
      const imageFiles = files
        .filter((f) => /\.(webp|png|jpg|jpeg)$/i.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      
      for (const img of imageFiles) {
        images.push(join(chapDir, img))
      }
    }
  }

  return images
}

async function getFallbackImages(): Promise<string[]> {
  const csmSource = 'src-chainsaw-man-pt-br-3105f24a'
  const csmChapters = ['chap_0001', 'chap_0002', 'chap_0003']
  const images = await getAllSourceImages(csmSource, csmChapters)
  if (images.length > 0) return images

  const mtSource = 'src-mushoku-tensei-jobless-reincarnation-3b1c3f7a'
  const mtChapters = ['chap_0001', 'chap_0002']
  return getAllSourceImages(mtSource, mtChapters)
}

async function seedStorage() {
  const prisma = getPrisma()
  try {
    const conversions = await prisma.conversion.findMany({
      include: { jobs: { orderBy: { bookIndex: 'asc' } } },
    })

    console.log(`Limpando e recriando previews para ${conversions.length} conversões...`)
    const fallbackImages = await getFallbackImages()

    for (const c of conversions) {
      const books = (c.books as Array<{ title?: string; chapters?: string[] }>) || []
      
      for (let i = 0; i < c.jobs.length; i++) {
        const j = c.jobs[i]
        if (!j.outputFile) continue

        const jobOutputDir = join(
          env.CONVERSIONS_STORAGE_PATH,
          c.conversionId,
          'jobs',
          j.jobId,
          'output'
        )

        const base = j.outputFile.replace(/\.[^.]+$/, '')
        const tempDir = join(jobOutputDir, 'temp', base)
        const imagesDir = join(tempDir, 'images')

        // Remove temp anterior completamente para evitar arquivos residuais
        await rm(tempDir, { recursive: true, force: true })
        await mkdir(imagesDir, { recursive: true })

        const book = books[j.bookIndex ?? i]
        const chapters = book?.chapters ?? []

        let imagesToUse: string[] = []
        if (c.sourceId && chapters.length > 0) {
          imagesToUse = await getAllSourceImages(c.sourceId, chapters)
        }

        if (imagesToUse.length === 0) {
          imagesToUse = fallbackImages
        }

        const pages = []
        for (let idx = 0; idx < imagesToUse.length; idx++) {
          const srcImgPath = imagesToUse[idx]
          const imgExt = srcImgPath.split('.').pop()?.toLowerCase() ?? 'webp'
          const filename = `${String(idx).padStart(5, '0')}.${imgExt}`
          const destImgPath = join(imagesDir, filename)

          await copyFile(srcImgPath, destImgPath)

          const contentType =
            imgExt === 'webp'
              ? 'image/webp'
              : imgExt === 'png'
              ? 'image/png'
              : 'image/jpeg'

          pages.push({
            index: idx,
            filename,
            contentType,
          })
        }

        const indexData = {
          sourceMobi: j.outputFile,
          extractedAt: new Date().toISOString(),
          pages,
        }

        await writeFile(join(tempDir, 'index.json'), JSON.stringify(indexData, null, 2))
        await writeFile(join(tempDir, 'READY'), 'READY')

        // Arquivo dummy principal para download
        const dummyFilePath = join(jobOutputDir, j.outputFile)
        if (imagesToUse.length > 0) {
          await copyFile(imagesToUse[0], dummyFilePath)
        }

        console.log(`✓ Job ${j.jobId} (${j.outputFile}) limpo e gerado com ${pages.length} páginas reais`)
      }
    }

    console.log('\nTodos os diretórios de preview foram limpos e regerados com sucesso!')
  } catch (err) {
    console.error('Erro no seed de storage:', err)
  } finally {
    await prisma.$disconnect()
  }
}

seedStorage()
