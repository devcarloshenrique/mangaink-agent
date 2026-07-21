import type { Meta } from "@storybook/react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const meta: Meta = {
  title: "UI/RadioGroup",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="epub">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="epub" id="r1" />
        <Label htmlFor="r1" className="font-display">
          EPUB
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="mobi" id="r2" />
        <Label htmlFor="r2" className="font-display">
          MOBI
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="cbz" id="r3" />
        <Label htmlFor="r3" className="font-display">
          CBZ
        </Label>
      </div>
    </RadioGroup>
  ),
};
