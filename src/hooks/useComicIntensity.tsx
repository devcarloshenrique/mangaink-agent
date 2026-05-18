import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Intensity = "soft" | "normal" | "loud";

interface IntensityCtx {
  intensity: Intensity;
  setIntensity: (i: Intensity) => void;
}

const Ctx = createContext<IntensityCtx | null>(null);
const KEY = "mangaforge-intensity";

function getInitial(): Intensity {
  if (typeof window === "undefined") return "normal";
  const stored = window.localStorage.getItem(KEY);
  if (stored === "soft" || stored === "normal" || stored === "loud") return stored;
  return "normal";
}

const CLASSES: Record<Intensity, string> = {
  soft: "comic-soft",
  normal: "comic-normal",
  loud: "comic-loud",
};

export function ComicIntensityProvider({ children }: { children: ReactNode }) {
  const [intensity, setIntensityState] = useState<Intensity>(getInitial);

  useEffect(() => {
    const root = document.documentElement;
    Object.values(CLASSES).forEach((c) => root.classList.remove(c));
    root.classList.add(CLASSES[intensity]);
    window.localStorage.setItem(KEY, intensity);
  }, [intensity]);

  const setIntensity = useCallback((i: Intensity) => setIntensityState(i), []);

  return <Ctx.Provider value={{ intensity, setIntensity }}>{children}</Ctx.Provider>;
}

export function useComicIntensity() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useComicIntensity dentro de ComicIntensityProvider");
  return ctx;
}
