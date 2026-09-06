import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route } from "./index";
import { consolidateLibraryWithConversions } from "@/hooks/useConversions";

const mockUseConversionsList = vi.fn();
const mockUseLibrary = vi.fn();

vi.mock("@/hooks/useConversions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useConversions")>();
  return {
    ...actual,
    useConversionsList: () => mockUseConversionsList(),
  };
});

vi.mock("@/hooks/useLibrary", () => ({
  useLibrary: () => mockUseLibrary(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", username: "admin", email: "admin@mangaink.local" },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component: React.ComponentType }) => ({
    ...config,
    options: { component: config.component },
    component: config.component,
  }),
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("Dashboard Route (index.tsx)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLibrary.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
    });
  });

  it("deve renderizar skeleton quando estiver carregando conversões ou biblioteca", () => {
    mockUseConversionsList.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    mockUseLibrary.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    const Component = Route.options.component as React.ComponentType;
    const { container } = renderWithClient(<Component />);

    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("deve renderizar visão de onboarding/empty quando não houver conversões nem obras na biblioteca", () => {
    mockUseConversionsList.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
    });
    mockUseLibrary.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
    });

    const Component = Route.options.component as React.ComponentType;
    renderWithClient(<Component />);

    expect(screen.getByText(/Bem-vindo ao MangaInk/i)).toBeInTheDocument();
    expect(screen.getByText(/Converter meu primeiro mangá/i)).toBeInTheDocument();
    expect(screen.getByText(/Nada por aqui ainda/i)).toBeInTheDocument();
  });

  it("deve renderizar dashboard completo quando houver obras salvas na biblioteca mesmo com 0 conversões", () => {
    mockUseConversionsList.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
    });
    mockUseLibrary.mockReturnValue({
      data: {
        items: [
          {
            id: "lib-1",
            userId: "u-1",
            sourceId: "src-naruto",
            title: "Naruto",
            author: "Masashi Kishimoto",
            coverUrl: "https://example.com/naruto.jpg",
            chaptersCount: 700,
            isFavorite: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        total: 1,
      },
      isLoading: false,
    });

    const Component = Route.options.component as React.ComponentType;
    renderWithClient(<Component />);

    expect(screen.getAllByText("Naruto").length).toBeGreaterThan(0);
    expect(screen.getByText("Sua biblioteca")).toBeInTheDocument();
    expect(screen.getByText("Novos capítulos")).toBeInTheDocument();
    expect(screen.queryByText("Conversões")).not.toBeInTheDocument();
  });

  it("deve renderizar dashboard completo quando houver conversões", () => {
    mockUseConversionsList.mockReturnValue({
      data: {
        items: [
          {
            conversionId: "conv-1",
            sourceId: "src-1",
            title: "Berserk",
            status: "completed",
            progress: 100,
            totalJobs: 1,
            completedJobs: 1,
            failedJobs: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            cover: { kind: "original" },
            output: { deviceId: "kindle", format: "EPUB" },
          },
        ],
        total: 1,
      },
      isLoading: false,
    });
    mockUseLibrary.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
    });

    const Component = Route.options.component as React.ComponentType;
    renderWithClient(<Component />);

    expect(screen.getAllByText("Berserk").length).toBeGreaterThan(0);
    expect(screen.getByText("Sua biblioteca")).toBeInTheDocument();
    expect(screen.getByText("Novos capítulos")).toBeInTheDocument();
    expect(screen.queryByText("Conversões")).not.toBeInTheDocument();
  });
});
