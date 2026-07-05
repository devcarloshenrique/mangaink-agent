import type { Meta } from "@storybook/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const meta: Meta = {
  title: "UI/Popover",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="border-[3px] border-ink shadow-comic-sm font-display">
          Abrir Popover
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-[3px] border-ink shadow-comic">
        <div className="space-y-2">
          <p className="font-display text-lg">Configurações</p>
          <div className="space-y-1.5">
            <Label className="font-display">Largura</Label>
            <Input placeholder="200" className="border-[3px] border-ink shadow-comic-sm" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};
