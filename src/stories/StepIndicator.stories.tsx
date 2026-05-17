import type { Meta, StoryObj } from "@storybook/react";
import { StepIndicator } from "@/components/comic/StepIndicator";

const STEPS = [
  { label: "Origem", short: "Origem" },
  { label: "Capítulos", short: "Caps" },
  { label: "Capas", short: "Capas" },
  { label: "Configurações", short: "Config" },
  { label: "Envio", short: "Envio" },
];

const meta: Meta<typeof StepIndicator> = {
  title: "Comic/StepIndicator",
  component: StepIndicator,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Step0: Story = {
  args: { steps: STEPS, current: 0, visited: 0, onJump: () => {} },
};

export const Step1: Story = {
  args: { steps: STEPS, current: 1, visited: 1, onJump: () => {} },
};

export const Step2: Story = {
  args: { steps: STEPS, current: 2, visited: 2, onJump: () => {} },
};

export const Step3: Story = {
  args: { steps: STEPS, current: 3, visited: 3, onJump: () => {} },
};

export const Step4: Story = {
  args: { steps: STEPS, current: 4, visited: 4, onJump: () => {} },
};

export const MidProgress: Story = {
  args: { steps: STEPS, current: 2, visited: 4, onJump: () => {} },
};
