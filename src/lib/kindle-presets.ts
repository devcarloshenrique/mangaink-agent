export const KINDLE_DEVICES = [
  { id: "kpw_11", label: "Kindle Paperwhite (11ª/12ª gen)" },
  { id: "kpw_signature", label: "Kindle Paperwhite Signature" },
  { id: "k_oasis", label: "Kindle Oasis" },
  { id: "k_scribe", label: "Kindle Scribe" },
  { id: "k_basic", label: "Kindle Basic (2022/2024)" },
  { id: "k_colorsoft", label: "Kindle Colorsoft" },
  { id: "k_voyage", label: "Kindle Voyage (legado)" },
  { id: "k_fire_hd", label: "Kindle Fire HD" },
] as const;

export const OUTPUT_FORMATS = ["EPUB", "MOBI", "CBZ", "KFX"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const PRESETS = [
  { id: "default", label: "default", description: "Configuração padrão" },
  { id: "manga", label: "manga", description: "Otimizado para mangá" },
  { id: "webtoon", label: "webtoon", description: "Otimizado para webtoon" },
  { id: "highQuality", label: "highQuality", description: "Qualidade máxima" },
  { id: "noProcessing", label: "noProcessing", description: "Sem processamento de imagem" },
  { id: "comic", label: "comic", description: "Otimizado para comics ocidentais" },
] as const;
export type PresetId = (typeof PRESETS)[number]["id"];
