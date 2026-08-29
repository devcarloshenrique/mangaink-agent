import { useEffect } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

export interface TourStep {
  /** Seletor CSS do alvo (ex.: "[data-tour='hero']") */
  element: string;
  title: string;
  description: string;
}

interface Props {
  steps: TourStep[];
  /** Atraso antes de abrir — dá tempo do layout assentar */
  startDelayMs?: number;
  /** Chave no localStorage para evitar reexibição após o tour ser concluído/fechado */
  storageKey?: string;
  /** Se true, força o tour mesmo se já estiver gravado no localStorage (modo demo) */
  force?: boolean;
  /** Callback opcional quando o tour é encerrado */
  onComplete?: () => void;
}

/**
 * Guided Tour estilo spotlight (driver.js) com tema pop-art via `.tour-comic`.
 * Cria a instância no mount e destrói no unmount.
 */
export function GuidedTour({
  steps,
  startDelayMs = 700,
  storageKey,
  force = false,
  onComplete,
}: Props) {
  useEffect(() => {
    // Se houver chave de persistência e não for forçado, não inicia se já foi visto
    if (storageKey && !force) {
      try {
        const seen = localStorage.getItem(storageKey);
        if (seen === "true") {
          return;
        }
      } catch {
        // Ignora falhas de acesso a localStorage
      }
    }

    let instance: Driver | undefined;

    const timer = setTimeout(() => {
      instance = driver({
        popoverClass: "tour-comic",
        overlayColor: "rgba(0,0,0,0.65)",
        stagePadding: 8,
        stageRadius: 12,
        allowClose: true,
        showProgress: true,
        progressText: "{{current}} de {{total}}",
        nextBtnText: "Próximo",
        prevBtnText: "Voltar",
        doneBtnText: "Bora! 🎉",
        onDestroyStarted: () => {
          if (storageKey) {
            try {
              localStorage.setItem(storageKey, "true");
            } catch {
              // Ignora falhas de escrita
            }
          }
          onComplete?.();
          instance?.destroy();
        },
        steps: steps.map((s) => ({
          element: s.element,
          popover: { title: s.title, description: s.description },
        })),
      });

      instance.drive();
    }, startDelayMs);

    return () => {
      clearTimeout(timer);
      instance?.destroy();
    };
    // steps é constante por página — intencional fora das deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, force]);

  return null;
}
