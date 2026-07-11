import { describe, expect, it } from 'vitest'
import {
  createChapterId,
  createCoverId,
  createSourceId,
} from '../id-generator'

// Mock para o path alias
vi.mock('../id-generator', async () => {
  const actual = await vi.importActual('../id-generator')
  return actual
})

describe('id-generator', () => {
  describe('createSourceId', () => {
    it('deve gerar um sourceId determinístico para uma URL válida', () => {
      const result = createSourceId(
        'mangalivre',
        'https://mangalivre.to/manga/hunter-x-hunter/',
      )
      expect(result).toMatch(/^src-hunter-x-hunter-[a-f0-9]{8}$/)
    })

    it('deve gerar o mesmo sourceId para a mesma URL e provider', () => {
      const result1 = createSourceId(
        'mangalivre',
        'https://mangalivre.to/manga/hunter-x-hunter/',
      )
      const result2 = createSourceId(
        'mangalivre',
        'https://mangalivre.to/manga/hunter-x-hunter/',
      )
      expect(result1).toBe(result2)
    })

    it('deve gerar sourceIds diferentes para URLs diferentes', () => {
      const result1 = createSourceId(
        'mangalivre',
        'https://mangalivre.to/manga/hunter-x-hunter/',
      )
      const result2 = createSourceId(
        'mangalivre',
        'https://mangalivre.to/manga/one-piece/',
      )
      expect(result1).not.toBe(result2)
    })

    it('deve extrair o slug corretamente da URL', () => {
      const result = createSourceId(
        'mangalivre',
        'https://mangalivre.to/manga/my-manga-name/',
      )
      expect(result).toMatch(/^src-my-manga-name-/)
    })

    it('deve usar "unknown" como slug se a URL não tiver formato esperado', () => {
      const result = createSourceId(
        'mangalivre',
        'https://mangalivre.to/invalid-path/',
      )
      expect(result).toMatch(/^src-unknown-/)
    })
  })

  describe('createChapterId', () => {
    it('deve gerar IDs com padding de 4 dígitos para números inteiros', () => {
      expect(createChapterId(1)).toBe('chap_0001')
      expect(createChapterId(10)).toBe('chap_0010')
      expect(createChapterId(100)).toBe('chap_0100')
      expect(createChapterId(1000)).toBe('chap_1000')
      expect(createChapterId(10000)).toBe('chap_10000')
    })

    it('deve gerar IDs com parte decimal separada por underscore', () => {
      expect(createChapterId(1.5)).toBe('chap_0001_5')
      expect(createChapterId(10.1)).toBe('chap_0010_1')
      expect(createChapterId(340.6)).toBe('chap_0340_6')
    })

    it('deve normalizar números com separadores diferentes (., -, _)', () => {
      expect(createChapterId('1.5')).toBe('chap_0001_5')
      expect(createChapterId('1-5')).toBe('chap_0001_5')
      expect(createChapterId('1_5')).toBe('chap_0001_5')
    })

    it('deve remover caracteres não numéricos exceto ., -, _', () => {
      expect(createChapterId('cap1.5')).toBe('chap_0001_5')
      expect(createChapterId('1a.5b')).toBe('chap_0001_5')
    })

    it('deve lidar com números decimais complexos', () => {
      expect(createChapterId('0.5')).toBe('chap_0000_5')
      expect(createChapterId('3.1')).toBe('chap_0003_1')
      expect(createChapterId('340.6')).toBe('chap_0340_6')
    })

    it('deve lidar com números negativos', () => {
      expect(createChapterId(-1)).toBe('chap_0000_1')
    })

    it('deve lidar com zero', () => {
      expect(createChapterId(0)).toBe('chap_0000')
    })
  })

  describe('createCoverId', () => {
    it('deve gerar IDs com padding de 3 dígitos', () => {
      expect(createCoverId(1)).toBe('cover_001')
      expect(createCoverId(10)).toBe('cover_010')
      expect(createCoverId(100)).toBe('cover_100')
      expect(createCoverId(1000)).toBe('cover_1000')
    })

    it('deve converter índice para string antes do padding', () => {
      expect(createCoverId(0)).toBe('cover_000')
      expect(createCoverId(5)).toBe('cover_005')
    })
  })
})