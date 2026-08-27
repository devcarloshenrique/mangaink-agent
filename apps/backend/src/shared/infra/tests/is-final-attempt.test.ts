import { describe, it, expect } from 'vitest'
import { isFinalAttempt } from '../queue-worker'

/**
 * O evento `failed` do BullMQ dispara A CADA tentativa. O guard
 * `isFinalAttempt` garante que handlers (marcar failed, notificar dono)
 * executem apenas quando o job esgota as tentativas — sem ele, filas com
 * attempts>1 multiplicavam notificações e ressuscitavam status.
 */
describe('isFinalAttempt', () => {
  it('fila com attempts:1 — única tentativa é sempre final', () => {
    expect(isFinalAttempt(1, 1)).toBe(true)
    expect(isFinalAttempt(0, 1)).toBe(false)
  })

  it('attempts:3 — intermediárias não são finais; a 3ª é', () => {
    expect(isFinalAttempt(1, 3)).toBe(false)
    expect(isFinalAttempt(2, 3)).toBe(false)
    expect(isFinalAttempt(3, 3)).toBe(true)
  })

  it('sem total conhecido assume 1 (filas in-memory/legado)', () => {
    expect(isFinalAttempt(1)).toBe(true)
    expect(isFinalAttempt(2)).toBe(true)
    expect(isFinalAttempt(0)).toBe(false)
  })

  it('attemptsMade acima do total (stall re-consumido) é final', () => {
    expect(isFinalAttempt(4, 3)).toBe(true)
  })
})
