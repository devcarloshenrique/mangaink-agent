import { useEffect, useRef, type ComponentType, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface MoreMenuItem {
  icon: ComponentType<{ className?: string }>;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}

export interface MoreMenuProps {
  items: MoreMenuItem[];
  onClose: () => void;
  align?: "left" | "right";
}

/**
 * Menu suspenso leve otimizado para linhas virtualizadas (sem conflito de stacking context / CSS transform).
 * - Fecha com clique externo (mousedown/touchstart) e tecla Escape.
 * - Foco automático no primeiro item e navegação por teclado (ArrowUp / ArrowDown).
 */
export function MoreMenu({ items, onClose, align = "right" }: MoreMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement | null;
        if (target?.closest?.('[aria-haspopup="menu"]')) {
          return;
        }
        onClose();
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const firstButton = menuRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])");
    firstButton?.focus();
  }, []);

  const handleKeyDownMenu = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [],
    );
    if (buttons.length === 0) return;

    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
      buttons[nextIndex]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
      buttons[prevIndex]?.focus();
    }
  };

  return (
    <div
      ref={menuRef}
      onKeyDown={handleKeyDownMenu}
      className={cn(
        "absolute top-[calc(100%+6px)] z-50 min-w-[200px] bg-card border-[3px] border-ink rounded-lg shadow-comic p-1.5 animate-slide-up",
        align === "right" ? "right-0" : "left-0",
      )}
      role="menu"
      tabIndex={-1}
    >
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="menuitem"
          disabled={it.disabled}
          title={it.title}
          onClick={() => {
            if (it.disabled) return;
            onClose();
            it.onClick();
          }}
          className={cn(
            "flex items-center gap-2 w-full text-left font-semibold text-[13px] px-2.5 py-2 rounded-md transition-colors whitespace-nowrap outline-none focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-ink",
            it.disabled
              ? "opacity-40 cursor-not-allowed text-muted-foreground"
              : "hover:bg-muted cursor-pointer",
            it.danger && !it.disabled && "text-comic-red hover:bg-comic-red/10",
          )}
        >
          <it.icon className="h-3.5 w-3.5 shrink-0" />
          {it.label}
        </button>
      ))}
    </div>
  );
}
