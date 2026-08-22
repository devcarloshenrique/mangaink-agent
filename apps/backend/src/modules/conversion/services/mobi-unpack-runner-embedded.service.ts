import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { logger } from '../../../shared/logging/logger'
import type { MobiUnpackRunner, MobiUnpackRunOptions } from './mobi-unpack-runner.service'
import { createImagePollingLoop } from './image-polling-loop'

export interface MobiUnpackRunnerEmbeddedDeps {
  /** Caminho raiz do runtime embutido (`MI_EMBEDDED_RUNTIME_PATH`). */
  runtimePath: string
  /** Permite injetar um mock de spawn em testes. */
  spawn?: typeof spawn
}

/**
 * Executa a extração de paginas de um MOBI via runtime embutido (Python
 * embarcado + `extract_mobi.py`) — sem Docker.
 *
 * Usado no modo embedded (`MI_EMBEDDED_MODE=1`), quando o app desktop
 * materializa o runtime junto ao pacote:
 *   `<runtime>/python/python.exe`  (Python embarcado)
 *   `<runtime>/extract_mobi.py`    (cópia de `docker/extract_mobi.py`)
 *
 * Invocação: `python.exe <runtime>/extract_mobi.py <mobiPath> <outputDir>`.
 * `PYTHONPATH` é definido como `runtimePath` para permitir imports relativos
 * ao runtime (mesmo padrão do KCC embedded); o restante do env é herdado.
 * O polling de `outputDir/images` é idêntico ao do runner Docker, permitindo
 * `onTick` incremental para o worker atualizar readyPages/totalPages.
 */
export class MobiUnpackRunnerEmbedded implements MobiUnpackRunner {
  private readonly spawnFn: typeof spawn

  constructor(private readonly deps: MobiUnpackRunnerEmbeddedDeps) {
    this.spawnFn = deps.spawn ?? spawn
  }

  async run(opts: MobiUnpackRunOptions): Promise<void> {
    const { jobId, mobiPath, outputDir, onTick, pollIntervalMs = 250 } = opts
    const { runtimePath } = this.deps

    if (!runtimePath) {
      throw new Error('MI_EMBEDDED_RUNTIME_PATH não configurado — runtime embutido ausente')
    }

    const pythonBin = join(runtimePath, 'python', 'python.exe')
    if (!existsSync(pythonBin)) {
      throw new Error(`Python embutido não encontrado em: ${pythonBin}`)
    }

    const script = join(runtimePath, 'extract_mobi.py')
    if (!existsSync(script)) {
      throw new Error(`Script de extração MOBI não encontrado em: ${script}`)
    }

    await mkdir(outputDir, { recursive: true })

    // Node define argv[0] do child como o executável — `script` é o primeiro
    // argumento real (sem duplicar o binário no argv — lição da task 4.1).
    const argv = [script, mobiPath, outputDir]

    return new Promise<void>((resolvePromise, reject) => {
      const child = this.spawnFn(pythonBin, argv, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Permite imports relativos ao runtime embutido
          PYTHONPATH: runtimePath,
        },
        windowsHide: true,
      })

      let stderr = ''

      const polling = createImagePollingLoop({
        imagesDir: join(outputDir, 'images'),
        onTick,
        pollIntervalMs,
      })

      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        logger.debug({ jobId, text: text.trim() }, '[mobi-unpack] stdout')
      })

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      child.on('close', (exitCode) => {
        polling.stop()
        if (exitCode === 0) {
          resolvePromise()
        } else {
          reject(new Error(`mobi-unpack exited ${exitCode}; stderr: ${stderr.slice(0, 500)}`))
        }
      })

      child.on('error', (err) => {
        polling.stop()
        reject(err)
      })

      // Inicia o polling apos um pequeno warmup
      polling.start()
    })
  }
}
