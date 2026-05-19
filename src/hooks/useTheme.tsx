import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  comicIntensity: number;
  toggleTheme: () => void;
  setComicIntensity: (v: number) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

const THEME_KEY = "mangaforge-theme";
const INTENSITY_KEY = "mangaforge-comic-intensity";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem(THEME_KEY) as Theme) ?? "light";
  });

  const [comicIntensity, setComicIntensityState] = useState(() => {
    if (typeof window === "undefined") return 1;
    const v = localStorage.getItem(INTENSITY_KEY);
    return v ? Number(v) : 1;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const s = comicIntensity;
    root.style.setProperty(
      "--shadow-comic-sm",
      `${Math.round(3 * s)}px ${Math.round(3 * s)}px 0 0 var(--comic-ink)`,
    );
    root.style.setProperty(
      "--shadow-comic",
      `${Math.round(6 * s)}px ${Math.round(6 * s)}px 0 0 var(--comic-ink)`,
    );
    root.style.setProperty(
      "--shadow-comic-lg",
      `${Math.round(10 * s)}px ${Math.round(10 * s)}px 0 0 var(--comic-ink)`,
    );
    localStorage.setItem(INTENSITY_KEY, String(s));
  }, [comicIntensity]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  const setComicIntensity = useCallback((v: number) => {
    setComicIntensityState(Math.max(0, Math.min(1, v)));
  }, []);

  return (
    <Ctx.Provider value={{ theme, comicIntensity, toggleTheme, setComicIntensity }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  return ctx;
}
