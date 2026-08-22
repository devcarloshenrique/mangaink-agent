import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { isImageFile } from '../constants/image-extensions'

export interface ImagePollingLoopOptions {
  /** Diretório de imagens a monitorar. */
  imagesDir: string
  /** Callback invocado quando novas imagens são detectadas. */
  onTick?: () => Promise<void> | void
  /** Intervalo de polling em ms (default 250). */
  pollIntervalMs?: number
}

export interface ImagePollingLoopHandle {
  /** Inicia o polling. */
  start(): void
  /** Para o polling. */
  stop(): void
}

/**
 * Cria um loop de polling que monitora um diretório de imagens e invoca
 * `onTick` sempre que novas imagens são detectadas.
 *
 * Usado por ambos os runners (Docker e Embedded) para reportar progresso
 * incremental ao worker via `onTick`.
 *
 * Garantias:
 * - `onTick` nunca é chamado em paralelo (aguarda a execução anterior).
 * - Falhas de `readdir` ou `onTick` são silenciosamente ignoradas.
 */
export function createImagePollingLoop(opts: ImagePollingLoopOptions): ImagePollingLoopHandle {
  const { imagesDir, onTick, pollIntervalMs = 250 } = opts

  let lastSeen = -1
  let tickPending: Promise<void> | null = null
  let stopped = false

  const poll = async () => {
    if (stopped) return
    try {
      const entries = await readdir(join(imagesDir)).catch(() => [] as string[])
      const images = entries.filter((f) => isImageFile(f))
      if (images.length !== lastSeen && onTick) {
        lastSeen = images.length
        if (!tickPending) {
          tickPending = Promise.resolve(onTick()).catch(() => {}).finally(() => { tickPending = null })
        }
      }
    } catch {
      // ignora falhas de poll
    }
    if (!stopped) {
      setTimeout(poll, pollIntervalMs)
    }
  }

  return {
    start() {
      setTimeout(poll, pollIntervalMs)
    },
    stop() {
      stopped = true
    },
  }
}
