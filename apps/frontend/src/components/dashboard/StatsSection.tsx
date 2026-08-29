import { ComicPanel } from "@/components/comic/ComicPanel";
import { AnimatedCounter } from "@/components/comic/AnimatedCounter";
import { BookCheck, HardDrive } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  chaptersConverted: number;
  storageGb: number;
}

/** Seção de estatísticas do rodapé da home — 2 cards grandes com contador animado. */
export function StatsSection({ chaptersConverted, storageGb }: Props) {
  const CARDS: {
    icon: LucideIcon;
    label: string;
    bg: string;
    value: number;
    format: (n: number) => string;
  }[] = [
    {
      icon: BookCheck,
      label: "Capítulos convertidos",
      bg: "bg-comic-yellow text-comic-ink",
      value: chaptersConverted,
      format: (n) => n.toLocaleString("pt-BR"),
    },
    {
      icon: HardDrive,
      label: "Em armazenamento",
      bg: "bg-card",
      value: Math.round(storageGb * 10),
      format: (n) =>
        `${(n / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`,
    },
  ];

  return (
    <section aria-label="Estatísticas">
      <h2 className="mb-3 font-display text-2xl uppercase leading-none">Estatísticas</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((c, i) => {
          const Icon = c.icon;
          return (
            <ComicPanel
              key={c.label}
              bg="card"
              padding="md"
              tilt={i % 2 === 0 ? "left" : "right"}
              className={c.bg}
            >
              <Icon className="mb-2 h-7 w-7" strokeWidth={2.5} />
              <div className="font-display text-5xl leading-none tabular-nums">
                <AnimatedCounter value={c.value} format={c.format} />
              </div>
              <p className="mt-2 text-xs font-bold uppercase tracking-wide opacity-80">{c.label}</p>
            </ComicPanel>
          );
        })}
      </div>
    </section>
  );
}
