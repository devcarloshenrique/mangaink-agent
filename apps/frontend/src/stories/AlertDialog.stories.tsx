import type { Meta } from "@storybook/react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const meta: Meta = {
  title: "UI/AlertDialog",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button className="border-[3px] border-ink shadow-comic font-display text-destructive">
            Excluir Item
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="border-[3px] border-ink shadow-comic-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium text-foreground">
              Esta ação não pode ser desfeita. O item será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3">
            <AlertDialogCancel className="border-[3px] border-ink shadow-comic-sm font-display">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-[3px] border-ink shadow-comic font-display">
              Excluir
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
};

export const Open: Story = {
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogContent className="border-[3px] border-ink shadow-comic-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl">Excluir série</AlertDialogTitle>
          <AlertDialogDescription className="text-base font-medium text-foreground">
            Tem certeza que deseja excluir <strong>"Berserk"</strong>? Todos os arquivos e capítulos
            serão removidos. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-end gap-3">
          <AlertDialogCancel className="border-[3px] border-ink shadow-comic-sm font-display">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-[3px] border-ink shadow-comic font-display">
            Excluir
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  ),
};
