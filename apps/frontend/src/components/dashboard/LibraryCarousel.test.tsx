import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LibraryCarousel } from "./LibraryCarousel";
import { conversionsApi } from "@/lib/api";
import { setPreferredCover, PREFERRED_COVERS_KEY } from "@/lib/custom-covers";
import type { SeriesGroup } from "@/hooks/useConversions";

const mockedLiveProgress = vi.hoisted(() => new Map<string, { overall: number }>());

vi.mock("@/hooks/useLiveConversionProgress", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useLiveConversionProgress")>();
  return {
    ...actual,
    useLiveConversionProgress: (ids: string[]) => {
      const map = new Map<
        string,
        {
          overall: number;
          done: boolean;
          downloadOnly: boolean;
          chaptersDone: number;
          chaptersTotal: number;
          chaptersFailed: number;
        }
      >();
      for (const id of ids) {
        const live = mockedLiveProgress.get(id);
        if (live) {
          map.set(id, {
            overall: live.overall,
            done: false,
            downloadOnly: false,
            chaptersDone: 0,
            chaptersTotal: 0,
            chaptersFailed: 0,
          });
        }
      }
      return map;
    },
  };
});

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
  beforeEach(() => {
    localStorage.removeItem(PREFERRED_COVERS_KEY);
    mockedLiveProgress.clear();
    vi.restoreAllMocks();
  });

  it("não deve renderizar se items estiver vazio", () => {
    const { container } = renderWithClient(<LibraryCarousel items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("deve renderizar a prateleira da biblioteca com contagem de obras e botões de navegação", () => {
    renderWithClient(<LibraryCarousel items={mockItems} />);

    expect(screen.getByText("Sua biblioteca")).toBeInTheDocument();
    expect(screen.getByText("20 obras na coleção")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver tudo/i })).toBeInTheDocument();

    // Deve exibir todas as obras disponíveis na prateleira dentro do overlay
    expect(screen.getByText("Manga 1")).toBeInTheDocument();
    expect(screen.getByText("Manga 6")).toBeInTheDocument();

    const prevBtn = screen.getByRole("button", { name: /Rolar para a esquerda/i });
    const nextBtn = screen.getByRole("button", { name: /Rolar para a direita/i });
    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();
  });

  it("deve renderizar a obra com título e informações do overlay sem descrição e sem tags externas de volume", () => {
    const singleItem: SeriesGroup = {
      sourceId: "src-single-lib",
      title: "Hunter x Hunter",
      conversionCount: 0,
      lastActivity: new Date().toISOString(),
      status: "completed",
      items: [],
    };

    renderWithClient(<LibraryCarousel items={[singleItem]} />);

    expect(screen.getByText("Hunter x Hunter")).toBeInTheDocument();
    expect(screen.getByText("Autor desconhecido")).toBeInTheDocument();
    expect(screen.getByText("0 capítulos")).toBeInTheDocument();
    expect(screen.queryByText(/0 volumes/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Na biblioteca")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Acesse seus volumes convertidos e continue a leitura na biblioteca."),
    ).not.toBeInTheDocument();
  });

  it("deve renderizar todas as obras se a coleção tiver 5 ou menos", () => {
    renderWithClient(<LibraryCarousel items={mockItems.slice(0, 3)} />);

    expect(screen.getByText("3 obras na coleção")).toBeInTheDocument();
    expect(screen.getByText("Manga 1")).toBeInTheDocument();
    expect(screen.getByText("Manga 2")).toBeInTheDocument();
    expect(screen.getByText("Manga 3")).toBeInTheDocument();
  });

  it("deve chamar conversionsApi.coverUrl com { kind: 'original' } quando preferredCover não estiver definido mesmo se a conversão do grupo tiver capa customizada", () => {
    const coverUrlSpy = vi.spyOn(conversionsApi, "coverUrl");
    const itemWithCustomCover: SeriesGroup = {
      sourceId: "src-custom-group",
      title: "Custom Manga",
      conversionCount: 1,
      lastActivity: new Date().toISOString(),
      status: "completed",
      items: [
        {
          conversionId: "conv-custom",
          sourceId: "src-custom-group",
          title: "Custom Manga",
          status: "completed",
          progress: 100,
          totalJobs: 1,
          completedJobs: 1,
          failedJobs: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cover: { kind: "gallery", coverId: "cov-custom" },
          output: { deviceId: "kindle", format: "EPUB" },
        },
      ],
    };

    renderWithClient(<LibraryCarousel items={[itemWithCustomCover]} />);

    expect(coverUrlSpy).toHaveBeenCalledWith("src-custom-group", { kind: "original" });
  });

  it("deve chamar conversionsApi.coverUrl com a capa preferida quando preferredCover estiver definido", () => {
    const coverUrlSpy = vi.spyOn(conversionsApi, "coverUrl");
    const preferred = { kind: "gallery" as const, coverId: "cov-preferred" };
    setPreferredCover("src-custom-pref", preferred);

    const item: SeriesGroup = {
      sourceId: "src-custom-pref",
      title: "Preferred Manga",
      conversionCount: 1,
      lastActivity: new Date().toISOString(),
      status: "completed",
      items: [
        {
          conversionId: "conv-1",
          sourceId: "src-custom-pref",
          title: "Preferred Manga",
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
    };

    renderWithClient(<LibraryCarousel items={[item]} />);

    expect(coverUrlSpy).toHaveBeenCalledWith("src-custom-pref", preferred);
  });

  it("deve renderizar badges de conversão ativa (formato, pulsando), porcentagem e barra de progresso quando item possuir conversão em andamento", () => {
    mockedLiveProgress.set("conv-active-1", { overall: 68.4 });

    const activeItem: SeriesGroup = {
      sourceId: "src-active-manga",
      title: "Chainsaw Man",
      conversionCount: 1,
      lastActivity: new Date().toISOString(),
      status: "active",
      items: [
        {
          conversionId: "conv-active-1",
          sourceId: "src-active-manga",
          title: "Chainsaw Man",
          status: "processing",
          progress: 0,
          totalJobs: 1,
          completedJobs: 0,
          failedJobs: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cover: { kind: "original" },
          output: { deviceId: "kindle", format: "MOBI" },
        },
      ],
    };

    renderWithClient(<LibraryCarousel items={[activeItem]} />);

    // Badges superiores
    expect(screen.getByText("MOBI")).toBeInTheDocument();
    expect(screen.getByText(/CONVERTENDO$/)).toBeInTheDocument();

    // Pílula de progresso
    expect(screen.getByText("Convertendo...")).toBeInTheDocument();
    expect(screen.getByText("68%")).toBeInTheDocument();

    // Overlay de hover
    expect(screen.getByText(/⚡ Conversão em andamento \(68%\)/i)).toBeInTheDocument();
  });

  it("deve renderizar status 'Na fila...' se conversão ativa estiver queued", () => {
    const queuedItem: SeriesGroup = {
      sourceId: "src-queued-manga",
      title: "Jujutsu Kaisen",
      conversionCount: 1,
      lastActivity: new Date().toISOString(),
      status: "active",
      items: [
        {
          conversionId: "conv-queued-1",
          sourceId: "src-queued-manga",
          title: "Jujutsu Kaisen",
          status: "queued",
          progress: 0,
          totalJobs: 1,
          completedJobs: 0,
          failedJobs: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cover: { kind: "original" },
          output: { deviceId: "kindle", format: "EPUB" },
        },
      ],
    };

    renderWithClient(<LibraryCarousel items={[queuedItem]} />);

    expect(screen.getByText("EPUB")).toBeInTheDocument();
    expect(screen.getByText("Na fila...")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("deve renderizar status 'Baixando...' se conversão ativa estiver processing e progresso for 0%", () => {
    mockedLiveProgress.set("conv-proc-0", { overall: 0 });

    const procItem: SeriesGroup = {
      sourceId: "src-proc-manga",
      title: "Bleach",
      conversionCount: 1,
      lastActivity: new Date().toISOString(),
      status: "active",
      items: [
        {
          conversionId: "conv-proc-0",
          sourceId: "src-proc-manga",
          title: "Bleach",
          status: "processing",
          progress: 0,
          totalJobs: 1,
          completedJobs: 0,
          failedJobs: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cover: { kind: "original" },
          output: { deviceId: "kindle", format: "EPUB" },
        },
      ],
    };

    renderWithClient(<LibraryCarousel items={[procItem]} />);

    expect(screen.getByText("EPUB")).toBeInTheDocument();
    expect(screen.getByText("Baixando...")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
