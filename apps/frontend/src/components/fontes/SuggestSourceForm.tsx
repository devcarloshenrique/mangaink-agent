import { useState } from "react";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Send, Sparkles } from "lucide-react";

export function SuggestSourceForm() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [comment, setComment] = useState("");

  const handleSubmit = () => {
    if (!name || !url) {
      toast.error("Preencha nome e URL");
      return;
    }
    toast.success(`Sugestão "${name}" enviada! Vamos analisar. 🔍`);
    setName("");
    setUrl("");
    setComment("");
  };

  return (
    <ComicPanel bg="yellow" padding="md" tilt="left">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5" />
        <h2 className="font-display text-2xl">Sugerir nova fonte</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="font-display">Nome do site</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="MangaSee"
            className="border-[3px] border-ink h-11 shadow-comic-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="font-display">URL do site</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://mangasee123.com"
            className="border-[3px] border-ink h-11 shadow-comic-sm"
          />
        </div>
      </div>
      <div className="space-y-1.5 mt-3">
        <Label className="font-display">Comentário (opcional)</Label>
        <Input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tem mangás em inglês e português..."
          className="border-[3px] border-ink h-11 shadow-comic-sm"
        />
      </div>
      <Button
        onClick={handleSubmit}
        className="mt-4 bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display"
      >
        <Send className="h-4 w-4 mr-1" /> Enviar sugestão
      </Button>
    </ComicPanel>
  );
}
