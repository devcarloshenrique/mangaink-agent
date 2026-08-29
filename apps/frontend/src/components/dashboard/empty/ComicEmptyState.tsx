import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  emoji: string;
  title: string;
  text: string;
  ctaTo?: "/wizard" | "/fontes" | "/biblioteca";
  ctaLabel?: string;
  className?: string;
}

/** Estado vazio padrão estilo quadrinhos: emoji em selo, título, texto e CTA opcional. */
export function ComicEmptyState({ emoji, title, text, ctaTo, ctaLabel, className }: Props) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 py-8 text-center",
        className,
      )}
    >
      <div className="grid h-16 w-16 -rotate-3 place-items-center rounded-full border-[3px] border-ink bg-comic-yellow text-3xl shadow-comic-sm">
        <span aria-hidden>{emoji}</span>
      </div>
      <h3 className="font-display text-2xl uppercase leading-none">{title}</h3>
      <p className="max-w-sm text-sm font-medium leading-snug opacity-70">{text}</p>
      {ctaTo && ctaLabel && (
        <Link
          to={ctaTo}
          className="mt-2 inline-flex items-center gap-2 rounded-md border-[3px] border-ink bg-comic-yellow px-4 py-2 font-display text-base text-comic-ink shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          {ctaLabel} <ArrowRight className="h-4 w-4" strokeWidth={3} />
        </Link>
      )}
    </div>
  );
}
