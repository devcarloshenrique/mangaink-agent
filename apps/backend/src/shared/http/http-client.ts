import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import axiosRetry from 'axios-retry'
import {
  assertUrlAllowed,
  createSsrfRequestInterceptor,
  stripSensitiveHeadersForCrossOrigin,
  SsrfBlockedError,
} from './ssrf-guard'
import { logger } from '../logging/logger'

export interface HttpClientOptions {
  /** Timeout em ms (padrão: 30000) */
  timeout?: number
  /** Headers HTTP fixos */
  headers?: Record<string, string>
  /** Número de tentativas em caso de falha (padrão: 3) */
  retries?: number
  /** Delay base de retry em ms (padrão: 1000) */
  retryDelay?: number
  /** Lista de hosts permitidos (guarda de SSRF). Vazio = qualquer host público. */
  allowedHosts?: string[]
  /** Bloqueia também redes reservadas/documentação (guard de SSRF estrito). */
  ssrfStrict?: boolean
  /** Máximo de redirects seguidos manualmente (padrão: 5). */
  maxRedirects?: number
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
    allowedHosts,
    ssrfStrict = false,
    maxRedirects = 5,
  } = options

  const instance = axios.create({
    timeout,
    maxRedirects: 0, // Redirects são seguidos manualmente com validação SSRF
    headers: {
      ...DEFAULT_HEADERS,
      ...headers,
    },
  })

  // Guard de SSRF: valida a URL (protocolo + resolução DNS + IPs privados) em
  // cada request e antes de cada redirect. (VULN-3/MEC-67)
  instance.interceptors.request.use(createSsrfRequestInterceptor(allowedHosts, ssrfStrict))

  // Segue redirects manualmente, validando cada hop com o guard e removendo
  // headers sensíveis (Authorization/Cookie) em saltos cross-origin.
  instance.interceptors.response.use(async (response) => {
    const status = response.status
    const location = response.headers?.['location']
    if (status >= 300 && status < 400 && location) {
      const from = response.config.url ?? ''
      const to = new URL(location, from).toString()
      await assertUrlAllowed(to, { allowedHosts, strict: ssrfStrict })
      stripSensitiveHeadersForCrossOrigin(response.config.headers as Record<string, unknown>, from, to)
      return instance.request({
        ...response.config,
        url: to,
        headers: { ...response.config.headers },
      })
    }
    return response
  }, undefined)

  // Limita o número de redirects para evitar loops infinitos.
  const originalRequest = instance.request.bind(instance)
  instance.request = (async (config: AxiosRequestConfig) => {
    let current = config
    for (let i = 0; i <= maxRedirects; i += 1) {
      const res = await originalRequest(current)
      const status = res.status
      const location = res.headers?.['location']
      if (status >= 300 && status < 400 && location) {
        const from = current.url ?? ''
        const to = new URL(location, from).toString()
        current = { ...current, url: to }
        continue
      }
      return res
    }
    throw new SsrfBlockedError(current.url ?? '', 'limite de redirects excedido')
  }) as typeof instance.request

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
      logger.warn(
        { retryCount, err: error.message, url: error.config?.url },
        '[HttpClient] Tentativa de retry apos erro',
      )
    },
  })

  return instance
}

/**
 * Instância padrão para uso geral.
 * Para providers com configurações específicas, use createHttpClient().
 */
export const httpClient = createHttpClient()
