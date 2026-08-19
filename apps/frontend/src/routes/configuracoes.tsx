import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast, Toaster } from "sonner";
import { Cog, Mail, Lock, HardDrive, Palette, User, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeSelector } from "@/components/theme/ThemeSelector";
import { authGuard } from "./-authGuard";
import { userApi, ApiError } from "@/lib/api";

export const Route = createFileRoute("/configuracoes")({
  beforeLoad: authGuard,
  component: ConfigPage,
});

function ConfigPage() {
  const { user, updateProfile } = useAuth();

  // -- Kindle Email --
  const [kindleEmail, setKindleEmail] = useState(user?.kindleEmail ?? "");
  const [kindleSaving, setKindleSaving] = useState(false);

  // -- Username --
  const [newUsername, setNewUsername] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  // -- Email (Login) --
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

  // -- Password --
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ── Salvar Kindle Email ──────────────────────────────────────────────────
  async function handleSaveKindle() {
    setKindleSaving(true);
    try {
      await updateProfile({ kindleEmail });
      toast.success("Email do Kindle atualizado com sucesso!");
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Erro ao salvar email do Kindle";
      toast.error(msg);
    } finally {
      setKindleSaving(false);
    }
  }

  // ── Trocar Username ──────────────────────────────────────────────────────
  async function handleSaveUsername() {
    if (!newUsername.trim()) return toast.error("Informe o novo nome de usuário");
    if (newUsername.length < 3) return toast.error("Nome de usuário deve ter no mínimo 3 caracteres");
    setUsernameSaving(true);
    try {
      await updateProfile({ username: newUsername.trim() });
      toast.success("Nome de usuário atualizado!");
      setNewUsername("");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) return toast.error("Esse nome de usuário já está em uso");
        toast.error(err.message);
      } else {
        toast.error("Erro ao atualizar nome de usuário");
      }
    } finally {
      setUsernameSaving(false);
    }
  }

  // ── Trocar Email de Login ────────────────────────────────────────────────
  async function handleSaveEmail() {
    if (!newEmail.trim()) return toast.error("Informe o novo e-mail");
    if (!newEmail.includes("@")) return toast.error("E-mail inválido");
    setEmailSaving(true);
    try {
      await updateProfile({ email: newEmail.trim() });
      toast.success("E-mail atualizado com sucesso!");
      setNewEmail("");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) return toast.error("Esse e-mail já está em uso");
        toast.error(err.message);
      } else {
        toast.error("Erro ao atualizar e-mail");
      }
    } finally {
      setEmailSaving(false);
    }
  }

  // ── Trocar Senha ─────────────────────────────────────────────────────────
  async function handleSavePassword() {
    if (!currentPassword) return toast.error("Informe a senha atual");
    if (!newPassword) return toast.error("Informe a nova senha");
    if (newPassword !== confirmPassword) return toast.error("As novas senhas não coincidem");
    if (newPassword.length < 8) return toast.error("Nova senha deve ter no mínimo 8 caracteres");
    setPasswordSaving(true);
    try {
      await userApi.updateMe({
        currentPassword,
        password: newPassword,
        confirmPassword,
      });
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) return toast.error("Senha atual incorreta");
        toast.error(err.message);
      } else {
        toast.error("Erro ao alterar senha");
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <ComicHeader />
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg border-[3px] border-ink bg-comic-yellow flex items-center justify-center shadow-comic-sm">
            <Cog />
          </div>
          <div>
            <h1 className="font-display text-4xl uppercase leading-none">Configurações</h1>
            {user?.role === "ADMIN" && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-comic-red mt-0.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Administrador
              </span>
            )}
          </div>
        </div>

        {/* ── Aparência ─────────────────────────────────────────────────────── */}
        <ComicPanel bg="card" padding="md">
          <h2 className="font-display text-2xl mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5" /> Aparência
          </h2>
          <ThemeSelector />
        </ComicPanel>

        {/* ── Conta ─────────────────────────────────────────────────────────── */}
        <ComicPanel bg="card" padding="md">
          <h2 className="font-display text-2xl mb-3 flex items-center gap-2">
            <User className="h-5 w-5" /> Dados da Conta
          </h2>

          {/* Nome de usuário */}
          <div className="mb-6">
            <p className="text-sm font-medium opacity-60 mb-3">
              Usuário atual: <strong>@{user?.username}</strong>
            </p>
            <div className="space-y-2 max-w-sm">
              <Label className="font-display">Novo nome de usuário</Label>
              <Input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="ex: mangamaster"
                className="border-[3px] border-ink h-11 shadow-comic-sm"
                onKeyDown={(e) => e.key === "Enter" && handleSaveUsername()}
              />
              <p className="text-xs font-medium opacity-60">
                Mínimo 3 caracteres. Apenas letras, números, _ e -.
              </p>
            </div>
            <Button
              onClick={handleSaveUsername}
              disabled={usernameSaving || !newUsername.trim()}
              className="mt-4 bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display"
            >
              {usernameSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Atualizar usuário
            </Button>
          </div>

          <hr className="border-t-[3px] border-ink my-6 opacity-20" />

          {/* Email de Login */}
          <div>
            <p className="text-sm font-medium opacity-60 mb-3">
              E-mail atual: <strong>{user?.email}</strong>
            </p>
            <div className="space-y-2 max-w-sm">
              <Label className="font-display">Novo e-mail de acesso</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="ex: seu@email.com"
                className="border-[3px] border-ink h-11 shadow-comic-sm"
                onKeyDown={(e) => e.key === "Enter" && handleSaveEmail()}
              />
            </div>
            <Button
              onClick={handleSaveEmail}
              disabled={emailSaving || !newEmail.trim()}
              className="mt-4 bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display"
            >
              {emailSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Atualizar e-mail
            </Button>
          </div>
        </ComicPanel>

        {/* ── Email Kindle ──────────────────────────────────────────────────── */}
        <ComicPanel bg="card" padding="md">
          <h2 className="font-display text-2xl mb-3 flex items-center gap-2">
            <Mail className="h-5 w-5" /> Email do Kindle
          </h2>
          <div className="space-y-2 max-w-sm">
            <Label className="font-display">Seu endereço @kindle.com</Label>
            <Input
              type="email"
              value={kindleEmail}
              onChange={(e) => setKindleEmail(e.target.value)}
              placeholder="seu-nome@kindle.com"
              className="border-[3px] border-ink h-11 shadow-comic-sm"
            />
            <p className="text-xs font-medium opacity-70">
              Autorize <strong>noreply@mangaink.local</strong> nas configurações da Amazon.
            </p>
          </div>
          <Button
            onClick={handleSaveKindle}
            disabled={kindleSaving}
            className="mt-4 bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display"
          >
            {kindleSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </ComicPanel>

        {/* ── Trocar Senha ──────────────────────────────────────────────────── */}
        <ComicPanel bg="card" padding="md">
          <h2 className="font-display text-2xl mb-3 flex items-center gap-2">
            <Lock className="h-5 w-5" /> Trocar senha
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="font-display">Senha atual</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="border-[3px] border-ink h-11 shadow-comic-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink opacity-50 hover:opacity-100 transition-opacity"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-display">Nova senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="border-[3px] border-ink h-11 shadow-comic-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink opacity-50 hover:opacity-100 transition-opacity"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-display">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="border-[3px] border-ink h-11 shadow-comic-sm pr-10"
                  onKeyDown={(e) => e.key === "Enter" && handleSavePassword()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink opacity-50 hover:opacity-100 transition-opacity"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
          <Button
            onClick={handleSavePassword}
            disabled={passwordSaving || !currentPassword || !newPassword}
            className="mt-4 bg-comic-red text-primary-foreground hover:bg-comic-red border-[3px] border-ink shadow-comic font-display"
          >
            {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Atualizar senha
          </Button>
        </ComicPanel>

        {/* ── Armazenamento ─────────────────────────────────────────────────── */}
        <ComicPanel bg="card" padding="md">
          <h2 className="font-display text-2xl mb-3 flex items-center gap-2">
            <HardDrive className="h-5 w-5" /> Armazenamento
          </h2>
          <dl className="text-sm font-medium space-y-1">
            <div className="flex justify-between border-b-2 border-dashed border-ink/30 py-1">
              <dt>Diretório de storage</dt>
              <dd>
                <code>./storage</code>
              </dd>
            </div>
            <div className="flex justify-between border-b-2 border-dashed border-ink/30 py-1">
              <dt>Banco de dados</dt>
              <dd>
                <code>PostgreSQL</code>
              </dd>
            </div>
          </dl>
        </ComicPanel>
      </div>
    </div>
  );
}
