import { Link } from "@tanstack/react-router";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, Wand2 } from "lucide-react";

/** Hero de boas-vindas para conta recém-criada, sem nenhuma obra. */
export function EmptyHero() {
  const { user } = useAuth();

  return (
    <section
      data-tour="hero"
      className="relative overflow-hidden rounded-xl border-[3px] border-ink bg-comic-yellow shadow-comic"
    >
      <div className="pointer-events-none absolute inset-0 bg-halftone opacity-20" />
      <div className="relative flex flex-col items-center gap-4 px-6 py-12 text-center">
        <SpeechBubble variant="white" tail="bottom" className="px-4 py-1.5 text-sm shadow-comic-sm">
          Conta criada com sucesso!
        </SpeechBubble>

        <h1 className="font-display text-4xl uppercase leading-[0.95] md:text-5xl">
          Bem-vindo ao MangaInk,
          <span
            className="mt-2 inline-block -rotate-2 border-[3px] border-ink bg-comic-red px-3 text-primary-foreground shadow-comic"
            style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.35)" }}
          >
            {user?.username ?? "leitor"}!
          </span>
        </h1>

        <p className="max-w-md text-sm font-bold opacity-80">
          Sua estante está vazia — vamos converter seu primeiro mangá pro Kindle?
        </p>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/wizard"
            data-tour="cta-converter"
            className="inline-flex items-center gap-2 rounded-md border-[3px] border-ink bg-comic-red px-4 py-2 font-display text-lg text-primary-foreground shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Wand2 className="h-4 w-4" strokeWidth={3} /> Converter meu primeiro mangá
          </Link>
          <Link
            to="/fontes"
            className="inline-flex items-center gap-2 rounded-md border-[3px] border-ink bg-card px-4 py-2 font-display text-lg shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Sparkles className="h-4 w-4" strokeWidth={3} /> Explorar fontes
          </Link>
        </div>
      </div>
    </section>
  );
}
