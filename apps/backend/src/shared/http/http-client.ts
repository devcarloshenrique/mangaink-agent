import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import axiosRetry from 'axios-retry'

export interface HttpClientOptions {
  /** Timeout em ms (padrão: 30000) */
  timeout?: number
  /** Headers HTTP fixos */
  headers?: Record<string, string>
  /** Número de tentativas em caso de falha (padrão: 3) */
  retries?: number
  /** Delay base de retry em ms (padrão: 1000) */
  retryDelay?: number
}

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
}

/**
 * Cria uma instância Axios configurada com:
 * - Headers padrão de browser (evita bloqueio por scraping básico)
 * - Retry automático para 5xx, timeout e erros de rede
 * - Tratamento de HTTP 429 com backoff exponencial
 */
export function createHttpClient(options: HttpClientOptions = {}): AxiosInstance {
  const {
    timeout = 30_000,
    headers = {},
    retries = 3,
    retryDelay = 1_000,
  } = options

  const instance = axios.create({
    timeout,
    headers: {
      ...DEFAULT_HEADERS,
      ...headers,
    },
  })

  axiosRetry(instance, {
    retries,
    retryDelay: (retryCount, error) => {
      // HTTP 429: respeitar Retry-After se disponível
      const retryAfter = error.response?.headers?.['retry-after']
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10)
        if (!isNaN(seconds)) return seconds * 1000
      }
      // Exponential backoff: 1s, 2s, 4s...
      return retryDelay * Math.pow(2, retryCount - 1)
    },
    retryCondition: (error) => {
      // Retry em erros de rede, timeout e 5xx
      if (axiosRetry.isNetworkOrIdempotentRequestError(error)) return true
      const status = error.response?.status
      if (!status) return false
      return status === 429 || (status >= 500 && status < 600)
    },
    onRetry: (retryCount, error) => {
      console.warn(`[HttpClient] Tentativa ${retryCount} após erro: ${error.message}`)
    },
  })

  return instance
}

/**
 * Instância padrão para uso geral.
 * Para providers com configurações específicas, use createHttpClient().
 */
export const httpClient = createHttpClient()
