import { NEXT_SCHEDULE } from "@/lib/mock-dashboard";
import { Clock } from "lucide-react";

export function NextScheduleCard() {
  const s = NEXT_SCHEDULE;

  return (
    <div className="relative overflow-hidden border-[3px] border-ink rounded-xl shadow-comic bg-comic-yellow p-5">
      <div className="absolute inset-0 bg-halftone opacity-15 pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-5 w-5" />
          <span className="font-display text-lg">Próximo agendamento</span>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="h-14 w-10 border-[2.5px] border-ink rounded shadow-comic-sm shrink-0"
            style={{ background: `hsl(${s.hue} 70% 55%)` }}
          />
          <div>
            <p className="font-display text-xl leading-none">{s.title}</p>
            <p className="text-sm font-medium opacity-80 mt-1">
              Cap. {s.chapter} • chega em ~{s.daysUntil} dias
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: s.daysUntil }).map((_, i) => (
            <div key={i} className="h-1.5 flex-1 rounded-full bg-comic-ink/20" />
          ))}
          <div className="h-1.5 flex-1 rounded-full bg-comic-red animate-pulse" />
        </div>
      </div>
    </div>
  );
}
