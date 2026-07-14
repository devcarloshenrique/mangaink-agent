import { devices } from './devices'

/**
 * Mapeamento interno: converte opções semânticas do frontend em flags CLI do KCC.
 *
 * NOTA: Este mapper é o ÚNICO lugar que conhece as flags KCC.
 * O frontend NUNCA recebe kccFlag/kccMap nos responses.
 */

interface KccOptions {
  mangaMode?: boolean
  webtoonMode?: boolean
  highQuality?: boolean
  noProcessing?: boolean
  stretchMode?: 'disabled' | 'stretch' | 'upscale'
  splitter?: 'split' | 'rotate' | 'both'
  cropping?: 'disabled' | 'margins' | 'marginsAndPageNumbers'
  interPanelCrop?: 'disabled' | 'horizontal' | 'both'
  batchSplit?: 'none' | 'auto' | 'perSubdirectory'
  metadataTitle?: 'ignore' | 'combine' | 'metadataOnly'
  gamma?: number | 'auto'
  jpegQuality?: number
  croppingPower?: number
  croppingMinimum?: number
  targetSize?: number
  customWidth?: number
  customHeight?: number
  forceColor?: boolean
  noRotate?: boolean
  rotateRight?: boolean
  rotateFirst?: boolean
  coverFill?: boolean
  smartCoverCrop?: boolean
  onePageLandscape?: boolean
  fileFusion?: boolean
  eraseRainbow?: boolean
  noQuantize?: boolean
  noAutocontrast?: boolean
  autolevel?: boolean
  colorAutocontrast?: boolean
  blackBorders?: boolean
  whiteBorders?: boolean
  invertDirection?: boolean
  spreadShift?: boolean
  preserveMargin?: boolean
  lightnovel?: boolean
  twoPanel?: boolean
  vertical4Panel?: boolean
  maximizeStrips?: boolean
  legacyExtract?: boolean
  forcePng?: boolean
  webp?: boolean
  mozjpeg?: boolean
  nokepub?: boolean
}

/**
 * Enum → valor KCC
 */
const ENUM_MAP: Record<string, Record<string, string>> = {
  splitter: { split: '0', rotate: '1', both: '2' },
  cropping: { disabled: '0', margins: '1', marginsAndPageNumbers: '2' },
  interPanelCrop: { disabled: '0', horizontal: '1', both: '2' },
  batchSplit: { none: '0', auto: '1', perSubdirectory: '2' },
  metadataTitle: { ignore: '0', combine: '1', metadataOnly: '2' },
}

/**
 * Boolean → flag CLI (sem valor)
 */
const BOOL_FLAGS: Record<string, string> = {
  mangaMode: '-m',
  webtoonMode: '-w',
  highQuality: '-q',
  noProcessing: '-n',
  forceColor: '--forcecolor',
  noRotate: '--norotate',
  rotateRight: '--rotateright',
  rotateFirst: '--rotatefirst',
  coverFill: '--coverfill',
  smartCoverCrop: '--smartcovercrop',
  onePageLandscape: '--onepagelandscape',
  fileFusion: '--filefusion',
  eraseRainbow: '--eraserainbow',
  noQuantize: '--noquantize',
  noAutocontrast: '--noautocontrast',
  autolevel: '--autolevel',
  colorAutocontrast: '--colorautocontrast',
  blackBorders: '--blackborders',
  whiteBorders: '--whiteborders',
  invertDirection: '--invertdirection',
  spreadShift: '--spreadshift',
  preserveMargin: '--preservemargin',
  lightnovel: '--lightnovel',
  twoPanel: '--two-panel',
  vertical4Panel: '--vertical4panel',
  maximizeStrips: '--maximizestrips',
  legacyExtract: '--legacyextract',
  forcePng: '--forcepng',
  webp: '--webp',
  mozjpeg: '--mozjpeg',
  nokepub: '--nokepub',
}

/**
 * Campos numéricos → flag CLI + value
 */
const NUM_FLAGS: Record<string, string> = {
  gamma: '-g',
  jpegQuality: '--jpeg-quality',
  croppingPower: '--cp',
  croppingMinimum: '--cm',
  targetSize: '--targetsize',
  customWidth: '--customwidth',
  customHeight: '--customheight',
}

/**
 * Enum → flag CLI + value
 */
const ENUM_FLAGS: Record<string, string> = {
  splitter: '-r',
  cropping: '-c',
  interPanelCrop: '--ipc',
  batchSplit: '-b',
  metadataTitle: '--metadatatitle',
}

/**
 * Mapeia opções semânticas em flags CLI do KCC.
 *
 * @param options - Opções de conversão (valores semânticos do frontend)
 * @param deviceId - ID do dispositivo (ex: 'K11')
 * @param format - Formato de saída (ex: 'EPUB', 'MOBI+EPUB')
 * @returns Array de strings de flags CLI prontas para child_process.spawn
 *
 * @example
 * mapOptionsToFlags({ mangaMode: true, cropping: 'margins' }, 'K11', 'EPUB')
 * // => ['-m', '-c', '1', '-p', 'K11', '-f', 'EPUB']
 */
export function mapOptionsToFlags(
  options: KccOptions,
  deviceId: string,
  format: string,
): string[] {
  const flags: string[] = []

  // noProcessing → ignora todos os outros campos
  if (options.noProcessing) {
    flags.push('-n')
    addDeviceAndFormat(flags, deviceId, format)
    return flags
  }

  // ── Booleans ──────────────────────────────────────────────────
  for (const [key, flag] of Object.entries(BOOL_FLAGS)) {
    if (options[key as keyof KccOptions] === true) {
      flags.push(flag)
    }
  }

  // ── stretchMode (composto: -s ou -u, mutuamente exclusivos) ──
  if (options.stretchMode === 'stretch') {
    flags.push('-s')
  } else if (options.stretchMode === 'upscale') {
    flags.push('-u')
  }

  // ── Enums ─────────────────────────────────────────────────────
  for (const [key, flag] of Object.entries(ENUM_FLAGS)) {
    const value = options[key as keyof KccOptions] as string | undefined
    if (value && value !== getDefaultEnum(key)) {
      const mapped = ENUM_MAP[key]?.[value]
      if (mapped !== undefined) {
        flags.push(flag, mapped)
      }
    }
  }

  // ── Numéricos ─────────────────────────────────────────────────
  for (const [key, flag] of Object.entries(NUM_FLAGS)) {
    const value = options[key as keyof KccOptions] as number | undefined
    if (value !== undefined && value !== 0 && value !== getDefaultNumber(key)) {
      flags.push(flag, String(value))
    }
  }

  // gamma especial: 'auto' é o default, omitir
  // se for um número e diferente de auto, emitir
  if (options.gamma !== undefined && options.gamma !== 'auto') {
    flags.push('-g', String(options.gamma))
  }

  addDeviceAndFormat(flags, deviceId, format)
  return flags
}

function addDeviceAndFormat(flags: string[], deviceId: string, format: string): void {
  flags.push('-p', deviceId)
  flags.push('-f', format)
}

function getDefaultEnum(key: string): string {
  const defaults: Record<string, string> = {
    splitter: 'split',
    cropping: 'marginsAndPageNumbers',
    interPanelCrop: 'disabled',
    batchSplit: 'none',
    metadataTitle: 'ignore',
  }
  return defaults[key] ?? ''
}

function getDefaultNumber(key: string): number {
  const defaults: Record<string, number> = {
    jpegQuality: 85,
    croppingPower: 1.0,
    croppingMinimum: 0.0,
  }
  return defaults[key] ?? 0
}

/**
 * Gera o comando KCC ( CLI `kcc-c2e` ) pronto para ser executado dentro do
 * container Docker. Os paths recebidos devem ser paths **do container**
 * (`/input`, `/output`) — o `kcc-runner.service.ts` encarrega de montar os
 * volumes do host e envolver o comando em `docker run`.
 */
export function buildKccCommand(
  options: KccOptions,
  deviceId: string,
  format: string,
  inputPath: string,
  outputPath: string,
): { command: 'kcc-c2e'; args: string[] } {
  const flags = mapOptionsToFlags(options, deviceId, format)
  const args = [...flags, '-o', outputPath, inputPath]

  return { command: 'kcc-c2e', args }
}