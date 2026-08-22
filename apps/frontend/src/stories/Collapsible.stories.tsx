import type { Meta } from "@storybook/react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

const meta: Meta = {
  title: "UI/Collapsible",
  tags: ["autodocs"],
};

export default meta;

function CollapsibleDefaultStory() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-[350px] space-y-2">
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="border-[3px] border-ink shadow-comic-sm font-display w-full justify-between"
        >
          <span>Mostrar detalhes</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-[3px] border-ink rounded-xl p-4 shadow-comic-sm">
        <p className="text-sm font-medium opacity-80">
          Este conteúdo pode ser expandido e recolhido. Útil para seções opcionais.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

export const Default: Story = {
  render: () => <CollapsibleDefaultStory />,
};
