export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "success" | "info" | "warning" | "chapter";
  read: boolean;
  when: string;
}

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    title: "Novo capítulo disponível",
    message: "3 capítulos novos de Chainsaw Man foram detectados.",
    type: "chapter",
    read: false,
    when: "há 5 min",
  },
  {
    id: "n2",
    title: "Conversão concluída",
    message: "Berserk Vol.1 foi convertido e enviado pro Kindle.",
    type: "success",
    read: false,
    when: "há 2h",
  },
  {
    id: "n3",
    title: "Fonte instável",
    message: "MangaDex está respondendo lentamente.",
    type: "warning",
    read: true,
    when: "há 1 dia",
  },
  {
    id: "n4",
    title: "Agendamento concluído",
    message: "One Piece cap.1110 foi baixado automaticamente.",
    type: "info",
    read: true,
    when: "há 2 dias",
  },
];
