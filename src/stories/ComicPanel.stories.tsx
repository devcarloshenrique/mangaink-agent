import type { Meta, StoryObj } from "@storybook/react";
import { ComicPanel } from "@/components/comic/ComicPanel";

const meta: Meta<typeof ComicPanel> = {
  title: "Comic/ComicPanel",
  component: ComicPanel,
  tags: ["autodocs"],
  argTypes: {
    tilt: { control: "select", options: ["left", "right", "none"] },
    bg: { control: "select", options: ["card", "yellow", "red", "blue", "halftone"] },
    padding: { control: "select", options: ["sm", "md", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div>
        <p className="font-display text-2xl">Título do Painel</p>
        <p className="text-sm mt-2 opacity-80">Conteúdo do painel com estilo comic book.</p>
      </div>
    ),
  },
};

export const Yellow: Story = {
  args: {
    bg: "yellow",
    children: (
      <div>
        <p className="font-display text-2xl">Painel Amarelo</p>
        <p className="text-sm mt-2 opacity-80">Usado para destaques e callouts.</p>
      </div>
    ),
  },
};

export const Red: Story = {
  args: {
    bg: "red",
    children: (
      <div>
        <p className="font-display text-2xl">Painel Vermelho</p>
        <p className="text-sm mt-2 opacity-90">Para ações importantes e alertas.</p>
      </div>
    ),
  },
};

export const Blue: Story = {
  args: {
    bg: "blue",
    children: (
      <div>
        <p className="font-display text-2xl">Painel Azul</p>
        <p className="text-sm mt-2 opacity-90">Para informações e progresso.</p>
      </div>
    ),
  },
};

export const Halftone: Story = {
  args: {
    bg: "halftone",
    children: (
      <div>
        <p className="font-display text-2xl">Painel Halftone</p>
        <p className="text-sm mt-2 opacity-80">Com padrão de fundo pontilhado.</p>
      </div>
    ),
  },
};

export const TiltLeft: Story = {
  args: {
    tilt: "left",
    children: (
      <p className="font-display text-xl">Inclinado para a esquerda (-1°)</p>
    ),
  },
};

export const TiltRight: Story = {
  args: {
    tilt: "right",
    children: (
      <p className="font-display text-xl">Inclinado para a direita (+1°)</p>
    ),
  },
};

export const PaddingSmall: Story = {
  args: {
    padding: "sm",
    children: <p className="font-display text-lg">Padding pequeno (p-4)</p>,
  },
};

export const PaddingLarge: Story = {
  args: {
    padding: "lg",
    children: <p className="font-display text-lg">Padding grande (p-8 md:p-10)</p>,
  },
};

export const Composition: Story = {
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <ComicPanel bg="yellow" tilt="left" padding="md">
        <p className="font-display text-xl">Origem</p>
        <p className="text-sm mt-1 opacity-80">Cole o link do mangá</p>
      </ComicPanel>
      <ComicPanel bg="blue" tilt="right" padding="md">
        <p className="font-display text-xl">Formato</p>
        <p className="text-sm mt-1 opacity-80">EPUB, MOBI, CBZ, KFX</p>
      </ComicPanel>
      <ComicPanel bg="red" tilt="left" padding="md">
        <p className="font-display text-xl">Envio</p>
        <p className="text-sm mt-1 opacity-90">Download ou Kindle</p>
      </ComicPanel>
      <ComicPanel bg="halftone" tilt="right" padding="md">
        <p className="font-display text-xl">Progresso</p>
        <p className="text-sm mt-1 opacity-80">Acompanhe em tempo real</p>
      </ComicPanel>
    </div>
  ),
};
