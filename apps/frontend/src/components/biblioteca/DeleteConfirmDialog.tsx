import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface Props {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({ title, open, onOpenChange, onConfirm }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-[3px] border-ink shadow-comic-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl">Excluir série</AlertDialogTitle>
          <AlertDialogDescription className="text-base font-medium text-foreground">
            Tem certeza que deseja excluir <strong>"{title}"</strong>? Todos os arquivos e capítulos
            serão removidos. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-end gap-3">
          <AlertDialogCancel className="border-[3px] border-ink shadow-comic-sm font-display">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-[3px] border-ink shadow-comic font-display"
          >
            Excluir
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
