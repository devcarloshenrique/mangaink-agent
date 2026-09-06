import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddMangaDialog } from "@/components/biblioteca/AddMangaDialog";
import { libraryApi, conversionsApi } from "@/lib/api";
import type { SourceInspectResponse } from "@/types/scraping";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/lib/api", () => ({
  libraryApi: {
    add: vi.fn(),
  },
  conversionsApi: {
    create: vi.fn(),
    coverUrl: vi.fn(() => "http://example.com/cover.jpg"),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockMetadata: SourceInspectResponse = {
  sourceId: "src-berserk",
  status: "ready",
  provider: {
    slug: "mangalivre",
    name: "MangaLivre",
    engine: "cheerio",
  },
  source: {
    url: "https://mangalivre.net/manga/berserk",
    language: "pt-BR",
  },
  metadata: {
    title: "Berserk",
    author: "Kentaro Miura",
    status: "ongoing",
    description: "Guts, um guerreiro misterioso...",
    genres: ["Ação", "Fantasia"],
  },
  chapters: [
    {
      id: "ch-1",
      number: "1",
      title: "O Espadachim Negro",
      url: "https://mangalivre.net/ler/berserk/online/1",
      pages: 40,
      volume: 1,
      isDownloaded: false,
      isRead: false,
    },
    {
      id: "ch-2",
      number: "2",
      title: "A Marca do Sacrifício",
      url: "https://mangalivre.net/ler/berserk/online/2",
      pages: 45,
      volume: 1,
      isDownloaded: false,
      isRead: false,
    },
  ],
  covers: [
    {
      id: "cov-1",
      type: "original",
      label: "Capa Principal",
      imageUrl: "http://example.com/berserk.jpg",
    },
  ],
  statistics: {
    chapters: 2,
    covers: 1,
  },
};

describe("AddMangaDialog", () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve renderizar os detalhes da obra e a lista de capítulos", () => {
    render(
      <AddMangaDialog
        open={true}
        onOpenChange={onOpenChange}
        sourceId="src-berserk"
        metadata={mockMetadata}
      />,
    );

    expect(screen.getByText("Adicionar obra")).toBeInTheDocument();
    expect(screen.getByText("Berserk")).toBeInTheDocument();
    expect(screen.getByText("Kentaro Miura")).toBeInTheDocument();
    expect(screen.getByText("O Espadachim Negro")).toBeInTheDocument();
    expect(screen.getByText("A Marca do Sacrifício")).toBeInTheDocument();
  });

  it("deve permitir adicionar à biblioteca sem capítulos selecionados via botão 'Salvar na biblioteca' e exibir opções", async () => {
    vi.mocked(libraryApi.add).mockResolvedValue({
      id: "lib-1",
      userId: "user-1",
      sourceId: "src-berserk",
      isFavorite: false,
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
    });

    render(
      <AddMangaDialog
        open={true}
        onOpenChange={onOpenChange}
        sourceId="src-berserk"
        metadata={mockMetadata}
      />,
    );

    // Botão de salvar na biblioteca não deve estar desabilitado mesmo sem capítulos selecionados
    const saveBtn = screen.getByRole("button", { name: /Salvar na biblioteca|Apenas salvar/i });
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(libraryApi.add).toHaveBeenCalledWith("src-berserk");
    });

    expect(screen.getByText(/"Berserk" Adicionada!/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver Obra/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Converter para Kindle/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fechar/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ver Obra/i }));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/biblioteca/$sourceId",
      params: { sourceId: "src-berserk" },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("deve permitir baixar capítulos selecionados quando houver capítulos marcados", async () => {
    vi.mocked(libraryApi.add).mockResolvedValue({
      id: "lib-1",
      userId: "user-1",
      sourceId: "src-berserk",
      isFavorite: false,
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
    });
    vi.mocked(conversionsApi.create).mockResolvedValue({
      conversionId: "conv-123",
      status: "queued",
      totalJobs: 1,
      createdAt: "2026-08-29T00:00:00.000Z",
    });

    render(
      <AddMangaDialog
        open={true}
        onOpenChange={onOpenChange}
        sourceId="src-berserk"
        metadata={mockMetadata}
      />,
    );

    // Seleciona o primeiro capítulo
    const ch1 = screen.getByText("O Espadachim Negro");
    fireEvent.click(ch1);

    const downloadBtn = screen.getByRole("button", { name: /Baixar capítulos/i });
    expect(downloadBtn).toBeInTheDocument();
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(libraryApi.add).toHaveBeenCalledWith("src-berserk");
      expect(conversionsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: "src-berserk",
          downloadOnly: true,
          books: [
            {
              title: "Berserk",
              chapters: ["ch-1"],
            },
          ],
        }),
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/biblioteca/converter/$jobId",
      params: { jobId: "conv-123" },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
