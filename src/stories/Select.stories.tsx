import type { Meta, StoryObj } from "@storybook/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const meta: Meta = {
  title: "UI/Select",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[240px] border-[3px] border-ink shadow-comic-sm">
        <SelectValue placeholder="Selecione um formato" />
      </SelectTrigger>
      <SelectContent className="border-[3px] border-ink">
        <SelectItem value="epub">EPUB</SelectItem>
        <SelectItem value="mobi">MOBI</SelectItem>
        <SelectItem value="cbz">CBZ</SelectItem>
        <SelectItem value="kfx">KFX</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const DeviceSelect: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[280px] border-[3px] border-ink h-11 shadow-comic-sm">
        <SelectValue placeholder="Selecione seu Kindle" />
      </SelectTrigger>
      <SelectContent className="border-[3px] border-ink">
        <SelectItem value="kpw_11">Kindle Paperwhite 11ª Geração</SelectItem>
        <SelectItem value="kpw_signature">Kindle Paperwhite Signature</SelectItem>
        <SelectItem value="k_oasis">Kindle Oasis</SelectItem>
        <SelectItem value="k_scribe">Kindle Scribe</SelectItem>
        <SelectItem value="k_basic">Kindle Basic</SelectItem>
      </SelectContent>
    </Select>
  ),
};
