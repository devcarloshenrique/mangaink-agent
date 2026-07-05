import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast, Toaster } from "sonner";
import { Calendar, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { authGuard } from "./-authGuard";

export const Route = createFileRoute("/agendamentos")({
  beforeLoad: authGuard,
  component: AgendamentosPage,
});

interface Sub {
  id: string;
  title: string;
  url: string;
  frequency: "daily" | "weekly" | "on_release";
  lastCheck?: string;
}

const FREQ_LABEL: Record<Sub["frequency"], string> = {
  daily: "Diária",
  weekly: "Semanal",
  on_release: "Ao detectar novo capítulo",
};

const SEED: Sub[] = [
  {
    id: "1",
    title: "One Piece",
    url: "https://mangadex.org/title/...",
    frequency: "on_release",
    lastCheck: "há 12h",
  },
  {
    id: "2",
    title: "Berserk",
    url: "https://mangalivre.net/manga/berserk",
    frequency: "weekly",
    lastCheck: "ontem",
  },
];

const HISTORY = [
  { when: "hoje 09:12", msg: "One Piece — nenhum capítulo novo", ok: true },
  { when: "ontem 21:04", msg: "Berserk — cap. 374 enviado pro Kindle", ok: true },
  { when: "ontem 09:11", msg: "MangaDex offline, tentando de novo", ok: false },
];

function AgendamentosPage() {
  const [subs, setSubs] = useState<Sub[]>(SEED);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<Sub["frequency"]>("on_release");

  const add = () => {
    if (!url || !title) return toast.error("Preencha título e URL");
    setSubs((s) => [...s, { id: crypto.randomUUID(), url, title, frequency, lastCheck: "—" }]);
    setUrl("");
    setTitle("");
    toast.success("Assinatura criada (mock)");
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <ComicHeader />
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-lg border-[3px] border-ink bg-comic-yellow flex items-center justify-center shadow-comic-sm">
              <Calendar />
            </div>
            <h1 className="font-display text-4xl uppercase leading-none">Agendamentos</h1>
          </div>
          <SpeechBubble variant="yellow" tail="left" className="max-w-md">
            Assine obras e elas chegam no Kindle quando saírem.
          </SpeechBubble>
        </div>

        <ComicPanel bg="card" padding="md">
          <h2 className="font-display text-2xl mb-3">Nova assinatura</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="font-display">Obra</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Berserk"
                className="border-[3px] border-ink h-11 shadow-comic-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-display">URL da obra</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://mangadex.org/title/..."
                className="border-[3px] border-ink h-11 shadow-comic-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-display">Frequência</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as Sub["frequency"])}>
                <SelectTrigger className="border-[3px] border-ink h-11 shadow-comic-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[3px] border-ink">
                  <SelectItem value="daily">{FREQ_LABEL.daily}</SelectItem>
                  <SelectItem value="weekly">{FREQ_LABEL.weekly}</SelectItem>
                  <SelectItem value="on_release">{FREQ_LABEL.on_release}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={add}
            className="mt-4 bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display"
          >
            Assinar
          </Button>
        </ComicPanel>

        <div>
          <h2 className="font-display text-2xl mb-3">Minhas assinaturas</h2>
          {subs.length === 0 ? (
            <p className="text-sm font-medium opacity-70">Nada por aqui ainda.</p>
          ) : (
            <ComicPanel bg="card" padding="md">
              <ul className="divide-y-2 divide-dashed divide-ink/30">
                {subs.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 flex-wrap"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-lg leading-none">{s.title}</p>
                      <p className="text-xs font-medium opacity-70 mt-1 truncate">
                        {FREQ_LABEL[s.frequency]} • última checagem: {s.lastCheck ?? "—"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast("Checagem disparada (mock)")}
                      className="border-[2.5px] border-ink shadow-comic-sm font-display"
                    >
                      <Play className="h-4 w-4 mr-1" /> Checar agora
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSubs((all) => all.filter((x) => x.id !== s.id))}
                      className="border-[2.5px] border-ink shadow-comic-sm font-display"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </ComicPanel>
          )}
        </div>

        <div>
          <h2 className="font-display text-2xl mb-3">Histórico (mock)</h2>
          <ComicPanel bg="card" padding="md">
            <ul className="space-y-2">
              {HISTORY.map((h, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-medium">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full border-2 border-ink",
                      h.ok ? "bg-comic-blue" : "bg-comic-red",
                    )}
                  />
                  <span className="font-display text-xs opacity-70 w-32 shrink-0">{h.when}</span>
                  <span className="flex-1">{h.msg}</span>
                </li>
              ))}
            </ul>
          </ComicPanel>
        </div>
      </div>
    </div>
  );
}
