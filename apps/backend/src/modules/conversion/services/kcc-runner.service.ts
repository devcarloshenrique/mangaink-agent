import { execSync, spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { env } from '../../../shared/config/env'
import { buildKccCommand } from '../config/kcc-flag-mapper'
import { ConversionEventsService } from './conversion-events.service'

export interface KccRunResult {
  success: boolean
  exitCode: number | null
  outputPath: string
  outputFile: string
  outputSize: number
}

/**
 * Contrato de execução do KCC (Kindle Comic Converter). Implementações:
 *  - `KccRunnerService` — via `docker run mangaink-kcc:10.3.0`
 *  - `KccRunnerEmbedded` — via python embutido (modo embedded, sem Docker)
 */
export interface IKccRunner {
  run(
    jobId: string,
    options: Record<string, string | number | boolean | undefined>,
    deviceId: string,
    format: string,
    inputPath: string,
    outputPath: string,
    title: string,
  ): Promise<KccRunResult>
}

/**
 * Argumentos `--user` do `docker run` para que os arquivos gerados em `/output`
 * pertençam ao usuário do host. No Linux usa UID/GID do processo atual; no
 * Windows/macOS as permissões são gerenciadas pelo Docker Desktop (omitido).
 */
export function buildUserArgs(): string[] {
  if (process.platform !== 'linux') return []
  try {
    const uid = process.getuid?.()
    const gid = process.getgid?.()
    if (uid !== undefined && gid !== undefined) {
      return ['--user', `${uid}:${gid}`]
    }
  } catch {
    // Fallback: roda como root (arriscado, mas funcional).
  }
  return []
}

/**
 * Monta os argumentos completos do `docker run`:
 *  - `--rm`: remove o container automaticamente ao terminar.
 *  - `--workdir /tmp` e `-e HOME=/tmp`: evitam que o KCC tente escrever em
 *    `~/.kcc` (não existe para usuários não-root no container).
 *  - `-v <absInput>:/input:ro`: mount read-only do diretorio de imagens.
 *  - `-v <absOutput>:/output`: mount do diretorio de saida (escrita).
 *  - `env.KCC_DOCKER_IMAGE`: imagem do KCC.
 *  - `...kccArgs`: flags do KCC + paths do container (`/input`, `/output`).
 */
export function buildDockerArgs(absInput: string, absOutput: string, kccArgs: string[]): string[] {
  return [
    'run',
    '--rm',
    '--workdir', '/tmp',
    '-e', 'HOME=/tmp',
    ...buildUserArgs(),
    '-v', `${absInput}:/input:ro`,
    '-v', `${absOutput}:/output`,
    env.KCC_DOCKER_IMAGE,
    ...kccArgs,
  ]
}

let dockerChecked = false

/**
 * Verifica (uma vez por processo) se o Docker está disponível no host. Emite um
 * erro claro em stdout e segue — o erro concreto só acontecerá na primeira
 * chamada `spawn('docker', ...)` se o daemon não estiver acessível.
 *
 * No modo embedded (`MI_EMBEDDED_MODE=1`) o KCC roda via python embutido — a
 * verificação é um no-op (não executa `docker --version`).
 */
export function checkDockerAvailable(): void {
  if (env.MI_EMBEDDED_MODE) return
  if (dockerChecked) return
  dockerChecked = true
  try {
    execSync('docker --version', { stdio: 'ignore' })
  } catch {
    console.error(
      '❌ Docker não encontrado. Instale o Docker e rode: pnpm kcc:build',
    )
  }
}

export class KccRunnerService implements IKccRunner {
  constructor(private readonly events: ConversionEventsService) {}

  /**
   * Executa o KCC (Kindle Comic Converter) via `docker run`.
   *
   * O backend permanece rodando nativamente; apenas o KCC roda efêmero em um
   * container da imagem `env.KCC_DOCKER_IMAGE`. Os diretorios de entrada e
   * saida (paths do host) são montados como `/input` (read-only) e `/output`
   * no container. As flags do KCC usam os paths do container.
   *
   * @param jobId - ID do job
   * @param options - Opções de conversão (valores semânticos)
   * @param deviceId - ID do dispositivo de saída
   * @param format - Formato de saída
   * @param inputPath - Diretório do host com as imagens de entrada
   * @param outputPath - Diretório do host para o arquivo de saída
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
    checkDockerAvailable()

    await this.events.emit(jobId, this.events.createEvent('conversion.started', {
      deviceId,
      format,
      title,
    }))

    // Paths absolutos do host para os bind mounts.
    const absoluteInputPath = resolve(inputPath)
    const absoluteOutputPath = resolve(outputPath)

    // As flags do KCC usam os paths do container (/input, /output).
    const { args: kccArgs } = buildKccCommand(
      options as Record<string, string | number | boolean | undefined>,
      deviceId,
      format,
      '/input',
      '/output',
    )

    const dockerArgs = buildDockerArgs(absoluteInputPath, absoluteOutputPath, kccArgs)

    return new Promise((resolvePromise, reject) => {
      const child = spawn('docker', dockerArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
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
          // Descobre o arquivo de saída gerado (lê no host via bind mount).
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

          resolvePromise({
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