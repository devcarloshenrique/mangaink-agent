import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route } from "./biblioteca.$sourceId";
import { scrapingApi, libraryApi } from "@/lib/api";
import type { SourceInspectResponse } from "@/types/scraping";
import type { LibraryItemDTO } from "@mangaink/shared";

const mockNavigate = vi.fn();
let mockSearchParams: { tab?: string } = { tab: "detalhes" };

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component: React.ComponentType }) => ({
    ...config,
    options: { component: config.component },
    component: config.component,
    useParams: () => ({ sourceId: "src-berserk" }),
    useSearch: () => mockSearchParams,
  }),
  useNavigate: () => mockNavigate,
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api", () => ({
  scrapingApi: {
    getSource: vi.fn(),
  },
  libraryApi: {
    list: vi.fn(),
    toggleFavorite: vi.fn(),
    add: vi.fn(),
  },
  chaptersApi: {
    download: vi.fn(),
  },
  conversionsApi: {
    list: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    coverUrl: vi.fn(() => "http://example.com/cover.jpg"),
    create: vi.fn(),
  },
}));

vi.mock("@/hooks/useReadingProgress", () => ({
  useReadingProgress: () => ({
    data: { readChapterIds: [] },
    isLoading: false,
  }),
  useToggleRead: () => ({
    mutate: vi.fn(),
  }),
}));

const mockSourceResponse: SourceInspectResponse = {
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
    description: "Guts é um guerreiro errante.",
    genres: ["Ação", "Fantasia"],
  },
  chapters: [
    {
      id: "ch-1",
      number: "1",
      title: "O Espadachim Negro",
      url: "https://mangalivre.net/manga/berserk/1",
      pages: 40,
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
    chapters: 1,
    covers: 1,
  },
};

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("Biblioteca $sourceId Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = { tab: "detalhes" };
    vi.mocked(scrapingApi.getSource).mockResolvedValue(mockSourceResponse);
  });

  it("deve carregar dados da obra e permitir favoritar", async () => {
    const mockLibraryItem: LibraryItemDTO = {
      id: "lib-1",
      userId: "user-1",
      sourceId: "src-berserk",
      title: "Berserk",
      author: "Kentaro Miura",
      coverUrl: "http://example.com/cover.jpg",
      chaptersCount: 1,
      isFavorite: false,
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
    };

    vi.mocked(libraryApi.list).mockResolvedValue({
      items: [mockLibraryItem],
      total: 1,
    });
    vi.mocked(libraryApi.toggleFavorite).mockResolvedValue({
      id: "lib-1",
      userId: "user-1",
      sourceId: "src-berserk",
      isFavorite: true,
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
    });

    const Component = Route.options.component as React.ComponentType;
    renderWithClient(<Component />);

    await waitFor(() => {
      expect(screen.getByText("Berserk")).toBeInTheDocument();
      expect(screen.getByText("Kentaro Miura")).toBeInTheDocument();
    });

    const favButton = screen.getByRole("button", { name: /Favoritar/i });
    expect(favButton).toBeInTheDocument();
    fireEvent.click(favButton);

    await waitFor(() => {
      expect(libraryApi.toggleFavorite).toHaveBeenCalledWith("src-berserk", true);
    });
  });

  it("deve renderizar as abas incluindo a nova aba Galeria", async () => {
    const Component = Route.options.component as React.ComponentType;
    renderWithClient(<Component />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Detalhes/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Capítulos/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Conversões/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Galeria/i })).toBeInTheDocument();
    });
  });

  it("deve mudar para a aba Galeria ao disparar onChangeCover pelo botão na capa", async () => {
    const Component = Route.options.component as React.ComponentType;
    renderWithClient(<Component />);

    await waitFor(() => {
      expect(screen.getByText("Berserk")).toBeInTheDocument();
    });

    const changeCoverBtn = screen.getByRole("button", { name: "Trocar capa da obra" });
    expect(changeCoverBtn).toBeInTheDocument();

    fireEvent.click(changeCoverBtn);

    await waitFor(() => {
      const galeriaTab = screen.getByRole("tab", { name: /Galeria/i });
      expect(galeriaTab).toHaveAttribute("data-state", "active");
      expect(screen.getByText(/Galeria de Capas \(1\)/i)).toBeInTheDocument();
    });
  });
});
