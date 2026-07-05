import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FolderPlus, Folder, Trash2 } from "lucide-react";

interface Collection {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  collections: Collection[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}

const PRESET_COLLECTIONS = ["Shonen", "Seinen", "Ação", "Fantasia", "Suspense"];

export function CollectionManager({ open, onOpenChange, collections, onAdd, onRemove }: Props) {
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd(newName.trim());
    setNewName("");
    toast.success(`Coleção "${newName.trim()}" criada!`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[3px] border-ink shadow-comic-lg max-w-md">
        <DialogTitle className="font-display text-2xl">Coleções</DialogTitle>

        <div className="space-y-4">
          {/* Existing collections */}
          {collections.length > 0 ? (
            <div className="space-y-2">
              {collections.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 border-[2.5px] border-ink rounded-lg p-3 bg-card shadow-comic-sm"
                >
                  <Folder className="h-4 w-4 text-comic-blue shrink-0" />
                  <span className="font-display text-base flex-1">{c.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRemove(c.id)}
                    className="border-[2px] border-ink shadow-comic-sm h-7 w-7 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-medium opacity-60 text-center py-4">
              Nenhuma coleção ainda. Crie uma abaixo!
            </p>
          )}

          {/* Add new */}
          <div className="border-t-[3px] border-dashed border-ink pt-4 space-y-3">
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome da coleção"
                className="border-[2.5px] border-ink h-10 shadow-comic-sm"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button
                onClick={handleAdd}
                className="bg-comic-blue text-accent-foreground border-[2.5px] border-ink shadow-comic-sm font-display"
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLLECTIONS.filter((p) => !collections.some((c) => c.name === p)).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    onAdd(p);
                    toast.success(`Coleção "${p}" criada!`);
                  }}
                  className="text-xs font-display border-2 border-ink rounded px-2 py-1 bg-comic-yellow hover:-translate-y-0.5 transition-transform shadow-comic-sm"
                >
                  + {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
