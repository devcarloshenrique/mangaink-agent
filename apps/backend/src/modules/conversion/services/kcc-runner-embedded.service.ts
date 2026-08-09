import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { buildKccCommand } from '../config/kcc-flag-mapper'
import { ConversionEventsService } from './conversion-events.service'
import type { IKccRunner, KccRunResult } from './kcc-runner.service'

export interface KccRunnerEmbeddedDeps {
  events: ConversionEventsService
  runtimePath: string
  spawn?: typeof spawn
}

/**
 * Executa o KCC (Kindle Comic Converter) via python embutido — sem Docker.
 *
 * Usado no modo embedded (`MI_EMBEDDED_MODE=1`), quando o app desktop
 * materializa o runtime do KCC (source em `<runtime>/kcc` + `kindlegen`)
 * junto ao pacote. O entry point CLI (`startC2E`) não importa GUI/PySide6;
 * a invocação passa `PYTHONPATH=<runtime>/kcc` e inclui `<runtime>/kindlegen`
 * no PATH (o KCC chama `kindlegen` via subprocess).
 *
 * O KCC usa `multiprocessing.Pool` (comic2ebook); no Windows invocar via
 * `python -c "...startC2E()..."` causa recursão de spawn (o filho re-executa
 * o `-c`). Por isso executa-se o wrapper `kcc-c2e.py` (guard `__main__` +
 * `multiprocessing.set_start_method('spawn')`), que encapsula o startC2E.
 */
export class KccRunnerEmbedded implements IKccRunner {
  private readonly spawnFn: typeof spawn

  constructor(private readonly deps: KccRunnerEmbeddedDeps) {
    this.spawnFn = deps.spawn ?? spawn
  }

  async run(
    jobId: string,
    options: Record<string, string | number | boolean | undefined>,
    deviceId: string,
    format: string,
    inputPath: string,
    outputPath: string,
    title: string,
  ): Promise<KccRunResult> {
    const { events, runtimePath } = this.deps

    if (!runtimePath) {
      throw new Error('MI_EMBEDDED_RUNTIME_PATH não configurado — runtime embutido ausente')
    }

    const pythonBin = join(runtimePath, 'python', 'python.exe')
    if (!existsSync(pythonBin)) {
      throw new Error(`Python embutido não encontrado em: ${pythonBin}`)
    }

    const scriptWrapper = join(runtimePath, 'kcc', 'kcc-c2e.py')
    if (!existsSync(scriptWrapper)) {
      throw new Error(`Wrapper kcc-c2e.py do KCC não encontrado em: ${scriptWrapper}`)
    }

    await events.emit(jobId, events.createEvent('conversion.started', {
      deviceId,
      format,
      title,
    }))

    // No embedded os paths já são os do HOST (inputPath/outputPath reais).
    const { args: kccArgs } = buildKccCommand(
      options as Record<string, string | number | boolean | undefined>,
      deviceId,
      format,
      inputPath,
      outputPath,
    )

    const childEnv = {
      ...process.env,
      PYTHONPATH: join(runtimePath, 'kcc'),
      PATH: [join(runtimePath, 'kindlegen'), process.env.PATH ?? ''].join(delimiter),
      // O KCC grava ~/.kcc — redireciona para o diretório temp do usuário
      HOME: tmpdir(),
      TMP: tmpdir(),
      TEMP: tmpdir(),
    }

    // Node define argv[0] do child como o executável — o primeiro argumento
    // real é o wrapper kcc-c2e.py (encapsula startC2E + guard __main__/spawn),
    // seguido das flags do KCC.
    const argv = [scriptWrapper, ...kccArgs]

    return new Promise((resolvePromise, reject) => {
      const child = this.spawnFn(pythonBin, argv, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: childEnv,
        windowsHide: true,
      })

      let stdout = ''
      let stderr = ''
      let lastProgress = 0

      child.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        stdout += output
        // Tenta extrair progresso do stdout do KCC (mesmo regex do docker runner)
        const progressMatch = output.match(/(\d+)%/)
        if (progressMatch) {
          const progress = parseInt(progressMatch[1], 10)
          if (progress !== lastProgress) {
            lastProgress = progress
            events.emit(jobId, events.createEvent('conversion.progress', {
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
          // Descobre o arquivo de saída gerado no outputPath do host.
          const absoluteOutputPath = resolve(outputPath)
          const files = await readdir(absoluteOutputPath)
          const outputFile = files[0] ?? `${title.replace(/[^a-zA-Z0-9]/g, '-')}.${format.toLowerCase()}`
          const outputFilePath = join(absoluteOutputPath, outputFile)

          let outputSize = 0
          try {
            const stats = await stat(outputFilePath)
            outputSize = stats.size
          } catch {
            // Arquivo pode não existir ainda
          }

          await events.emit(jobId, events.createEvent('conversion.finished', {
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
          reject(new KccExecutionError(jobId, exitCode, diagnostic))
        }
      })

      child.on('error', (err) => {
        reject(err)
      })
    })
  }
}
