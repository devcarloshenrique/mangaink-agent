import type { Cover } from "@/types/scraping";
import type { CoverRef } from "@/types/conversion";

export const PREFERRED_COVERS_KEY = "mangaink:preferred-covers";
export const PREFERRED_COVER_CHANGED_EVENT = "mangaink:preferred-cover-changed";

/**
 * Converte uma `Cover` do scraping em uma referência `CoverRef` para uso na API de conversões.
 */
export function coverToCoverRef(cover: Cover): CoverRef {
  if (cover.type === "original") {
    return { kind: "original" };
  }
  if (cover.type === "upload") {
    return { kind: "upload", uploadId: cover.id, name: cover.label };
  }
  return { kind: "gallery", coverId: cover.id };
}

/**
 * Formata um nome amigável para a capa na UI (Lightbox, Alt text, Galeria).
 */
export function formatCoverLabel(cover: Cover, index?: number): string {
  if (cover.type === "original") {
    return "Capa Original";
  }

  if (cover.type === "upload") {
    if (!cover.label) return "Capa Personalizada";
    const clean = cover.label.replace(/\.(jpe?g|png|webp|avif|gif)$/i, "").trim();

    // Identifica UUIDs, hashes hexadecimais, nomes automáticos de uploads ou arquivos de câmera
    const isUuidOrHash =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean) ||
      /^[0-9a-fA-F-_]{16,}$/.test(clean) ||
      /^IMG[-_0-9]+/i.test(clean) ||
      /^upload[-_0-9]+/i.test(clean) ||
      /^(image|img|foto|capa|file|blob)$/i.test(clean);

    if (isUuidOrHash) {
      return "Capa Personalizada";
    }

    return clean || "Capa Personalizada";
  }

  if (cover.type === "gallery") {
    if (!cover.label) {
      return index !== undefined ? `Volume ${index + 1}` : "Capa Oficial";
    }
    const clean = cover.label.replace(/\.(jpe?g|png|webp|avif|gif)$/i, "").trim();

    if (/^volume\s+/i.test(clean) || /^\d+$/.test(clean)) {
      return clean.startsWith("Volume") || clean.startsWith("volume")
        ? clean.replace(/^volume\s*/i, "Volume ")
        : `Volume ${clean}`;
    }

    if (/^capa\s+oficial$/i.test(clean)) {
      return "Capa Oficial";
    }

    return clean || (index !== undefined ? `Volume ${index + 1}` : "Capa Oficial");
  }

  return cover.label || "Capa";
}

/**
 * Compara se duas referências de capa representam a mesma capa.
 */
export function isSameCover(
  coverA: CoverRef | null | undefined,
  coverB: CoverRef | null | undefined,
): boolean {
  if (!coverA && !coverB) return true;
  if (!coverA || !coverB) return false;
  if (coverA.kind !== coverB.kind) return false;
  if (coverA.kind === "original" && coverB.kind === "original") return true;
  if (coverA.kind === "gallery" && coverB.kind === "gallery") {
    return coverA.coverId === coverB.coverId;
  }
  if (coverA.kind === "upload" && coverB.kind === "upload") {
    return coverA.uploadId === coverB.uploadId;
  }
  return false;
}

/**
 * Verifica se a capa fornecida é a capa selecionada/preferida da obra.
 */
export function isCoverSelected(cover: Cover, preferredCover: CoverRef | null): boolean {
  if (!preferredCover) {
    // Por padrão (sem preferência gravada), a capa original é a principal
    return cover.type === "original";
  }
  const ref = coverToCoverRef(cover);
  return isSameCover(ref, preferredCover);
}

/**
 * Retorna o mapa de todas as capas preferidas armazenadas no localStorage.
 */
export function getPreferredCoversMap(): Record<string, CoverRef> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(PREFERRED_COVERS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CoverRef>;
  } catch {
    return {};
  }
}

/**
 * Retorna a capa preferida para uma obra específica.
 */
export function getPreferredCover(sourceId: string): CoverRef | null {
  if (!sourceId) return null;
  const map = getPreferredCoversMap();
  return map[sourceId] ?? null;
}

/**
 * Define a capa preferida para uma obra específica e notifica a aplicação.
 */
export function setPreferredCover(sourceId: string, cover: Cover | CoverRef): void {
  if (!sourceId) return;
  const ref: CoverRef = "type" in cover ? coverToCoverRef(cover) : cover;
  const map = getPreferredCoversMap();
  map[sourceId] = ref;
  try {
    localStorage.setItem(PREFERRED_COVERS_KEY, JSON.stringify(map));
  } catch (e) {
    console.error("Erro ao salvar capa preferida no localStorage:", e);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PREFERRED_COVER_CHANGED_EVENT, {
        detail: { sourceId, coverRef: ref },
      }),
    );
  }
}

/**
 * Remove a preferência de capa para uma obra específica e notifica a aplicação.
 */
export function removePreferredCover(sourceId: string): void {
  if (!sourceId) return;
  const map = getPreferredCoversMap();
  delete map[sourceId];
  try {
    localStorage.setItem(PREFERRED_COVERS_KEY, JSON.stringify(map));
  } catch (e) {
    console.error("Erro ao remover capa preferida do localStorage:", e);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PREFERRED_COVER_CHANGED_EVENT, {
        detail: { sourceId, coverRef: null },
      }),
    );
  }
}
