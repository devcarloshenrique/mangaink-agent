import { THEME_PRESETS, getThemeById } from "@/lib/theme-presets";

const STORAGE_KEY = "mangaink-theme";

export function applyTheme(themeId: string): void {
  const theme = getThemeById(themeId);
  if (!theme) return;
  const root = document.documentElement;
  const c = theme.colors;
  const dark = !!theme.isDark;

  root.style.setProperty("--comic-yellow", c.yellow);
  root.style.setProperty("--comic-red", c.red);
  root.style.setProperty("--comic-blue", c.blue);
  root.style.setProperty("--comic-cream", c.cream);
  root.style.setProperty("--comic-ink", c.ink);

  root.style.setProperty("--background", c.cream);
  root.style.setProperty("--card", c.cream);
  root.style.setProperty("--popover", c.cream);
  root.style.setProperty("--border", c.ink);
  root.style.setProperty("--input", c.cream);

  root.style.setProperty("--foreground", dark ? "#e8e6f0" : c.ink);
  root.style.setProperty("--card-foreground", dark ? "#e8e6f0" : c.ink);
  root.style.setProperty("--popover-foreground", dark ? "#e8e6f0" : c.ink);
  root.style.setProperty("--muted-foreground", dark ? "#b0adc4" : c.ink);

  root.style.setProperty("--primary", c.red);
  root.style.setProperty("--primary-foreground", dark ? c.ink : c.cream);
  root.style.setProperty("--destructive", c.red);
  root.style.setProperty("--destructive-foreground", dark ? c.ink : c.cream);

  root.style.setProperty("--secondary", c.yellow);
  root.style.setProperty("--secondary-foreground", c.ink);

  root.style.setProperty("--accent", c.blue);
  root.style.setProperty("--accent-foreground", dark ? c.ink : c.cream);

  root.style.setProperty("--ring", c.blue);
  root.style.setProperty("--muted", c.cream);

  if (dark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function getTheme(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "classic";
}

export function setTheme(themeId: string): void {
  localStorage.setItem(STORAGE_KEY, themeId);
  applyTheme(themeId);
}

export function initTheme(): void {
  applyTheme(getTheme());
}

export function getPresetIds(): string[] {
  return THEME_PRESETS.map((t) => t.id);
}
