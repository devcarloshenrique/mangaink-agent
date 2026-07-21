import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  left: React.ReactNode;
  right: React.ReactNode;
  leftLabel?: string;
  rightLabel?: string;
  className?: string;
}

export function ComparisonSlider({
  left,
  right,
  leftLabel = "Original",
  rightLabel = "Convertido",
  className,
}: Props) {
  const [pos, setPos] = useState(50);

  return (
    <div className={cn("relative select-none", className)}>
      {/* Full right side (convertido) */}
      <div className="relative overflow-hidden border-[3px] border-ink rounded-md shadow-comic-sm">
        {right}
      </div>

      {/* Clipped left side (original) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {left}
      </div>

      {/* Slider handle */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-comic-yellow cursor-ew-resize z-10"
        style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-5 bg-comic-yellow border-[2.5px] border-ink rounded shadow-comic-sm flex items-center justify-center">
          <span className="text-[8px] font-bold">↔</span>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-2 left-2 z-20">
        <span className="font-display text-[10px] bg-comic-yellow border-[2px] border-ink px-1.5 py-0.5 rounded">
          {leftLabel}
        </span>
      </div>
      <div className="absolute top-2 right-2 z-20">
        <span className="font-display text-[10px] bg-comic-blue text-accent-foreground border-[2px] border-ink px-1.5 py-0.5 rounded">
          {rightLabel}
        </span>
      </div>

      {/* Range input (invisible, on top) */}
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
        aria-label="Comparação original vs convertido"
      />
    </div>
  );
}
