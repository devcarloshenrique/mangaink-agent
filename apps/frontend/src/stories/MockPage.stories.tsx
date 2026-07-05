import type { Meta, StoryObj } from "@storybook/react";
import { MockPage } from "@/components/comic/MockPage";

const meta: Meta<typeof MockPage> = {
  title: "Comic/MockPage",
  component: MockPage,
  tags: ["autodocs"],
  argTypes: {
    seed: { control: "number" },
    width: { control: "number" },
    height: { control: "number" },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { seed: 1, width: 200, height: 280 },
};

export const Seed2: Story = {
  args: { seed: 2, width: 200, height: 280 },
};

export const Seed3: Story = {
  args: { seed: 3, width: 200, height: 280 },
};

export const Small: Story = {
  args: { seed: 1, width: 120, height: 160 },
};

export const Large: Story = {
  args: { seed: 5, width: 300, height: 400 },
};

export const MultiplePages: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      {[1, 2, 3, 4, 5].map((seed) => (
        <MockPage key={seed} seed={seed} width={140} height={190} />
      ))}
    </div>
  ),
};
