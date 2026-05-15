import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sessionConfig, type SessionData } from "./auth-config";
import { libraryDir, isPersistent } from "./storage.server";

async function requireUser(): Promise<string> {
  const session = await useSession<SessionData>(sessionConfig);
  if (!session.data?.username) throw new Error("Não autenticado");
  return session.data.username;
}

export interface LibraryFile {
  name: string;
  bytes: number;
  modifiedAt: number;
  format: string;
}

export interface LibrarySeries {
  slug: string;
  title: string;
  fileCount: number;
  totalBytes: number;
  updatedAt: number;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "obra";
}

export const listSeries = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser();
  if (!isPersistent()) return { persistent: false, series: [] as LibrarySeries[] };
  const root = libraryDir();
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  const entries = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
  const series: LibrarySeries[] = entries.map((d) => {
    const dir = join(root, d.name);
    const files = readdirSync(dir, { withFileTypes: true }).filter((f) => f.isFile());
    const stats = files.map((f) => statSync(join(dir, f.name)));
    return {
      slug: d.name,
      title: d.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      fileCount: files.length,
      totalBytes: stats.reduce((acc, s) => acc + s.size, 0),
      updatedAt: stats.reduce((acc, s) => Math.max(acc, s.mtimeMs), 0),
    };
  });
  return { persistent: true, series };
});

export const getSeries = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    await requireUser();
    if (!isPersistent()) return { persistent: false, files: [] as LibraryFile[] };
    const dir = join(libraryDir(), data.slug);
    if (!existsSync(dir)) return { persistent: true, files: [] };
    const files: LibraryFile[] = readdirSync(dir, { withFileTypes: true })
      .filter((f) => f.isFile())
      .map((f) => {
        const s = statSync(join(dir, f.name));
        const ext = f.name.split(".").pop()?.toUpperCase() ?? "";
        return { name: f.name, bytes: s.size, modifiedAt: s.mtimeMs, format: ext };
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
    return { persistent: true, files };
  });

// Conversão MOCK: gera um arquivo placeholder em /data/library/{slug}/
export const saveConvertedMock = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      title: z.string().min(1).max(200),
      label: z.string().min(1).max(200),
      format: z.enum(["EPUB", "MOBI", "CBZ", "KFX"]),
      sizeBytes: z.number().int().min(1024).max(200 * 1024 * 1024),
    }),
  )
  .handler(async ({ data }) => {
    await requireUser();
    if (!isPersistent()) {
      return {
        ok: false,
        message:
          "Este preview do Lovable roda em runtime sem filesystem. A biblioteca local só persiste dentro do container Docker.",
      };
    }
    const slug = slugify(data.title);
    const dir = join(libraryDir(), slug);
    mkdirSync(dir, { recursive: true });
    const filename = `${slugify(data.label)}.${data.format.toLowerCase()}`;
    const path = join(dir, filename);
    // Placeholder de tamanho aproximado (bytes nulos) — substituir pela conversão real depois
    writeFileSync(path, Buffer.alloc(Math.min(data.sizeBytes, 5 * 1024 * 1024)));
    return { ok: true, slug, filename };
  });
