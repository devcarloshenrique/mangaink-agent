import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const meta: Meta = {
  title: "UI/Checkbox",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="check1" />
      <Label htmlFor="check1" className="font-display">Aceito os termos</Label>
    </div>
  ),
};

export const Checked: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="check2" defaultChecked />
      <Label htmlFor="check2" className="font-display">Marcado por padrão</Label>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="check3" disabled />
      <Label htmlFor="check3" className="font-display opacity-50">Desabilitado</Label>
    </div>
  ),
};

export const ComicStyle: Story = {
  render: () => (
    <div className="space-y-3">
      <div className="flex items-center gap-3 border-[3px] border-ink rounded-lg p-3 bg-card shadow-comic-sm">
        <Checkbox id="ch1" defaultChecked className="h-5 w-5 border-[2.5px] border-ink data-[state=checked]:bg-comic-red data-[state=checked]:border-ink" />
        <Label htmlFor="ch1" className="font-display text-lg">Cap. 1 • O início • 18p</Label>
      </div>
      <div className="flex items-center gap-3 border-[3px] border-ink rounded-lg p-3 bg-secondary shadow-comic-sm">
        <Checkbox id="ch2" defaultChecked className="h-5 w-5 border-[2.5px] border-ink data-[state=checked]:bg-comic-red data-[state=checked]:border-ink" />
        <Label htmlFor="ch2" className="font-display text-lg">Cap. 2 • O Grupo da Águia • 22p</Label>
      </div>
      <div className="flex items-center gap-3 border-[3px] border-ink rounded-lg p-3 bg-card shadow-comic-sm">
        <Checkbox id="ch3" className="h-5 w-5 border-[2.5px] border-ink data-[state=checked]:bg-comic-red data-[state=checked]:border-ink" />
        <Label htmlFor="ch3" className="font-display text-lg">Cap. 3 • A Lâmina do Mal • 20p</Label>
      </div>
    </div>
  ),
};
