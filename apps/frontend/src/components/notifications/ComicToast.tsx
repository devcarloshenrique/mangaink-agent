import { toast } from "sonner";
import { OnomatopoeiaBadge } from "@/components/comic/OnomatopoeiaBadge";

type ComicVariant = "yellow" | "red" | "blue";

interface ComicToastOptions {
  onomatopoeia?: string;
  variant?: ComicVariant;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function ComicToastSuccess({
  onomatopoeia = "POW!",
  variant = "yellow",
  description,
  action,
}: ComicToastOptions) {
  return (
    <div className="flex items-center gap-3 w-full">
      <OnomatopoeiaBadge variant={variant} size="sm">
        {onomatopoeia}
      </OnomatopoeiaBadge>
      <div className="flex-1 min-w-0">
        {description && <p className="text-sm font-medium truncate">{description}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 text-xs font-display underline underline-offset-2 hover:opacity-80"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export const comicToast = {
  conversionComplete: (seriesTitle: string, slug: string, navigate: (to: string) => void) =>
    toast.success(
      <ComicToastSuccess
        onomatopoeia="BOOM!"
        variant="yellow"
        description={`Conversão de "${seriesTitle}" concluída!`}
        action={{
          label: "Ver na biblioteca",
          onClick: () => navigate(`/biblioteca/${slug}`),
        }}
      />,
      { duration: 8000 },
    ),

  newChapter: (mangaTitle: string, chapter: string) =>
    toast.info(
      <ComicToastSuccess
        onomatopoeia="TCHAN!"
        variant="blue"
        description={`Novo capítulo de ${mangaTitle}: ${chapter}`}
      />,
      { duration: 6000 },
    ),

  error: (message: string) =>
    toast.error(<ComicToastSuccess onomatopoeia="ERRO!" variant="red" description={message} />),

  info: (message: string, onomatopoeia = "INFO") =>
    toast(<ComicToastSuccess onomatopoeia={onomatopoeia} variant="blue" description={message} />),
};
