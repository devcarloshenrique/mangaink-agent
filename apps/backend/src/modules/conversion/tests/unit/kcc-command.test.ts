import { describe, it, expect } from 'vitest'
import { buildKccCommand } from '../../config/kcc-flag-mapper'

describe('buildKccCommand', () => {
  it('usa kcc-c2e como command (CLI dentro do container)', () => {
    const { command } = buildKccCommand({}, 'K11', 'EPUB', '/input', '/output')
    expect(command).toBe('kcc-c2e')
  })

  it('usa paths do container (/input, /output) — não do host', () => {
    const { args } = buildKccCommand({}, 'K11', 'EPUB', '/input', '/output')
    const oIdx = args.indexOf('-o')
    expect(oIdx).toBeGreaterThan(-1)
    expect(args[oIdx + 1]).toBe('/output')
    expect(args[args.length - 1]).toBe('/input')
  })

  it('não recebe mais kccBinPath (assinatura sem o parâmetro)', () => {
    // Compilação apenas — se a assinatura mudou, 5 args são aceitos.
    const result = buildKccCommand({ mangaMode: true }, 'KPW5', 'MOBI', '/input', '/output')
    expect(result.args).toContain('-m')
    expect(result.args).toContain('-p')
    expect(result.args).toContain('KPW5')
    expect(result.args).toContain('MOBI')
  })
})