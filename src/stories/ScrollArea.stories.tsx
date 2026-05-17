import type { Meta } from "@storybook/react";
import { ScrollArea } from "@/components/ui/scroll-area";

const meta: Meta = {
  title: "UI/ScrollArea",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => (
    <ScrollArea className="h-[200px] w-[300px] border-[3px] border-ink rounded-xl p-4 shadow-comic-sm">
      <div className="space-y-2">
        {Array.from({ length: 20 }, (_, i) => (
          <p key={i} className="text-sm font-medium">
            Item {i + 1} — Conteúdo scrollável dentro da área.
          </p>
        ))}
      </div>
    </ScrollArea>
  ),
};
