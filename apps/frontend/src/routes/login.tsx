import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Lock, User, Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api";

// ─── Schema de validação ───────────────────────────────────────────────────────
const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail ou nome de usuário"),
  password: z.string().min(1, "Informe sua senha"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { redirect?: string };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login(values);
      toast.success("Login realizado com sucesso!");
      const target = search.redirect && !search.redirect.includes("/login")
        ? search.redirect
        : "/";
      navigate({ to: target as "/" });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          toast.error("Credenciais inválidas. Verifique usuário e senha.");
        } else if (err.status === 429) {
          toast.error("Muitas tentativas. Aguarde alguns instantes.");
        } else {
          toast.error(err.message || "Erro ao realizar login");
        }
      } else {
        toast.error("Erro inesperado. Tente novamente.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="text-center mb-6">
          <SpeechBubble variant="yellow" tail="bottom" className="mb-4">
            Sua instância pessoal de mangás pro Kindle.
          </SpeechBubble>
          <h1 className="font-display text-4xl uppercase mt-2">Entrar</h1>
        </div>

        <ComicPanel bg="card" padding="lg">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Identifier (e-mail ou username) */}
            <div className="space-y-1.5">
              <Label htmlFor="login-identifier" className="font-display">
                <User className="inline h-4 w-4 mr-1" /> E-mail ou usuário
              </Label>
              <Input
                id="login-identifier"
                type="text"
                autoFocus
                autoComplete="username"
                placeholder="Email ou Username"
                className="border-[3px] border-ink h-11 shadow-comic-sm"
                aria-invalid={!!errors.identifier}
                {...register("identifier")}
              />
              {errors.identifier && (
                <p className="text-xs font-medium text-comic-red mt-0.5">
                  {errors.identifier.message}
                </p>
              )}
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="font-display">
                <Lock className="inline h-4 w-4 mr-1" /> Senha
              </Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="border-[3px] border-ink h-11 shadow-comic-sm"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs font-medium text-comic-red mt-0.5">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Botão */}
            <Button
              id="login-submit"
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display text-lg h-11"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando…
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <span className="text-sm font-medium opacity-70">Não tem conta? </span>
            <Link to="/cadastro" className="text-sm font-display text-comic-blue hover:underline">
              Criar conta
            </Link>
          </div>
        </ComicPanel>
      </div>
    </div>
  );
}
