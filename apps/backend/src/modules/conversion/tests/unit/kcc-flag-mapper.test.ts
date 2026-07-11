import { describe, it, expect } from 'vitest'
import { mapOptionsToFlags } from '../../config/kcc-flag-mapper'

describe('kcc-flag-mapper', () => {
  describe('presets', () => {
    it('preset manga deve gerar -m -u e device/format', () => {
      const flags = mapOptionsToFlags(
        { mangaMode: true, cropping: 'marginsAndPageNumbers', stretchMode: 'upscale' },
        'K11',
        'EPUB',
      )
      expect(flags).toContain('-m')
      expect(flags).toContain('-u')
      expect(flags).toContain('-p')
      expect(flags).toContain('K11')
      expect(flags).toContain('-f')
      expect(flags).toContain('EPUB')
      // cropping="marginsAndPageNumbers" é o default → não emite -c
    })

    it('preset webtoon deve gerar -w -c 1 -s', () => {
      const flags = mapOptionsToFlags(
        { webtoonMode: true, cropping: 'margins', stretchMode: 'stretch' },
        'KPW5',
        'MOBI',
      )
      expect(flags).toContain('-w')
      expect(flags).toContain('-c')
      expect(flags).toContain('1')
      expect(flags).toContain('-s')
    })

    it('preset comic sem flags extras (cropping default omitido)', () => {
      const flags = mapOptionsToFlags({ cropping: 'marginsAndPageNumbers' }, 'K11', 'EPUB')
      expect(flags).not.toContain('-m')
      expect(flags).not.toContain('-w')
      expect(flags).toContain('-p')
      expect(flags).toContain('-f')
    })

    it('preset highQuality deve gerar -q -u', () => {
      const flags = mapOptionsToFlags(
        { highQuality: true, stretchMode: 'upscale' },
        'K11',
        'EPUB',
      )
      expect(flags).toContain('-q')
      expect(flags).toContain('-u')
    })

    it('preset noProcessing deve gerar apenas -n e ignorar outros', () => {
      const flags = mapOptionsToFlags(
        { noProcessing: true, mangaMode: true, cropping: 'margins', stretchMode: 'upscale', fileFusion: true },
        'K11',
        'CBZ',
      )
      expect(flags).toContain('-n')
      expect(flags).not.toContain('-m')
      expect(flags).not.toContain('-c')
      expect(flags).not.toContain('-u')
      expect(flags).toContain('-f')
      expect(flags).toContain('CBZ')
    })
  })

  describe('enums', () => {
    it('splitter="split" (default) não deve emitir flag', () => {
      const flags = mapOptionsToFlags({ splitter: 'split' }, 'K11', 'EPUB')
      expect(flags).not.toContain('-r')
    })

    it('splitter="rotate" deve emitir -r 1', () => {
      const flags = mapOptionsToFlags({ splitter: 'rotate' }, 'K11', 'EPUB')
      expect(flags).toContain('-r')
      expect(flags).toContain('1')
    })

    it('splitter="both" deve emitir -r 2', () => {
      const flags = mapOptionsToFlags({ splitter: 'both' }, 'K11', 'EPUB')
      expect(flags).toContain('-r')
      expect(flags).toContain('2')
    })

    it('cropping="disabled" deve emitir -c 0', () => {
      const flags = mapOptionsToFlags({ cropping: 'disabled' }, 'K11', 'EPUB')
      expect(flags).toContain('-c')
      expect(flags).toContain('0')
    })

    it('cropping="margins" deve emitir -c 1', () => {
      const flags = mapOptionsToFlags({ cropping: 'margins' }, 'K11', 'EPUB')
      expect(flags).toContain('-c')
      expect(flags).toContain('1')
    })

    it('cropping="marginsAndPageNumbers" (default) não deve emitir flag', () => {
      const flags = mapOptionsToFlags({ cropping: 'marginsAndPageNumbers' }, 'K11', 'EPUB')
      expect(flags).not.toContain('-c')
    })

    it('stretchMode="disabled" (default) não deve emitir flag', () => {
      const flags = mapOptionsToFlags({}, 'K11', 'EPUB')
      expect(flags).not.toContain('-s')
      expect(flags).not.toContain('-u')
    })

    it('stretchMode="stretch" deve emitir -s (não -u)', () => {
      const flags = mapOptionsToFlags({ stretchMode: 'stretch' }, 'K11', 'EPUB')
      expect(flags).toContain('-s')
      expect(flags).not.toContain('-u')
    })

    it('stretchMode="upscale" deve emitir -u (não -s)', () => {
      const flags = mapOptionsToFlags({ stretchMode: 'upscale' }, 'K11', 'EPUB')
      expect(flags).toContain('-u')
      expect(flags).not.toContain('-s')
    })
  })

  describe('booleans', () => {
    it('mangaMode deve emitir -m', () => {
      expect(mapOptionsToFlags({ mangaMode: true }, 'K11', 'EPUB')).toContain('-m')
    })

    it('webtoonMode deve emitir -w', () => {
      expect(mapOptionsToFlags({ webtoonMode: true }, 'K11', 'EPUB')).toContain('-w')
    })

    it('highQuality deve emitir -q', () => {
      expect(mapOptionsToFlags({ highQuality: true }, 'K11', 'EPUB')).toContain('-q')
    })

    it('fileFusion deve emitir --filefusion', () => {
      expect(mapOptionsToFlags({ fileFusion: true }, 'K11', 'EPUB')).toContain('--filefusion')
    })

    it('forceColor deve emitir --forcecolor', () => {
      expect(mapOptionsToFlags({ forceColor: true }, 'K11', 'EPUB')).toContain('--forcecolor')
    })

    it('boolean false não deve emitir flag', () => {
      const flags = mapOptionsToFlags({ mangaMode: false }, 'K11', 'EPUB')
      expect(flags).not.toContain('-m')
    })
  })

  describe('numéricos', () => {
    it('gamma numérico deve emitir -g', () => {
      const flags = mapOptionsToFlags({ gamma: 1.5 }, 'K11', 'EPUB')
      expect(flags).toContain('-g')
      expect(flags).toContain('1.5')
    })

    it('jpegQuality deve emitir --jpeg-quality', () => {
      const flags = mapOptionsToFlags({ jpegQuality: 90 }, 'K11', 'EPUB')
      expect(flags).toContain('--jpeg-quality')
      expect(flags).toContain('90')
    })
  })

  describe('device e format', () => {
    it('deve emitir -p deviceId e -f format', () => {
      const flags = mapOptionsToFlags({}, 'K11', 'EPUB')
      expect(flags).toContain('-p')
      expect(flags).toContain('K11')
      expect(flags).toContain('-f')
      expect(flags).toContain('EPUB')
    })

    it('deve passar format composto como string', () => {
      const flags = mapOptionsToFlags({}, 'KPW5', 'MOBI+EPUB')
      expect(flags[flags.indexOf('-f') + 1]).toBe('MOBI+EPUB')
    })
  })

  describe('flags internas (batchSplit)', () => {
    it('batchSplit="none" (default) não deve emitir -b', () => {
      const flags = mapOptionsToFlags({ batchSplit: 'none' }, 'K11', 'EPUB')
      expect(flags).not.toContain('-b')
    })

    it('batchSplit="auto" deve emitir -b 1', () => {
      const flags = mapOptionsToFlags({ batchSplit: 'auto' }, 'K11', 'EPUB')
      expect(flags).toContain('-b')
      expect(flags).toContain('1')
    })

    it('batchSplit="perSubdirectory" deve emitir -b 2', () => {
      const flags = mapOptionsToFlags({ batchSplit: 'perSubdirectory' }, 'K11', 'EPUB')
      expect(flags).toContain('-b')
      expect(flags).toContain('2')
    })
  })
})
