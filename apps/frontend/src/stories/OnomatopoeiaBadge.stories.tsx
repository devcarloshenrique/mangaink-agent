import type { Meta, StoryObj } from "@storybook/react";
import { OnomatopoeiaBadge } from "@/components/comic/OnomatopoeiaBadge";

const meta: Meta<typeof OnomatopoeiaBadge> = {
  title: "Comic/OnomatopoeiaBadge",
  component: OnomatopoeiaBadge,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["yellow", "red", "blue"] },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "BAM!" },
};

export const Yellow: Story = {
  args: { variant: "yellow", children: "POW!" },
};

export const Red: Story = {
  args: { variant: "red", children: "BOOM!" },
};

export const Blue: Story = {
  args: { variant: "blue", children: "DONE!" },
};

export const Small: Story = {
  args: { size: "sm", children: "ZIP!" },
};

export const Medium: Story = {
  args: { size: "md", children: "WHOOSH!" },
};

export const Large: Story = {
  args: { size: "lg", children: "KAPOW!" },
};

export const AllSounds: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <OnomatopoeiaBadge variant="yellow" size="md">
        BAM!
      </OnomatopoeiaBadge>
      <OnomatopoeiaBadge variant="red" size="md">
        POW!
      </OnomatopoeiaBadge>
      <OnomatopoeiaBadge variant="blue" size="md">
        DONE!
      </OnomatopoeiaBadge>
      <OnomatopoeiaBadge variant="yellow" size="sm">
        ZIP!
      </OnomatopoeiaBadge>
      <OnomatopoeiaBadge variant="red" size="lg">
        BOOM!
      </OnomatopoeiaBadge>
      <OnomatopoeiaBadge variant="blue" size="sm">
        SEND!
      </OnomatopoeiaBadge>
      <OnomatopoeiaBadge variant="yellow" size="md">
        WHOOSH!
      </OnomatopoeiaBadge>
      <OnomatopoeiaBadge variant="red" size="md">
        BEEP!
      </OnomatopoeiaBadge>
    </div>
  ),
};
