import { createHash } from 'node:crypto'

/**
 * Gera um hash SHA-256 de uma string e retorna em hexadecimal.
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}
