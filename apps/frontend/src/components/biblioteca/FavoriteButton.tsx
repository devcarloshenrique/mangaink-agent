import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  className?: string;
}

export function FavoriteButton({ isFavorite, onToggle, className }: FavoriteButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full border-[3px] border-ink shadow-comic-sm font-display py-2.5 rounded-md transition-all flex items-center justify-center gap-2",
        isFavorite ? "bg-comic-red text-primary-foreground" : "bg-card hover:bg-muted",
        className,
      )}
    >
      <Heart className="h-5 w-5" fill={isFavorite ? "currentColor" : "none"} />
      {isFavorite ? "Favoritado" : "Favoritar"}
    </button>
  );
}
