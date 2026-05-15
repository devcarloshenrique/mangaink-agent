import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { OnomatopoeiaBadge } from "@/components/comic/OnomatopoeiaBadge";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Zap } from "lucide-react";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/conta")({
  head: () => ({ meta: [{ title: "Minha conta — MangaForge" }] }),
  component: () => (
    <RequireAuth>
      <ContaPage />
    </RequireAuth>
  ),
});

interface Tx {
  id: string;
  delta: number;
  reason: string;
  created_at: string;
}

function ContaPage() {
  const { user, profile } = useAuth();
  const [tx, setTx] = useState<Tx[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("credit_transactions")
      .select("id, delta, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setTx(data ?? []));
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <ComicHeader />
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-4xl uppercase">Minha conta</h1>
          <Link
            to="/wizard"
            className="inline-flex items-center gap-1 bg-comic-red text-primary-foreground border-[3px] border-ink shadow-comic-sm px-4 py-2 rounded-md font-display"
          >
            Novo mangá <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <ComicPanel bg="yellow" padding="lg" tilt="left">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-display text-xl">{profile?.display_name ?? user?.email}</p>
              <p className="text-sm font-medium opacity-80">{user?.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <OnomatopoeiaBadge variant="red" size="md">
                <Zap className="inline h-5 w-5 fill-current mr-1" />
                {profile?.credits ?? 0}
              </OnomatopoeiaBadge>
              <Button
                onClick={() => toast.info("Em breve! Compra de créditos chegando.")}
                className="bg-comic-blue text-accent-foreground hover:bg-comic-blue border-[3px] border-ink shadow-comic-sm font-display"
              >
                Comprar créditos
              </Button>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium">
            Cada conversão de capítulo gasta <strong>1 crédito</strong>.
          </p>
        </ComicPanel>

        <ComicPanel bg="card" padding="lg">
          <h2 className="font-display text-2xl mb-4">Histórico</h2>
          {tx.length === 0 ? (
            <p className="text-sm font-medium opacity-70">Sem transações ainda.</p>
          ) : (
            <ul className="space-y-2">
              {tx.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between border-b-2 border-dashed border-ink/20 pb-2 last:border-0"
                >
                  <div>
                    <span className="font-display">{t.reason}</span>
                    <span className="block text-xs opacity-60">
                      {new Date(t.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <span
                    className={`font-display text-lg ${
                      t.delta >= 0 ? "text-comic-blue" : "text-comic-red"
                    }`}
                  >
                    {t.delta > 0 ? "+" : ""}
                    {t.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ComicPanel>
      </div>
    </div>
  );
}
