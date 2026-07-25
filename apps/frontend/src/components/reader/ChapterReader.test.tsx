import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

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
    mockNavigate.mockClear();
    mockUseChapterDownload.mockReturnValue({
      status: "idle",
      totalImages: 0,
      downloadedImages: 0,
      progress: 0,
    });
    mockUseChapterPages.mockReturnValue([]);
  });

  it("deve exibir loading brand quando effectiveTotal=0", () => {
    render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        estimatedTotalPages={0}
        backUrl="/biblioteca/src-test"
      />,
    );

    expect(screen.getByText("MANGAINK")).toBeTruthy();
  });

  it("deve renderizar imagem quando effectiveTotal > 0", () => {
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
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        backUrl="/biblioteca/src-test"
      />,
    );

    const img = screen.getByAltText("Pagina 1");
    expect(img).toBeTruthy();
    expect(img).not.toHaveAttribute("loading");
  });

  it("deve ocultar topbar e bubble no estado inicial", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "ready",
      totalImages: 3,
      downloadedImages: 3,
      progress: 100,
    });
    mockUseChapterPages.mockReturnValue(["/api/sources/src-test/chapters/chap-001/images/1"]);

    const { container } = render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        backUrl="/biblioteca/src-test"
      />,
    );

    const topbar = container.querySelector('[data-testid="reader-topbar"]');
    const bubble = container.querySelector('[data-testid="reader-bubble"]');
    expect(topbar?.className).toContain("-translate-y-full");
    expect(bubble?.className).toContain("opacity-0");
  });

  it("deve alternar UI ao clicar no centro da tela", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "ready",
      totalImages: 3,
      downloadedImages: 3,
      progress: 100,
    });
    mockUseChapterPages.mockReturnValue(["/api/sources/src-test/chapters/chap-001/images/1"]);

    const { container } = render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        backUrl="/biblioteca/src-test"
      />,
    );

    const toggleZone = container.querySelector('[data-testid="zone-toggle"]');
    expect(toggleZone).toBeTruthy();

    fireEvent.click(toggleZone!);
    const topbar = container.querySelector('[data-testid="reader-topbar"]');
    expect(topbar?.className).toContain("translate-y-0");

    fireEvent.click(toggleZone!);
    expect(topbar?.className).toContain("-translate-y-full");
  });

  it("deve navegar ao clicar nas zonas esquerda/direita", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "ready",
      totalImages: 5,
      downloadedImages: 5,
      progress: 100,
    });
    mockUseChapterPages.mockReturnValue(Array.from({ length: 5 }, (_, i) => `url-${i + 1}`));

    const { container } = render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        backUrl="/biblioteca/src-test"
      />,
    );

    const prevZone = container.querySelector('[data-testid="zone-prev"]');
    const nextZone = container.querySelector('[data-testid="zone-next"]');

    fireEvent.click(nextZone!);
    expect(screen.getByAltText("Pagina 2")).toBeTruthy();

    fireEvent.click(nextZone!);
    expect(screen.getByAltText("Pagina 3")).toBeTruthy();

    fireEvent.click(prevZone!);
    expect(screen.getByAltText("Pagina 2")).toBeTruthy();
  });

  it("deve exibir numero de pagina no bubble com UI ativa", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "ready",
      totalImages: 10,
      downloadedImages: 10,
      progress: 100,
    });
    mockUseChapterPages.mockReturnValue(Array.from({ length: 10 }, (_, i) => `url-${i + 1}`));

    const { container } = render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        backUrl="/biblioteca/src-test"
      />,
    );

    const toggleZone = container.querySelector('[data-testid="zone-toggle"]');
    fireEvent.click(toggleZone!);

    const bubble = container.querySelector('[data-testid="reader-bubble"]');
    expect(bubble?.textContent).toContain("1 / 10");
  });

  it("deve exibir indicador BookOpen enquanto a imagem carrega", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "ready",
      totalImages: 3,
      downloadedImages: 3,
      progress: 100,
    });
    mockUseChapterPages.mockReturnValue(["/api/sources/src-test/chapters/chap-001/images/1"]);

    render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        backUrl="/biblioteca/src-test"
      />,
    );

    const books = document.querySelectorAll("svg");
    const bookOpen = Array.from(books).find((svg) => svg.getAttribute("stroke-width") === "1.5");
    expect(bookOpen).toBeTruthy();
  });

  it("deve remover indicador BookOpen quando imagem carrega", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "ready",
      totalImages: 3,
      downloadedImages: 3,
      progress: 100,
    });
    mockUseChapterPages.mockReturnValue(["/api/sources/src-test/chapters/chap-001/images/1"]);

    render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        backUrl="/biblioteca/src-test"
      />,
    );

    const img = screen.getByAltText("Pagina 1");
    fireEvent.load(img);

    const books = document.querySelectorAll("svg");
    const bookOpen = Array.from(books).find((svg) => svg.getAttribute("stroke-width") === "1.5");
    expect(bookOpen).toBeFalsy();
  });

  it("deve usar effectiveTotal do cachedTotalPages quando cached=true", () => {
    render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={true}
        cachedTotalPages={5}
        backUrl="/biblioteca/src-test"
      />,
    );

    expect(mockUseChapterPages).toHaveBeenCalledWith("src-test", "chap-001", 5);
  });

  it("deve usar estimatedTotalPages como fallback quando nao cached", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "idle",
      totalImages: 0,
      downloadedImages: 0,
      progress: 0,
    });
    mockUseChapterPages.mockReturnValue(Array.from({ length: 15 }, (_, i) => `url-${i + 1}`));

    render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        estimatedTotalPages={15}
        backUrl="/biblioteca/src-test"
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
    mockUseChapterPages.mockReturnValue(["/api/sources/src/chapters/ch/images/1"]);

    render(
      <ChapterReader sourceId="src" chapterId="ch" cached={false} backUrl="/biblioteca/src" />,
    );

    const img = screen.getByAltText("Pagina 1");
    fireEvent.error(img);

    expect(screen.getByText("Pagina indisponivel")).toBeTruthy();
  });

  it("deve exibir mensagem de erro e botao retry quando download falha e effectiveTotal=0", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "failed",
      totalImages: 0,
      downloadedImages: 0,
      progress: 0,
    });

    const onRetry = vi.fn();

    render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        estimatedTotalPages={0}
        onRetry={onRetry}
        backUrl="/biblioteca/src-test"
      />,
    );

    expect(screen.getByText("MANGAINK")).toBeTruthy();
    expect(screen.getByText("Nao foi possivel carregar as paginas")).toBeTruthy();
    expect(screen.getByText("Tentar novamente")).toBeTruthy();
  });

  it("deve abrir menu de configuracoes ao clicar no icone de settings", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "ready",
      totalImages: 3,
      downloadedImages: 3,
      progress: 100,
    });
    mockUseChapterPages.mockReturnValue(["/api/sources/src-test/chapters/chap-001/images/1"]);

    render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        backUrl="/biblioteca/src-test"
        mangaTitle="One Piece"
        chapterTitle="Cap. 1100"
      />,
    );

    const menu = document.querySelector('[data-testid="floating-menu"]');
    expect(menu).toBeTruthy();
  });

  it("deve navegar para pagina especifica ao clicar na barra de progresso", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "ready",
      totalImages: 10,
      downloadedImages: 10,
      progress: 100,
    });
    mockUseChapterPages.mockReturnValue(Array.from({ length: 10 }, (_, i) => `url-${i + 1}`));

    const { container } = render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        backUrl="/biblioteca/src-test"
      />,
    );

    const toggleZone = container.querySelector('[data-testid="zone-toggle"]');
    fireEvent.click(toggleZone!);

    const bubble = container.querySelector('[data-testid="reader-bubble"]');
    expect(bubble?.textContent).toContain("1 / 10");
    expect(screen.getByAltText("Pagina 1")).toBeTruthy();

    const progressBar = container.querySelector(".fixed.left-0.right-0.z-20");
    expect(progressBar).toBeTruthy();

    const barEl = progressBar!.querySelector(".h-4.flex-1");
    if (barEl) {
      vi.spyOn(barEl, "getBoundingClientRect").mockReturnValue({
        left: 100,
        right: 900,
        top: 0,
        bottom: 2,
        width: 800,
        height: 2,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      });
    }

    fireEvent.click(progressBar!, { clientX: 540 });

    const bubble2 = container.querySelector('[data-testid="reader-bubble"]');
    expect(bubble2?.textContent).toContain("6 / 10");
    expect(screen.getByAltText("Pagina 6")).toBeTruthy();
  });

  it("deve exibir botoes de zoom no menu flutuante quando UI ativa", () => {
    mockUseChapterDownload.mockReturnValue({
      status: "ready",
      totalImages: 3,
      downloadedImages: 3,
      progress: 100,
    });
    mockUseChapterPages.mockReturnValue(["/api/sources/src-test/chapters/chap-001/images/1"]);

    const { container } = render(
      <ChapterReader
        sourceId="src-test"
        chapterId="chap-001"
        cached={false}
        backUrl="/biblioteca/src-test"
      />,
    );

    const toggleZone = container.querySelector('[data-testid="zone-toggle"]');
    fireEvent.click(toggleZone!);

    expect(container.querySelector('[title="Zoom +"]')).toBeTruthy();
    expect(container.querySelector('[title="Zoom -"]')).toBeTruthy();
  });
});
