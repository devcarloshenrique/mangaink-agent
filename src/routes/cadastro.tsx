import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast, Toaster } from "sonner";
import { Lock, Mail, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/cadastro")({
  component: CadastroPage,
});

function CadastroPage() {
  const navigate = useNavigate();
  const { user, signUp } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setBusy(true);
    try {
      await signUp(username, email, password);
      toast.success("Conta criada com sucesso!");
      navigate({ to: "/login" });
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
          <SpeechBubble variant="blue" tail="bottom" className="mb-4">
            Crie sua conta e comece a converter mangás!
          </SpeechBubble>
          <h1 className="font-display text-4xl uppercase mt-2">Criar conta</h1>
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
                placeholder="seu_usuario"
                className="border-[3px] border-ink h-11 shadow-comic-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-display">
                <Mail className="inline h-4 w-4 mr-1" /> Email
              </Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
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
            <div className="space-y-1.5">
              <Label className="font-display">
                <Lock className="inline h-4 w-4 mr-1" /> Confirmar senha
              </Label>
              <Input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="border-[3px] border-ink h-11 shadow-comic-sm"
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-comic-blue text-accent-foreground hover:bg-comic-blue border-[3px] border-ink shadow-comic font-display text-lg h-11"
            >
              {busy ? "Criando…" : "Criar conta"}
            </Button>
          </form>

          <p className="text-xs font-medium opacity-70 mt-4 text-center leading-relaxed">
            Modo demo — conta criada localmente.
          </p>

          <div className="mt-4 text-center">
            <span className="text-sm font-medium opacity-70">Já tem conta? </span>
            <Link
              to="/login"
              className="text-sm font-display text-comic-red hover:underline"
            >
              Entrar
            </Link>
          </div>
        </ComicPanel>
      </div>
    </div>
  );
}
