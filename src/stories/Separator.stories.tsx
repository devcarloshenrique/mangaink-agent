import type { Meta } from "@storybook/react";
import { Separator } from "@/components/ui/separator";

const meta: Meta = {
  title: "UI/Separator",
  tags: ["autodocs"],
};

export default meta;

export const Horizontal: Story = {
  render: () => (
    <div className="w-[300px] space-y-4">
      <p className="font-display text-lg">Seção 1</p>
      <p className="text-sm opacity-70">Conteúdo da primeira seção.</p>
      <Separator />
      <p className="font-display text-lg">Seção 2</p>
      <p className="text-sm opacity-70">Conteúdo da segunda seção.</p>
      <Separator />
      <p className="font-display text-lg">Seção 3</p>
      <p className="text-sm opacity-70">Conteúdo da terceira seção.</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-[100px] items-center gap-4">
      <p className="font-display">Esquerda</p>
      <Separator orientation="vertical" className="h-full" />
      <p className="font-display">Direita</p>
    </div>
  ),
};
