import { randomUUID } from 'node:crypto'
import { mkdir, readFile as fsReadFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createAppProtocolHandler, type AppProtocolDeps } from '../main/app-protocol'

const tempRoot = join(tmpdir(), `mangaink-app-protocol-${randomUUID()}`)
const frontendDir = join(tempRoot, 'frontend')
const BACKEND_PORT = 3333

let readFileSpy: ReturnType<typeof vi.fn>

function fakeResponse(): Response {
  return new Response(null, { status: 200, headers: { 'content-type': 'application/json' } })
}

function buildHandler(overrides: Partial<AppProtocolDeps> = {}): {
  handler: (request: Request) => Promise<Response>
  netFetchMock: ReturnType<typeof vi.fn>
} {
  const netFetchMock = vi.fn()
  const handler = createAppProtocolHandler({
    netFetch: netFetchMock as unknown as typeof fetch,
    frontendDir,
    backendPort: vi.fn(async () => BACKEND_PORT),
    readFile: readFileSpy,
    ...overrides,
  })
  return { handler, netFetchMock }
}

describe('app-protocol', () => {
  beforeAll(async () => {
    await mkdir(join(frontendDir, 'assets'), { recursive: true })
    await writeFile(join(frontendDir, 'index.html'), '<html>index</html>', 'utf-8')
    await writeFile(join(frontendDir, 'assets', 'app.js'), 'console.log("hi")', 'utf-8')
    await writeFile(join(frontendDir, 'img.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    await writeFile(join(tempRoot, 'secret.txt'), 'segredo', 'utf-8')

    readFileSpy = vi.fn((filePath: string) => fsReadFile(filePath))
  })

  afterAll(async () => {
    await rm(tempRoot, { recursive: true, force: true })
  })

  it('roteia /api/* para o backend com bypassCustomProtocolHandlers preservando método e body', async () => {
    const { handler, netFetchMock } = buildHandler()
    netFetchMock.mockResolvedValue(fakeResponse())

    const request = new Request('app://bundle/api/conversions/options', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"title":"x"}',
    })
    await handler(request)

    expect(netFetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = netFetchMock.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:3333/api/conversions/options')
    expect(init.method).toBe('POST')
    expect(init.bypassCustomProtocolHandlers).toBe(true)
    expect(Buffer.isBuffer(init.body)).toBe(true)
    expect(Buffer.from(init.body as Buffer).toString('utf-8')).toBe('{"title":"x"}')
  })

  it('bufferiza o body ReadableStream real do protocol.handle em Buffer para o net.fetch', async () => {
    const { handler, netFetchMock } = buildHandler()
    netFetchMock.mockResolvedValue(fakeResponse())

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"title":"x"}'))
        controller.close()
      },
    })
    const request = new Request('app://bundle/api/conversions/options', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token-abc' },
      body: stream,
      duplex: 'half',
    } as RequestInit)
    await handler(request)

    expect(netFetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = netFetchMock.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:3333/api/conversions/options')
    expect(init.method).toBe('POST')
    expect(init.bypassCustomProtocolHandlers).toBe(true)
    expect(Buffer.isBuffer(init.body)).toBe(true)
    expect(Buffer.from(init.body as Buffer).toString('utf-8')).toBe('{"title":"x"}')
    const forwarded = new Headers(init.headers)
    expect(forwarded.get('content-type')).toBe('application/json')
    expect(forwarded.get('authorization')).toBe('Bearer token-abc')
    expect(forwarded.has('content-length')).toBe(false)
  })

  it('repassa headers (Authorization) e remove o header host', async () => {
    const { handler, netFetchMock } = buildHandler()
    netFetchMock.mockResolvedValue(fakeResponse())

    const headers = new Headers({ authorization: 'Bearer token-abc' })
    headers.set('host', 'mangaink.app')
    const request = {
      url: 'app://bundle/api/health',
      method: 'GET',
      headers,
      body: null,
    } as unknown as Request
    await handler(request)

    const [, init] = netFetchMock.mock.calls[0]
    const forwarded = new Headers(init.headers)
    expect(forwarded.get('authorization')).toBe('Bearer token-abc')
    expect(forwarded.has('host')).toBe(false)
  })

  it('retorna a MESMA Response do net.fetch sem consumir o corpo (streaming)', async () => {
    const { handler, netFetchMock } = buildHandler()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('evento sse'))
        controller.close()
      },
    })
    const getReaderSpy = vi.spyOn(stream, 'getReader')
    const backendResponse = new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })
    netFetchMock.mockResolvedValue(backendResponse)

    const result = await handler(new Request('app://bundle/api/conversions/x/events'))

    expect(result).toBe(backendResponse)
    expect(getReaderSpy).not.toHaveBeenCalled()
  })

  it.each([
    ['/api/conversions/options', 'http://127.0.0.1:3333/api/conversions/options'],
    ['/auth/login', 'http://127.0.0.1:3333/auth/login'],
    ['/users/me', 'http://127.0.0.1:3333/users/me'],
  ])('roteia %s como API para o backend', async (path, expectedUrl) => {
    const { handler, netFetchMock } = buildHandler()
    netFetchMock.mockResolvedValue(fakeResponse())

    await handler(new Request(`app://bundle${path}`))

    expect(netFetchMock).toHaveBeenCalledTimes(1)
    expect(netFetchMock.mock.calls[0][0]).toBe(expectedUrl)
  })

  it('serve /index.html com content-type text/html e corpo do arquivo', async () => {
    const { handler } = buildHandler()
    const response = await handler(new Request('app://bundle/index.html'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/html')
    expect(await response.text()).toBe('<html>index</html>')
  })

  it('serve index.html para a raiz /', async () => {
    const { handler } = buildHandler()
    const response = await handler(new Request('app://bundle/'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/html')
    expect(await response.text()).toBe('<html>index</html>')
  })

  it('serve /assets/app.js com content-type text/javascript e corpo correto', async () => {
    const { handler } = buildHandler()
    const response = await handler(new Request('app://bundle/assets/app.js'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/javascript')
    expect(await response.text()).toBe('console.log("hi")')
  })

  it('rejeita path traversal com 404 sem ler arquivos fora do frontendDir', async () => {
    const { handler } = buildHandler()

    const callsBefore = readFileSpy.mock.calls.length
    const encodedResponse = await handler(new Request('app://bundle/..%2fsecret.txt'))
    expect(encodedResponse.status).toBe(404)
    expect(readFileSpy.mock.calls.length).toBe(callsBefore)

    const rawResponse = await handler(
      {
        url: 'app://bundle/../secret.txt',
        method: 'GET',
        headers: new Headers(),
        body: null,
      } as unknown as Request,
    )
    expect(rawResponse.status).toBe(404)

    for (const [filePath] of readFileSpy.mock.calls) {
      expect(resolve(String(filePath)).startsWith(frontendDir + sep)).toBe(true)
    }
  })

  it('arquivo inexistente retorna 404', async () => {
    const { handler } = buildHandler()
    const response = await handler(new Request('app://bundle/nao-existe.js'))

    expect(response.status).toBe(404)
  })
})
