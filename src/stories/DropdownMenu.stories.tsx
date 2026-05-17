import type { Meta } from "@storybook/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Pencil, Star, Trash2, MoreVertical } from "lucide-react";

const meta: Meta = {
  title: "UI/DropdownMenu",
  tags: ["autodocs"],
};

export default meta;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="border-[3px] border-ink shadow-comic-sm font-display">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-[3px] border-ink shadow-comic w-48">
        <DropdownMenuLabel className="font-display">Ações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="font-medium cursor-pointer">
          <Pencil className="mr-2 h-4 w-4" /> Renomear
        </DropdownMenuItem>
        <DropdownMenuItem className="font-medium cursor-pointer">
          <Star className="mr-2 h-4 w-4" /> Favoritar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="font-medium cursor-pointer text-destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Excluir
          <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const DownloadMenu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="border-[3px] border-ink bg-comic-yellow shadow-comic-sm font-display">
          Downloads
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 border-[3px] border-ink shadow-comic p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-ink/20 bg-comic-yellow">
          <span className="font-display text-lg">Downloads</span>
          <span className="text-xs font-medium bg-comic-blue text-accent-foreground border-2 border-ink px-1.5 py-0.5 rounded">
            2 ativos
          </span>
        </div>
        <div className="max-h-60 overflow-y-auto">
          <DropdownMenuItem className="flex flex-col items-start gap-1 px-4 py-3 cursor-pointer border-b border-ink/10">
            <div className="flex items-center gap-2 w-full">
              <span className="font-display text-sm truncate flex-1">Berserk</span>
              <span className="text-[10px] font-medium opacity-50">EPUB</span>
            </div>
            <div className="w-full h-1.5 border border-ink/30 rounded-full bg-card overflow-hidden">
              <div className="h-full bg-comic-blue w-[45%]" />
            </div>
            <p className="text-[11px] font-medium opacity-60">Baixando imagens • 45%</p>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex flex-col items-start gap-1 px-4 py-3 cursor-pointer">
            <div className="flex items-center gap-2 w-full">
              <span className="font-display text-sm truncate flex-1">One Piece</span>
              <span className="text-[10px] font-medium opacity-50">MOBI</span>
            </div>
            <div className="w-full h-1.5 border border-ink/30 rounded-full bg-card overflow-hidden">
              <div className="h-full bg-comic-blue w-[78%]" />
            </div>
            <p className="text-[11px] font-medium opacity-60">Convertendo páginas • 78%</p>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
