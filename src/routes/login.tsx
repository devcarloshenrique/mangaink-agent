import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { toast, Toaster } from "sonner";
import { Mail, Lock, BookOpen } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — MangaForge" },
      { name: "description", content: "Entre na MangaForge e comece a mandar mangás pro seu Kindle." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/wizard" });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/wizard`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu e-mail se necessário.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/wizard`,
    });
    if (result.error) {
      toast.error(result.error.message);
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
            {mode === "signup" ? "Vem ser otaku com a gente!" : "Bem-vindo de volta, leitor!"}
          </SpeechBubble>
          <h1 className="font-display text-4xl uppercase mt-2">
            {mode === "signup" ? "Criar conta" : "Entrar"}
          </h1>
        </div>

        <ComicPanel bg="card" padding="lg">
          <Button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            variant="outline"
            className="w-full border-[3px] border-ink shadow-comic-sm font-display h-11"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .55 4.13 1.62l3.05-3.05A11.95 11.95 0 0 0 12 0C7.3 0 3.25 2.69 1.28 6.6l3.55 2.76A7.05 7.05 0 0 1 12 5z"/>
              <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.4 5.4 0 0 1-2.4 3.59l3.7 2.86c2.18-2.01 3.43-4.99 3.43-8.69z"/>
              <path fill="#FBBC05" d="M4.83 14.36a7.05 7.05 0 0 1 0-4.51L1.28 7.09a12 12 0 0 0 0 9.82l3.55-2.55z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.7-2.86c-1.03.69-2.36 1.1-4.23 1.1a7.05 7.05 0 0 1-6.62-4.55L1.83 17.4A12 12 0 0 0 12 24z"/>
            </svg>
            Continuar com Google
          </Button>

          <div className="my-4 flex items-center gap-3">
            <div className="h-[2px] flex-1 bg-ink/20" />
            <span className="font-display text-sm opacity-70">ou</span>
            <div className="h-[2px] flex-1 bg-ink/20" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label className="font-display"><BookOpen className="inline h-4 w-4 mr-1" /> Nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="border-[3px] border-ink h-11 shadow-comic-sm"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="font-display"><Mail className="inline h-4 w-4 mr-1" /> E-mail</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="border-[3px] border-ink h-11 shadow-comic-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-display"><Lock className="inline h-4 w-4 mr-1" /> Senha</Label>
              <Input
                type="password"
                required
                minLength={6}
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
              {busy ? "Aguarde…" : mode === "signup" ? "Criar conta (+10 créditos)" : "Entrar"}
            </Button>
          </form>

          <p className="text-center text-sm font-medium mt-4">
            {mode === "signup" ? "Já tem conta?" : "Novo por aqui?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="font-display text-comic-red underline underline-offset-4"
            >
              {mode === "signup" ? "Entrar" : "Criar conta"}
            </button>
          </p>
        </ComicPanel>

        <p className="text-center mt-6">
          <Link to="/" className="font-display text-sm underline underline-offset-4">
            ← voltar pra home
          </Link>
        </p>
      </div>
    </div>
  );
}
