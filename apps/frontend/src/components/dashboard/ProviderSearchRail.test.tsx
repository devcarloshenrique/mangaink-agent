import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderSearchRail } from "./ProviderSearchRail";
import type { ProviderSearchResult, SearchSourcesResponse } from "@/types/scraping";

const mockResults: ProviderSearchResult[] = Array.from({ length: 10 }, (_, i) => ({
  providerSlug: "mangadex",
  title: `Manga ${i + 1}`,
  url: `https://example.com/manga/${i + 1}`,
  coverUrl: `https://example.com/cover/${i + 1}.jpg`,
}));

describe("ProviderSearchRail", () => {
  const defaultProps = {
    slug: "mangadex",
    title: "MangaDex",
    engine: "api" as const,
    results: mockResults,
    query: "naruto",
    onLoadMore: vi.fn(),
    addingUrl: null,
    inspectFailed: false,
    inspectError: null,
    onAdd: vi.fn(),
  };

  it("renderiza o cabeçalho com título, badge da engine e contagem de resultados", () => {
    render(<ProviderSearchRail {...defaultProps} />);

    expect(screen.getByText("MangaDex")).toBeInTheDocument();
    expect(screen.getByText("10 resultados")).toBeInTheDocument();
    expect(screen.getByText("Ver mais")).toBeInTheDocument();
  });

  it("renderiza os cards de resultado no modo trilho horizontal", () => {
    render(<ProviderSearchRail {...defaultProps} />);

    expect(screen.getByText("Manga 1")).toBeInTheDocument();
    expect(screen.getByText("Manga 10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar Manga 1" })).toBeInTheDocument();
  });

  it("alterna entre modo trilho e modo expandido (grade)", () => {
    render(<ProviderSearchRail {...defaultProps} />);

    const toggleButton = screen.getByText("Ver mais");
    fireEvent.click(toggleButton);

    expect(screen.getByText("Ver menos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /carregar mais obras/i })).toBeInTheDocument();

    fireEvent.click(screen.getByText("Ver menos"));
    expect(screen.getByText("Ver mais")).toBeInTheDocument();
  });

  it("chama onLoadMore e anexa novos itens ao clicar em carregar mais no modo expandido", async () => {
    const onLoadMore = vi.fn().mockResolvedValueOnce({
      query: "naruto",
      results: [
        {
          providerSlug: "mangadex",
          title: "Manga 11",
          url: "https://example.com/manga/11",
          coverUrl: null,
        },
      ],
      errors: [],
      searchedProviders: ["mangadex"],
      truncated: false,
    } as SearchSourcesResponse);

    render(<ProviderSearchRail {...defaultProps} onLoadMore={onLoadMore} />);

    fireEvent.click(screen.getByText("Ver mais"));

    const loadMoreButton = screen.getByRole("button", { name: /carregar mais obras/i });
    fireEvent.click(loadMoreButton);

    expect(onLoadMore).toHaveBeenCalledWith("mangadex", 10, 10, expect.any(AbortSignal));

    await waitFor(() => {
      expect(screen.getByText("Manga 11")).toBeInTheDocument();
      expect(screen.getByText("11 resultados")).toBeInTheDocument();
    });
  });

  it("exibe mensagem de erro e permite tentar novamente se onLoadMore falhar", async () => {
    const onLoadMore = vi.fn().mockRejectedValueOnce(new Error("Timeout de rede"));

    render(<ProviderSearchRail {...defaultProps} onLoadMore={onLoadMore} />);

    fireEvent.click(screen.getByText("Ver mais"));

    const loadMoreButton = screen.getByRole("button", { name: /carregar mais obras/i });
    fireEvent.click(loadMoreButton);

    await waitFor(() => {
      expect(screen.getByText("Timeout de rede")).toBeInTheDocument();
      expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
    });
  });

  it("chama onAdd ao clicar em um card", () => {
    const onAdd = vi.fn();
    render(<ProviderSearchRail {...defaultProps} onAdd={onAdd} />);

    const cardButton = screen.getByRole("button", { name: "Adicionar Manga 1" });
    fireEvent.click(cardButton);

    expect(onAdd).toHaveBeenCalledWith("https://example.com/manga/1");
  });

  it("renderiza a imagem de capa com referrerPolicy no-referrer", () => {
    render(<ProviderSearchRail {...defaultProps} />);

    const img = screen.getByAltText("Capa de Manga 1");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("referrerPolicy", "no-referrer");
  });

  it("faz fallback para cover-proxy quando onError é acionado na imagem direta", () => {
    render(
      <ProviderSearchRail
        {...defaultProps}
        results={[
          {
            providerSlug: "mangakakalot",
            title: "Naruto",
            url: "https://example.com/manga/naruto",
            coverUrl: "https://img-r1.2xstorage.com/thumb/naruto.webp",
          },
        ]}
      />,
    );

    const img = screen.getByAltText("Capa de Naruto") as HTMLImageElement;
    expect(img.src).toBe("https://img-r1.2xstorage.com/thumb/naruto.webp");

    fireEvent.error(img);

    expect(img.src).toContain("/api/conversions/source/cover-proxy");
    expect(img.src).toContain("mangakakalot");

    // Se falhar novamente no proxy, exibe 'Sem capa'
    fireEvent.error(img);
    expect(screen.getByText("Sem capa")).toBeInTheDocument();
  });
});
