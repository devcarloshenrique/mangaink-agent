import { Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useComicIntensity, type Intensity } from "@/hooks/useComicIntensity";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Intensity; label: string; hint: string }[] = [
  { value: "soft", label: "Suave", hint: "Sombras discretas" },
  { value: "normal", label: "Padrão", hint: "Estilo clássico" },
  { value: "loud", label: "Exagerado", hint: "POW! BOOM!" },
];

export function IntensityControl({ className }: { className?: string }) {
  const { intensity, setIntensity } = useComicIntensity();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Intensidade comic"
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-md border-[3px] border-ink bg-card shadow-comic-sm hover:-translate-y-0.5 transition-transform",
            className,
          )}
        >
          <Sparkles className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 border-[3px] border-ink shadow-comic p-2">
        <p className="font-display text-base mb-2 px-1">Intensidade comic</p>
        <div className="flex flex-col gap-1">
          {OPTIONS.map((o) => {
            const active = intensity === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setIntensity(o.value)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-md border-[2.5px] px-2 py-1.5 text-left transition-all",
                  active
                    ? "border-ink bg-comic-yellow shadow-comic-sm"
                    : "border-transparent hover:border-ink",
                )}
              >
                <span className="font-display text-sm">{o.label}</span>
                <span className="text-[11px] opacity-70">{o.hint}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
