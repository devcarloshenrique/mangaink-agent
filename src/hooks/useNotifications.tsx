import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { INITIAL_NOTIFICATIONS, type AppNotification } from "@/lib/mock-notifications";

interface NotificationCtx {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (n: Omit<AppNotification, "id" | "read" | "when">) => void;
}

const Ctx = createContext<NotificationCtx | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const addNotification = useCallback((n: Omit<AppNotification, "id" | "read" | "when">) => {
    const newNotification: AppNotification = {
      ...n,
      id: `n-${Date.now()}`,
      read: false,
      when: "agora",
    };
    setNotifications((prev) => [newNotification, ...prev]);
  }, []);

  return (
    <Ctx.Provider
      value={{ notifications, unreadCount, markAsRead, markAllAsRead, addNotification }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications deve ser usado dentro de NotificationProvider");
  return ctx;
}
