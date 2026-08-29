import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route } from "./index";
import type { ConversionSummary } from "@/types/conversion";
import type { SeriesGroup } from "@/hooks/useConversions";

const mockUseConversionsList = vi.fn();

vi.mock("@/hooks/useConversions", () => ({
  useConversionsList: () => mockUseConversionsList(),
  groupConversionsBySource: (items: ConversionSummary[]): SeriesGroup[] => {
    if (!items || items.length === 0) return [];
    const map = new Map<string, SeriesGroup>();
    for (const item of items) {
      const entry = map.get(item.sourceId);
      if (entry) entry.items.push(item);
      else
        map.set(item.sourceId, {
          sourceId: item.sourceId,
          title: item.title,
          items: [item],
          conversionCount: 1,
          lastActivity: item.updatedAt,
          status: "completed",
        });
    }
    return Array.from(map.values());
  },
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
  });

  it("deve renderizar skeleton quando estiver carregando", () => {
    mockUseConversionsList.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const Component = Route.options.component as React.ComponentType;
    const { container } = renderWithClient(<Component />);

    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("deve renderizar visão de onboarding/empty quando não houver conversões", () => {
    mockUseConversionsList.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
    });

    const Component = Route.options.component as React.ComponentType;
    renderWithClient(<Component />);

    expect(screen.getByText(/Bem-vindo ao MangaInk/i)).toBeInTheDocument();
    expect(screen.getByText(/Converter meu primeiro mangá/i)).toBeInTheDocument();
    expect(screen.getByText(/Nada por aqui ainda/i)).toBeInTheDocument();
  });

  it("deve renderizar dashboard completo quando houver obras na biblioteca", () => {
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

    const Component = Route.options.component as React.ComponentType;
    renderWithClient(<Component />);

    expect(screen.getAllByText("Berserk").length).toBeGreaterThan(0);
    expect(screen.getByText("Sua biblioteca")).toBeInTheDocument();
    expect(screen.getByText("Novos capítulos")).toBeInTheDocument();
    expect(screen.getByText("Conversões")).toBeInTheDocument();
  });
});
