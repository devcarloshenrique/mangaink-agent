import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Contrato "todo evento terminal carrega id" (paridade capa/sino = página).
 *
 * O fio SSE injeta `jobId` no write (ConversionEventsService.writeSseEvent),
 * mas `chapterId` vem do callsite — e os gates de dedupe dos hooks dependem
 * dele. Este teste varre os callsites de `createEvent` nos workers/downloader
 * e quebra se um emit terminal sair sem o id correspondente. O frontend
 * mantém fallback sem-id por compatibilidade; o backend não pode depender
 * dele.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const FILES = [
  '../../workers/conversion-job.worker.ts',
  '../../workers/download-only.worker.ts',
  '../../services/image-downloader.service.ts',
].map((rel) => join(HERE, rel))

const CHAPTER_TERMINAL = ['download.chapter.finished', 'download.chapter.skipped', 'download.error']
const JOB_TERMINAL = ['job.finished', 'job.failed']

const SHORT = (file: string) => file.split(/[\\/]/).slice(-1)[0]

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

/** Extrai o objeto literal de data após `createEvent('TYPE'` (scan com chaves balanceadas). */
function extractDataObject(source: string, callIndex: number): string | null {
  const braceStart = source.indexOf('{', callIndex)
  if (braceStart === -1) return null
  let depth = 0
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(braceStart, i + 1)
    }
  }
  return null
}

/** Todos os índices de `createEvent('TYPE'` no fonte. */
function callsites(source: string, type: string): number[] {
  const needle = `createEvent('${type}'`
  const out: number[] = []
  let from = 0
  for (;;) {
    const idx = source.indexOf(needle, from)
    if (idx === -1) return out
    out.push(idx)
    from = idx + needle.length
  }
}

describe('SSE terminal events sempre carregam id (contrato)', () => {
  for (const file of FILES) {
    const source = readFileSync(file, 'utf8')

    for (const type of CHAPTER_TERMINAL) {
      it(`${type} em ${SHORT(file)} sempre inclui chapterId`, () => {
        for (const idx of callsites(source, type)) {
          const data = extractDataObject(source, idx)
          expect(data, `${type} sem data object em ${file}:${lineOf(source, idx)}`).not.toBeNull()
          expect(
            data != null && /\bchapterId\b/.test(data),
            `${type} sem chapterId em ${file}:${lineOf(source, idx)}`,
          ).toBe(true)
        }
      })
    }

    for (const type of JOB_TERMINAL) {
      it(`${type} em ${SHORT(file)} sempre inclui jobId`, () => {
        for (const idx of callsites(source, type)) {
          const data = extractDataObject(source, idx)
          expect(data, `${type} sem data object em ${file}:${lineOf(source, idx)}`).not.toBeNull()
          expect(
            data != null && /\bjobId\b/.test(data),
            `${type} sem jobId em ${file}:${lineOf(source, idx)}`,
          ).toBe(true)
        }
      })
    }
  }

  it('cada tipo terminal tem ao menos 1 callsite varrido', () => {
    // download.error hoje não é emitido (hooks o tratam defensivamente).
    const all = FILES.map((f) => readFileSync(f, 'utf8')).join('\n')
    for (const type of CHAPTER_TERMINAL) {
      if (type === 'download.error') continue
      expect(callsites(all, type).length, `${type} sem callsite`).toBeGreaterThan(0)
    }
    for (const type of JOB_TERMINAL) {
      expect(callsites(all, type).length, `${type} sem callsite`).toBeGreaterThan(0)
    }
  })
})
