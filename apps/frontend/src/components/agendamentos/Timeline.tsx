import { cn } from "@/lib/utils";

interface TimelineItem {
  id: string;
  title: string;
  chapter: string;
  date: string;
  hue: number;
  status: "upcoming" | "today" | "sent";
}

const TIMELINE_ITEMS: TimelineItem[] = [
  { id: "t1", title: "One Piece", chapter: "Cap. 1109", date: "hoje", hue: 200, status: "today" },
  {
    id: "t2",
    title: "Chainsaw Man",
    chapter: "Cap. 164",
    date: "amanhã",
    hue: 15,
    status: "upcoming",
  },
  {
    id: "t3",
    title: "Berserk",
    chapter: "Cap. 375",
    date: "em 3 dias",
    hue: 0,
    status: "upcoming",
  },
  {
    id: "t4",
    title: "Vagabond",
    chapter: "Cap. 328",
    date: "em 5 dias",
    hue: 35,
    status: "upcoming",
  },
  {
    id: "t5",
    title: "Jujutsu Kaisen",
    chapter: "Cap. 261",
    date: "em 7 dias",
    hue: 280,
    status: "upcoming",
  },
];

export function Timeline() {
  return (
    <div className="space-y-0">
      {TIMELINE_ITEMS.map((item, i) => (
        <div key={item.id} className="flex gap-4">
          {/* Vertical line + dot */}
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "h-4 w-4 rounded-full border-[2.5px] border-ink shrink-0",
                item.status === "today" && "bg-comic-red animate-pulse",
                item.status === "upcoming" && "bg-comic-yellow",
                item.status === "sent" && "bg-comic-blue",
              )}
            />
            {i < TIMELINE_ITEMS.length - 1 && (
              <div className="w-0.5 flex-1 bg-ink/20 min-h-[2rem]" />
            )}
          </div>

          {/* Content */}
          <div className="pb-5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="h-6 w-4 border-[2px] border-ink rounded-sm shrink-0"
                style={{ background: `hsl(${item.hue} 70% 55%)` }}
              />
              <p className="font-display text-base leading-none">{item.title}</p>
              <span className="text-xs font-medium opacity-60">{item.chapter}</span>
            </div>
            <p className="text-xs font-medium opacity-50 mt-1">{item.date}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
