import type { Meta } from "@storybook/react";
import { useState } from "react";
import { DeleteConfirmDialog } from "@/components/biblioteca/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof DeleteConfirmDialog> = {
  title: "Biblioteca/DeleteConfirmDialog",
  component: DeleteConfirmDialog,
  tags: ["autodocs"],
};

export default meta;

function DeleteConfirmDialogDefaultStory() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <Button
        onClick={() => setIsOpen(true)}
        className="border-[3px] border-ink shadow-comic font-display"
      >
        Excluir Série
      </Button>
      <DeleteConfirmDialog
        title="Berserk"
        open={isOpen}
        onOpenChange={setIsOpen}
        onConfirm={() => setIsOpen(false)}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <DeleteConfirmDialogDefaultStory />,
};

export const Open: Story = {
  render: () => (
    <DeleteConfirmDialog
      title="One Piece"
      open={true}
      onOpenChange={() => {}}
      onConfirm={() => {}}
    />
  ),
};
