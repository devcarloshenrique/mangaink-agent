import sharp from 'sharp'
import { devices } from '../config/devices'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export class PlaceholderService {
  private static readonly DEFAULT_W = 1072
  private static readonly DEFAULT_H = 1448

  private getDeviceResolution(deviceId: string): { width: number; height: number } {
    const device = devices.find((d) => d.id === deviceId)
    if (!device)
      return { width: PlaceholderService.DEFAULT_W, height: PlaceholderService.DEFAULT_H }

    const parts = device.resolution.split('x')
    const w = parseInt(parts[0], 10)
    const h = parseInt(parts[1], 10)

    if (isNaN(w) || isNaN(h))
      return { width: PlaceholderService.DEFAULT_W, height: PlaceholderService.DEFAULT_H }
    return { width: w, height: h }
  }

  async generateDefault(pageLabel: string): Promise<Buffer> {
    const { width, height } = {
      width: PlaceholderService.DEFAULT_W,
      height: PlaceholderService.DEFAULT_H,
    }

    const fontSize = Math.max(24, Math.round(Math.min(width, height) * 0.05))
    const escaped = escapeXml(pageLabel)

    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#1a1a1a"/>
  <text x="50%" y="45%" text-anchor="middle" dominant-baseline="middle"
        fill="#ffffff" font-family="Arial, sans-serif" font-size="${fontSize}px" font-weight="bold">
    Página indisponível
  </text>
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
        fill="#999999" font-family="Arial, sans-serif" font-size="${Math.round(fontSize * 0.7)}px">
    ${escaped}
  </text>
</svg>`

    return sharp(Buffer.from(svg)).png().toBuffer()
  }

  async generate(deviceId: string, pageLabel: string): Promise<Buffer> {
    const { width, height } = this.getDeviceResolution(deviceId)

    const fontSize = Math.max(24, Math.round(Math.min(width, height) * 0.05))
    const escaped = escapeXml(pageLabel)

    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#1a1a1a"/>
  <text x="50%" y="45%" text-anchor="middle" dominant-baseline="middle"
        fill="#ffffff" font-family="Arial, sans-serif" font-size="${fontSize}px" font-weight="bold">
    Página indisponível
  </text>
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
        fill="#999999" font-family="Arial, sans-serif" font-size="${Math.round(fontSize * 0.7)}px">
    ${escaped}
  </text>
</svg>`

    return sharp(Buffer.from(svg)).png().toBuffer()
  }
}
