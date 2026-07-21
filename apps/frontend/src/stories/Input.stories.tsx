import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: "Digite algo…" },
};

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-1.5">
      <Label className="font-display">E-mail Kindle</Label>
      <Input type="email" placeholder="seu-nome@kindle.com" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, placeholder: "Desabilitado" },
};

export const ComicStyle: Story = {
  render: () => (
    <div className="space-y-4">
      <Input
        placeholder="https://exemplo.com/manga/meu-manga"
        className="border-[3px] border-ink h-12 text-base shadow-comic-sm focus-visible:ring-comic-blue"
      />
      <Input
        placeholder="seu-nome@kindle.com"
        className="border-[3px] border-ink h-11 shadow-comic-sm"
      />
      <Input
        placeholder="Desabilitado"
        disabled
        className="border-[3px] border-ink h-11 shadow-comic-sm"
      />
    </div>
  ),
};
