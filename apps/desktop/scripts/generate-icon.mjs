#!/usr/bin/env node
// generate-icon.mjs
// Gera o ícone do app desktop (tema pop-art do MangaInk) em build/icon.png (512x512)
// e build/icon.ico (multiplos tamanhos 16-256). O PNG e desenhado via SVG renderizado
// pelo sharp; o ICO e convertido com png-to-ico (sharp nao escreve .ico).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const BUILD_DIR = join(SCRIPTS_DIR, '..', 'build')

const BASE_SIZE = 512
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

const SVG = `<svg width="${BASE_SIZE}" height="${BASE_SIZE}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#f5c518"/>
  <g fill="#1d3557" opacity="0.10">
    <circle cx="60" cy="60" r="14"/>
    <circle cx="452" cy="70" r="18"/>
    <circle cx="70" cy="452" r="16"/>
    <circle cx="446" cy="448" r="12"/>
    <circle cx="256" cy="26" r="10"/>
    <circle cx="40" cy="256" r="12"/>
    <circle cx="472" cy="256" r="12"/>
  </g>
  <path d="M 128 96 h 256 a 40 40 0 0 1 40 40 v 180 a 40 40 0 0 1 -40 40 h -120 l -40 44 l -40 -44 h -56 a 40 40 0 0 1 -40 -40 v -180 a 40 40 0 0 1 40 -40 z"
        fill="#e63946" stroke="#1d3557" stroke-width="22" stroke-linejoin="round"/>
  <path d="M 150 330 V 182 L 256 292 L 362 182 V 330"
        stroke="#1d3557" stroke-width="52" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 150 330 V 182 L 256 292 L 362 182 V 330"
        stroke="#ffffff" stroke-width="34" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`

function log(msg) {
  process.stdout.write(`${msg}\n`)
}

function fail(msg) {
  process.stderr.write(`✗ ${msg}\n`)
  process.exit(1)
}

async function main() {
  let sharp
  let pngToIco
  try {
    sharp = (await import('sharp')).default
  } catch {
    fail('sharp nao encontrado. Rode `pnpm install` em apps/desktop (devDep sharp).')
  }
  try {
    pngToIco = (await import('png-to-ico')).default
  } catch {
    fail('png-to-ico nao encontrado. Rode `pnpm install` em apps/desktop (devDep png-to-ico).')
  }

  mkdirSync(BUILD_DIR, { recursive: true })

  const iconPng = await sharp(Buffer.from(SVG))
    .resize(BASE_SIZE, BASE_SIZE)
    .png()
    .toBuffer()
  writeFileSync(join(BUILD_DIR, 'icon.png'), iconPng)
  log(`✓ build/icon.png (${BASE_SIZE}x${BASE_SIZE})`)

  const pngs = await Promise.all(
    ICO_SIZES.map(async (size) =>
      sharp(iconPng)
        .resize(size, size)
        .png()
        .toBuffer(),
    ),
  )

  const ico = await pngToIco(pngs)
  writeFileSync(join(BUILD_DIR, 'icon.ico'), ico)
  log(`✓ build/icon.ico (${ICO_SIZES.join(', ')} px)`)
}

void main()
