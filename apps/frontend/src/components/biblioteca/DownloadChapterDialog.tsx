import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { Button } from "@/components/ui/button";

interface DownloadChapterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterTitle: string;
  onConfirm: () => void;
  onDownloadBackground?: () => void;
}

export function DownloadChapterDialog({
  open,
  onOpenChange,
  chapterTitle,
  onConfirm,
  onDownloadBackground,
}: DownloadChapterDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[3px] border-ink shadow-comic max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg uppercase">Baixar Capítulo</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <SpeechBubble variant="yellow" tail="left">
            <p className="text-sm">
              O capítulo <strong className="font-display">{chapterTitle}</strong> não está em cache
              no disco.
            </p>
          </SpeechBubble>
        </div>

        <div className="flex gap-2 justify-end flex-wrap">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[2px] border-ink shadow-comic-sm font-display text-xs"
          >
            Cancelar
          </Button>
          {onDownloadBackground && (
            <Button
              variant="default"
              onClick={() => {
                onDownloadBackground();
                onOpenChange(false);
              }}
              className="border-[2px] border-ink bg-comic-blue text-ink hover:bg-comic-blue/90 shadow-comic-sm font-display text-xs"
            >
              Baixar no disco
            </Button>
          )}
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="border-[2px] border-ink bg-comic-red hover:bg-comic-red/90 text-primary-foreground shadow-comic-sm font-display text-xs"
          >
            Baixar e Ler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
