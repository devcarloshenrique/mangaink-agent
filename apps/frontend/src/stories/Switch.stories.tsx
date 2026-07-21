import type { Meta } from "@storybook/react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const meta: Meta = {
  title: "UI/Switch",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="switch1" />
      <Label htmlFor="switch1" className="font-display">
        Modo escuro
      </Label>
    </div>
  ),
};

export const Checked: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="switch2" defaultChecked />
      <Label htmlFor="switch2" className="font-display">
        Ativado
      </Label>
    </div>
  ),
};
