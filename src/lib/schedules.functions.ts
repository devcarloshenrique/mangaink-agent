import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { sessionConfig, type SessionData } from "./auth-config";
import { readJson, writeJson } from "./storage.server";

async function requireUser(): Promise<string> {
  const session = await useSession<SessionData>(sessionConfig);
  if (!session.data?.username) throw new Error("Não autenticado");
  return session.data.username;
}

export type Frequency = "daily" | "weekly" | "on_release";

export interface Subscription {
  id: string;
  seriesUrl: string;
  seriesTitle: string;
  source: string;
  frequency: Frequency;
  device: string;
  format: string;
  preset: string;
  lastCheck?: number;
  lastChapter?: string;
  createdAt: number;
}

export interface CronRun {
  id: string;
  ranAt: number;
  ok: boolean;
  message: string;
}

interface SchedulesFile {
  subscriptions: Subscription[];
  history: CronRun[];
}

const FILE = "schedules";

function load(): SchedulesFile {
  return readJson<SchedulesFile>(FILE, { subscriptions: [], history: [] });
}

export const listSubscriptions = createServerFn({ method: "GET" }).handler(
  async () => {
    await requireUser();
    const f = load();
    return { subscriptions: f.subscriptions, history: f.history.slice(-25).reverse() };
  },
);

export const subscribe = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      seriesUrl: z.string().url(),
      seriesTitle: z.string().min(1).max(200),
      source: z.string().min(1).max(50),
      frequency: z.enum(["daily", "weekly", "on_release"]),
      device: z.string().min(1).max(50),
      format: z.string().min(1).max(10),
      preset: z.string().min(1).max(20),
    }),
  )
  .handler(async ({ data }) => {
    await requireUser();
    const f = load();
    const sub: Subscription = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    f.subscriptions.push(sub);
    writeJson(FILE, f);
    return { subscription: sub };
  });

export const unsubscribe = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await requireUser();
    const f = load();
    f.subscriptions = f.subscriptions.filter((s) => s.id !== data.id);
    writeJson(FILE, f);
    return { ok: true };
  });

// TODO (próxima fatia): rodar este check via node-cron no boot do server.
export const runCheckNow = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await requireUser();
    const f = load();
    const sub = f.subscriptions.find((s) => s.id === data.id);
    if (!sub) throw new Error("Assinatura não encontrada");
    sub.lastCheck = Date.now();
    f.history.push({
      id: crypto.randomUUID(),
      ranAt: Date.now(),
      ok: true,
      message: `(simulado) verificou ${sub.seriesTitle} — nenhum capítulo novo`,
    });
    writeJson(FILE, f);
    return { ok: true };
  });
