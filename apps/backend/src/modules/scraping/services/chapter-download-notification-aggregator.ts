import type { NotificationService } from '../../notification/services/notification.service'
import type { FailedChapter } from '../../notification/types/notification.types'

/** Evento de término de um download de capítulo individual. */
export interface ChapterDownloadEvent {
  userId: string
  sourceId: string
  sourceTitle: string
  /** Rótulo legível do capítulo (ex.: "Capítulo 3"). */
  chapterLabel: string
  chapterId: string
  ok: boolean
  /** Motivo da falha (quando ok=false). */
  reason?: string
}

interface ChapterOutcome {
  chapterLabel: string
  ok: boolean
  reason?: string
}

interface PendingBatch {
  userId: string
  sourceId: string
  sourceTitle: string
  /** Último resultado por capítulo — re-processamento NÃO duplica nem
   * mantém um capítulo como falha e sucesso ao mesmo tempo. */
  outcomes: Map<string, ChapterOutcome>
  timer: ReturnType<typeof setTimeout>
}

/**
 * 30s: downloads de site lento podem levar >10s POR capítulo (worker serial);
 * janelas curtas partiam a agregação no meio de lotes longos. 30s cobre a
 * maioria dos gaps e ainda emite em tempo razoável após o último capítulo.
 */
const DEFAULT_DEBOUNCE_MS = 30_000
const MAX_REASON_LENGTH = 200

/**
 * Agrupa notificações de downloads de capítulos INDIVIDUAIS por
 * `(usuário, obra)`: eventos chegam por capítulo e viram UMA notificação
 * emitida ~10s após o último evento (debounce). Sem isso, baixar/falhar
 * vários capítulos em sequência "pipoca" uma notificação por capítulo.
 *
 * - Sucessos e falhas entram na mesma agregada (decisão de produto).
 * - O fluxo em LOTE (conversão download-only) NÃO passa por aqui: ele já
 *   emite sua própria notificação agregada com `failedChapters`.
 * - In-process por design: o worker de chapter-download é único
 *   (concurrency=1) nos runtimes web e embedded.
 */
export class ChapterDownloadNotificationAggregator {
  private readonly pending = new Map<string, PendingBatch>()

  constructor(
    private readonly notifications: NotificationService,
    private readonly debounceMs = DEFAULT_DEBOUNCE_MS,
  ) {}

  push(event: ChapterDownloadEvent): void {
    const key = `${event.userId}:${event.sourceId}`
    let batch = this.pending.get(key)
    if (!batch) {
      batch = {
        userId: event.userId,
        sourceId: event.sourceId,
        sourceTitle: event.sourceTitle,
        outcomes: new Map(),
        timer: this.scheduleFlush(key),
      }
      this.pending.set(key, batch)
    } else {
      // Debounce: cada evento novo empurra o flush para daqui a N segundos,
      // então uma sequência de downloads vira uma única notificação no fim.
      clearTimeout(batch.timer)
      batch.timer = this.scheduleFlush(key)
    }

    // Último evento por capítulo vence (idempotente p/ re-processamentos).
    batch.outcomes.set(event.chapterId, {
      chapterLabel: event.chapterLabel,
      ok: event.ok,
      reason: event.reason,
    })
  }

  /** Agenda o flush da chave; não segura o processo vivo só pela janela. */
  private scheduleFlush(key: string): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => {
      void this.flush(key)
    }, this.debounceMs)
    timer.unref?.()
    return timer
  }

  /** Emite a notificação agregada pendente da chave (se houver). */
  async flush(key: string): Promise<void> {
    const batch = this.pending.get(key)
    if (!batch) return
    this.pending.delete(key)
    clearTimeout(batch.timer)

    const successes: string[] = []
    const failures: FailedChapter[] = []
    for (const [chapterId, outcome] of batch.outcomes) {
      if (outcome.ok) {
        successes.push(outcome.chapterLabel)
      } else {
        failures.push({
          chapterId,
          reason: (outcome.reason ?? 'Falha desconhecida').slice(0, MAX_REASON_LENGTH),
        })
      }
    }

    const total = successes.length + failures.length
    const allFailed = successes.length === 0
    const hasFailures = failures.length > 0

    try {
      await this.notifications.notify(batch.userId, {
        type: allFailed ? 'download_failed' : 'download_completed',
        title: allFailed
          ? `"${batch.sourceTitle}" — download falhou`
          : hasFailures
            ? `"${batch.sourceTitle}" — download concluído com ${failures.length} falha(s)`
            : `"${batch.sourceTitle}" — download concluído`,
        message: hasFailures
          ? `${successes.length}/${total} capítulo(s) baixado(s) • ${failures.length} falha(s)`
          : `${successes.length}/${total} capítulo(s) baixado(s)`,
        metadata: {
          sourceId: batch.sourceId,
          successfulChapters: successes.length,
          ...(hasFailures ? { failedChapters: failures } : {}),
        },
      })
    } catch {
      // best-effort: falha ao notificar nunca derruba o worker
    }
  }

  /** Flush de tudo (shutdown/testes). */
  async flushAll(): Promise<void> {
    const keys = [...this.pending.keys()]
    await Promise.all(keys.map((k) => this.flush(k)))
  }
}
