import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LibraryCarousel } from "./LibraryCarousel";
import type { SeriesGroup } from "@/hooks/useConversions";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const mockItems: SeriesGroup[] = Array.from({ length: 20 }, (_, i) => ({
  sourceId: `src-manga-${i + 1}`,
  title: `Manga ${i + 1}`,
  conversionCount: i + 1,
  lastActivity: new Date().toISOString(),
  status: "completed",
  items: [
    {
      conversionId: `conv-${i + 1}`,
      sourceId: `src-manga-${i + 1}`,
      title: `Manga ${i + 1}`,
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
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("LibraryCarousel", () => {
  it("não deve renderizar se items estiver vazio", () => {
    const { container } = renderWithClient(<LibraryCarousel items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("deve renderizar a prateleira da biblioteca com contagem de obras e botões de navegação", () => {
    renderWithClient(<LibraryCarousel items={mockItems} />);

    expect(screen.getByText("Sua biblioteca")).toBeInTheDocument();
    expect(screen.getByText("20 obras na coleção")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver tudo/i })).toBeInTheDocument();

    // Deve exibir todas as obras disponíveis na prateleira
    expect(screen.getAllByText("Manga 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manga 6").length).toBeGreaterThan(0);

    const prevBtn = screen.getByRole("button", { name: /Rolar para a esquerda/i });
    const nextBtn = screen.getByRole("button", { name: /Rolar para a direita/i });
    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();
  });

  it("deve renderizar todas as obras se a coleção tiver 5 ou menos", () => {
    renderWithClient(<LibraryCarousel items={mockItems.slice(0, 3)} />);

    expect(screen.getByText("3 obras na coleção")).toBeInTheDocument();
    expect(screen.getAllByText("Manga 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manga 2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manga 3").length).toBeGreaterThan(0);
  });
});
