import type { Meta } from "@storybook/react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

const meta: Meta = {
  title: "UI/Slider",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => (
    <div className="w-[300px] space-y-2">
      <Label className="font-display">Volume: 8 capítulos</Label>
      <Slider defaultValue={[8]} max={24} min={1} step={1} />
    </div>
  ),
};

export const Range: Story = {
  render: () => (
    <div className="w-[300px] space-y-2">
      <Label className="font-display">Intervalo</Label>
      <Slider defaultValue={[25, 75]} min={0} max={100} step={1} />
    </div>
  ),
};
