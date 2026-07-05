import { Bell, BookOpen, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const TYPE_ICON = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  chapter: BookOpen,
};

const TYPE_COLOR = {
  success: "text-comic-blue",
  info: "text-comic-blue",
  warning: "text-comic-red",
  chapter: "text-comic-red",
};

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-md border-[3px] border-ink bg-card shadow-comic-sm hover:-translate-y-0.5 transition-all",
          )}
          title={unreadCount > 0 ? `${unreadCount} notificação(ões)` : "Notificações"}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-comic-red px-0.5 text-[10px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 border-[3px] border-ink shadow-comic p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-ink/20 bg-comic-yellow">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="font-display text-lg">Notificações</span>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-xs font-medium underline underline-offset-2 hover:text-comic-red"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium opacity-50">Nenhuma notificação</p>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = TYPE_ICON[n.type];
              return (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={cn(
                    "flex flex-col items-start gap-1 px-4 py-3 cursor-pointer border-b border-ink/10 last:border-0 focus:bg-muted",
                    !n.read && "bg-comic-yellow/30",
                  )}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className={cn("h-4 w-4 shrink-0", TYPE_COLOR[n.type])} />
                    <span className="font-display text-sm truncate flex-1">{n.title}</span>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-comic-red shrink-0" />}
                  </div>
                  <p className="text-xs font-medium opacity-70 ml-6">{n.message}</p>
                  <p className="text-[10px] font-medium opacity-40 ml-6">{n.when}</p>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
