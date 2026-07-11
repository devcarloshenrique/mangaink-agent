import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { env } from '../../../shared/config/env'
import { buildKccCommand } from '../config/kcc-flag-mapper'
import { ConversionEventsService } from './conversion-events.service'
import type { KccExecutionError } from '../errors/conversion.errors'

export interface KccRunResult {
  success: boolean
  exitCode: number | null
  outputPath: string
  outputFile: string
  outputSize: number
}

export class KccRunnerService {
  constructor(private readonly events: ConversionEventsService) {}

  /**
   * Executa o KCC (Kindle Comic Converter) via child_process.spawn.
   *
   * @param jobId - ID do job
   * @param options - Opções de conversão (valores semânticos)
   * @param deviceId - ID do dispositivo de saída
   * @param format - Formato de saída
   * @param inputPath - Diretório com as imagens de entrada
   * @param outputPath - Diretório para o arquivo de saída
   * @param title - Título da obra (para nome do arquivo)
   */
  async run(
    jobId: string,
    options: Record<string, string | number | boolean | undefined>,
    deviceId: string,
    format: string,
    inputPath: string,
    outputPath: string,
    title: string,
  ): Promise<KccRunResult> {
    await this.events.emit(jobId, this.events.createEvent('conversion.started', {
      deviceId,
      format,
      title,
    }))

    // Resolve o caminho do KCC e dos paths de input/output para absolutos
    const kccBinPath = resolve(env.KCC_BIN_PATH)
    const kccDir = resolve(kccBinPath, '..')
    const absoluteInputPath = resolve(inputPath)
    const absoluteOutputPath = resolve(outputPath)

    const { command, args } = buildKccCommand(
      options as Record<string, string | number | boolean | undefined>,
      deviceId,
      format,
      absoluteInputPath,
      absoluteOutputPath,
      kccBinPath,
    )

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: kccDir,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })

      let stdout = ''
      let stderr = ''
      let lastProgress = 0

      child.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        stdout += output
        // Tenta extrair progresso do stdout do KCC
        const progressMatch = output.match(/(\d+)%/)
        if (progressMatch) {
          const progress = parseInt(progressMatch[1], 10)
          if (progress !== lastProgress) {
            lastProgress = progress
            this.events.emit(jobId, this.events.createEvent('conversion.progress', {
              progress,
              message: output.trim(),
            })).catch(() => {})
          }
        }
      })

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      child.on('close', async (exitCode) => {
        if (exitCode === 0) {
          // Descobre o arquivo de saída gerado
          const { readdir } = await import('node:fs/promises')
          const files = await readdir(absoluteOutputPath)
          const outputFile = files[0] ?? `${title.replace(/[^a-zA-Z0-9]/g, '-')}.${format.toLowerCase()}`
          const outputFilePath = join(absoluteOutputPath, outputFile)

          const { stat } = await import('node:fs/promises')
          let outputSize = 0
          try {
            const stats = await stat(outputFilePath)
            outputSize = stats.size
          } catch {
            // Arquivo pode não existir ainda
          }

          await this.events.emit(jobId, this.events.createEvent('conversion.finished', {
            outputFile,
            outputSize,
          }))

          resolve({
            success: true,
            exitCode,
            outputPath,
            outputFile,
            outputSize,
          })
        } else {
          const { KccExecutionError } = await import('../errors/conversion.errors')
          const diagnostic = stderr || stdout || 'KCC não emitiu nenhuma saída de erro'
          const error = new KccExecutionError(jobId, exitCode, diagnostic)
          reject(error)
        }
      })

      child.on('error', (err) => {
        reject(err)
      })
    })
  }
}