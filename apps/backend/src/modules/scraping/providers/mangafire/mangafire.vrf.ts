import * as fs from 'fs'
import * as path from 'path'

let isInitialized = false
let initPromise: Promise<void> | null = null

function setupGlobals(): void {
  if (typeof globalThis.navigator === 'undefined') {
    ;(globalThis as any).navigator = { appCodeName: 'Mozilla' }
  } else if (!globalThis.navigator.appCodeName) {
    try {
      Object.defineProperty(globalThis.navigator, 'appCodeName', {
        value: 'Mozilla',
        configurable: true,
        writable: true,
      })
    } catch {}
  }

  if (typeof (globalThis as any).window === 'undefined') {
    ;(globalThis as any).window = globalThis
  }

  if (typeof (globalThis as any).document === 'undefined') {
    ;(globalThis as any).document = {
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      cookie: '',
      head: {},
      body: {},
      documentElement: {},
      createElement: () => ({ appendChild: () => {}, setAttribute: () => {} }),
    }
  }

  if (typeof (globalThis as any).location === 'undefined') {
    ;(globalThis as any).location = {
      href: 'https://mangafire.to/',
      origin: 'https://mangafire.to',
      pathname: '/',
      search: '',
      hash: '',
      host: 'mangafire.to',
      hostname: 'mangafire.to',
      protocol: 'https:',
    }
  }
}

async function doInitMangaFireSigner(): Promise<void> {
  if (isInitialized && typeof (globalThis as any).getProtectionToken === 'function') {
    return
  }

  setupGlobals()

  let polyfillCode: string | null = null

  // 1. Attempt dynamic discovery from live MangaFire site
  try {
    const resHtml = await fetch('https://mangafire.to', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(5000),
    })

    if (resHtml.ok) {
      const html = await resHtml.text()
      const mainMatch = html.match(/src="([^"]*assets\/main-[^"]+\.js)"/)
      if (mainMatch) {
        const mainUrl = mainMatch[1].startsWith('http')
          ? mainMatch[1]
          : `https://mangafire.to${mainMatch[1].startsWith('/') ? '' : '/'}${mainMatch[1]}`
        const resMain = await fetch(mainUrl, { signal: AbortSignal.timeout(5000) })
        if (resMain.ok) {
          const mainJs = await resMain.text()
          const polyMatch = mainJs.match(/['"](\.\/polyfill-[^'"]+\.js)['"]/)
          if (polyMatch) {
            const polyUrl = new URL(polyMatch[1], mainUrl).href
            const resPoly = await fetch(polyUrl, { signal: AbortSignal.timeout(5000) })
            if (resPoly.ok) {
              polyfillCode = await resPoly.text()
            }
          }
        }
      }
    }
  } catch {
    // Dynamic fetch failed, proceed to local fallback
  }

  // 2. Fallback to local copy
  if (!polyfillCode) {
    const fallbackPath = path.resolve(__dirname, 'mangafire.polyfill.js')
    if (fs.existsSync(fallbackPath)) {
      polyfillCode = fs.readFileSync(fallbackPath, 'utf8')
    }
  }

  if (!polyfillCode) {
    throw new Error('Could not load MangaFire polyfill for VRF token generation')
  }

  const realSetTimeout = globalThis.setTimeout
  const realSetInterval = globalThis.setInterval

  try {
    // Temporarily suppress JScrambler background anti-tamper heartbeat timers
    ;(globalThis as any).setTimeout = () => 0
    ;(globalThis as any).setInterval = () => 0

    const dataUrl = 'data:text/javascript;base64,' + Buffer.from(polyfillCode).toString('base64')
    await import(dataUrl)
  } finally {
    globalThis.setTimeout = realSetTimeout
    globalThis.setInterval = realSetInterval
  }

  if (typeof (globalThis as any).getProtectionToken !== 'function') {
    throw new Error('getProtectionToken was not registered by MangaFire polyfill')
  }

  isInitialized = true
}

export async function initMangaFireSigner(): Promise<void> {
  if (isInitialized && typeof (globalThis as any).getProtectionToken === 'function') {
    return
  }
  if (!initPromise) {
    initPromise = doInitMangaFireSigner().finally(() => {
      initPromise = null
    })
  }
  return initPromise
}

export async function getVrfToken(apiPath: string, params: Record<string, any> = {}): Promise<string> {
  await initMangaFireSigner()
  return (globalThis as any).getProtectionToken(apiPath, params)
}
