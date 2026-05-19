export const DASHBOARD_STATS = {
  totalConverted: 1247,
  mbSaved: 3840,
  kindleSendsThisMonth: 18,
};

export const LAST_READ = {
  title: "Berserk",
  chapter: 42,
  totalChapters: 87,
  hue: 0,
};

export const RECENT_ACTIVITY = [
  {
    id: "a1",
    icon: "✓" as const,
    color: "text-comic-blue",
    message: "Berserk Vol.12 enviado pro Kindle",
    when: "há 2h",
  },
  {
    id: "a2",
    icon: "↓" as const,
    color: "text-comic-red",
    message: "Chainsaw Man Vol.5 convertido",
    when: "há 5h",
  },
  {
    id: "a3",
    icon: "⚡" as const,
    color: "text-comic-yellow",
    message: "One Piece Vol.100 baixado automaticamente",
    when: "há 1 dia",
  },
  {
    id: "a4",
    icon: "✗" as const,
    color: "text-comic-red",
    message: "Monster Vol.3 — erro na conversão",
    when: "há 2 dias",
  },
  {
    id: "a5",
    icon: "✓" as const,
    color: "text-comic-blue",
    message: "Vinland Saga Vol.8 enviado pro Kindle",
    when: "há 3 dias",
  },
];

export const NEXT_SCHEDULE = {
  title: "One Piece",
  chapter: 1109,
  daysUntil: 3,
  hue: 200,
};
