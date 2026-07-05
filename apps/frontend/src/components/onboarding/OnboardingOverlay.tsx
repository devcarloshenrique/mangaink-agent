import { useOnboarding } from "@/hooks/useOnboarding";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Bem-vindo ao MangaForge! 👋",
    text: "Vou te mostrar os principais recursos. É rapidinho!",
    variant: "yellow" as const,
  },
  {
    title: "🧙 Wizard de Conversão",
    text: "Cole uma URL de qualquer site homologado e converta pra Kindle em 5 passos simples.",
    variant: "blue" as const,
  },
  {
    title: "📚 Sua Biblioteca",
    text: "Tudo organizado por obra. Busque, filtre, arraste pra reordenar e crie coleções!",
    variant: "yellow" as const,
  },
  {
    title: "📅 Agendamentos",
    text: "Assine obras e receba capítulos novos automaticamente no seu Kindle.",
    variant: "blue" as const,
  },
  {
    title: "Tudo pronto! 🚀",
    text: "Agora é só converter seu primeiro mangá. Bora lá!",
    variant: "yellow" as const,
  },
];

export function OnboardingOverlay() {
  const { isOpen, currentStep, totalSteps, next, prev, skip } = useOnboarding();

  if (!isOpen) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative max-w-md w-center">
          {/* Close button */}
          <button
            type="button"
            onClick={skip}
            className="absolute -top-2 -right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border-[2.5px] border-ink bg-card shadow-comic-sm hover:bg-comic-red hover:text-primary-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Speech bubble */}
          <div className="animate-comic-pop">
            <SpeechBubble variant={step.variant} tail="none" className="shadow-comic-lg">
              <h3 className="font-display text-xl mb-2">{step.title}</h3>
              <p className="text-sm font-medium opacity-90 leading-relaxed">{step.text}</p>
            </SpeechBubble>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2.5 rounded-full border-2 border-ink transition-all",
                  i === currentStep
                    ? "w-6 bg-comic-red"
                    : i < currentStep
                      ? "w-2.5 bg-comic-blue"
                      : "w-2.5 bg-card",
                )}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4 gap-3">
            <Button
              onClick={prev}
              disabled={currentStep === 0}
              variant="outline"
              className="border-[2.5px] border-ink shadow-comic-sm font-display disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>

            <button
              type="button"
              onClick={skip}
              className="text-xs font-medium opacity-50 hover:opacity-100 underline"
            >
              Pular tour
            </button>

            <Button
              onClick={next}
              className="bg-comic-red text-primary-foreground border-[2.5px] border-ink shadow-comic-sm font-display hover:-translate-y-0.5 transition-transform"
            >
              {isLast ? "Começar! 🎉" : "Próximo"}{" "}
              {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
