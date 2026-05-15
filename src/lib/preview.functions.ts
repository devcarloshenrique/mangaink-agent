import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { sessionConfig, type SessionData } from "./auth-config";
import { KINDLE_DEVICES } from "./kindle-presets";

// Stub do preview de página convertida.
// Próxima fatia: instalar `sharp` no container e aplicar resize/grayscale/contraste
// reais, retornando PNG em base64. Por ora devolvemos as dimensões alvo + filtros
// CSS equivalentes pra UI renderizar uma simulação visualmente próxima.

const DEVICE_PROFILES: Record<
  string,
  { width: number; height: number; ppi: number; grayscale: boolean }
> = {
  kpw_11: { width: 1236, height: 1648, ppi: 300, grayscale: true },
  kpw_signature: { width: 1236, height: 1648, ppi: 300, grayscale: true },
  k_oasis: { width: 1264, height: 1680, ppi: 300, grayscale: true },
  k_scribe: { width: 1860, height: 2480, ppi: 300, grayscale: true },
  k_basic: { width: 1072, height: 1448, ppi: 300, grayscale: true },
  k_colorsoft: { width: 1264, height: 1680, ppi: 300, grayscale: false },
  k_voyage: { width: 1080, height: 1440, ppi: 300, grayscale: true },
  k_fire_hd: { width: 1280, height: 800, ppi: 224, grayscale: false },
};

const PRESET_FILTERS: Record<string, { contrast: number; brightness: number; gamma: number }> = {
  default: { contrast: 1.0, brightness: 1.0, gamma: 1.0 },
  manga: { contrast: 1.2, brightness: 1.0, gamma: 0.95 },
  webtoon: { contrast: 1.05, brightness: 1.05, gamma: 1.0 },
  highQuality: { contrast: 1.1, brightness: 1.0, gamma: 1.0 },
  noProcessing: { contrast: 1.0, brightness: 1.0, gamma: 1.0 },
  comic: { contrast: 1.15, brightness: 1.05, gamma: 0.98 },
};

async function requireUser(): Promise<string> {
  const session = await useSession<SessionData>(sessionConfig);
  if (!session.data?.username) throw new Error("Não autenticado");
  return session.data.username;
}

export const generatePreview = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      pageUrl: z.string().url(),
      deviceId: z.string(),
      presetId: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    await requireUser();
    const device = DEVICE_PROFILES[data.deviceId] ?? DEVICE_PROFILES.kpw_11;
    const preset = PRESET_FILTERS[data.presetId] ?? PRESET_FILTERS.default;
    const deviceLabel =
      KINDLE_DEVICES.find((d) => d.id === data.deviceId)?.label ?? "Kindle";

    return {
      previewMode: "css-simulation" as const,
      sourceUrl: data.pageUrl,
      device: {
        id: data.deviceId,
        label: deviceLabel,
        width: device.width,
        height: device.height,
        ppi: device.ppi,
        grayscale: device.grayscale,
      },
      preset: { id: data.presetId, ...preset },
      // Filtro CSS equivalente que o cliente aplica em <img>
      cssFilter: [
        device.grayscale ? "grayscale(100%)" : "",
        `contrast(${preset.contrast})`,
        `brightness(${preset.brightness})`,
      ]
        .filter(Boolean)
        .join(" "),
      note: "Preview de simulação. A renderização final usa sharp no container.",
    };
  });
