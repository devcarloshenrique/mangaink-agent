import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route } from "./biblioteca.index";
import { libraryApi, conversionsApi } from "@/lib/api";
import { setPreferredCover } from "@/lib/custom-covers";
import { toast } from "sonner";
import type { LibraryItemDTO } from "@mangaink/shared";
import type { SourceInspectResponse } from "@/types/scraping";

const mockUseLibrary = vi.fn();
const mockUseActiveConversions = vi.fn();
const mockUseConversionsList = vi.fn();
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

vi.mock("@/lib/api", () => ({
  libraryApi: {
    list: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    toggleFavorite: vi.fn(),
  },
  conversionsApi: {
    coverUrl: vi.fn(
      (sourceId: string, cover: { kind: string; coverId?: string; uploadId?: string }) => {
        if (cover.kind === "gallery") return `http://example.com/gallery/${cover.coverId}.jpg`;
        return "http://example.com/cover.jpg";
      },
    ),
    list: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/useLibrary", () => ({
  useLibrary: (opts?: unknown) => mockUseLibrary(opts),
}));

vi.mock("@/hooks/useConversions", () => ({
  useActiveConversions: () => mockUseActiveConversions(),
  useConversionsList: (opts?: unknown) => mockUseConversionsList(opts),
  groupConversionsBySource: () => [],
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component: React.ComponentType }) => ({
    ...config,
    options: { component: config.component },
    component: config.component,
  }),
  useNavigate: () => vi.fn(),
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string;
    params?: Record<string, string>;
    children: React.ReactNode;
  }) => {
    let href = to;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        href = href.replace(`$${k}`, v);
      }
    }
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("Biblioteca Index Route (biblioteca.index.tsx)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUseActiveConversions.mockReturnValue({ data: { items: [] } });
    mockUseConversionsList.mockReturnValue({ data: { items: [] } });
    mockScrapingState = {
      status: "idle",
      progress: 0,
      sourceId: null,
      metadata: null,
      message: null,
      error: null,
    };
  });

  it("deve exibir estado de carregamento quando isLoading for true", () => {
    mockUseLibrary.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const Component = Route.options.component as React.ComponentType;
    const { container } = renderWithClient(<Component />);

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("deve renderizar empty state amigável quando não houver obras na biblioteca", () => {
    mockUseLibrary.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
    });

    const Component = Route.options.component as React.ComponentType;
    renderWithClient(<Component />);

    expect(screen.getByText(/Nenhuma obra na sua biblioteca/i)).toBeInTheDocument();
    expect(screen.getByText(/Adicione uma colando o link acima/i)).toBeInTheDocument();
  });

  it("deve listar obras da biblioteca com capas, títulos, autores e quantidade de capítulos", () => {
    const mockItems: LibraryItemDTO[] = [
      {
        id: "lib-1",
        userId: "user-1",
        sourceId: "src-berserk",
        title: "Berserk",
        author: "Kentaro Miura",
        coverUrl: "http://example.com/berserk.jpg",
        chaptersCount: 364,
        isFavorite: true,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "lib-2",
        userId: "user-1",
        sourceId: "src-one-piece",
        title: "One Piece",
        author: "Eiichiro Oda",
        coverUrl: null,
        chaptersCount: 1100,
        isFavorite: false,
        createdAt: "2026-08-02T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
      },
    ];

    mockUseLibrary.mockReturnValue({
      data: { items: mockItems, total: 2 },
      isLoading: false,
    });

    const Component = Route.options.component as React.ComponentType;
    renderWithClient(<Component />);

    expect(screen.getByText("Berserk")).toBeInTheDocument();
    expect(screen.getByText("Kentaro Miura")).toBeInTheDocument();
    expect(screen.getByText(/364/)).toBeInTheDocument();

    expect(screen.getByText("One Piece")).toBeInTheDocument();
    expect(screen.getByText("Eiichiro Oda")).toBeInTheDocument();
    expect(screen.getByText(/1100/)).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    const berserkLink = links.find((l) => l.getAttribute("href") === "/biblioteca/src-berserk");
    expect(berserkLink).toBeDefined();
  });

  it("deve usar capa preferida para a obra na listagem da biblioteca", () => {
    setPreferredCover("src-berserk", {
      id: "cov-vol-10",
      type: "gallery",
      label: "Volume 10",
      imageUrl: "",
    });

    const mockItems: LibraryItemDTO[] = [
      {
        id: "lib-1",
        userId: "user-1",
        sourceId: "src-berserk",
        title: "Berserk",
        author: "Kentaro Miura",
        coverUrl: "http://example.com/berserk-original.jpg",
        chaptersCount: 364,
        isFavorite: false,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ];

    mockUseLibrary.mockReturnValue({
      data: { items: mockItems, total: 1 },
      isLoading: false,
    });

    const Component = Route.options.component as React.ComponentType;
    renderWithClient(<Component />);

    const img = screen.getByRole("img", { name: "Berserk" });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe("http://example.com/gallery/cov-vol-10.jpg");
  });

  it("deve filtrar por favoritos na tab de favoritos", () => {
    const mockItems: LibraryItemDTO[] = [
      {
        id: "lib-1",
        userId: "user-1",
        sourceId: "src-berserk",
        title: "Berserk",
        author: "Kentaro Miura",
        coverUrl: "http://example.com/berserk.jpg",
        chaptersCount: 364,
        isFavorite: true,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "lib-2",
        userId: "user-1",
        sourceId: "src-one-piece",
        title: "One Piece",
        author: "Eiichiro Oda",
        coverUrl: null,
        chaptersCount: 1100,
        isFavorite: false,
        createdAt: "2026-08-02T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
      },
    ];

    mockUseLibrary.mockReturnValue({
      data: { items: mockItems, total: 2 },
      isLoading: false,
    });

    const Component = Route.options.component as React.ComponentType;
    renderWithClient(<Component />);

    const favTab = screen.getByRole("button", { name: /Favoritos \(1\)/i });
    fireEvent.click(favTab);

    expect(screen.getByText("Berserk")).toBeInTheDocument();
    expect(screen.queryByText("One Piece")).not.toBeInTheDocument();
  });

  it("deve abrir o modal de adição de obra quando scraping estiver pronto", async () => {
    const mockScraped: SourceInspectResponse = {
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
        description: null,
        status: null,
        genres: ["Ação"],
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
      metadata: mockScraped,
      message: null,
      error: null,
    };

    mockUseLibrary.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
    });

    const Component = Route.options.component as React.ComponentType;
    renderWithClient(<Component />);

    const addBtn = screen.getByRole("button", { name: /Adicionar obra/i });
    fireEvent.click(addBtn);

    // Com o scraping em status 'ready', deve abrir o AddMangaDialog
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Adicionar obra" })).toBeInTheDocument();
    });
  });
});
