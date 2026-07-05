import type { Meta, StoryObj } from "@storybook/react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const meta: Meta = {
  title: "UI/Textarea",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => (
    <div className="space-y-1.5 w-[350px]">
      <Label className="font-display">Notas</Label>
      <Textarea placeholder="Adicione notas sobre esta conversão…" />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="space-y-1.5 w-[350px]">
      <Label className="font-display">Desabilitado</Label>
      <Textarea disabled placeholder="Não é possível editar…" />
    </div>
  ),
};
