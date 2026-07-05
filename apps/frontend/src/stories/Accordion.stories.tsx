import type { Meta } from "@storybook/react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const meta: Meta = {
  title: "UI/Accordion",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => (
    <Accordion type="single" collapsible className="w-[400px] border-[3px] border-ink rounded-xl shadow-comic-sm">
      <AccordionItem value="item-1" className="border-b-2 border-ink px-4">
        <AccordionTrigger className="font-display text-lg">O que é o MangaForge?</AccordionTrigger>
        <AccordionContent className="text-sm font-medium opacity-80">
          Uma aplicação web self-hosted que converte mangás de online para formatos compatíveis com Kindle.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2" className="border-b-2 border-ink px-4">
        <AccordionTrigger className="font-display text-lg">Quais formatos são suportados?</AccordionTrigger>
        <AccordionContent className="text-sm font-medium opacity-80">
          EPUB, MOBI, CBZ e KFX — os principais formatos compatíveis com dispositivos Kindle.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3" className="px-4">
        <AccordionTrigger className="font-display text-lg">Como envio pro meu Kindle?</AccordionTrigger>
        <AccordionContent className="text-sm font-medium opacity-80">
          Você pode baixar o arquivo ou enviar diretamente para o e-mail do seu Kindle.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
