import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { Button } from "@/components/ui/button";

interface DownloadChapterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterTitle: string;
  onConfirm: () => void;
}

export function DownloadChapterDialog({
  open,
  onOpenChange,
  chapterTitle,
  onConfirm,
}: DownloadChapterDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[3px] border-ink shadow-comic max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg uppercase">Baixar Capitulo</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <SpeechBubble variant="yellow" tail="left">
            <p className="text-sm">
              Este capitulo <strong className="font-display">{chapterTitle}</strong> nao esta em
              cache. Deseja baixar para ler?
            </p>
          </SpeechBubble>
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[2px] border-ink shadow-comic-sm"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="border-[2px] border-ink bg-comic-red hover:bg-comic-red/90 text-white shadow-comic-sm"
          >
            Baixar e Ler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
