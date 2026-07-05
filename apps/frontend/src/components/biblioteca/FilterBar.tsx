import { Star, FileText, CheckCircle2, AlertTriangle, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterId = "all" | "favorites" | "epub" | "mobi" | "cbz" | "not-sent" | "errors";

interface Props {
  active: FilterId;
  onChange: (f: FilterId) => void;
  className?: string;
}

const FILTERS: { id: FilterId; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "Todas", icon: null },
  { id: "favorites", label: "Favoritas", icon: <Star className="h-3.5 w-3.5" /> },
  { id: "epub", label: "EPUB", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "mobi", label: "MOBI", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "cbz", label: "CBZ", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "not-sent", label: "Não enviadas", icon: <Mail className="h-3.5 w-3.5" /> },
  { id: "errors", label: "Com erro", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
];

export function FilterBar({ active, onChange, className }: Props) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onChange(f.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md border-[2.5px] font-display text-sm transition-all",
            active === f.id
              ? "bg-comic-red text-primary-foreground border-ink shadow-comic-sm"
              : "bg-card border-ink hover:-translate-y-0.5 shadow-comic-sm",
          )}
        >
          {f.icon}
          {f.label}
        </button>
      ))}
    </div>
  );
}
