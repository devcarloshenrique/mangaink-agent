import type { Meta, StoryObj } from "@storybook/react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Info } from "lucide-react";

const meta: Meta = {
  title: "UI/Alert",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle className="font-display">Informação</AlertTitle>
      <AlertDescription>Esta é uma mensagem informativa padrão.</AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="font-display">Erro</AlertTitle>
      <AlertDescription>Ocorreu um erro na conversão. Tente novamente.</AlertDescription>
    </Alert>
  ),
};
