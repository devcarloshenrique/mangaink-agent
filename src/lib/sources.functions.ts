import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { sessionConfig, type SessionData } from "./auth-config";

async function requireUser(): Promise<string> {
  const session = await useSession<SessionData>(sessionConfig);
  if (!session.data?.username) throw new Error("Não autenticado");
  return session.data.username;
}

export interface SourceInfo {
  id: string;
  name: string;
  status: "active" | "beta" | "soon";
  description: string;
  urlExample: string;
  homepage: string;
}

const SOURCES: SourceInfo[] = [
  {
    id: "mangadex",
    name: "MangaDex",
    status: "active",
    description:
      "Catálogo enorme com tradução comunitária em vários idiomas. Usa a API oficial.",
    urlExample: "https://mangadex.org/title/<id>/<slug>",
    homepage: "https://mangadex.org",
  },
  {
    id: "mangalivre",
    name: "MangaLivre",
    status: "beta",
    description:
      "Scraping da Mangá Livre (PT-BR). Funciona para a maioria das obras populares.",
    urlExample: "https://mangalivre.net/manga/<slug>",
    homepage: "https://mangalivre.net",
  },
];

export const listSources = createServerFn({ method: "GET" }).handler(
  async () => {
    return { sources: SOURCES };
  },
);

export const detectSource = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => d)
  .handler(async ({ data }) => {
    await requireUser();
    try {
      const u = new URL(data.url);
      const match = SOURCES.find((s) => {
        try {
          return new URL(s.homepage).hostname.replace(/^www\./, "") ===
            u.hostname.replace(/^www\./, "");
        } catch {
          return false;
        }
      });
      return { source: match ?? null };
    } catch {
      return { source: null };
    }
  });
