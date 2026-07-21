import type { Meta } from "@storybook/react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const meta: Meta = {
  title: "UI/Dialog",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="border-[3px] border-ink shadow-comic font-display">
            Abrir Dialog
          </Button>
        </DialogTrigger>
        <DialogContent className="border-[3px] border-ink shadow-comic-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Título do Dialog</DialogTitle>
            <DialogDescription>Descrição do dialog com mais detalhes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="font-display">Nome</Label>
              <Input
                placeholder="Digite seu nome"
                className="border-[3px] border-ink shadow-comic-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-[3px] border-ink shadow-comic-sm font-display"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => setOpen(false)}
              className="bg-comic-red text-primary-foreground border-[3px] border-ink shadow-comic font-display"
            >
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  },
};

export const Open: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogContent className="border-[3px] border-ink shadow-comic-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Dialog Aberto</DialogTitle>
          <DialogDescription>Este dialog já inicia aberto para demonstração.</DialogDescription>
        </DialogHeader>
        <p className="text-sm font-medium opacity-80 py-4">
          Conteúdo do dialog com estilo comic book — bordas grossas, sombras duras.
        </p>
      </DialogContent>
    </Dialog>
  ),
};
