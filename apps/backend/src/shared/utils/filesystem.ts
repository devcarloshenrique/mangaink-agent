import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Cria um diretório e todos os pais necessários (equivalente a mkdir -p).
 */
export async function mkdirp(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

/**
 * Escreve um objeto como JSON formatado em um arquivo.
 * Cria os diretórios pai automaticamente.
 * Substitui completamente o conteúdo anterior.
 */
export async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await mkdirp(path.dirname(filePath))
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Lê e parseia um arquivo JSON.
 * Retorna `null` se o arquivo não existir.
 */
export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

/**
 * Verifica se um arquivo ou diretório existe.
 */
export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}
