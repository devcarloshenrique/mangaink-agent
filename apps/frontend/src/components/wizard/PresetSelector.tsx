import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Pencil, RefreshCw, Star, Trash2, Plus } from "lucide-react";
import type { ConversionPreset, UserPresetResponse } from "@/types/conversion";
import { cn } from "@/lib/utils";

interface Props {
  presets: ConversionPreset[];
  userPresets: UserPresetResponse[];
  activePresetId: string | null;
  activePresetSource: "system" | "user" | null;
  isAtLimit: boolean;
  onSelectPreset: (presetId: string, source: "system" | "user") => void;
  onSaveAsPreset: () => void;
  onEditPreset: (preset: UserPresetResponse) => void;
  onDeletePreset: (preset: UserPresetResponse) => void;
  onToggleDefault: (preset: UserPresetResponse) => void;
  onUpdateValues: (preset: UserPresetResponse) => void;
  onCustomMode: () => void;
}

export function PresetSelector({
  presets,
  userPresets,
  activePresetId,
  activePresetSource,
  isAtLimit,
  onSelectPreset,
  onSaveAsPreset,
  onEditPreset,
  onDeletePreset,
  onToggleDefault,
  onUpdateValues,
  onCustomMode,
}: Props) {
  const displayName = activePresetId
    ? ([...userPresets, ...presets].find((p) => p.id === activePresetId)?.name ?? "Personalizado")
    : "Personalizado";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="border-[3px] border-ink shadow-comic-sm font-display w-full justify-between h-11"
        >
          <span className="truncate">{displayName}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[var(--radix-dropdown-menu-trigger-width)] border-[3px] border-ink shadow-comic-lg"
        align="start"
      >
        <DropdownMenuItem
          onSelect={onCustomMode}
          className={cn("font-display", !activePresetId && "bg-comic-yellow/20 font-bold")}
        >
          Personalizado
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="font-display text-xs text-muted-foreground">
          Presets do sistema
        </DropdownMenuLabel>
        {presets.map((preset) => (
          <DropdownMenuItem
            key={preset.id}
            onSelect={() => onSelectPreset(preset.id, "system")}
            className={cn(
              "font-display cursor-pointer",
              activePresetId === preset.id &&
                activePresetSource === "system" &&
                "bg-comic-yellow/20 font-bold",
            )}
          >
            {preset.name}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="font-display text-xs text-muted-foreground">
          Meus presets
        </DropdownMenuLabel>

        {userPresets.length === 0 && (
          <div className="px-2 py-2 text-sm text-muted-foreground italic">Nenhum preset salvo</div>
        )}

        {userPresets.map((preset) => (
          <DropdownMenuItem
            key={preset.id}
            className={cn(
              "flex items-center justify-between group cursor-pointer",
              activePresetId === preset.id &&
                activePresetSource === "user" &&
                "bg-comic-yellow/20 font-bold",
            )}
          >
            <span className="flex-1 font-display" onClick={() => onSelectPreset(preset.id, "user")}>
              {preset.name}
            </span>
            <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onToggleDefault(preset)}
                title={preset.isDefault ? "Remover padrao" : "Definir como padrao"}
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5",
                    preset.isDefault && "fill-comic-yellow text-comic-yellow",
                  )}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onUpdateValues(preset)}
                title="Atualizar valores com configuracao atual"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEditPreset(preset)}
                title="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-comic-red"
                onClick={() => onDeletePreset(preset)}
                title="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </span>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={onSaveAsPreset}
          disabled={isAtLimit}
          className="font-display cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1" />
          Salvar como preset
          {isAtLimit && (
            <span className="ml-auto text-xs text-muted-foreground">Limite atingido</span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
