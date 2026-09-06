import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddMangaBar } from "@/components/biblioteca/AddMangaBar";
import type { SourceInspectResponse } from "@/types/scraping";

const mockInspect = vi.fn();
const mockReset = vi.fn();
let mockScrapingState: {
  status: "idle" | "processing" | "ready" | "failed";
  progress: number;
  sourceId: string | null;
  metadata: SourceInspectResponse | null;
  message: string | null;
  error: string | null;
} = {
  status: "idle",
  progress: 0,
  sourceId: null,
  metadata: null,
  message: null,
  error: null,
};

vi.mock("@/hooks/useScraping", () => ({
  useScraping: () => ({
    state: mockScrapingState,
    inspect: mockInspect,
    reset: mockReset,
  }),
}));

describe("AddMangaBar", () => {
  const onChange = vi.fn();
  const onModeChange = vi.fn();
  const onReady = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockScrapingState = {
      status: "idle",
      progress: 0,
      sourceId: null,
      metadata: null,
      message: null,
      error: null,
    };
  });

  it("deve renderizar em modo filtro por padrão", () => {
    render(
      <AddMangaBar
        value=""
        onChange={onChange}
        mode="filter"
        onModeChange={onModeChange}
        onReady={onReady}
      />,
    );

    expect(screen.getByPlaceholderText("Buscar por título...")).toBeInTheDocument();
  });

  it("deve alternar para modo url quando digitado Enter com http:// ou https://", () => {
    render(
      <AddMangaBar
        value="https://mangalivre.net/manga/berserk"
        onChange={onChange}
        mode="filter"
        onModeChange={onModeChange}
        onReady={onReady}
      />,
    );

    const input = screen.getByPlaceholderText("Buscar por título...");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onModeChange).toHaveBeenCalledWith("url");
  });

  it("deve chamar inspect ao clicar em Adicionar no modo url", async () => {
    render(
      <AddMangaBar
        value="https://mangalivre.net/manga/berserk"
        onChange={onChange}
        mode="url"
        onModeChange={onModeChange}
        onReady={onReady}
      />,
    );

    const addBtn = screen.getByRole("button", { name: /Adicionar/i });
    fireEvent.click(addBtn);

    expect(mockInspect).toHaveBeenCalledWith("https://mangalivre.net/manga/berserk");
  });

  it("deve acionar onReady quando o scraping ficar ready", async () => {
    const mockMeta: SourceInspectResponse = {
      sourceId: "src-berserk",
      status: "ready",
      provider: {
        slug: "mangalivre",
        name: "MangaLivre",
        engine: "cheerio",
      },
      source: { url: "https://mangalivre.net/manga/berserk", language: "pt-BR" },
      metadata: {
        title: "Berserk",
        author: null,
        description: null,
        status: null,
        genres: [],
      },
      chapters: [],
      covers: [],
      statistics: {
        chapters: 0,
        covers: 0,
      },
    };
    mockScrapingState = {
      status: "ready",
      progress: 100,
      sourceId: "src-berserk",
      metadata: mockMeta,
      message: null,
      error: null,
    };

    render(
      <AddMangaBar
        value=""
        onChange={onChange}
        mode="url"
        onModeChange={onModeChange}
        onReady={onReady}
      />,
    );

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith("src-berserk", mockMeta);
      expect(onModeChange).toHaveBeenCalledWith("filter");
    });
  });
});
