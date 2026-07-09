import { describe, expect, it } from 'vitest'
import { createSourceId, createChapterId, createCoverId } from '../../../../shared/utils/id-generator'

describe('ID Generator', () => {
  describe('createSourceId', () => {
    it('deve gerar sourceId no formato src-{slug}-{hash}', () => {
      const result = createSourceId('mangalivre', 'https://mangalivre.to/manga/hunter-x-hunter/')
      expect(result).toMatch(/^src-hunter-x-hunter-[a-f0-9]{8}$/)
    })

    it('deve ser determinístico para mesma URL', () => {
      const url = 'https://mangalivre.to/manga/hunter-x-hunter/'
      const a = createSourceId('mangalivre', url)
      const b = createSourceId('mangalivre', url)
      expect(a).toBe(b)
    })

    it('deve gerar hashes diferentes para URLs diferentes', () => {
      const a = createSourceId('mangalivre', 'https://mangalivre.to/manga/hunter-x-hunter/')
      const b = createSourceId('mangalivre', 'https://mangalivre.to/manga/one-piece/')
      expect(a).not.toBe(b)
    })

    it('deve extrair slug corretamente', () => {
      const result = createSourceId('mangalivre', 'https://mangalivre.to/manga/jujutsu-kaisen/')
      expect(result).toMatch(/^src-jujutsu-kaisen-/)
    })

    it('deve usar fallback "unknown" para pathname sem slug', () => {
      const result = createSourceId('mangalivre', 'https://mangalivre.to/')
      expect(result).toMatch(/^src-unknown-/)
    })
  })

  describe('createChapterId', () => {
    it('deve gerar ID para capítulo inteiro', () => {
      expect(createChapterId('1')).toBe('chap_0001')
    })

    it('deve gerar ID para capítulo 10', () => {
      expect(createChapterId('10')).toBe('chap_0010')
    })

    it('deve gerar ID para capítulo 100', () => {
      expect(createChapterId('100')).toBe('chap_0100')
    })

    it('deve gerar ID para capítulo decimal com ponto', () => {
      expect(createChapterId('10.5')).toBe('chap_0010_5')
    })

    it('deve gerar ID para capítulo decimal com underscore', () => {
      expect(createChapterId('3_1')).toBe('chap_0003_1')
    })

    it('deve gerar ID para capítulo decimal com hífen', () => {
      expect(createChapterId('340-6')).toBe('chap_0340_6')
    })

    it('deve aceitar número como tipo', () => {
      expect(createChapterId(1)).toBe('chap_0001')
    })

    it('deve aceitar decimal como número', () => {
      expect(createChapterId(10.5)).toBe('chap_0010_5')
    })

    it('deve preservar parte decimal com múltiplos dígitos', () => {
      expect(createChapterId('10.10')).toBe('chap_0010_10')
    })

    it('deve remover caracteres não numéricos', () => {
      expect(createChapterId('abc1def')).toBe('chap_0001')
    })
  })

  describe('createCoverId', () => {
    it('deve gerar cover_001 para índice 1', () => {
      expect(createCoverId(1)).toBe('cover_001')
    })

    it('deve gerar cover_010 para índice 10', () => {
      expect(createCoverId(10)).toBe('cover_010')
    })

    it('deve gerar cover_100 para índice 100', () => {
      expect(createCoverId(100)).toBe('cover_100')
    })

    it('deve gerar cover_000 para índice 0', () => {
      expect(createCoverId(0)).toBe('cover_000')
    })
  })
})