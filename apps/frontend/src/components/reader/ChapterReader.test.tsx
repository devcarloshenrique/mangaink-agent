import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockUseChapterDownload = vi.fn();
const mockUseChapterPages = vi.fn();

vi.mock("@/hooks/useChapterDownload", () => ({
  useChapterDownload: (...args: any[]) => mockUseChapterDownload(...args),
}));

vi.mock("@/hooks/useChapterPages", () => ({
  useChapterPages: (...args: any[]) => mockUseChapterPages(...args),
}));

import { ChapterReader } from "@/components/reader/ChapterReader";

describe("ChapterReader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChapterDownload.mockReturnValue({
      status: "idle",
      totalImages: 0,
      downloadedImages: 0,
      progress: 0,
    });
    mockUseChapterPages.mockReturnValue([]);
  });

  it("deve exibir Carregando quando effectiveTotal=0", () => {
    render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        estimatedTotalPages={0}
      />,
    );

    expect(screen.getByText("Carregando...")).toBeTruthy();
  });

  it("deve renderizar imagem quando status=ready", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "ready",
      totalImages: 3,
      downloadedImages: 3,
      progress: 100,
    });
    mockUseChapterPages.mockReturnValue([
      "/api/sources/src-test/chapters/chap-001/images/1",
      "/api/sources/src-test/chapters/chap-001/images/2",
      "/api/sources/src-test/chapters/chap-001/images/3",
    ]);

    render(
      <ChapterReader sourceId="src-test" chapterId="chap-001" cached={false} />,
    );

    const img = screen.getByAltText("Pagina 1");
    expect(img).toBeTruthy();
    expect(img).toHaveAttribute("loading", "lazy");
  });

  it("deve exibir barra de progresso quando status=downloading e totalImages > 0", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "downloading",
      totalImages: 10,
      downloadedImages: 5,
      progress: 50,
    });
    mockUseChapterPages.mockReturnValue(
      Array.from({ length: 10 }, (_, i) => `url-${i + 1}`),
    );

    render(
      <ChapterReader sourceId="src-test" chapterId="chap-001" cached={false} />,
    );

    expect(screen.getByText("Baixando paginas...")).toBeTruthy();
  });

  it("deve exibir botao Tentar novamente quando status=failed e effectiveTotal=0", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "failed",
      totalImages: 0,
      downloadedImages: 0,
      progress: 0,
    });

    render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        estimatedTotalPages={0}
        onRetry={vi.fn()}
      />,
    );

    // Quando effectiveTotal=0 e failed, mostra Carregando + botao Tentar novamente
    expect(screen.getByText("Carregando...")).toBeTruthy();
    expect(screen.getByText("Tentar novamente")).toBeTruthy();
  });

  it("deve usar effectiveTotal do cachedTotalPages quando cached=true", () => {
    render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={true}
        cachedTotalPages={5}
      />,
    );

    // Deve gerar pageUrls para 5 paginas
    expect(mockUseChapterPages).toHaveBeenCalledWith("src-test", "chap-001", 5);
  });

  it("deve usar estimatedTotalPages como fallback quando nao cached", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "idle",
      totalImages: 0,
      downloadedImages: 0,
      progress: 0,
    });
    mockUseChapterPages.mockReturnValue(
      Array.from({ length: 15 }, (_, i) => `url-${i + 1}`),
    );

    render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        estimatedTotalPages={15}
      />,
    );

    expect(mockUseChapterPages).toHaveBeenCalledWith("src-test", "chap-001", 15);
  });

  it("deve mostrar fallback quando imagem falha", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "ready",
      totalImages: 1,
      downloadedImages: 1,
      progress: 100,
    });
    mockUseChapterPages.mockReturnValue([
      "/api/sources/src/chapters/ch/images/1",
    ]);

    render(
      <ChapterReader sourceId="src" chapterId="ch" cached={false} />,
    );

    const img = screen.getByAltText("Pagina 1");
    fireEvent.error(img);

    expect(screen.getByText("Pagina indisponivel")).toBeTruthy();
  });
});
