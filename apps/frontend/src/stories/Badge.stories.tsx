import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "@/components/ui/badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["default", "secondary", "destructive", "outline"] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: "Padrão" } };
export const Secondary: Story = { args: { variant: "secondary", children: "Secundário" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Destrutivo" } };
export const Outline: Story = { args: { variant: "outline", children: "Contorno" } };

export const ComicStyle: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <span className="font-display text-xs bg-comic-blue text-accent-foreground border-[2.5px] border-ink shadow-comic-sm px-2 py-0.5 rounded">
        Concluído
      </span>
      <span className="font-display text-xs bg-comic-yellow border-[2.5px] border-ink shadow-comic-sm px-2 py-0.5 rounded">
        Pendente
      </span>
      <span className="font-display text-xs bg-comic-red text-primary-foreground border-[2.5px] border-ink shadow-comic-sm px-2 py-0.5 rounded">
        Erro
      </span>
      <span className="font-display text-xs bg-comic-blue text-accent-foreground border-[2.5px] border-ink shadow-comic-sm px-2 py-0.5 rounded animate-pulse">
        Convertendo
      </span>
      <span className="font-display text-[10px] bg-card text-foreground border-[2px] border-ink rounded px-1.5 py-0.5">
        EPUB
      </span>
      <span className="font-display text-[10px] bg-card text-foreground border-[2px] border-ink rounded px-1.5 py-0.5">
        MOBI
      </span>
      <span className="font-display text-[10px] bg-card text-foreground border-[2px] border-ink rounded px-1.5 py-0.5">
        servidor
      </span>
    </div>
  ),
};
