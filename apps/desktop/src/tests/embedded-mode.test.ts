import { describe, expect, it } from 'vitest'
import { resolveEmbeddedMode } from '../main/embedded-mode'

describe('resolveEmbeddedMode', () => {
  it('dev sem flag MI_EMBEDDED_MODE → false (host infra)', () => {
    expect(resolveEmbeddedMode({ isPackaged: false })).toBe(false)
  })

  it('packaged sem flag → true (produção roda embedded por padrão)', () => {
    expect(resolveEmbeddedMode({ isPackaged: true })).toBe(true)
  })

  it('envFlag "1" em dev → true (embedded forçado em dev)', () => {
    expect(resolveEmbeddedMode({ isPackaged: false, envFlag: '1' })).toBe(true)
  })

  it('envFlag "1" em packaged → true (embedded forçado em produção)', () => {
    expect(resolveEmbeddedMode({ isPackaged: true, envFlag: '1' })).toBe(true)
  })

  it('envFlag "0" em packaged → false (override explícito, debug com Docker)', () => {
    expect(resolveEmbeddedMode({ isPackaged: true, envFlag: '0' })).toBe(false)
  })

  it('envFlag "0" em dev → false (override explícito, host infra)', () => {
    expect(resolveEmbeddedMode({ isPackaged: false, envFlag: '0' })).toBe(false)
  })

  it('flag vazia/outra trata como ausente (sem flag)', () => {
    expect(resolveEmbeddedMode({ isPackaged: true, envFlag: '' })).toBe(true)
    expect(resolveEmbeddedMode({ isPackaged: false, envFlag: 'lixo' })).toBe(false)
  })
})
