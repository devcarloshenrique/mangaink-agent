import type { Meta } from "@storybook/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const meta: Meta = {
  title: "UI/Card",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px] border-[3px] border-ink shadow-comic">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Título do Card</CardTitle>
        <CardDescription>Descrição do card com mais detalhes.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium opacity-80">
          Conteúdo principal do card com informações relevantes.
        </p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" className="border-[3px] border-ink shadow-comic-sm font-display">
          Cancelar
        </Button>
        <Button className="bg-comic-red text-primary-foreground border-[3px] border-ink shadow-comic font-display">
          Confirmar
        </Button>
      </CardFooter>
    </Card>
  ),
};
