export const lastRead = {
  title: "Berserk",
  slug: "berserk",
  currentChapter: 42,
  totalChapters: 87,
  cover: "🗡️",
  coverBg: "bg-comic-red",
};

export const stats = {
  totalConverted: 127,
  mbSaved: 842,
  kindleSentThisMonth: 18,
};

export const nextSchedule = {
  series: "One Piece",
  chapter: 1109,
  etaDays: 3,
};

export type ActivityKind = "sent" | "converted" | "scheduled" | "error";

export const activity: { id: string; kind: ActivityKind; text: string; when: string }[] = [
  { id: "1", kind: "sent", text: "Berserk Vol.12 enviado pro Kindle", when: "há 2h" },
  { id: "2", kind: "converted", text: "Vagabond Cap.327 convertido (EPUB)", when: "ontem" },
  { id: "3", kind: "scheduled", text: "Chainsaw Man agendado (semanal)", when: "2 dias" },
  { id: "4", kind: "sent", text: "One Piece Cap.1108 enviado pro Kindle", when: "3 dias" },
  { id: "5", kind: "error", text: "Falha ao baixar Jujutsu Cap.260", when: "4 dias" },
];
