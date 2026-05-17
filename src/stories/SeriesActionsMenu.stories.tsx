import type { Meta, StoryObj } from "@storybook/react";
import { SeriesActionsMenu } from "@/components/biblioteca/SeriesActionsMenu";

const meta: Meta<typeof SeriesActionsMenu> = {
  title: "Biblioteca/SeriesActionsMenu",
  component: SeriesActionsMenu,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Berserk",
    isFavorite: false,
    onRename: () => {},
    onToggleFavorite: () => {},
    onDelete: () => {},
  },
};

export const Favorite: Story = {
  args: {
    title: "One Piece",
    isFavorite: true,
    onRename: () => {},
    onToggleFavorite: () => {},
    onDelete: () => {},
  },
};
