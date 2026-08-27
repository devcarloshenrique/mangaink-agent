import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ChapterDownloadNotificationAggregator } from '../../services/chapter-download-notification-aggregator'
import type { NotificationService } from '../../notification/services/notification.service'
import type { ChapterDownloadEvent } from '../../services/chapter-download-notification-aggregator'

function makeNotifications() {
  return { notify: vi.fn(async () => ({})) } as unknown as NotificationService & {
    notify: ReturnType<typeof vi.fn>
  }
}

function event(over: Partial<ChapterDownloadEvent> = {}): ChapterDownloadEvent {
  return {
    userId: 'user-1',
    sourceId: 'src-1',
    sourceTitle: 'Obra X',
    chapterLabel: 'Capítulo 1',
    chapterId: 'chap_0001',
    ok: true,
    ...over,
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('ChapterDownloadNotificationAggregator', () => {
  it('agrega N eventos em UMA notificação emitida após o debounce', async () => {
    const notifications = makeNotifications()
    const agg = new ChapterDownloadNotificationAggregator(notifications, 10_000)

    agg.push(event())
    agg.push(event({ chapterId: 'chap_0002', chapterLabel: 'Capítulo 2' }))
    agg.push(event({ chapterId: 'chap_0003', chapterLabel: 'Capítulo 3' }))

    // Antes da janela: nada emitido.
    await vi.advanceTimersByTimeAsync(9_999)
    expect(notifications.notify).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(notifications.notify).toHaveBeenCalledTimes(1)
    expect(notifications.notify).toHaveBeenCalledWith('user-1', expect.objectContaining({
      type: 'download_completed',
      title: '"Obra X" — download concluído',
      message: '3/3 capítulo(s) baixado(s)',
      metadata: expect.objectContaining({
        sourceId: 'src-1',
        successfulChapters: 3,
      }),
    }))
    // Sem failedChapters quando tudo deu certo.
    expect(notifications.notify.mock.calls[0][1].metadata.failedChapters).toBeUndefined()
  })

  it('debounce: evento novo dentro da janela reagenda e não duplica', async () => {
    const notifications = makeNotifications()
    const agg = new ChapterDownloadNotificationAggregator(notifications, 10_000)

    agg.push(event())
    await vi.advanceTimersByTimeAsync(8_000)
    agg.push(event({ chapterId: 'chap_0002', chapterLabel: 'Capítulo 2' }))
    await vi.advanceTimersByTimeAsync(9_999)
    expect(notifications.notify).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(notifications.notify).toHaveBeenCalledTimes(1)
    expect(notifications.notify.mock.calls[0][1].message).toBe('2/2 capítulo(s) baixado(s)')
  })

  it('agrupa por (usuário, obra) sem misturar chaves', async () => {
    const notifications = makeNotifications()
    const agg = new ChapterDownloadNotificationAggregator(notifications, 10_000)

    agg.push(event())
    agg.push(event({ userId: 'user-2' }))
    agg.push(event({ sourceId: 'src-2', sourceTitle: 'Obra Y' }))

    await vi.advanceTimersByTimeAsync(10_000)
    expect(notifications.notify).toHaveBeenCalledTimes(3)
  })

  it('falhas: título download_failed, motivo por capítulo truncado a 200', async () => {
    const notifications = makeNotifications()
    const agg = new ChapterDownloadNotificationAggregator(notifications, 10_000)

    agg.push(event({ ok: false, chapterId: 'chap_0001', reason: 'f'.repeat(500) }))
    agg.push(event({ chapterId: 'chap_0002', chapterLabel: 'Capítulo 2' }))

    await vi.advanceTimersByTimeAsync(10_000)
    expect(notifications.notify).toHaveBeenCalledTimes(1)
    const call = notifications.notify.mock.calls[0]
    expect(call[1].type).toBe('download_completed')
    expect(call[1].title).toBe('"Obra X" — download concluído com 1 falha(s)')
    expect(call[1].message).toBe('1/2 capítulo(s) baixado(s) • 1 falha(s)')
    expect(call[1].metadata.failedChapters).toEqual([
      { chapterId: 'chap_0001', reason: 'f'.repeat(200) },
    ])
  })

  it('todos falhando → type download_failed com contagem de falhas', async () => {
    const notifications = makeNotifications()
    const agg = new ChapterDownloadNotificationAggregator(notifications, 10_000)

    agg.push(event({ ok: false, reason: '404' }))
    agg.push(event({ chapterId: 'chap_0002', chapterLabel: 'Capítulo 2', ok: false, reason: '404' }))

    await vi.advanceTimersByTimeAsync(10_000)
    expect(notifications.notify.mock.calls[0][1].type).toBe('download_failed')
    expect(notifications.notify.mock.calls[0][1].message).toBe('0/2 capítulo(s) baixado(s) • 2 falha(s)')
  })

  it('DEDUPE: último evento por capítulo vence (falha→sucesso sai das falhas)', async () => {
    const notifications = makeNotifications()
    const agg = new ChapterDownloadNotificationAggregator(notifications, 10_000)

    // Re-processamento: capítulo falha na 1ª tentativa e sucede na 2ª.
    agg.push(event({ chapterId: 'chap_0001', ok: false, reason: 'Network error' }))
    agg.push(event({ chapterId: 'chap_0001', chapterLabel: 'Capítulo 1', ok: true }))
    agg.push(event({ chapterId: 'chap_0002', chapterLabel: 'Capítulo 2', ok: false, reason: '404' }))

    await vi.advanceTimersByTimeAsync(10_000)
    const call = notifications.notify.mock.calls[0]
    expect(call[1].type).toBe('download_completed')
    expect(call[1].title).toBe('"Obra X" — download concluído com 1 falha(s)')
    expect(call[1].message).toBe('1/2 capítulo(s) baixado(s) • 1 falha(s)')
    expect(call[1].metadata.failedChapters).toEqual([
      { chapterId: 'chap_0002', reason: '404' },
    ])
  })

  it('DEDUPE: sucesso→falha registra o capítulo como falha única', async () => {
    const notifications = makeNotifications()
    const agg = new ChapterDownloadNotificationAggregator(notifications, 10_000)

    agg.push(event({ chapterId: 'chap_0001', chapterLabel: 'Capítulo 1', ok: true }))
    agg.push(event({ chapterId: 'chap_0001', chapterLabel: 'Capítulo 1', ok: false, reason: 'Cache corrompido' }))

    await vi.advanceTimersByTimeAsync(10_000)
    const call = notifications.notify.mock.calls[0]
    expect(call[1].type).toBe('download_failed')
    expect(call[1].message).toBe('0/1 capítulo(s) baixado(s) • 1 falha(s)')
    expect(call[1].metadata.failedChapters).toEqual([
      { chapterId: 'chap_0001', reason: 'Cache corrompido' },
    ])
  })

  it('flushAll emite imediatamente e limpa pendências', async () => {
    const notifications = makeNotifications()
    const agg = new ChapterDownloadNotificationAggregator(notifications, 60_000)

    agg.push(event())
    await agg.flushAll()
    expect(notifications.notify).toHaveBeenCalledTimes(1)

    // Depois do flushAll o timer antigo não gera duplicata.
    await vi.advanceTimersByTimeAsync(120_000)
    expect(notifications.notify).toHaveBeenCalledTimes(1)
  })

  it('engole erro do notify (best-effort)', async () => {
    const notifications = makeNotifications()
    notifications.notify.mockRejectedValueOnce(new Error('redis down'))
    const agg = new ChapterDownloadNotificationAggregator(notifications, 10_000)

    agg.push(event())
    await vi.advanceTimersByTimeAsync(10_000)
    // Erro engolido: notify foi chamado e não propagou.
    expect(notifications.notify).toHaveBeenCalledTimes(1)
  })
})
