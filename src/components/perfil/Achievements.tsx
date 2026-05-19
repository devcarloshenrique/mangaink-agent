import { cn } from "@/lib/utils";

interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  date?: string;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: "a1",
    icon: "🏆",
    title: "100 capítulos convertidos",
    description: "Você converteu mais de 100 capítulos no total.",
    unlocked: true,
    date: "há 3 dias",
  },
  {
    id: "a2",
    icon: "📚",
    title: "10 obras na biblioteca",
    description: "Sua biblioteca tem 10 ou mais séries diferentes.",
    unlocked: true,
    date: "há 1 semana",
  },
  {
    id: "a3",
    icon: "⚡",
    title: "5 conversões em 1 dia",
    description: "Você converteu 5+ capítulos em um único dia.",
    unlocked: true,
    date: "há 2 semanas",
  },
  {
    id: "a4",
    icon: "🔥",
    title: "Sequência de 7 dias",
    description: "Usou o MangaForge por 7 dias consecutivos.",
    unlocked: true,
    date: "há 5 dias",
  },
  {
    id: "a5",
    icon: "📖",
    title: "Leitor voraz",
    description: "Leu mais de 500 páginas em uma semana.",
    unlocked: false,
  },
  {
    id: "a6",
    icon: "🌍",
    title: "Poliglota",
    description: "Converteu mangás de 3+ fontes diferentes.",
    unlocked: false,
  },
  {
    id: "a7",
    icon: "💎",
    title: "Colecionador",
    description: "Tenha 20+ volumes na biblioteca.",
    unlocked: false,
  },
  {
    id: "a8",
    icon: "🚀",
    title: "Velocista",
    description: "Converteu um volume em menos de 1 minuto.",
    unlocked: false,
  },
];

export function Achievements() {
  const unlocked = ACHIEVEMENTS.filter((a) => a.unlocked);
  const locked = ACHIEVEMENTS.filter((a) => !a.unlocked);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="font-display text-lg">Conquistas</span>
        <span className="font-display text-xs bg-comic-yellow border-[2px] border-ink px-2 py-0.5 rounded">
          {unlocked.length}/{ACHIEVEMENTS.length}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {unlocked.map((a) => (
          <div
            key={a.id}
            className="border-[3px] border-ink rounded-lg p-4 bg-comic-yellow shadow-comic-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{a.icon}</span>
              <p className="font-display text-base leading-none">{a.title}</p>
            </div>
            <p className="text-xs font-medium opacity-70 ml-9">{a.description}</p>
            <p className="text-[10px] font-medium opacity-40 ml-9 mt-1">Desbloqueado {a.date}</p>
          </div>
        ))}
        {locked.map((a) => (
          <div
            key={a.id}
            className={cn("border-[3px] border-ink/30 rounded-lg p-4 bg-card opacity-50")}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl grayscale">{a.icon}</span>
              <p className="font-display text-base leading-none">{a.title}</p>
            </div>
            <p className="text-xs font-medium opacity-50 ml-9">{a.description}</p>
            <p className="text-[10px] font-medium opacity-30 ml-9 mt-1">🔒 Bloqueado</p>
          </div>
        ))}
      </div>
    </div>
  );
}
