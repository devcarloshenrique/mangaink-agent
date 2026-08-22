/**
 * Extensões de imagem aceitas pelo preview MOBI.
 * Usada por: MobiPreviewService, MobiUnpackRunner (Docker + Embedded), worker onTick.
 */
export const IMAGE_EXTENSIONS_REGEX = /\.(jpg|jpeg|png|gif|bmp|webp|avif)$/i

export function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS_REGEX.test(filename)
}
