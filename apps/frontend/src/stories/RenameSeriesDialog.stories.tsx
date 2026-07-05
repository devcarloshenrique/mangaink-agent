import type { Meta } from "@storybook/react";
import { useState } from "react";
import { RenameSeriesDialog } from "@/components/biblioteca/RenameSeriesDialog";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof RenameSeriesDialog> = {
  title: "Biblioteca/RenameSeriesDialog",
  component: RenameSeriesDialog,
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <div>
        <Button onClick={() => setIsOpen(true)} className="border-[3px] border-ink shadow-comic font-display">
          Renomear Série
        </Button>
        <RenameSeriesDialog
          currentTitle="Berserk"
          open={isOpen}
          onOpenChange={setIsOpen}
          onConfirm={() => setIsOpen(false)}
        />
      </div>
    );
  },
};

export const Open: Story = {
  render: () => (
    <RenameSeriesDialog
      currentTitle="Vagabond"
      open={true}
      onOpenChange={() => {}}
      onConfirm={() => {}}
    />
  ),
};
