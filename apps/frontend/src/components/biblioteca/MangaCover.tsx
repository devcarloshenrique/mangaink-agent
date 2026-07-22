import { useState } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { conversionsApi } from "@/lib/api";

interface MangaCoverProps {
  sourceId: string;
  className?: string;
}

export function MangaCover({ sourceId, className }: MangaCoverProps) {
  const [error, setError] = useState(false);

  const url = conversionsApi.coverUrl(sourceId, { kind: "original" });

  if (!url || error) {
    return (
      <ComicPanel bg="halftone" className={cn("flex items-center justify-center", className)}>
        <BookOpen className="h-16 w-16 opacity-30" />
      </ComicPanel>
    );
  }

  return (
    <div
      className={cn("border-[3px] border-ink rounded-xl shadow-comic overflow-hidden", className)}
    >
      <img
        src={url}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setError(true)}
      />
    </div>
  );
}
