import { Star } from "lucide-react";

interface TopItem {
  rank: number;
  title: string;
  hue: number;
  reads: number;
}

const TOP: TopItem[] = [
  { rank: 1, title: "Berserk", hue: 0, reads: 47 },
  { rank: 2, title: "One Piece", hue: 200, reads: 38 },
  { rank: 3, title: "Chainsaw Man", hue: 15, reads: 29 },
  { rank: 4, title: "Vagabond", hue: 35, reads: 22 },
  { rank: 5, title: "Monster", hue: 280, reads: 18 },
];

export function TopReadings() {
  return (
    <div className="space-y-3">
      {TOP.map((item) => (
        <div
          key={item.rank}
          className="flex items-center gap-3 border-[2.5px] border-ink rounded-lg p-3 bg-card shadow-comic-sm"
        >
          <span className="font-display text-2xl w-8 text-center text-comic-red">{item.rank}</span>
          <div
            className="h-10 w-7 border-[2px] border-ink rounded shadow-comic-sm shrink-0"
            style={{ background: `hsl(${item.hue} 70% 55%)` }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg leading-none truncate">{item.title}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Star className="h-3.5 w-3.5 text-comic-yellow fill-comic-yellow" />
            <span className="font-display text-sm">{item.reads} leituras</span>
          </div>
        </div>
      ))}
    </div>
  );
}
