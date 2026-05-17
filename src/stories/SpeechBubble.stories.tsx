import type { Meta, StoryObj } from "@storybook/react";
import { SpeechBubble } from "@/components/comic/SpeechBubble";

const meta: Meta<typeof SpeechBubble> = {
  title: "Comic/SpeechBubble",
  component: SpeechBubble,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["white", "yellow", "red", "blue"] },
    tail: { control: "select", options: ["left", "right", "bottom", "none"] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Olá! Eu sou uma fala de quadrinhos!",
  },
};

export const Yellow: Story = {
  args: {
    variant: "yellow",
    children: "Atenção! Este é um destaque importante.",
  },
};

export const Red: Story = {
  args: {
    variant: "red",
    children: "PERIGO! Algo deu errado!",
  },
};

export const Blue: Story = {
  args: {
    variant: "blue",
    children: "Info: Operação concluída com sucesso.",
  },
};

export const TailLeft: Story = {
  args: {
    tail: "left",
    variant: "yellow",
    children: "Balão com cauda à esquerda",
  },
};

export const TailRight: Story = {
  args: {
    tail: "right",
    variant: "blue",
    children: "Balão com cauda à direita",
  },
};

export const TailBottom: Story = {
  args: {
    tail: "bottom",
    variant: "red",
    children: "Balão com cauda embaixo",
  },
};

export const NoTail: Story = {
  args: {
    tail: "none",
    children: "Balão sem cauda — só o texto",
  },
};

export const LongText: Story = {
  args: {
    variant: "yellow",
    tail: "bottom",
    children: "Este é um texto mais longo para demonstrar como o balão se comporta com várias linhas de conteúdo. Ele se adapta automaticamente ao tamanho do texto.",
  },
};

export const Composition: Story = {
  render: () => (
    <div className="space-y-6">
      <SpeechBubble variant="yellow" tail="bottom">
        Vasculhando os arquivos secretos…
      </SpeechBubble>
      <div className="flex justify-end">
        <SpeechBubble variant="blue" tail="right">
          Capítulos encontrados! 24 no total.
        </SpeechBubble>
      </div>
      <SpeechBubble variant="red" tail="left">
        Erro! URL inválida. Tente novamente.
      </SpeechBubble>
    </div>
  ),
};
