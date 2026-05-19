export interface ThemeColors {
  yellow: string;
  red: string;
  blue: string;
  cream: string;
  ink: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  colors: ThemeColors;
  isDark?: boolean;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "classic",
    name: "Clássico",
    colors: {
      yellow: "oklch(0.88 0.18 95)",
      red: "oklch(0.62 0.24 25)",
      blue: "oklch(0.5 0.22 260)",
      cream: "oklch(0.97 0.025 90)",
      ink: "oklch(0.15 0.02 260)",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    colors: {
      yellow: "oklch(0.85 0.12 200)",
      red: "oklch(0.55 0.2 230)",
      blue: "oklch(0.45 0.25 250)",
      cream: "oklch(0.96 0.02 220)",
      ink: "oklch(0.35 0.15 240)",
    },
  },
  {
    id: "forest",
    name: "Forest",
    colors: {
      yellow: "oklch(0.88 0.16 140)",
      red: "oklch(0.5 0.22 30)",
      blue: "oklch(0.45 0.18 160)",
      cream: "oklch(0.96 0.03 140)",
      ink: "oklch(0.3 0.1 150)",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    colors: {
      yellow: "oklch(0.9 0.18 60)",
      red: "oklch(0.6 0.25 20)",
      blue: "oklch(0.5 0.2 300)",
      cream: "oklch(0.97 0.04 50)",
      ink: "oklch(0.4 0.15 20)",
    },
  },
  {
    id: "neon",
    name: "Neon",
    colors: {
      yellow: "oklch(0.9 0.2 120)",
      red: "oklch(0.6 0.28 340)",
      blue: "oklch(0.55 0.25 280)",
      cream: "oklch(0.95 0.05 300)",
      ink: "oklch(0.5 0.25 320)",
    },
  },
  {
    id: "peach",
    name: "Pêssego",
    colors: {
      yellow: "oklch(0.9 0.16 55)",
      red: "oklch(0.68 0.22 25)",
      blue: "oklch(0.55 0.14 230)",
      cream: "oklch(0.97 0.05 45)",
      ink: "oklch(0.32 0.12 25)",
    },
  },
  {
    id: "mint",
    name: "Menta",
    colors: {
      yellow: "oklch(0.88 0.14 150)",
      red: "oklch(0.55 0.18 30)",
      blue: "oklch(0.55 0.14 200)",
      cream: "oklch(0.96 0.03 160)",
      ink: "oklch(0.32 0.08 170)",
    },
  },
  {
    id: "rose",
    name: "Rosa",
    colors: {
      yellow: "oklch(0.88 0.1 350)",
      red: "oklch(0.62 0.22 350)",
      blue: "oklch(0.55 0.16 280)",
      cream: "oklch(0.96 0.03 340)",
      ink: "oklch(0.38 0.12 340)",
    },
  },
  {
    id: "sand",
    name: "Areia",
    colors: {
      yellow: "oklch(0.84 0.1 85)",
      red: "oklch(0.55 0.16 50)",
      blue: "oklch(0.48 0.08 250)",
      cream: "oklch(0.95 0.04 85)",
      ink: "oklch(0.28 0.06 60)",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    isDark: true,
    colors: {
      yellow: "oklch(0.82 0.18 85)",
      red: "oklch(0.72 0.2 350)",
      blue: "oklch(0.75 0.14 260)",
      cream: "oklch(0.22 0.03 270)",
      ink: "oklch(0.18 0.03 270)",
    },
  },
  {
    id: "one-dark",
    name: "One Dark",
    isDark: true,
    colors: {
      yellow: "oklch(0.82 0.14 75)",
      red: "oklch(0.7 0.18 20)",
      blue: "oklch(0.72 0.14 240)",
      cream: "oklch(0.24 0.02 240)",
      ink: "oklch(0.18 0.02 240)",
    },
  },
  {
    id: "github-dark",
    name: "GitHub Dark",
    isDark: true,
    colors: {
      yellow: "oklch(0.82 0.12 80)",
      red: "oklch(0.68 0.2 15)",
      blue: "oklch(0.7 0.16 220)",
      cream: "oklch(0.18 0.02 220)",
      ink: "oklch(0.15 0.02 220)",
    },
  },
  {
    id: "nord",
    name: "Nord",
    isDark: true,
    colors: {
      yellow: "oklch(0.82 0.12 90)",
      red: "oklch(0.65 0.16 15)",
      blue: "oklch(0.7 0.12 210)",
      cream: "oklch(0.24 0.03 220)",
      ink: "oklch(0.18 0.03 220)",
    },
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    isDark: true,
    colors: {
      yellow: "oklch(0.82 0.12 100)",
      red: "oklch(0.72 0.18 345)",
      blue: "oklch(0.72 0.16 250)",
      cream: "oklch(0.2 0.04 260)",
      ink: "oklch(0.16 0.04 260)",
    },
  },
];

export function getThemeById(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((t) => t.id === id);
}
