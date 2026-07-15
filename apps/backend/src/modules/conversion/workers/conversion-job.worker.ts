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
import { PlaceholderService } from '../services/placeholder.service'
import { getSourceRepository, getConversionRepository, getConversionJobRepository } from '../../../shared/database/repositories'
import { isPrismaBackend } from '../../../shared/config/repo-mode'
import type { ConversionJobData, ErrorHandlingStrategy } from '../types/conversion.types'

const pubsub = new ConversionPubSubService()
const events = new ConversionEventsService(pubsub)

const worker = new Worker<ConversionJobData>(
  'conversion-job',
  async (job) => {
    const { conversionId, jobId, sourceId, chapters, cover, output, metadata, options, storagePath } = job.data

    // Repositórios escopados por conversionId (Jobs em storage/conversions/{conv}/jobs/{jobId}).
    const isPrisma = isPrismaBackend()
    const repository = isPrisma
      ? getConversionJobRepository().withConversion(conversionId)
      : new FilesystemJobRepository(conversionId)
    const conversions = isPrisma
      ? getConversionRepository()
      : new FilesystemConversionRepository()
    const sourceRepo = getSourceRepository()
    const downloader = new ImageDownloaderService(events, repository, sourceRepo)
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

    // ── Fase 1: Download de imagens ──────────────────────────────────
    await repository.update(jobId, {
      status: 'downloading',
      currentStep: 'Downloading images...',
    })
    await sync()
    await events.emit(jobId, events.createEvent('download.started', {
      jobId,
      totalChapters: chapters.length,
    }))

    let totalDownloaded = 0
    let totalErrors = 0
    let totalCorrupt = 0
    const skippedChapters: string[] = []
    const successfulChapters: string[] = []

    const strategy: ErrorHandlingStrategy = job.data.errorHandlingStrategy ?? 'ignore'
    const placeholderService = new PlaceholderService()

    const provider = await resolveProvider(sourceId)
    if (!provider) {
      throw new Error(`Não foi possível resolver o provider para sourceId: ${sourceId}`)
    }

    for (const chapterId of chapters) {
      const currentJob = await repository.findById(jobId)
      if (currentJob?.status === 'cancelled') {
        await repository.appendLog(jobId, 'Job cancelado durante download')
        return { jobId, status: 'cancelled', message: 'Job cancelled during download' }
      }

      const imageUrls = await getChapterImageUrls(provider, sourceId, chapterId)

      const result = await downloader.downloadChapter(
        jobId,
        sourceId,
        chapterId,
        imageUrls,
        provider,
      )

      totalDownloaded += result.downloadedImages
      totalErrors += result.errors

      if (result.corruptPages.length > 0) {
        totalCorrupt += result.corruptPages.length

        if (strategy === 'abort') {
          await repository.appendLog(jobId,
            `ABORTAR: ${result.corruptPages.length} páginas corrompidas no capítulo ${chapterId} ` +
            `(${result.corruptPages.map(c => `p${c.pageIndex}`).join(', ')}). Estratégia: abort`)
          throw new Error(
            `Páginas corrompidas encontradas no capítulo ${chapterId}. ` +
            `Estratégia de erro: abort. Páginas: ${result.corruptPages.map(c => c.pageIndex).join(', ')}`)
        }

        if (strategy === 'skip_chapter') {
          await repository.appendLog(jobId,
            `Capítulo ${chapterId} ignorado — ${result.corruptPages.length} páginas corrompidas. Estratégia: skip_chapter`)
          skippedChapters.push(chapterId)
          continue
        }

        if (strategy === 'ignore') {
          const cacheDir = join(env.STORAGE_PATH, 'sources', sourceId, 'chapters', chapterId)
          
          if (result.fromCache) {
            await repository.appendLog(jobId,
              `Capítulo ${chapterId}: ${result.corruptPages.length} placeholder(s) em cache ` +
              `(${result.corruptPages.map(c => `p${c.pageIndex}`).join(', ')}). Nenhuma ação necessária.`)
            
            await events.emit(jobId, events.createEvent('download.progress', {
              chapterId,
              downloadedImages: result.totalImages,
              totalImages: result.totalImages,
              errors: 0,
            }))
            
            successfulChapters.push(chapterId)
          } else {
            let placeholderCount = 0
            for (const cp of result.corruptPages) {
              const filename = `${String(cp.pageIndex).padStart(4, '0')}.png`
              const cachePath = join(cacheDir, filename)
              try {
                const pageLabel = `Cap. ${chapterId.replace(/^chap_0*/, '')}, Pág. ${cp.pageIndex}`
                const placeholder = await placeholderService.generate(output.deviceId, pageLabel)
                await writeFile(cachePath, placeholder)
                placeholderCount++
              } catch (err) {
                await repository.appendLog(jobId,
                  `Erro ao gerar placeholder para ${chapterId} página ${cp.pageIndex}: ${err instanceof Error ? err.message : 'unknown'}`)
              }
            }
            
            const placeholderIndices = result.corruptPages.map(cp => cp.pageIndex)
            await sourceRepo.updatePlaceholderIndices(sourceId, chapterId, placeholderIndices)
            
            await repository.appendLog(jobId,
              `${placeholderCount}/${result.corruptPages.length} placeholders gerados para capítulo ${chapterId} ` +
              `(resolução do dispositivo ${output.deviceId})`)
            
            const effectiveTotal = result.totalImages
            const effectiveDownloaded = result.downloadedImages + placeholderCount
            totalDownloaded += placeholderCount
            
            await events.emit(jobId, events.createEvent('download.progress', {
              chapterId,
              downloadedImages: effectiveDownloaded,
              totalImages: effectiveTotal,
              errors: result.errors - placeholderCount,
            }))

            successfulChapters.push(chapterId)
          }
        }
      } else if (result.skipped) {
        skippedChapters.push(chapterId)
      } else {
        successfulChapters.push(chapterId)
      }
    }

    if (successfulChapters.length === 0) {
      const corruptDetail = totalCorrupt > 0 ? `, ${totalCorrupt} página(s) corrompida(s)` : ''
      throw new Error(
        `Nenhum capítulo pôde ser baixado. ` +
        `${skippedChapters.length} capítulo(s) estão indisponíveis no site de origem (erros 404)${corruptDetail}.`,
      )
    }

    // Avisa sobre capítulos ignorados, mas continua com os disponíveis
    if (skippedChapters.length > 0) {
      await repository.appendLog(
        jobId,
        `AVISO: ${skippedChapters.length} capítulo(s) ignorado(s) por indisponibilidade: ${skippedChapters.join(', ')}. ` +
        `Convertendo os ${successfulChapters.length} capítulo(s) disponíveis.`,
      )
    }

    // ── Fase 2: Montar temp/input/ com hard links ───────────────────
    await repository.update(jobId, {
      status: 'preparing',
      currentStep: `Creating hard links from cache (${successfulChapters.length}/${chapters.length} chapters)...`,
    })
    await sync()
    await repository.appendLog(jobId, `Montando temp/input/ com hard links do cache (${successfulChapters.length} capítulos disponíveis)`)

    // Usa apenas capítulos com download bem-sucedido
    for (const chapterId of successfulChapters) {
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
    await applyCover(repository, jobId, sourceId, cover, tempInputDir, provider)

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
    // Sanitiza o título para remover caracteres inválidos em nomes de arquivo
    // Exemplo: "Boruto: Two Blue Vortex" → "Boruto - Two Blue Vortex"
    const desiredName = `${sanitizeFilename(metadata.title)}.${output.format.toLowerCase()}`

    if (finalOutputFile && finalOutputFile !== desiredName) {
      const currentPath = join(outputPath, finalOutputFile)
      const desiredPath = join(outputPath, desiredName)
      try {
        await rename(currentPath, desiredPath)
        finalOutputFile = desiredName
        await repository.appendLog(jobId, `Output renomeado: "${kccResult.outputFile}" → "${desiredName}"`)
      } catch (renameErr) {
        // Loga o motivo real da falha para facilitar debug
        const reason = renameErr instanceof Error ? renameErr.message : String(renameErr)
        await repository.appendLog(jobId, `AVISO: Falha ao renomear output ("${reason}"), mantendo "${finalOutputFile}"`)
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
    const failedRepo = isPrismaBackend()
      ? getConversionJobRepository().withConversion(conversionId)
      : new FilesystemJobRepository(conversionId)
    const convRepo = isPrismaBackend()
      ? getConversionRepository()
      : new FilesystemConversionRepository()
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
 * Remove caracteres inválidos em nomes de arquivo (Windows + Unix).
 * Converte ":" → " -", "?" → "", "*" → "", etc.
 * Exemplos:
 *   "Boruto: Two Blue Vortex" → "Boruto - Two Blue Vortex"
 *   "Attack on Titan/Final" → "Attack on Titan-Final"
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/:/g, ' -')           // ":" → " -" (comum em títulos de mangá)
    .replace(/[\/\\|?*<>"\x00-\x1f]/g, '') // outros chars inválidos → remove
    .replace(/\s+/g, ' ')          // normaliza espaços múltiplos
    .trim()
    || 'output'                    // fallback se o resultado for vazio
}

/**
 * Lê os metadados originais do scraping (autor, descrição, gêneros)
 * para inclusão no ComicInfo.xml.
 */
async function readSourceMetadata(sourceId: string): Promise<{
  author: string | null
  description: string | null
  genres: string[]
}> {
  const source = await getSourceRepository().load(sourceId)
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
  repository: { appendLog: (jobId: string, message: string) => Promise<void> },
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
 * Busca URLs das imagens de um capítulo usando o provider com rate limiting.
 */
async function getChapterImageUrls(
  provider: import('../../scraping/interfaces/provider-strategy.interface').IProviderStrategy | null,
  sourceId: string,
  chapterId: string,
): Promise<string[]> {
  const source = await getSourceRepository().load(sourceId)
  if (!source || !provider) return []

  const chapter = source.chapters.find((c) => c.id === chapterId)
  if (!chapter?.url) return []

  const images = await provider.getChapterImages(chapter.url)

  if (images.length === 0) {
    console.warn(
      `[ConversionWorker] Nenhuma imagem encontrada para capítulo ${chapterId} (${chapter.url})`,
    )
  }

  return images
}

/**
 * Resolve o provider correto para o sourceId com rate limiter injetado.
 */
async function resolveProvider(sourceId: string): Promise<import('../../scraping/interfaces/provider-strategy.interface').IProviderStrategy | null> {
  const source = await getSourceRepository().load(sourceId)
  if (!source) return null

  const firstChapter = source.chapters[0]
  if (!firstChapter?.url) return null

  const { ProviderResolver } = await import('../../scraping/providers/provider-resolver')
  const resolver = new ProviderResolver()
  return resolver.resolve(firstChapter.url)
}

/**
 * Aplica a capa ao diretório temp/input/ do KCC.
 *
 * Regras de prioridade (KCC):
 * 1. Nomeação Explícita: Salva como `cover.jpg` ou `cover.png` na raiz
 * 2. Fallback: Ordem alfabética (cover.* vem antes de chap_*)
 */
async function applyCover(
  repository: { appendLog: (jobId: string, message: string) => Promise<void> },
  jobId: string,
  sourceId: string,
  cover: { kind: string; coverId?: string; uploadId?: string; name?: string },
  inputDir: string,
  provider: import('../../scraping/interfaces/provider-strategy.interface').IProviderStrategy | null,
): Promise<void> {
  try {
    if (cover.kind !== 'original') {
      await repository.appendLog(jobId, `Cover kind "${cover.kind}" não suportado — pulando`)
      return
    }

    const source = await getSourceRepository().load(sourceId)

    if (!source?.covers || source.covers.length === 0) {
      await repository.appendLog(jobId, 'Nenhuma capa encontrada')
      return
    }

    const coverEntry = source.covers.find((c) => c.type === 'original') ?? source.covers[0]
    if (!coverEntry?.imageUrl) {
      await repository.appendLog(jobId, 'Cover entry sem imageUrl')
      return
    }

    const coversCacheDir = join(env.STORAGE_PATH, 'sources', sourceId, 'covers')
    const urlExt = extname(new URL(coverEntry.imageUrl).pathname).toLowerCase() || '.jpg'
    const cachedCoverPath = join(coversCacheDir, `${coverEntry.id}${urlExt}`)

    let coverData: Buffer

    if (await pathExists(cachedCoverPath)) {
      coverData = await readFile(cachedCoverPath)
      await repository.appendLog(jobId, `Capa do cache: ${cachedCoverPath}`)
    } else if (provider) {
      const { buffer } = await provider.downloadImage(coverEntry.imageUrl)
      coverData = buffer

      if (coverData.length === 0) {
        await repository.appendLog(jobId, `Capa vazia baixada de ${coverEntry.imageUrl}`)
        return
      }

      await mkdirp(coversCacheDir)
      await writeFile(cachedCoverPath, coverData)
      await repository.appendLog(jobId, `Capa baixada e cacheada: ${cachedCoverPath}`)
    } else {
      await repository.appendLog(jobId, 'Provider não disponível para download de capa — pulando')
      return
    }

    const coverExt = ['.png'].includes(urlExt) ? '.png' : '.jpg'
    const finalCoverName = `cover${coverExt}`
    await writeFile(join(inputDir, finalCoverName), coverData)
    await repository.appendLog(jobId, `Capa aplicada como ${finalCoverName} em temp/input/`)

  } catch (error) {
    await repository.appendLog(jobId, `Erro ao aplicar capa (continuando sem): ${error instanceof Error ? error.message : 'unknown'}`)
  }
}

export default worker