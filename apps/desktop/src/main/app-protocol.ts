import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface AppProtocolDeps {
  netFetch: typeof fetch
  frontendDir: string
  backendPort: () => Promise<number>
  readFile?: (filePath: string) => Promise<Buffer>
  mimeMap?: Record<string, string>
}

type ElectronFetchInit = RequestInit & { bypassCustomProtocolHandlers?: boolean }

const API_PREFIXES = ['/api/', '/auth/', '/users/']

const DEFAULT_MIME_MAP: Record<string, string> = {
  html: 'text/html',
  js: 'text/javascript',
  mjs: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
  map: 'application/json',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  txt: 'text/plain',
}

function isApiPath(pathname: string): boolean {
  return API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function createAppProtocolHandler(
  deps: AppProtocolDeps,
): (request: Request) => Promise<Response> {
  const { netFetch, frontendDir, backendPort } = deps
  const readFile = deps.readFile ?? fs.readFile
  const mimeMap = { ...DEFAULT_MIME_MAP, ...deps.mimeMap }
  const rootDir = path.resolve(frontendDir)

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)

    if (isApiPath(url.pathname)) {
      const port = await backendPort()
      const targetUrl = `http://127.0.0.1:${port}${url.pathname}${url.search}`
      const headers = new Headers(request.headers)
      headers.delete('host')
      headers.delete('content-length')
      const body = request.body ? Buffer.from(await request.arrayBuffer()) : undefined
      const init: ElectronFetchInit = {
        method: request.method,
        headers,
        body,
        bypassCustomProtocolHandlers: true,
      }
      return netFetch(targetUrl, init)
    }

    const decodedPath = safeDecode(url.pathname)
    const relativePath =
      decodedPath === '/' || decodedPath === '' ? 'index.html' : decodedPath.replace(/^\/+/, '')
    const filePath = path.resolve(rootDir, relativePath)

    const insideRoot =
      filePath === rootDir || filePath.startsWith(rootDir + path.sep)
    if (!insideRoot) {
      return new Response('Not Found', { status: 404 })
    }

    try {
      const data = await readFile(filePath)
      const ext = path.extname(filePath).slice(1).toLowerCase()
      const contentType = mimeMap[ext] ?? 'application/octet-stream'
      return new Response(data, {
        status: 200,
        headers: { 'content-type': contentType },
      })
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  }
}
