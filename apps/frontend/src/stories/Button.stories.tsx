import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Mail, Plus, Trash2 } from "lucide-react";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: { control: "select", options: ["default", "sm", "lg", "icon"] },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: "Botão Padrão" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Excluir" } };
export const Outline: Story = { args: { variant: "outline", children: "Contorno" } };
export const Secondary: Story = { args: { variant: "secondary", children: "Secundário" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Fantasma" } };
export const Link: Story = { args: { variant: "link", children: "Link" } };
export const Disabled: Story = { args: { disabled: true, children: "Desabilitado" } };
export const Small: Story = { args: { size: "sm", children: "Pequeno" } };
export const Large: Story = { args: { size: "lg", children: "Grande" } };
export const IconOnly: Story = {
  args: { size: "icon", children: <Download className="h-4 w-4" /> },
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button className="border-[3px] border-ink shadow-comic font-display">
        <Plus className="h-4 w-4 mr-1" /> Converter
      </Button>
      <Button variant="outline" className="border-[3px] border-ink shadow-comic-sm font-display">
        <Download className="h-4 w-4 mr-1" /> Baixar
      </Button>
      <Button variant="outline" className="border-[3px] border-ink shadow-comic-sm font-display">
        <Mail className="h-4 w-4 mr-1" /> Enviar
      </Button>
      <Button
        variant="outline"
        className="border-[3px] border-ink shadow-comic-sm font-display text-destructive"
      >
        <Trash2 className="h-4 w-4 mr-1" /> Excluir
      </Button>
    </div>
  ),
};

export const ComicStyle: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button className="bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display text-lg">
        Converter
      </Button>
      <Button className="bg-comic-blue text-accent-foreground hover:bg-comic-blue border-[3px] border-ink shadow-comic font-display">
        Buscar
      </Button>
      <Button variant="outline" className="border-[3px] border-ink shadow-comic-sm font-display">
        Cancelar
      </Button>
      <Button
        variant="outline"
        className="border-[3px] border-ink shadow-comic-sm font-display"
        disabled
      >
        <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Carregando…
      </Button>
    </div>
  ),
};
