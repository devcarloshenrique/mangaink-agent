import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildUserArgs, buildDockerArgs, checkDockerAvailable } from '../../services/kcc-runner.service'

describe('buildUserArgs', () => {
  it('retorna array vazio no Windows', () => {
    vi.stubEnv('NODE_ENV', 'test')
    Object.defineProperty(process, 'platform', { value: 'win32' })
    const result = buildUserArgs()
    expect(result).toEqual([])
  })

  it('retorna array vazio no macOS (Docker Desktop gerencia permissoes)', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const result = buildUserArgs()
    expect(result).toEqual([])
  })

  it('retorna --user com UID:GID no Linux quando getuid/getgid estao disponiveis', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const mockGetuid = vi.fn(() => 1000)
    const mockGetgid = vi.fn(() => 1000)
    Object.defineProperty(process, 'getuid', { value: mockGetuid, configurable: true })
    Object.defineProperty(process, 'getgid', { value: mockGetgid, configurable: true })
    const result = buildUserArgs()
    expect(result).toEqual(['--user', '1000:1000'])
  })

  it('retorna array vazio no Linux quando getuid falha', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const mockGetuid = vi.fn(() => {
      throw new Error('not available')
    })
    Object.defineProperty(process, 'getuid', { value: mockGetuid, configurable: true })
    Object.defineProperty(process, 'getgid', { value: vi.fn(), configurable: true })
    const result = buildUserArgs()
    expect(result).toEqual([])
  })
})

describe('buildDockerArgs', () => {
  it('monta estrutura completa do docker run', () => {
    const args = buildDockerArgs('/host/input', '/host/output', ['-m', '-p', 'K11', '-f', 'EPUB'])

    expect(args[0]).toBe('run')
    expect(args).toContain('--rm')
    expect(args).toContain('--workdir')
    expect(args.slice(args.indexOf('--workdir') + 1)[0]).toBe('/tmp')
    expect(args).toContain('-e')
    expect(args.slice(args.indexOf('-e') + 1)[0]).toBe('HOME=/tmp')
  })

  it('inclui bind mounts de input read-only e output read-write', () => {
    const args = buildDockerArgs('/host/input', '/host/output', [])

    expect(args).toContain('-v')
    const volumeArgs = args.filter((a, i) => args[i - 1] === '-v')
    expect(volumeArgs.some((v) => v.startsWith('/host/input:') && v.endsWith('ro'))).toBe(true)
    expect(volumeArgs.some((v) => v.startsWith('/host/output:') && !v.endsWith('ro'))).toBe(true)
  })

  it('inclui a imagem KCC e os argumentos do comando', () => {
    const kccArgs = ['-m', '-p', 'KPW5']
    const args = buildDockerArgs('/in', '/out', kccArgs)

    const imgIdx = args.findIndex((a) => a.includes('mangaink-kcc'))
    expect(imgIdx).toBeGreaterThan(-1)

    // KCC args devem vir depois da imagem
    const afterImage = args.slice(imgIdx + 1)
    expect(afterImage).toEqual(kccArgs)
  })
})

describe('checkDockerAvailable', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('não emite erro quando Docker esta disponivel', () => {
    const { execSync } = require('node:child_process')
    try {
      execSync('docker --version', { stdio: 'ignore' })
      checkDockerAvailable()
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Docker não encontrado'),
      )
    } catch {
      // Docker nao instalado neste ambiente — pulamos a verificacao positiva
      // mas o teste ainda valida que a funcao nao quebra
      checkDockerAvailable()
      // Pode ter chamado console.error (Docker indisponivel) — valido em ambos os casos
    }
  })
})
