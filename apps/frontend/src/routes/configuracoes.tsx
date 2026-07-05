import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast, Toaster } from "sonner";
import { Cog, Mail, Lock, HardDrive, Palette } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeSelector } from "@/components/theme/ThemeSelector";
import { authGuard } from "./-authGuard";

export const Route = createFileRoute("/configuracoes")({
  beforeLoad: authGuard,
  component: ConfigPage,
});

function ConfigPage() {
  const { user } = useAuth();
  const [kindleEmail, setKindleEmail] = useState(user?.kindleEmail ?? "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <ComicHeader />
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg border-[3px] border-ink bg-comic-yellow flex items-center justify-center shadow-comic-sm">
            <Cog />
          </div>
          <h1 className="font-display text-4xl uppercase leading-none">Configurações</h1>
        </div>

        <ComicPanel bg="card" padding="md">
          <h2 className="font-display text-2xl mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5" /> Aparência
          </h2>
          <ThemeSelector />
        </ComicPanel>

        <ComicPanel bg="card" padding="md">
          <h2 className="font-display text-2xl mb-3 flex items-center gap-2">
            <Mail className="h-5 w-5" /> Email do Kindle
          </h2>
          <div className="space-y-2">
            <Label className="font-display">Seu endereço @kindle.com</Label>
            <Input
              type="email"
              value={kindleEmail}
              onChange={(e) => setKindleEmail(e.target.value)}
              placeholder="seu-nome@kindle.com"
              className="border-[3px] border-ink h-11 shadow-comic-sm"
            />
            <p className="text-xs font-medium opacity-70">
              Autorize <strong>noreply@mangaforge.local</strong> nas configurações da Amazon.
            </p>
          </div>
          <Button
            onClick={() => toast.success("Email salvo (mock)")}
            className="mt-4 bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display"
          >
            Salvar
          </Button>
        </ComicPanel>

        <ComicPanel bg="card" padding="md">
          <h2 className="font-display text-2xl mb-3 flex items-center gap-2">
            <Lock className="h-5 w-5" /> Trocar senha
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="font-display">Senha atual</Label>
              <Input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="border-[3px] border-ink h-11 shadow-comic-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-display">Nova senha</Label>
              <Input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="border-[3px] border-ink h-11 shadow-comic-sm"
              />
            </div>
          </div>
          <Button
            onClick={() => {
              if (!current || !next) return toast.error("Preencha os dois campos");
              toast.success("Senha alterada (mock)");
              setCurrent("");
              setNext("");
            }}
            className="mt-4 bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display"
          >
            Atualizar
          </Button>
        </ComicPanel>

        <ComicPanel bg="card" padding="md">
          <h2 className="font-display text-2xl mb-3 flex items-center gap-2">
            <HardDrive className="h-5 w-5" /> Armazenamento
          </h2>
          <dl className="text-sm font-medium space-y-1">
            <div className="flex justify-between border-b-2 border-dashed border-ink/30 py-1">
              <dt>Diretório da biblioteca</dt>
              <dd>
                <code>/data/library</code>
              </dd>
            </div>
            <div className="flex justify-between border-b-2 border-dashed border-ink/30 py-1">
              <dt>Banco</dt>
              <dd>
                <code>/data/db/manga.db</code>
              </dd>
            </div>
            <div className="flex justify-between py-1">
              <dt>Espaço usado (mock)</dt>
              <dd>312 MB / 50 GB</dd>
            </div>
          </dl>
        </ComicPanel>
      </div>
    </div>
  );
}
