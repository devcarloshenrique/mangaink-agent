import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast, Toaster } from "sonner";
import { Lock, User, Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api";

// ─── Schema de validação ───────────────────────────────────────────────────────
const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, "E-mail ou nome de usuário deve ter no mínimo 3 caracteres"),
  password: z.string().min(1, "Senha é obrigatória"),
});

type LoginForm = z.infer<typeof loginSchema>;

// ─── Rota ─────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  component: LoginPage,
});

// ─── Componente ───────────────────────────────────────────────────────────────
function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      await login({ identifier: data.identifier, password: data.password });
      toast.success("Bem-vindo de volta!");
      const destination = search.redirect ?? "/";
      navigate({ to: destination as "/" });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          toast.error("Credenciais inválidas. Verifique seu e-mail/usuário e senha.");
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error("Erro ao conectar com o servidor");
      }
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
                placeholder="seu@email.com ou seunome"
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
            <Link
              to="/cadastro"
              className="text-sm font-display text-comic-blue hover:underline"
            >
              Criar conta
            </Link>
          </div>
        </ComicPanel>
      </div>
    </div>
  );
}
