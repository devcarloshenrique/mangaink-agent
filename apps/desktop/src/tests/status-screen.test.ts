import { describe, expect, it } from 'vitest'
import type { BackendState } from '../main/backend-manager'
import { getStateStderr, renderStatusScreenHtml, resolveScreenAction } from '../main/status-screen'

describe('resolveScreenAction', () => {
  it.each<[BackendState, 'status' | 'frontend']>([
    [{ status: 'ready', message: 'Backend pronto.' }, 'frontend'],
    [{ status: 'starting', message: 'Iniciando backend...' }, 'status'],
    [{ status: 'prereq_failed', message: 'Docker ausente.' }, 'status'],
    [{ status: 'migration_failed', message: 'Migrações falharam.', stderr: 'ERRO' }, 'status'],
    [{ status: 'backend_failed', message: 'Backend encerrou.', stderr: 'ERRO' }, 'status'],
    [{ status: 'postgres_failed', message: 'PostgreSQL falhou.', stderr: 'ERRO' }, 'status'],
  ])('resolveScreenAction(%j) -> %s', (state, expected) => {
    expect(resolveScreenAction(state)).toBe(expected)
  })

  it('retorna "status" para estados não mapeados (idle)', () => {
    expect(resolveScreenAction({ status: 'idle' })).toBe('status')
  })
})

describe('renderStatusScreenHtml', () => {
  const startingState: BackendState = { status: 'starting', message: 'Iniciando backend...' }

  it('gera HTML com o título "MangaInk Agent"', () => {
    const html = renderStatusScreenHtml(startingState)
    expect(html).toContain('MangaInk Agent')
  })

  it('estado backend_failed exibe "Backend falhou" e o stderr no <pre id="logs">', () => {
    const state: BackendState = {
      status: 'backend_failed',
      message: 'O backend encerrou inesperadamente.',
      stderr: 'ERRO: EADDRINUSE :3333',
    }
    const html = renderStatusScreenHtml(state)
    expect(html).toContain('Backend falhou')
    expect(html).toMatch(/<pre id="logs">[\s\S]*ERRO: EADDRINUSE :3333/)
  })

  it('estado prereq_failed exibe "Pré-requisitos" e menciona Docker', () => {
    const state: BackendState = { status: 'prereq_failed', message: 'Docker não encontrado.' }
    const html = renderStatusScreenHtml(state)
    expect(html).toContain('Pré-requisitos')
    expect(html.toLowerCase()).toContain('docker')
  })

  it('estado postgres_failed exibe "PostgreSQL embarcado", a mensagem e o stderr no <pre id="logs">', () => {
    const state: BackendState = {
      status: 'postgres_failed',
      message: 'Porta 5432 em uso.',
      stderr: 'boom',
    }
    const html = renderStatusScreenHtml(state)
    expect(html).toContain('PostgreSQL embarcado')
    expect(html).toContain('Porta 5432 em uso.')
    expect(html).toMatch(/<pre id="logs">[\s\S]*boom/)
  })

  it('estado postgres_failed não exibe stderr quando ausente', () => {
    const state: BackendState = { status: 'postgres_failed', message: 'Porta 5432 em uso.' }
    const html = renderStatusScreenHtml(state)
    expect(html).toContain('PostgreSQL embarcado')
    expect(html).not.toContain('<pre id="logs">')
  })

  it('inclui id="retry", id="browser" e referência a window.desktop.retry', () => {
    const html = renderStatusScreenHtml(startingState, { backendUrl: 'http://localhost:3333' })
    expect(html).toContain('id="retry"')
    expect(html).toContain('id="browser"')
    expect(html).toContain('window.desktop.retry')
  })

  it('inclui o backendUrl no href do link do navegador', () => {
    const html = renderStatusScreenHtml(startingState, { backendUrl: 'http://localhost:3333' })
    expect(html).toMatch(/<a[^>]*id="browser"[^>]*href="http:\/\/localhost:3333"/)
  })

  it('aceita stderr via options e escapa HTML do stderr', () => {
    const html = renderStatusScreenHtml(startingState, { stderr: '<script>alert(1)</script>' })
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('estado starting exibe "Iniciando..."', () => {
    const html = renderStatusScreenHtml(startingState)
    expect(html).toContain('Iniciando...')
  })

  it('exibe o version quando informado via options', () => {
    const html = renderStatusScreenHtml(startingState, { version: '1.0.0' })
    expect(html).toContain('1.0.0')
  })
})

describe('getStateStderr', () => {
  it.each<[BackendState, string | undefined]>([
    [{ status: 'prereq_failed', message: 'Docker ausente.', stderr: 'a' }, 'a'],
    [{ status: 'migration_failed', message: 'Migrações falharam.', stderr: 'b' }, 'b'],
    [{ status: 'backend_failed', message: 'Backend encerrou.', stderr: 'c' }, 'c'],
    [{ status: 'postgres_failed', message: 'PG falhou.', stderr: 'err' }, 'err'],
  ])('getStateStderr(%j) -> %s', (state, expected) => {
    expect(getStateStderr(state)).toBe(expected)
  })

  it('retorna undefined para estados sem stderr', () => {
    expect(getStateStderr({ status: 'ready', message: 'OK' })).toBeUndefined()
    expect(getStateStderr({ status: 'idle' })).toBeUndefined()
    expect(getStateStderr({ status: 'starting', message: 'Iniciando...' })).toBeUndefined()
  })
})
