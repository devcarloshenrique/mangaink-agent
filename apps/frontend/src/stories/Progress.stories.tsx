import type { Meta } from "@storybook/react";
import { Progress } from "@/components/ui/progress";

const meta: Meta = {
  title: "UI/Progress",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => (
    <div className="w-[300px] space-y-4">
      <div className="space-y-1">
        <p className="font-display text-sm">0%</p>
        <Progress value={0} />
      </div>
      <div className="space-y-1">
        <p className="font-display text-sm">25%</p>
        <Progress value={25} />
      </div>
      <div className="space-y-1">
        <p className="font-display text-sm">50%</p>
        <Progress value={50} />
      </div>
      <div className="space-y-1">
        <p className="font-display text-sm">75%</p>
        <Progress value={75} />
      </div>
      <div className="space-y-1">
        <p className="font-display text-sm">100%</p>
        <Progress value={100} />
      </div>
    </div>
  ),
};

export const ComicStyle: Story = {
  render: () => (
    <div className="w-[300px] space-y-4">
      <div>
        <p className="font-display text-sm mb-1">Baixando imagens • 45%</p>
        <div className="h-4 w-full border-[3px] border-ink rounded-full bg-card overflow-hidden">
          <div
            className="h-full bg-comic-blue transition-all duration-300"
            style={{ width: "45%" }}
          />
        </div>
      </div>
      <div>
        <p className="font-display text-sm mb-1">Convertendo páginas • 78%</p>
        <div className="h-4 w-full border-[3px] border-ink rounded-full bg-card overflow-hidden">
          <div
            className="h-full bg-comic-yellow transition-all duration-300"
            style={{ width: "78%" }}
          />
        </div>
      </div>
      <div>
        <p className="font-display text-sm mb-1">Concluído • 100%</p>
        <div className="h-4 w-full border-[3px] border-ink rounded-full bg-card overflow-hidden">
          <div
            className="h-full bg-comic-blue transition-all duration-300"
            style={{ width: "100%" }}
          />
        </div>
      </div>
    </div>
  ),
};
