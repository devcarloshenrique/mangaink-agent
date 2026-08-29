import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SpotlightCard } from "./SpotlightCard";
import type { SeriesGroup } from "@/hooks/useConversions";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const mockItems: SeriesGroup[] = [
  {
    sourceId: "src-manga-1",
    title: "Chainsaw Man",
    conversionCount: 3,
    lastActivity: new Date().toISOString(),
    status: "completed",
    items: [
      {
        conversionId: "conv-1",
        sourceId: "src-manga-1",
        title: "Chainsaw Man",
        status: "completed",
        progress: 100,
        totalJobs: 3,
        completedJobs: 3,
        failedJobs: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cover: { kind: "original" },
        output: { deviceId: "kindle", format: "EPUB" },
      },
    ],
  },
  {
    sourceId: "src-manga-2",
    title: "One Piece",
    conversionCount: 12,
    lastActivity: new Date().toISOString(),
    status: "completed",
    items: [
      {
        conversionId: "conv-2",
        sourceId: "src-manga-2",
        title: "One Piece",
        status: "completed",
        progress: 100,
        totalJobs: 12,
        completedJobs: 12,
        failedJobs: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cover: { kind: "original" },
        output: { deviceId: "kindle", format: "MOBI" },
      },
    ],
  },
];

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("SpotlightCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("não deve renderizar nada se a lista de itens estiver vazia", () => {
    const { container } = renderWithClient(<SpotlightCard items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("deve renderizar a obra inicial em destaque com dados reais, tags e botões", () => {
    renderWithClient(<SpotlightCard items={mockItems} />);

    expect(screen.getByText("MANGÁ")).toBeInTheDocument();
    expect(screen.getByText("Chainsaw Man")).toBeInTheDocument();
    expect(screen.getByText(/3 conversões/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Começar a ler/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver Detalhes/i })).toBeInTheDocument();
  });

  it("deve alternar a obra em destaque ao clicar nos botões de navegação", () => {
    renderWithClient(<SpotlightCard items={mockItems} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(1);

    // Clica no segundo indicador
    fireEvent.click(buttons[1]);

    expect(screen.getByText("One Piece")).toBeInTheDocument();
  });

  it("deve avançar automaticamente após 6 segundos", () => {
    renderWithClient(<SpotlightCard items={mockItems} />);

    expect(screen.getByText("Chainsaw Man")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6100);
    });

    expect(screen.getByText("One Piece")).toBeInTheDocument();
  });
});
