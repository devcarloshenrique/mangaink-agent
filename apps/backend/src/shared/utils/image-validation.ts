/**
 * Validação de conteúdo de imagem por magic bytes (VULN-1/MEC-74).
 *
 * As rotas de serve/proxy de imagem (capítulos e covers) nunca devem refletir o
 * Content-Type vindo do servidor remoto, nem servir conteúdo que não seja uma
 * imagem verdadeira. Uma fonte comprometida poderia retornar HTML/SVG com
 * payload JS e ele seria servido na origem da aplicação.
 */

const IMAGE_MAGIC_BYTES: Array<{ signature: number[]; label: string }> = [
  { signature: [0xff, 0xd8, 0xff], label: 'JPEG' },
  { signature: [0x89, 0x50, 0x4e, 0x47], label: 'PNG' },
  { signature: [0x52, 0x49, 0x46, 0x46], label: 'WEBP' },
  { signature: [0x47, 0x49, 0x46, 0x38], label: 'GIF' },
  { signature: [0x42, 0x4d], label: 'BMP' },
]

export class InvalidImageContentError extends Error {
  readonly statusCode = 415
  constructor() {
    super('Conteúdo não é uma imagem válida')
    this.name = 'InvalidImageContentError'
  }
}

function hasSignature(buf: Buffer, signature: number[]): boolean {
  if (buf.length < signature.length) return false
  for (let i = 0; i < signature.length; i++) {
    if (buf[i] !== signature[i]) return false
  }
  return true
}

function looksLikeTextHtml(buf: Buffer): boolean {
  if (buf.length === 0) return false
  const start = buf.toString('utf-8', 0, Math.min(256, buf.length)).trimStart()
  return start.startsWith('<!') || start.startsWith('<html') || start.startsWith('<HTML')
}

/**
 * Detecta o Content-Type real de um buffer de imagem a partir dos bytes.
 * Nunca deriva do header remoto — o caller usa este valor para servir.
 */
export function detectImageContentType(buf: Buffer): string {
  if (hasSignature(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (hasSignature(buf, [0x89, 0x50, 0x4e, 0x47])) return 'image/png'
  if (
    hasSignature(buf, [0x52, 0x49, 0x46, 0x46]) &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (hasSignature(buf, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'
  if (hasSignature(buf, [0x42, 0x4d])) return 'image/bmp'
  return 'image/octet-stream'
}

/**
 * Retorna true se o buffer é uma imagem verdadeira (magic bytes conhecidos).
 */
export function isImageBuffer(buf: Buffer): boolean {
  if (buf.length === 0) return false
  if (hasSignature(buf, [0xff, 0xd8, 0xff])) return true // JPEG
  if (hasSignature(buf, [0x89, 0x50, 0x4e, 0x47])) return true // PNG
  if (
    hasSignature(buf, [0x52, 0x49, 0x46, 0x46]) &&
    buf.length >= 12 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return true // WEBP
  }
  if (hasSignature(buf, [0x47, 0x49, 0x46, 0x38])) return true // GIF
  if (hasSignature(buf, [0x42, 0x4d])) return true // BMP
  return false
}

/**
 * Valida um buffer baixado: deve ser uma imagem verdadeira (não HTML/SVG/texto
 * plano/vazio). Lança InvalidImageContentError (415) caso contrário.
 */
export function assertValidImage(buf: Buffer): void {
  if (buf.length === 0) {
    throw new InvalidImageContentError()
  }
  if (looksLikeTextHtml(buf)) {
    throw new InvalidImageContentError()
  }
  if (!isImageBuffer(buf)) {
    throw new InvalidImageContentError()
  }
}
