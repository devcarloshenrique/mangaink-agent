import type { Meta } from "@storybook/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

const meta: Meta = {
  title: "UI/Toaster",
  tags: ["autodocs"],
};

export default meta;

export const Examples: Story = {
  render: () => (
    <div>
      <Toaster richColors position="top-right" />
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => toast.success("Conversão concluída!")}
          className="bg-comic-blue text-accent-foreground border-[3px] border-ink shadow-comic font-display"
        >
          Success Toast
        </Button>
        <Button
          onClick={() => toast.error("Erro na conversão. Tente novamente.")}
          variant="outline"
          className="border-[3px] border-ink shadow-comic-sm font-display text-destructive"
        >
          Error Toast
        </Button>
        <Button
          onClick={() =>
            toast("Processando…", { description: "Aguarde enquanto convertemos as páginas." })
          }
          variant="outline"
          className="border-[3px] border-ink shadow-comic-sm font-display"
        >
          Info Toast
        </Button>
        <Button
          onClick={() =>
            toast.success("Conversão concluída!", {
              duration: 8000,
              action: { label: "Ver na biblioteca", onClick: () => {} },
            })
          }
          variant="outline"
          className="border-[3px] border-ink shadow-comic-sm font-display"
        >
          Toast com Ação
        </Button>
      </div>
    </div>
  ),
};
