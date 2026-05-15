import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/auth.functions";
import { useAuth } from "@/hooks/useAuth";
import { toast, Toaster } from "sonner";
import { Lock, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — MangaForge" },
      { name: "description", content: "Acesse sua instância MangaForge self-hosted." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, refresh } = useAuth();
  const loginFn = useServerFn(login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await loginFn({ data: { username: username.trim(), password } });
      await refresh();
      toast.success("Bem-vindo!");
      navigate({ to: "/" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <ComicHeader />
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="text-center mb-6">
          <SpeechBubble variant="yellow" tail="bottom" className="mb-4">
            Sua instância pessoal de mangás pro Kindle.
          </SpeechBubble>
          <h1 className="font-display text-4xl uppercase mt-2">Entrar</h1>
        </div>

        <ComicPanel bg="card" padding="lg">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="font-display">
                <UserIcon className="inline h-4 w-4 mr-1" /> Usuário
              </Label>
              <Input
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="border-[3px] border-ink h-11 shadow-comic-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-display">
                <Lock className="inline h-4 w-4 mr-1" /> Senha
              </Label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border-[3px] border-ink h-11 shadow-comic-sm"
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display text-lg h-11"
            >
              {busy ? "Entrando…" : "Entrar"}
            </Button>
          </form>

          <p className="text-xs font-medium opacity-70 mt-4 text-center leading-relaxed">
            Primeiro acesso: usa <code className="bg-muted px-1 rounded">APP_USER</code> /{" "}
            <code className="bg-muted px-1 rounded">APP_PASSWORD</code> do seu compose.
            Se nada definido, padrão é <code className="bg-muted px-1 rounded">admin</code> /{" "}
            <code className="bg-muted px-1 rounded">admin</code> — troque em Configurações depois de entrar.
          </p>
        </ComicPanel>
      </div>
    </div>
  );
}
