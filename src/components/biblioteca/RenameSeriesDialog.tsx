import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";

interface Props {
  currentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (newTitle: string) => void;
}

export function RenameSeriesDialog({ currentTitle, open, onOpenChange, onConfirm }: Props) {
  const [title, setTitle] = useState(currentTitle);

  const handleOpenChange = (o: boolean) => {
    if (o) setTitle(currentTitle);
    onOpenChange(o);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-[3px] border-ink shadow-comic-lg sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Pencil className="h-5 w-5" /> Renomear série
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-display">Novo título</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Berserk Deluxe"
              className="border-[3px] border-ink h-11 shadow-comic-sm"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[3px] border-ink shadow-comic-sm font-display"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!title.trim()}
              className="bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display disabled:opacity-40"
            >
              Renomear
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
