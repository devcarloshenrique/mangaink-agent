import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { sessionConfig, type SessionData } from "./auth-config";
import { readJson, writeJson } from "./storage.server";
import { hashPassword, verifyPassword } from "./password.server";

interface UserRecord {
  username: string;
  passwordHash: string;
  kindleEmail?: string;
  createdAt: number;
}

interface UsersFile {
  users: UserRecord[];
}

const FILE = "users";

async function ensureBootstrapUser(): Promise<void> {
  const file = readJson<UsersFile>(FILE, { users: [] });
  if (file.users.length > 0) return;

  const envUser = process.env.APP_USER ?? "admin";
  const envPass = process.env.APP_PASSWORD ?? "admin";
  const hash = await hashPassword(envPass);
  file.users.push({
    username: envUser,
    passwordHash: hash,
    createdAt: Date.now(),
  });
  writeJson(FILE, file);
}

function findUser(username: string): UserRecord | undefined {
  const file = readJson<UsersFile>(FILE, { users: [] });
  return file.users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
}

export const login = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      username: z.string().min(1).max(64),
      password: z.string().min(1).max(200),
    }),
  )
  .handler(async ({ data }) => {
    await ensureBootstrapUser();
    const user = findUser(data.username);
    if (!user) throw new Error("Usuário ou senha inválidos");
    const ok = await verifyPassword(data.password, user.passwordHash);
    if (!ok) throw new Error("Usuário ou senha inválidos");

    const session = await useSession<SessionData>(sessionConfig);
    await session.update({ username: user.username, loggedInAt: Date.now() });
    return { username: user.username };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<SessionData>(sessionConfig);
  await session.clear();
  return { ok: true };
});

export const me = createServerFn({ method: "GET" }).handler(async () => {
  await ensureBootstrapUser();
  const session = await useSession<SessionData>(sessionConfig);
  if (!session.data?.username) return { user: null };
  const user = findUser(session.data.username);
  if (!user) return { user: null };
  return {
    user: {
      username: user.username,
      kindleEmail: user.kindleEmail ?? "",
    },
  };
});

export const changePassword = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      current: z.string().min(1),
      next: z.string().min(6).max(200),
    }),
  )
  .handler(async ({ data }) => {
    const session = await useSession<SessionData>(sessionConfig);
    if (!session.data?.username) throw new Error("Não autenticado");
    const file = readJson<UsersFile>(FILE, { users: [] });
    const u = file.users.find(
      (x) => x.username.toLowerCase() === session.data!.username!.toLowerCase(),
    );
    if (!u) throw new Error("Usuário não encontrado");
    const ok = await verifyPassword(data.current, u.passwordHash);
    if (!ok) throw new Error("Senha atual incorreta");
    u.passwordHash = await hashPassword(data.next);
    writeJson(FILE, file);
    return { ok: true };
  });

export const setKindleEmail = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      kindleEmail: z
        .string()
        .trim()
        .regex(
          /^$|^\S+@(kindle\.com|free\.kindle\.com)$/i,
          "Use um endereço @kindle.com ou @free.kindle.com",
        ),
    }),
  )
  .handler(async ({ data }) => {
    const session = await useSession<SessionData>(sessionConfig);
    if (!session.data?.username) throw new Error("Não autenticado");
    const file = readJson<UsersFile>(FILE, { users: [] });
    const u = file.users.find(
      (x) => x.username.toLowerCase() === session.data!.username!.toLowerCase(),
    );
    if (!u) throw new Error("Usuário não encontrado");
    u.kindleEmail = data.kindleEmail || undefined;
    writeJson(FILE, file);
    return { ok: true, kindleEmail: u.kindleEmail ?? "" };
  });
