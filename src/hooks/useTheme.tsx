import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { THEME_PRESETS, getThemeById } from "@/lib/theme-presets";

// ── ThemeProvider (Context) ──────────────────────────────────────────────────

type Mode = "light" | "dark";

interface ThemeCtx {
  mode: Mode;
  theme: Mode;
  activeThemeId: string;
  comicIntensity: number;
  toggleMode: () => void;
  toggle: () => void;
  setThemeById: (id: string) => void;
  setComicIntensity: (v: number) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

const MODE_KEY = "mangaink-mode";
const THEME_KEY = "mangaink-theme";
const INTENSITY_KEY = "mangaink-intensity";

function getInitialMode(): Mode {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(MODE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return "light";
}

function getInitialTheme(): string {
  if (typeof window === "undefined") return "classic";
  return localStorage.getItem(THEME_KEY) ?? "classic";
}

function getInitialIntensity(): number {
  if (typeof window === "undefined") return 1;
  const v = localStorage.getItem(INTENSITY_KEY);
  return v ? Number(v) : 1;
}

function applyColors(themeId: string, darkMode: boolean): void {
  const theme = getThemeById(themeId);
  if (!theme) return;
  const root = document.documentElement;
  const c = theme.colors;
  const isDark = darkMode || theme.isDark;

  root.style.setProperty("--comic-yellow", c.yellow);
  root.style.setProperty("--comic-red", c.red);
  root.style.setProperty("--comic-blue", c.blue);
  root.style.setProperty("--comic-cream", c.cream);
  root.style.setProperty("--comic-ink", c.ink);

  root.style.setProperty("--background", c.cream);
  root.style.setProperty("--card", c.cream);
  root.style.setProperty("--popover", c.cream);
  root.style.setProperty("--input", c.cream);
  root.style.setProperty("--muted", c.cream);

  if (isDark) {
    root.style.setProperty("--foreground", "#ffffff");
    root.style.setProperty("--card-foreground", "#ffffff");
    root.style.setProperty("--popover-foreground", "#ffffff");
    root.style.setProperty("--muted-foreground", "#9ca3af");
    root.style.setProperty("--border", "#4b5563");
    root.style.setProperty("--primary", c.red);
    root.style.setProperty("--primary-foreground", c.cream);
    root.style.setProperty("--destructive", c.red);
    root.style.setProperty("--destructive-foreground", c.cream);
    root.style.setProperty("--secondary", c.yellow);
    root.style.setProperty("--secondary-foreground", c.cream);
    root.style.setProperty("--accent", c.blue);
    root.style.setProperty("--accent-foreground", c.cream);
  } else {
    root.style.setProperty("--foreground", c.ink);
    root.style.setProperty("--card-foreground", c.ink);
    root.style.setProperty("--popover-foreground", c.ink);
    root.style.setProperty("--muted-foreground", c.ink);
    root.style.setProperty("--border", c.ink);
    root.style.setProperty("--primary", c.red);
    root.style.setProperty("--primary-foreground", c.cream);
    root.style.setProperty("--destructive", c.red);
    root.style.setProperty("--destructive-foreground", c.cream);
    root.style.setProperty("--secondary", c.yellow);
    root.style.setProperty("--secondary-foreground", c.ink);
    root.style.setProperty("--accent", c.blue);
    root.style.setProperty("--accent-foreground", c.cream);
  }

  root.style.setProperty("--ring", c.blue);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(getInitialMode);
  const [activeThemeId, setActiveThemeId] = useState(getInitialTheme);
  const [comicIntensity, setComicIntensityState] = useState(getInitialIntensity);

  useEffect(() => {
    applyColors(activeThemeId, mode === "dark");
    localStorage.setItem(THEME_KEY, activeThemeId);
  }, [activeThemeId, mode]);

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    const s = comicIntensity;
    root.style.setProperty("--shadow-comic-sm", `${Math.round(3 * s)}px ${Math.round(3 * s)}px 0 0 var(--comic-ink)`);
    root.style.setProperty("--shadow-comic", `${Math.round(6 * s)}px ${Math.round(6 * s)}px 0 0 var(--comic-ink)`);
    root.style.setProperty("--shadow-comic-lg", `${Math.round(10 * s)}px ${Math.round(10 * s)}px 0 0 var(--comic-ink)`);
    localStorage.setItem(INTENSITY_KEY, String(s));
  }, [comicIntensity]);

  const toggleMode = useCallback(() => {
    setMode((m) => (m === "light" ? "dark" : "light"));
  }, []);

  const setThemeById = useCallback((id: string) => {
    setActiveThemeId(id);
  }, []);

  const setComicIntensity = useCallback((v: number) => {
    setComicIntensityState(Math.max(0, Math.min(1, v)));
  }, []);

  return (
    <Ctx.Provider
      value={{
        mode,
        theme: mode,
        activeThemeId,
        comicIntensity,
        toggleMode,
        toggle: toggleMode,
        setThemeById,
        setComicIntensity,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  return ctx;
}

// ── Imperative API (compatibilidade) ─────────────────────────────────────────

export function applyTheme(themeId: string): void {
  applyColors(themeId, false);
}

export function getTheme(): string {
  return localStorage.getItem(THEME_KEY) ?? "classic";
}

export function setTheme(themeId: string): void {
  localStorage.setItem(THEME_KEY, themeId);
  applyTheme(themeId);
}

export function initTheme(): void {
  applyTheme(getTheme());
}

export function getPresetIds(): string[] {
  return THEME_PRESETS.map((t) => t.id);
}
