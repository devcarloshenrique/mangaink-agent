import type { Meta } from "@storybook/react";
import { useState } from "react";
import { ReconvertDialog } from "@/components/biblioteca/ReconvertDialog";
import { Button } from "@/components/ui/button";
import type { MangaSeries } from "@/lib/biblioteca-data";

const mockSeries: MangaSeries = {
  slug: "berserk",
  title: "Berserk",
  author: "Kentaro Miura",
  hue: 0,
  lastConverted: "há 2h",
  favorite: true,
  tags: ["seinen", "ação"],
  addedAt: "2026-05-10T10:00:00Z",
  files: [
    {
      id: "berserk-vol-01",
      name: "berserk-vol-01.epub",
      bytes: 12582912,
      when: "há 2h",
      format: "EPUB",
      sent: true,
      status: "completed",
      chapters: [
        { id: "ch-01", number: "1", title: "O Espadachim Negro", status: "completed" },
        { id: "ch-02", number: "2", title: "O Grupo da Águia", status: "completed" },
        { id: "ch-03", number: "3", title: "A Lâmina do Mal", status: "completed" },
      ],
    },
    {
      id: "berserk-vol-02",
      name: "berserk-vol-02.epub",
      bytes: 14680064,
      when: "há 2h",
      format: "EPUB",
      sent: false,
      status: "error",
      chapters: [
        { id: "ch-06", number: "6", title: "O Cerco", status: "completed" },
        { id: "ch-07", number: "7", title: "O Assalto Noturno", status: "error" },
        { id: "ch-08", number: "8", title: "O Resgate", status: "pending" },
      ],
    },
  ],
};

const meta: Meta<typeof ReconvertDialog> = {
  title: "Biblioteca/ReconvertDialog",
  component: ReconvertDialog,
  tags: ["autodocs"],
};

export default meta;

function ReconvertDialogDefaultStory() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <Button
        onClick={() => setIsOpen(true)}
        className="border-[3px] border-ink shadow-comic font-display"
      >
        Reconverter Série
      </Button>
      <ReconvertDialog
        series={mockSeries}
        open={isOpen}
        onOpenChange={setIsOpen}
        onReconvertFile={() => {}}
        onReconvertChapters={() => {}}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <ReconvertDialogDefaultStory />,
};

export const Open: Story = {
  render: () => (
    <ReconvertDialog
      series={mockSeries}
      open={true}
      onOpenChange={() => {}}
      onReconvertFile={() => {}}
      onReconvertChapters={() => {}}
    />
  ),
};
