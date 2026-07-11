import { describe, expect, it, vi, afterEach } from 'vitest'
import { createHttpClient } from '../../../../shared/http/http-client'
import axios from 'axios'

vi.mock('axios-retry', () => ({
  default: vi.fn((instance: unknown) => instance),
}))

describe('Http Client', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deve criar instância axios com timeout padrão', () => {
    const client = createHttpClient()
    expect(client.defaults.timeout).toBe(30000)
  })

  it('deve aceitar timeout customizado', () => {
    const client = createHttpClient({ timeout: 5000 })
    expect(client.defaults.timeout).toBe(5000)
  })

  it('deve incluir headers padrão de browser', () => {
    const client = createHttpClient()
    expect(client.defaults.headers['User-Agent']).toContain('Mozilla')
    expect(client.defaults.headers['Accept']).toContain('text/html')
    expect(client.defaults.headers['Accept-Language']).toContain('pt-BR')
  })

  it('deve mesclar headers customizados com os padrão', () => {
    const client = createHttpClient({
      headers: { Referer: 'https://example.com/' },
    })
    expect(client.defaults.headers['Referer']).toBe('https://example.com/')
    expect(client.defaults.headers['User-Agent']).toContain('Mozilla')
  })

  it('deve criar instância com retries customizados', () => {
    const client = createHttpClient({ retries: 5 })
    expect(client.defaults.timeout).toBe(30000)
  })

  it('deve criar instância com retryDelay customizado', () => {
    const client = createHttpClient({ retryDelay: 2000 })
    expect(client.defaults.timeout).toBe(30000)
  })

  it('deve exportar uma instância padrão', async () => {
    const { httpClient } = await import('../../../../shared/http/http-client')
    expect(httpClient.defaults.timeout).toBe(30000)
  })
})