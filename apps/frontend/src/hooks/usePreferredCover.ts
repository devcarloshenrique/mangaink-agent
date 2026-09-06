import { useState, useEffect, useCallback } from "react";
import {
  getPreferredCover,
  setPreferredCover as savePreferredCover,
  removePreferredCover as deletePreferredCover,
  PREFERRED_COVER_CHANGED_EVENT,
} from "@/lib/custom-covers";
import type { CoverRef } from "@/types/conversion";
import type { Cover } from "@/types/scraping";

/**
 * Hook reativo que escuta alterações na capa preferida de um mangá.
 * Atualiza instantaneamente quando qualquer componente chama `setPreferredCover` ou `removePreferredCover`.
 */
export function usePreferredCover(sourceId: string | null | undefined) {
  const [preferredCover, setPreferredCoverState] = useState<CoverRef | null>(() => {
    return sourceId ? getPreferredCover(sourceId) : null;
  });

  useEffect(() => {
    if (!sourceId) {
      setPreferredCoverState(null);
      return;
    }

    // Inicializa com o valor atual
    setPreferredCoverState(getPreferredCover(sourceId));

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ sourceId: string; coverRef: CoverRef | null }>;
      if (customEvent.detail && customEvent.detail.sourceId === sourceId) {
        setPreferredCoverState(customEvent.detail.coverRef);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "mangaink:preferred-covers") {
        setPreferredCoverState(getPreferredCover(sourceId));
      }
    };

    window.addEventListener(PREFERRED_COVER_CHANGED_EVENT, handleCustomEvent);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(PREFERRED_COVER_CHANGED_EVENT, handleCustomEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, [sourceId]);

  const setCover = useCallback(
    (cover: Cover | CoverRef) => {
      if (!sourceId) return;
      savePreferredCover(sourceId, cover);
    },
    [sourceId],
  );

  const removeCover = useCallback(() => {
    if (!sourceId) return;
    deletePreferredCover(sourceId);
  }, [sourceId]);

  return {
    preferredCover,
    setPreferredCover: setCover,
    removePreferredCover: removeCover,
  };
}
