import { useTheme } from "@/hooks/useTheme";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export function ComicIntensitySlider({ className }: Props) {
  const { comicIntensity, setComicIntensity } = useTheme();

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Label className="font-display text-base">Intensidade Comic</Label>
        <span className="font-display text-sm bg-comic-yellow border-[2px] border-ink px-2 py-0.5 rounded">
          {Math.round(comicIntensity * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={comicIntensity}
        onChange={(e) => setComicIntensity(Number(e.target.value))}
        className="w-full accent-comic-red"
      />
      <div className="flex justify-between text-xs font-medium opacity-60">
        <span>Suave</span>
        <span>Padrão</span>
        <span>Exagerado</span>
      </div>
    </div>
  );
}
