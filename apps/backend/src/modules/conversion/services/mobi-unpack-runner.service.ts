import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { readdir, mkdir } from 'node:fs/promises'
import { logger } from '../../../shared/logging/logger'
import { env } from '../../../shared/config/env'
import { buildUserArgs } from './kcc-runner.service'

export interface MobiUnpackRunOptions {
  jobId: string
  /** Caminho absoluto do .mobi no host (montado read-only no container). */
  mobiPath: string
  /** Caminho absoluto do /output no host (montado read+write). */
  outputDir: string
  /** Callback invocado periodicamente enquanto o runner executa. */
  onTick?: () => Promise<void> | void
  /** Intervalo de polling (default 250ms). */
  pollIntervalMs?: number
}

/**
 * Abstracao do runner de extracao MOBI — injetada no worker para testabilidade.
 */
export interface MobiUnpackRunner {
  run(opts: MobiUnpackRunOptions): Promise<void>
}

/**
 * Executa o container `mangaink-unpack:0.4.1` para extrair as paginas de um
 * arquivo MOBI. Sincrono quanto ao child process; a callback `onTick` e
 * chamada periodicamente para que o worker atualize o Redis Hash com
 * `readyPages`/`totalPages` (extração incremental).
 *
 * Argumentos do docker run:
 *   docker run --rm --user UID:GID \
 *     -v <mobiPath>:/input.mobi:ro -v <outputDir>:/output \
 *     mangaink-unpack:0.4.1 /input.mobi /output
 */
export class MobiUnpackRunnerService implements MobiUnpackRunner {
  async run(opts: MobiUnpackRunOptions): Promise<void> {
    const { jobId, mobiPath, outputDir, onTick, pollIntervalMs = 250 } = opts

    await mkdir(outputDir, { recursive: true })

    const dockerArgs = [
      'run',
      '--rm',
      '--workdir', '/tmp',
      '-e', 'HOME=/tmp',
      ...buildUserArgs(),
      '-v', `${resolve(mobiPath)}:/input.mobi:ro`,
      '-v', `${resolve(outputDir)}:/output`,
      env.MOBI_DOCKER_IMAGE,
      '/input.mobi',
      '/output',
    ]

    return new Promise<void>((resolvePromise, reject) => {
      const child = spawn('docker', dockerArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stderr = ''
      let lastSeen = -1
      let tickPending: Promise<void> | null = null
      let stop = false

      const poll = async () => {
        if (stop) return
        try {
          const entries = await readdir(resolve(outputDir, 'images')).catch(() => [] as string[])
          const images = entries.filter((f) => /\.(jpg|jpeg|png|gif|bmp|webp|avif)$/i.test(f))
          if (images.length !== lastSeen && onTick) {
            lastSeen = images.length
            if (!tickPending) {
              tickPending = Promise.resolve(onTick()).catch(() => {}).finally(() => { tickPending = null })
            }
          }
        } catch {
          // ignora falhas de poll
        }
        if (!stop) {
          setTimeout(poll, pollIntervalMs)
        }
      }

      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        logger.debug({ jobId, text: text.trim() }, '[mobi-unpack] stdout')
      })

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      child.on('close', (exitCode) => {
        stop = true
        if (exitCode === 0) {
          resolvePromise()
        } else {
          reject(new Error(`mobi-unpack exited ${exitCode}; stderr: ${stderr.slice(0, 500)}`))
        }
      })

      child.on('error', (err) => {
        stop = true
        reject(err)
      })

      // Inicia o polling apos um pequeno warmup
      setTimeout(poll, pollIntervalMs)
    })
  }
}