import type { Meta } from "@storybook/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

const meta: Meta = {
  title: "UI/Tooltip",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" className="border-[3px] border-ink shadow-comic-sm font-display">
          Passe o mouse
        </Button>
      </TooltipTrigger>
      <TooltipContent className="border-2 border-ink">
        <p className="font-medium">Este é um tooltip</p>
      </TooltipContent>
    </Tooltip>
  ),
};
