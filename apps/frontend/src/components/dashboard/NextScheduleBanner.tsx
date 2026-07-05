import { Link } from "@tanstack/react-router";
import { Calendar, ChevronRight } from "lucide-react";
import { nextSchedule } from "@/lib/dashboard-mock";

export function NextScheduleBanner() {
  return (
    <Link
      to="/agendamentos"
      className="group block border-[3px] border-ink bg-comic-blue text-accent-foreground shadow-comic rounded-md p-4 hover:-translate-y-0.5 transition-transform relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-halftone opacity-15 pointer-events-none" />
      <div className="relative flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px] border-ink bg-comic-yellow text-comic-ink">
          <Calendar className="h-5 w-5" strokeWidth={3} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-xs uppercase bg-comic-red text-primary-foreground border-[2.5px] border-ink px-2 py-0.5 rounded">
              Em breve
            </span>
            <span className="text-xs font-bold opacity-90">Próximo agendamento</span>
          </div>
          <p className="font-display text-2xl mt-1 leading-none">
            {nextSchedule.series} cap. {nextSchedule.chapter}
          </p>
          <p className="text-sm font-medium mt-1 opacity-90">
            chega em ~{nextSchedule.etaDays} dias
          </p>
        </div>
        <ChevronRight className="h-6 w-6 shrink-0 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
}
