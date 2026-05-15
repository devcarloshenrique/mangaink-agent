// Persistência leve baseada em arquivos JSON no diretório /data.
// Quando rodando em runtime Workers (Lovable preview) o filesystem
// não existe — caímos num store em memória para a app continuar
// renderizável. No container Docker tudo escreve em /data.
//
// Para evoluir depois: trocar por better-sqlite3 ou drizzle/sqlite.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = process.env.DATA_DIR ?? "/data";
const memStore = new Map<string, unknown>();

function hasFs(): boolean {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

export function readJson<T>(name: string, fallback: T): T {
  if (memStore.has(name)) return memStore.get(name) as T;
  if (!hasFs()) return fallback;
  const file = join(DATA_DIR, `${name}.json`);
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(name: string, data: T): void {
  memStore.set(name, data);
  if (!hasFs()) return;
  try {
    writeFileSync(join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2));
  } catch {
    // ignore (read-only fs ou worker)
  }
}

export function libraryDir(): string {
  return join(DATA_DIR, "library");
}

export function dataDir(): string {
  return DATA_DIR;
}

export function isPersistent(): boolean {
  return hasFs();
}
