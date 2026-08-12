import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ProviderRecord } from "@/types/scraping";
import { EngineBadge } from "./EngineBadge";
import { ProviderEditorForm } from "./ProviderEditorForm";

interface ProviderConfigDialogProps {
  provider: ProviderRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProviderConfigDialog({ provider, open, onOpenChange }: ProviderConfigDialogProps) {
  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-[3px] border-ink bg-card p-6 shadow-comic-lg max-h-[85vh] overflow-y-auto">
        <DialogTitle asChild>
          <div className="flex items-center gap-3 pr-8">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-2xl leading-none truncate">
                  Configurar {provider.name}
                </h2>
                <EngineBadge engine={provider.engine} />
              </div>
              <p className="text-[10px] font-medium opacity-50 mt-1">#{provider.slug}</p>
            </div>
          </div>
        </DialogTitle>
        <DialogDescription className="sr-only">
          Edite as configurações do provider {provider.name}.
        </DialogDescription>
        <ProviderEditorForm provider={provider} onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
