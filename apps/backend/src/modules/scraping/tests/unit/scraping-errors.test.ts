import { describe, expect, it } from 'vitest'
import {
  ScrapingError,
  ProviderNotFoundError,
  InvalidUrlError,
  SourceNotFoundError,
  ScrapingNetworkError,
  ScrapingParseError,
} from '../../errors/scraping.errors'

describe('Scraping Errors', () => {
  describe('ScrapingError', () => {
    it('deve criar erro base com mensagem e código', () => {
      const error = new ScrapingError('Erro genérico', 'GENERIC')
      expect(error.message).toBe('Erro genérico')
      expect(error.code).toBe('GENERIC')
      expect(error.name).toBe('ScrapingError')
    })
  })

  describe('ProviderNotFoundError', () => {
    it('deve criar erro com mensagem descritiva', () => {
      const error = new ProviderNotFoundError('https://unsupported.com/manga/x/')
      expect(error.message).toContain('Nenhum provider suporta a URL')
      expect(error.code).toBe('PROVIDER_NOT_FOUND')
      expect(error.name).toBe('ProviderNotFoundError')
    })
  })

  describe('InvalidUrlError', () => {
    it('deve criar erro para URL inválida', () => {
      const error = new InvalidUrlError('not-a-url')
      expect(error.message).toContain('URL inválida')
      expect(error.code).toBe('INVALID_URL')
      expect(error.name).toBe('InvalidUrlError')
    })
  })

  describe('SourceNotFoundError', () => {
    it('deve criar erro para source não encontrada', () => {
      const error = new SourceNotFoundError('src-nonexistent-12345678')
      expect(error.message).toContain('Source não encontrada')
      expect(error.code).toBe('SOURCE_NOT_FOUND')
      expect(error.name).toBe('SourceNotFoundError')
    })
  })

  describe('ScrapingNetworkError', () => {
    it('deve criar erro de rede com cause', () => {
      const cause = new Error('ECONNREFUSED')
      const error = new ScrapingNetworkError('https://example.com/', cause)
      expect(error.message).toContain('Erro de rede')
      expect(error.code).toBe('NETWORK_ERROR')
      expect(error.name).toBe('ScrapingNetworkError')
      expect(error.cause).toBe(cause)
    })

    it('deve criar erro de rede sem cause', () => {
      const error = new ScrapingNetworkError('https://example.com/')
      expect(error.message).toContain('Erro de rede')
      expect(error.code).toBe('NETWORK_ERROR')
    })
  })

  describe('ScrapingParseError', () => {
    it('deve criar erro de parsing', () => {
      const error = new ScrapingParseError('Falha ao extrair capítulos do HTML')
      expect(error.message).toContain('Erro de parsing')
      expect(error.code).toBe('PARSE_ERROR')
      expect(error.name).toBe('ScrapingParseError')
    })
  })

  describe('Hierarquia', () => {
    it('ProviderNotFoundError deve ser instância de ScrapingError', () => {
      const error = new ProviderNotFoundError('https://test.com/')
      expect(error).toBeInstanceOf(ScrapingError)
      expect(error).toBeInstanceOf(Error)
    })

    it('InvalidUrlError deve ser instância de ScrapingError', () => {
      const error = new InvalidUrlError('bad-url')
      expect(error).toBeInstanceOf(ScrapingError)
    })

    it('SourceNotFoundError deve ser instância de ScrapingError', () => {
      const error = new SourceNotFoundError('src-test')
      expect(error).toBeInstanceOf(ScrapingError)
    })

    it('ScrapingNetworkError deve ser instância de ScrapingError', () => {
      const error = new ScrapingNetworkError('https://test.com/')
      expect(error).toBeInstanceOf(ScrapingError)
    })

    it('ScrapingParseError deve ser instância de ScrapingError', () => {
      const error = new ScrapingParseError('erro')
      expect(error).toBeInstanceOf(ScrapingError)
    })
  })
})