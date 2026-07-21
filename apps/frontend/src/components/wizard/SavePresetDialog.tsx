import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save } from "lucide-react";
import type { UserPresetResponse } from "@/types/conversion";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    name: string;
    description?: string;
    values: Record<string, string | number | boolean>;
    isDefault?: boolean;
  }) => Promise<void>;
  fieldOptions: Record<string, string | number | boolean>;
  mode: "create" | "edit";
  existingPreset?: UserPresetResponse;
  existingNames: string[];
  isSaving?: boolean;
}

export function SavePresetDialog({
  open,
  onOpenChange,
  onSave,
  fieldOptions,
  mode,
  existingPreset,
  existingNames,
  isSaving,
}: Props) {
  const [name, setName] = useState(existingPreset?.name ?? "");
  const [description, setDescription] = useState(existingPreset?.description ?? "");
  const [isDefault, setIsDefault] = useState(existingPreset?.isDefault ?? false);

  const isEditing = mode === "edit" && existingPreset;

  const handleOpenChange = (o: boolean) => {
    if (o) {
      setName(isEditing ? existingPreset!.name : "");
      setDescription(isEditing ? (existingPreset!.description ?? "") : "");
      setIsDefault(isEditing ? existingPreset!.isDefault : false);
    }
    onOpenChange(o);
  };

  const nameExists =
    name.trim().length > 0 &&
    existingNames.some(
      (n) => n.toLowerCase() === name.trim().toLowerCase() && n !== existingPreset?.name,
    );

  const canSave = name.trim().length > 0 && !nameExists && !isSaving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    await onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      values: fieldOptions,
      isDefault,
    });
  };

  const fieldCount = Object.keys(fieldOptions).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-[3px] border-ink shadow-comic-lg sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Save className="h-5 w-5" />
            {isEditing ? "Editar Preset" : "Salvar como Preset"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-display">Nome *</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Meu Kindle"
              className="border-[3px] border-ink h-11 shadow-comic-sm"
            />
            {nameExists && <p className="text-sm text-comic-red font-medium">Nome ja existe</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="font-display">Descricao</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Configuracao otimizada para Kindle"
              className="border-[3px] border-ink h-11 shadow-comic-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isDefault"
              checked={isDefault}
              onCheckedChange={(v) => setIsDefault(v === true)}
              className="border-[3px] border-ink"
            />
            <Label htmlFor="isDefault" className="font-display cursor-pointer">
              Definir como preset padrao
            </Label>
          </div>

          {fieldCount > 0 && (
            <div className="bg-comic-cream dark:bg-comic-ink/10 border-[3px] border-ink p-3 rounded-md">
              <p className="font-display text-sm mb-2">Configuracoes ({fieldCount} campos):</p>
              <div className="text-sm space-y-0.5 max-h-24 overflow-y-auto">
                {Object.entries(fieldOptions)
                  .slice(0, 8)
                  .map(([key, value]) => (
                    <p key={key} className="truncate">
                      <span className="font-medium">{key}</span>: {String(value)}
                    </p>
                  ))}
                {fieldCount > 8 && (
                  <p className="text-muted-foreground italic">...e mais {fieldCount - 8} campos</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[3px] border-ink shadow-comic-sm font-display"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!canSave}
              className="bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display disabled:opacity-40"
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
