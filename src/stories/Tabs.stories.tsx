import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const meta: Meta = {
  title: "UI/Tabs",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className="w-[400px]">
      <TabsList className="grid w-full grid-cols-3 border-[3px] border-ink">
        <TabsTrigger value="tab1" className="font-display data-[state=active]:bg-comic-red data-[state=active]:text-primary-foreground">
          Origem
        </TabsTrigger>
        <TabsTrigger value="tab2" className="font-display data-[state=active]:bg-comic-red data-[state=active]:text-primary-foreground">
          Capítulos
        </TabsTrigger>
        <TabsTrigger value="tab3" className="font-display data-[state=active]:bg-comic-red data-[state=active]:text-primary-foreground">
          Config
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" className="border-[3px] border-ink rounded-xl p-4 mt-2 shadow-comic-sm">
        <p className="font-display text-lg">Passo 1: Origem</p>
        <p className="text-sm opacity-70 mt-1">Cole o link da obra que você quer converter.</p>
      </TabsContent>
      <TabsContent value="tab2" className="border-[3px] border-ink rounded-xl p-4 mt-2 shadow-comic-sm">
        <p className="font-display text-lg">Passo 2: Capítulos</p>
        <p className="text-sm opacity-70 mt-1">Selecione os capítulos que deseja incluir.</p>
      </TabsContent>
      <TabsContent value="tab3" className="border-[3px] border-ink rounded-xl p-4 mt-2 shadow-comic-sm">
        <p className="font-display text-lg">Passo 3: Configurações</p>
        <p className="text-sm opacity-70 mt-1">Escolha dispositivo, formato e preset.</p>
      </TabsContent>
    </Tabs>
  ),
};
