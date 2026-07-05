import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
import { Lock, Mail, User as UserIcon, Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api";

// ─── Schema de validação ───────────────────────────────────────────────────────
const cadastroSchema = z
  .object({
    username: z
      .string()
      .min(3, "Usuário deve ter no mínimo 3 caracteres")
      .max(50, "Usuário deve ter no máximo 50 caracteres")
      .regex(/^[a-zA-Z0-9_-]+$/, "Apenas letras, números, _ e -"),
    email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
    password: z.string().min(4, "Senha deve ter no mínimo 4 caracteres"),
    confirmPassword: z.string().min(1, "Confirme sua senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não coincidem",
  });

type CadastroForm = z.infer<typeof cadastroSchema>;

// ─── Rota ─────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/cadastro")({
  component: CadastroPage,
});

// ─── Componente ───────────────────────────────────────────────────────────────
function CadastroPage() {
  const navigate = useNavigate();
  const { register: authRegister } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
  });

  const onSubmit = async (data: CadastroForm) => {
    try {
      await authRegister({
        username: data.username,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });
      toast.success("Conta criada com sucesso! Bem-vindo!");
      navigate({ to: "/" });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          toast.error("E-mail ou usuário já cadastrado");
        } else if (err.status === 400) {
          toast.error("Dados inválidos. Verifique os campos.");
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
          <SpeechBubble variant="blue" tail="bottom" className="mb-4">
            Crie sua conta e comece a converter mangás!
          </SpeechBubble>
          <h1 className="font-display text-4xl uppercase mt-2">Criar conta</h1>
        </div>

        <ComicPanel bg="card" padding="lg">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Usuário */}
            <div className="space-y-1.5">
              <Label htmlFor="cadastro-username" className="font-display">
                <UserIcon className="inline h-4 w-4 mr-1" /> Usuário
              </Label>
              <Input
                id="cadastro-username"
                autoFocus
                autoComplete="username"
                placeholder="seu_usuario"
                className="border-[3px] border-ink h-11 shadow-comic-sm"
                aria-invalid={!!errors.username}
                {...register("username")}
              />
              {errors.username && (
                <p className="text-xs font-medium text-comic-red mt-0.5">
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* E-mail */}
            <div className="space-y-1.5">
              <Label htmlFor="cadastro-email" className="font-display">
                <Mail className="inline h-4 w-4 mr-1" /> E-mail
              </Label>
              <Input
                id="cadastro-email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                className="border-[3px] border-ink h-11 shadow-comic-sm"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs font-medium text-comic-red mt-0.5">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <Label htmlFor="cadastro-password" className="font-display">
                <Lock className="inline h-4 w-4 mr-1" /> Senha
              </Label>
              <Input
                id="cadastro-password"
                type="password"
                autoComplete="new-password"
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

            {/* Confirmar senha */}
            <div className="space-y-1.5">
              <Label htmlFor="cadastro-confirm" className="font-display">
                <Lock className="inline h-4 w-4 mr-1" /> Confirmar senha
              </Label>
              <Input
                id="cadastro-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="border-[3px] border-ink h-11 shadow-comic-sm"
                aria-invalid={!!errors.confirmPassword}
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-xs font-medium text-comic-red mt-0.5">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Botão */}
            <Button
              id="cadastro-submit"
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-comic-blue text-accent-foreground hover:bg-comic-blue border-[3px] border-ink shadow-comic font-display text-lg h-11"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta…
                </>
              ) : (
                "Criar conta"
              )}
            </Button>
          </form>

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
