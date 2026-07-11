import { Worker } from 'bullmq'
import { join, extname } from 'node:path'
import { link, writeFile, readdir, mkdir, rm, readFile, rename, stat } from 'node:fs/promises'
import { env } from '../../../shared/config/env'
import { mkdirp, pathExists } from '../../../shared/utils/filesystem'
import { FilesystemJobRepository } from '../repositories/filesystem-job.repository'
import { FilesystemConversionRepository } from '../repositories/filesystem-conversion.repository'
import { ConversionPubSubService } from '../services/conversion-pubsub.service'
import { ConversionEventsService } from '../services/conversion-events.service'
import { ImageDownloaderService } from '../services/image-downloader.service'
import { KccRunnerService } from '../services/kcc-runner.service'
import type { ConversionJobData } from '../types/conversion.types'

const pubsub = new ConversionPubSubService()
const events = new ConversionEventsService(pubsub)

const worker = new Worker<ConversionJobData>(
  'conversion-job',
  async (job) => {
    const { conversionId, jobId, sourceId, chapters, cover, output, metadata, options, storagePath } = job.data

    // Repositórios escopados por conversionId (Jobs em storage/conversions/{conv}/jobs/{jobId}).
    const repository = new FilesystemJobRepository(conversionId)
    const conversions = new FilesystemConversionRepository()
    const downloader = new ImageDownloaderService(events, repository)
    const kccRunner = new KccRunnerService(events)

    /** Recomputa o status.json da Conversion após cada fase do Job. */
    const sync = () => conversions.syncStatus(conversionId).catch(() => {})

    const tempDir = join(storagePath, 'temp')
    const tempInputDir = join(tempDir, 'input')
    const outputPath = join(storagePath, 'output')

    await mkdir(tempInputDir, { recursive: true })
    await mkdir(outputPath, { recursive: true })

    // ── Job started ─────────────────────────────────────────────────
    await repository.update(jobId, {
      status: 'preparing',
      currentStep: 'Preparing conversion...',
    })
    await sync()
    await repository.appendLog(jobId, `Job iniciado — ${chapters.length} capítulos selecionados`)
    await events.emit(jobId, events.createEvent('job.started', { jobId }))

    // ── Fase 1: Garantir cache em sources/ ──────────────────────────
    // O downloader apenas salva em sources/{sourceId}/chapters/ (cache)
    let needsDownload = false

    for (const chapterId of chapters) {
      const cacheDir = join(env.STORAGE_PATH, 'sources', sourceId, 'chapters', chapterId)
      if (!(await pathExists(cacheDir))) {
        needsDownload = true
        break
      }
    }

    if (needsDownload) {
      await repository.update(jobId, {
        status: 'downloading',
        currentStep: 'Downloading images...',
      })
      await sync()
      await events.emit(jobId, events.createEvent('download.started', {
        jobId,
        totalChapters: chapters.length,
      }))
    }

    let totalDownloaded = 0
    let totalErrors = 0

    for (const chapterId of chapters) {
      // Verifica cancelamento
      const currentJob = await repository.findById(jobId)
      if (currentJob?.status === 'cancelled') {
        await repository.appendLog(jobId, 'Job cancelado durante download')
        return { jobId, status: 'cancelled', message: 'Job cancelled during download' }
      }

      // Busca URLs e garante cache
      const imageUrls = await getChapterImageUrls(sourceId, chapterId)

      const result = await downloader.downloadChapter(
        jobId,
        sourceId,
        chapterId,
        imageUrls,
      )

      totalDownloaded += result.downloadedImages
      totalErrors += result.errors
    }

    // ── Fase 2: Montar temp/input/ com hard links ───────────────────
    await repository.update(jobId, {
      status: 'preparing',
      currentStep: 'Creating hard links from cache...',
    })
    await sync()
    await repository.appendLog(jobId, 'Montando temp/input/ com hard links do cache')

    for (const chapterId of chapters) {
      const cacheDir = join(env.STORAGE_PATH, 'sources', sourceId, 'chapters', chapterId)
      const chapterInputDir = join(tempInputDir, chapterId)
      await mkdir(chapterInputDir, { recursive: true })

      const files = await readdir(cacheDir)
      const imageFiles = files.filter((f) => /\.(jpg|jpeg|png|webp|gif|bmp|avif)$/i.test(f))

      for (const file of imageFiles) {
        const src = join(cacheDir, file)
        const dest = join(chapterInputDir, file)
        try {
          await link(src, dest) // Hard link: instantâneo, zero duplicação
        } catch {
          // Fallback para cópia se hard link falhar (ex: cross-device)
          const { copyFile } = await import('node:fs/promises')
          await copyFile(src, dest)
        }
      }

      await repository.appendLog(jobId, `Hard links criados para ${chapterId} (${imageFiles.length} imagens)`)
    }

    // ── Fase 2.5: Aplicar capa ──────────────────────────────────────
    await applyCover(repository, jobId, sourceId, cover, tempInputDir)

    // ── Fase 2.6: Escrever metadados (ComicInfo.xml) ────────────────
    const sourceMeta = await readSourceMetadata(sourceId)
    await writeComicInfoXml(repository, jobId, tempInputDir, metadata, sourceMeta)

    // ── Fase 3: Conversão KCC ───────────────────────────────────────
    await repository.update(jobId, {
      status: 'converting',
      currentStep: 'Starting KCC conversion...',
    })
    await sync()
    await repository.appendLog(jobId, `KCC iniciado — device=${output.deviceId}, format=${output.format}`)

    const kccOptions = { ...options, metadataTitle: 'metadataOnly' as const }
    const kccResult = await kccRunner.run(
      jobId,
      kccOptions,
      output.deviceId,
      output.format,
      tempInputDir,
      outputPath,
      metadata.title,
    )

    // ── Fase 4: Packaging — renomear output e limpar temp ───────────
    await repository.update(jobId, {
      status: 'packaging',
      currentStep: 'Packaging output...',
    })
    await sync()

    // Renomeia o arquivo de saída para o nome bonito com o título real
    let finalOutputFile = kccResult.outputFile
    const desiredName = `${metadata.title}.${output.format.toLowerCase()}`

    if (finalOutputFile && finalOutputFile !== desiredName) {
      const currentPath = join(outputPath, finalOutputFile)
      const desiredPath = join(outputPath, desiredName)
      try {
        await rename(currentPath, desiredPath)
        finalOutputFile = desiredName
        await repository.appendLog(jobId, `Output renomeado: "${kccResult.outputFile}" → "${desiredName}"`)
      } catch {
        // Se renomear falhar, mantém o nome original
        await repository.appendLog(jobId, `Falha ao renomear output, mantendo "${finalOutputFile}"`)
      }
    }

    // Calcula tamanho final
    let finalOutputSize = kccResult.outputSize
    try {
      const stats = await stat(join(outputPath, finalOutputFile))
      finalOutputSize = stats.size
    } catch {
      // Mantém o tamanho original
    }

    // Limpa temp/ inteiro
    try {
      await rm(tempDir, { recursive: true, force: true })
      await repository.appendLog(jobId, 'Diretório temp/ removido')
    } catch (err) {
      await repository.appendLog(jobId, `Aviso: falha ao remover temp/ — ${err instanceof Error ? err.message : 'unknown'}`)
    }

    // ── Job finished ────────────────────────────────────────────────
    const downloadUrl = `/api/conversions/${conversionId}/jobs/${jobId}/download`

    await repository.update(jobId, {
      status: 'completed',
      progress: 100,
      currentStep: 'Done',
      completedAt: new Date().toISOString(),
      downloadUrl,
      outputFile: finalOutputFile,
      outputSize: finalOutputSize,
    })
    await sync()

    await repository.appendLog(jobId, `Job concluído — output: "${finalOutputFile}" (${(finalOutputSize / 1024 / 1024).toFixed(1)} MB)`)

    await events.emit(jobId, events.createEvent('job.finished', {
      jobId,
      downloadUrl,
      outputFile: finalOutputFile,
      outputSize: finalOutputSize,
    }))

    return { jobId, status: 'completed', outputFile: finalOutputFile }
  },
  {
    connection: {
      url: env.REDIS_URL,
    },
    concurrency: 1,
    lockDuration: 300_000, // 5 min — conversões são longas
    maxStalledCount: 2,
  },
)

worker.on('completed', (job) => {
  console.log(`[ConversionWorker] Job ${job.id} completed successfully`)
})

worker.on('failed', async (job, error) => {
  const jobId = job?.id
  const conversionId = job?.data?.conversionId
  console.error(`[ConversionWorker] Job ${jobId ?? 'unknown'} failed:`, error.message)
  if (jobId && conversionId) {
    const failedRepo = new FilesystemJobRepository(conversionId)
    const convRepo = new FilesystemConversionRepository()
    await failedRepo.update(jobId, {
      status: 'failed',
      error: error.message.slice(0, 500),
      currentStep: 'Failed',
    })
    await failedRepo.appendLog(jobId, `ERRO: ${error.message.slice(0, 500)}`)
    await convRepo.syncStatus(conversionId)
    await events.emit(jobId, events.createEvent('job.failed', {
      jobId,
      conversionId,
      error: error.message.slice(0, 500),
    })).catch(() => {})
  }
})

worker.on('error', (error) => {
  console.error('[ConversionWorker] Worker error:', error.message)
})

/**
 * Lê os metadados originais do scraping (autor, descrição, gêneros)
 * para inclusão no ComicInfo.xml.
 */
async function readSourceMetadata(sourceId: string): Promise<{
  author: string | null
  description: string | null
  genres: string[]
}> {
  const { readJson } = await import('../../../shared/utils/filesystem')
  const sourcePath = join(env.STORAGE_PATH, 'sources', sourceId, 'metadata.json')
  const source = await readJson<{
    metadata?: { author?: string; description?: string; genres?: string[] }
  }>(sourcePath)
  if (!source?.metadata) return { author: null, description: null, genres: [] }
  return {
    author: source.metadata.author ?? null,
    description: source.metadata.description ?? null,
    genres: source.metadata.genres ?? [],
  }
}

/**
 * Escreve ComicInfo.xml no diretório de input do KCC.
 *
 * O KCC lê este arquivo para extrair título, autor e outros metadados
 * que serão embedados no EPUB final. Sem ele, o KCC infere o título do
 * nome do diretório (ex: "input") e usa "KCC" como autor padrão.
 */
async function writeComicInfoXml(
  repository: FilesystemJobRepository,
  jobId: string,
  inputDir: string,
  metadata: { title: string; author?: string },
  sourceMeta: { author: string | null; description: string | null; genres: string[] },
): Promise<void> {
  try {
    const author = metadata.author || sourceMeta.author || ''
    const description = sourceMeta.description || ''
    const genres = sourceMeta.genres || []

    const escapeXml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')

    const genre = genres.length > 0 ? `<Genre>${escapeXml(genres.join(', '))}</Genre>` : ''

    const xml = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
      `  <Title>${escapeXml(metadata.title)}</Title>`,
      `  <Series>${escapeXml(metadata.title)}</Series>`,
      author ? `  <Writer>${escapeXml(author)}</Writer>` : '',
      description ? `  <Summary>${escapeXml(description)}</Summary>` : '',
      genre ? `  ${genre}` : '',
      '  <Manga>YesAndRightToLeft</Manga>',
      '</ComicInfo>',
      '',
    ]
      .filter(Boolean)
      .join('\n')

    await writeFile(join(inputDir, 'ComicInfo.xml'), xml, 'utf-8')
    await repository.appendLog(jobId, `ComicInfo.xml escrito com título="${metadata.title}", autor="${author}"`)
  } catch (error) {
    await repository.appendLog(jobId, `Erro ao escrever ComicInfo.xml (continuando sem): ${error instanceof Error ? error.message : 'unknown'}`)
  }
}

/**
 * Busca URLs das imagens de um capítulo usando o provider correto.
 */
async function getChapterImageUrls(sourceId: string, chapterId: string): Promise<string[]> {
  const { readJson } = await import('../../../shared/utils/filesystem')
  const sourcePath = join(env.STORAGE_PATH, 'sources', sourceId, 'metadata.json')
  const source = await readJson<{
    provider: { slug: string }
    chapters: Array<{ id: string; url: string }>
  }>(sourcePath)
  if (!source) return []

  const chapter = source.chapters.find((c) => c.id === chapterId)
  if (!chapter?.url) return []

  const { ProviderResolver } = await import('../../scraping/providers/provider-resolver')
  const resolver = new ProviderResolver()
  const provider = resolver.resolve(chapter.url)
  const images = await provider.getChapterImages(chapter.url)

  if (images.length === 0) {
    console.warn(
      `[ConversionWorker] Nenhuma imagem encontrada para capítulo ${chapterId} (${chapter.url})`,
    )
  }

  return images
}

/**
 * Aplica a capa ao diretório temp/input/ do KCC.
 *
 * Regras de prioridade (KCC):
 * 1. Nomeação Explícita: Salva como `cover.jpg` ou `cover.png` na raiz
 * 2. Fallback: Ordem alfabética (cover.* vem antes de chap_*)
 */
async function applyCover(
  repository: FilesystemJobRepository,
  jobId: string,
  sourceId: string,
  cover: { kind: string; coverId?: string; uploadId?: string; name?: string },
  inputDir: string,
): Promise<void> {
  try {
    if (cover.kind !== 'original') {
      await repository.appendLog(jobId, `Cover kind "${cover.kind}" não suportado — pulando`)
      return
    }

    const { readJson } = await import('../../../shared/utils/filesystem')
    const sourcePath = join(env.STORAGE_PATH, 'sources', sourceId, 'metadata.json')
    const source = await readJson<{
      covers?: Array<{ id: string; type: string; imageUrl: string }>
    }>(sourcePath)

    if (!source?.covers || source.covers.length === 0) {
      await repository.appendLog(jobId, 'Nenhuma capa encontrada no metadata.json')
      return
    }

    const coverEntry = source.covers.find((c) => c.type === 'original') ?? source.covers[0]
    if (!coverEntry?.imageUrl) {
      await repository.appendLog(jobId, 'Cover entry sem imageUrl')
      return
    }

    // Verifica cache de capas em sources/
    const coversCacheDir = join(env.STORAGE_PATH, 'sources', sourceId, 'covers')
    const urlExt = extname(new URL(coverEntry.imageUrl).pathname).toLowerCase() || '.jpg'
    const cachedCoverPath = join(coversCacheDir, `${coverEntry.id}${urlExt}`)

    let coverData: Buffer

    if (await pathExists(cachedCoverPath)) {
      coverData = await readFile(cachedCoverPath)
      await repository.appendLog(jobId, `Capa do cache: ${cachedCoverPath}`)
    } else {
      const { httpClient } = await import('../../../shared/http/http-client')
      const response = await httpClient.get(coverEntry.imageUrl, {
        responseType: 'arraybuffer',
        validateStatus: (status: number) => status === 200,
      })

      coverData = Buffer.from(response.data)

      if (coverData.length === 0) {
        await repository.appendLog(jobId, `Capa vazia baixada de ${coverEntry.imageUrl}`)
        return
      }

      await mkdirp(coversCacheDir)
      await writeFile(cachedCoverPath, coverData)
      await repository.appendLog(jobId, `Capa baixada e cacheada: ${cachedCoverPath}`)
    }

    // Salva como cover.jpg na raiz do input (KCC reconhece este nome)
    const coverExt = ['.png'].includes(urlExt) ? '.png' : '.jpg'
    const finalCoverName = `cover${coverExt}`
    await writeFile(join(inputDir, finalCoverName), coverData)
    await repository.appendLog(jobId, `Capa aplicada como ${finalCoverName} em temp/input/`)

  } catch (error) {
    await repository.appendLog(jobId, `Erro ao aplicar capa (continuando sem): ${error instanceof Error ? error.message : 'unknown'}`)
  }
}

export default worker