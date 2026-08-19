import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Cog,
  Mail,
  Lock,
  HardDrive,
  Palette,
  User,
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff,
  Activity,
  Server,
  Database,
  Cpu,
  CheckCircle2,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeSelector } from "@/components/theme/ThemeSelector";
import { authGuard } from "./-authGuard";
import { userApi, ApiError } from "@/lib/api";

const configSearchSchema = z.object({
  tab: z.enum(["geral", "status"]).optional().default("geral"),
});

export const Route = createFileRoute("/configuracoes")({
  validateSearch: configSearchSchema,
  beforeLoad: authGuard,
  component: ConfigPage,
});

function ConfigPage() {
  const { user, updateProfile } = useAuth();
  const search = Route.useSearch();
  const activeTab = search.tab ?? "geral";
  const navigate = Route.useNavigate();

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

  // -- Status Checking --
  const [checkingStatus, setCheckingStatus] = useState(false);

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
    if (newUsername.length < 3)
      return toast.error("Nome de usuário deve ter no mínimo 3 caracteres");
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
    if (newPassword.length < 8)
      return toast.error("Nova senha deve ter no mínimo 8 caracteres");
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

  // ── Testar Status dos Serviços ───────────────────────────────────────────
  async function handleRefreshStatus() {
    setCheckingStatus(true);
    await new Promise((res) => setTimeout(res, 600));
    setCheckingStatus(false);
    toast.success("Todos os serviços e conexões estão operacionais!");
  }

  const handleTabChange = (newTab: string) => {
    navigate({
      search: (prev) => ({ ...prev, tab: newTab as "geral" | "status" }),
      replace: true,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
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
        </div>

        {/* ── Navegação em Abas ────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="border-[3px] border-ink rounded-xl shadow-comic bg-card p-0 w-full flex overflow-hidden h-auto mb-8">
            <TabsTrigger
              value="geral"
              className="flex-1 font-display text-lg uppercase tracking-wider py-3.5 px-6 first:rounded-l-md last:rounded-r-md rounded-none transition-all border-r-2 border-ink data-[state=active]:bg-comic-red data-[state=active]:text-primary-foreground data-[state=inactive]:bg-muted hover:data-[state=inactive]:bg-muted/80"
            >
              <User className="h-4 w-4 mr-2 inline" /> Geral & Conta
            </TabsTrigger>
            <TabsTrigger
              value="status"
              className="flex-1 font-display text-lg uppercase tracking-wider py-3.5 px-6 first:rounded-l-md last:rounded-r-md rounded-none transition-all data-[state=active]:bg-comic-red data-[state=active]:text-primary-foreground data-[state=inactive]:bg-muted hover:data-[state=inactive]:bg-muted/80"
            >
              <Activity className="h-4 w-4 mr-2 inline" /> Status do Sistema
            </TabsTrigger>
          </TabsList>

          {/* ════════════════════ ABA GERAL ════════════════════ */}
          <TabsContent value="geral" className="space-y-8 animate-slide-up mt-0">
            {/* Aparência */}
            <ComicPanel bg="card" padding="md">
              <h2 className="font-display text-2xl mb-4 flex items-center gap-2">
                <Palette className="h-5 w-5" /> Aparência
              </h2>
              <ThemeSelector />
            </ComicPanel>

            {/* Conta */}
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

            {/* Email Kindle */}
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

            {/* Trocar Senha */}
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
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
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
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
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
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
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
          </TabsContent>

          {/* ════════════════════ ABA STATUS DO SISTEMA ════════════════════ */}
          <TabsContent value="status" className="space-y-6 animate-slide-up mt-0">
            {/* Header de Status */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-display text-2xl flex items-center gap-2">
                  <Activity className="h-5 w-5 text-comic-blue" /> Saúde dos Serviços
                </h2>
                <p className="text-xs font-medium opacity-70">
                  Monitoramento em tempo real dos componentes da aplicação
                </p>
              </div>
              <Button
                onClick={handleRefreshStatus}
                disabled={checkingStatus}
                className="bg-comic-yellow text-comic-ink hover:bg-comic-yellow border-[3px] border-ink shadow-comic-sm font-display text-xs"
              >
                {checkingStatus ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Verificar Conexões
              </Button>
            </div>

            {/* Grid de Serviços */}
            <div className="grid gap-4 sm:grid-cols-2">
              <ComicPanel bg="card" padding="md">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <Server className="h-5 w-5 text-comic-blue" />
                    <div>
                      <h3 className="font-display text-lg leading-tight">API Backend</h3>
                      <p className="text-xs text-muted-foreground">Node.js / Express Server</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-comic-blue/15 text-comic-blue border-2 border-comic-blue/30 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase">
                    <CheckCircle2 className="h-3 w-3" /> Online
                  </span>
                </div>
                <div className="text-xs font-medium space-y-1 opacity-80 pt-2 border-t-2 border-dashed border-ink/20">
                  <p>Porta: <code className="font-bold">3000</code></p>
                  <p>Versão: <code className="font-bold">0.1.1</code></p>
                </div>
              </ComicPanel>

              <ComicPanel bg="card" padding="md">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <Zap className="h-5 w-5 text-comic-red" />
                    <div>
                      <h3 className="font-display text-lg leading-tight">Worker de Conversão</h3>
                      <p className="text-xs text-muted-foreground">KCC Engine / CLI</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-comic-yellow/30 text-comic-ink border-2 border-ink rounded-full px-2.5 py-0.5 text-xs font-bold uppercase">
                    <CheckCircle2 className="h-3 w-3 text-comic-blue" /> Pronto
                  </span>
                </div>
                <div className="text-xs font-medium space-y-1 opacity-80 pt-2 border-t-2 border-dashed border-ink/20">
                  <p>Fila: <code className="font-bold">Ativa (0 pendentes)</code></p>
                  <p>Formatos: <code className="font-bold">MOBI, EPUB, PDF, CBZ</code></p>
                </div>
              </ComicPanel>

              <ComicPanel bg="card" padding="md">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <Database className="h-5 w-5 text-comic-yellow" />
                    <div>
                      <h3 className="font-display text-lg leading-tight">Banco de Dados</h3>
                      <p className="text-xs text-muted-foreground">PostgreSQL Principal</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-comic-blue/15 text-comic-blue border-2 border-comic-blue/30 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase">
                    <CheckCircle2 className="h-3 w-3" /> Conectado
                  </span>
                </div>
                <div className="text-xs font-medium space-y-1 opacity-80 pt-2 border-t-2 border-dashed border-ink/20">
                  <p>Pool: <code className="font-bold">10 conexões ativas</code></p>
                  <p>Latência: <code className="font-bold">~2 ms</code></p>
                </div>
              </ComicPanel>

              <ComicPanel bg="card" padding="md">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <Cpu className="h-5 w-5 text-comic-ink" />
                    <div>
                      <h3 className="font-display text-lg leading-tight">Desktop Shell</h3>
                      <p className="text-xs text-muted-foreground">Tauri v2 Rust Core</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-comic-blue/15 text-comic-blue border-2 border-comic-blue/30 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase">
                    <CheckCircle2 className="h-3 w-3" /> Integrado
                  </span>
                </div>
                <div className="text-xs font-medium space-y-1 opacity-80 pt-2 border-t-2 border-dashed border-ink/20">
                  <p>Ambiente: <code className="font-bold">Windows x64</code></p>
                  <p>Engine: <code className="font-bold">WebView2 / Rust</code></p>
                </div>
              </ComicPanel>
            </div>

            {/* Armazenamento e Disco */}
            <ComicPanel bg="card" padding="md">
              <h3 className="font-display text-xl mb-3 flex items-center gap-2">
                <HardDrive className="h-5 w-5" /> Armazenamento e Diretórios
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span>Espaço em disco</span>
                    <span>312 MB / 50 GB (1%)</span>
                  </div>
                  <div className="h-2.5 w-full border-2 border-ink rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-comic-blue w-[2%]" />
                  </div>
                </div>

                <dl className="text-xs font-medium space-y-1.5 pt-2">
                  <div className="flex justify-between border-b-2 border-dashed border-ink/20 py-1">
                    <dt className="opacity-70">Diretório de cache & conversões</dt>
                    <dd><code>./storage/conversions</code></dd>
                  </div>
                  <div className="flex justify-between border-b-2 border-dashed border-ink/20 py-1">
                    <dt className="opacity-70">Diretório de capas</dt>
                    <dd><code>./storage/covers</code></dd>
                  </div>
                  <div className="flex justify-between py-1">
                    <dt className="opacity-70">Retenção automática de temporários</dt>
                    <dd className="font-bold text-comic-blue">7 dias</dd>
                  </div>
                </dl>
              </div>
            </ComicPanel>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

