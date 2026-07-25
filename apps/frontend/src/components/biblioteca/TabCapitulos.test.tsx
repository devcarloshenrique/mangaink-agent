import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock do Chapter (não tem router real no teste)
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

import { TabCapitulos } from "@/components/biblioteca/TabCapitulos";

const makeChapter = (overrides: Partial<any> = {}) => ({
  id: "chap_0001",
  number: "1",
  title: "Capítulo 1",
  url: "https://test.com/ch/1",
  pages: 20,
  volume: null,
  isDownloaded: false,
  ...overrides,
});

describe("TabCapitulos", () => {
  const onDownloadRequest = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve renderizar capitulos com badges isDownloaded", () => {
    const chapters = [
      makeChapter({ id: "ch1", number: "1", title: "Cap 1", isDownloaded: true }),
      makeChapter({ id: "ch2", number: "2", title: "Cap 2", isDownloaded: false }),
    ];

    render(
      <TabCapitulos
        chapters={chapters}
        sourceId="src-test"
        onDownloadRequest={onDownloadRequest}
      />,
    );

    expect(screen.getByText("Cap 1")).toBeTruthy();
    expect(screen.getByText("Cap 2")).toBeTruthy();
  });

  it("deve exibir mensagem quando lista vazia", () => {
    render(
      <TabCapitulos chapters={[]} sourceId="src-test" onDownloadRequest={onDownloadRequest} />,
    );

    expect(screen.getByText("Nenhum capitulo disponivel.")).toBeTruthy();
  });

  it("deve filtrar capitulos por numero na barra de pesquisa", () => {
    const chapters = [
      makeChapter({ id: "ch1", number: "10", title: "Capitulo Dez" }),
      makeChapter({ id: "ch2", number: "20", title: "Capitulo Vinte" }),
    ];

    render(
      <TabCapitulos
        chapters={chapters}
        sourceId="src-test"
        onDownloadRequest={onDownloadRequest}
      />,
    );

    const input = screen.getByPlaceholderText("Buscar por título...");
    fireEvent.change(input, { target: { value: "10" } });

    // highlightMatch pode quebrar o texto — verifica que "10" está visivel
    expect(screen.getByText((c) => c.includes("10"))).toBeTruthy();
    expect(screen.queryByText((c) => c.includes("Vinte"))).toBeNull();
    expect(screen.getByText("1 de 2 capítulos")).toBeTruthy();
  });

  it("deve exibir mensagem de nenhum resultado quando filtro nao encontra", () => {
    const chapters = [makeChapter({ id: "ch1", number: "1", title: "Cap 1" })];

    render(
      <TabCapitulos
        chapters={chapters}
        sourceId="src-test"
        onDownloadRequest={onDownloadRequest}
      />,
    );

    const input = screen.getByPlaceholderText("Buscar por título...");
    fireEvent.change(input, { target: { value: "inexistente" } });

    expect(screen.getByText(/Nenhum capítulo encontrado/)).toBeTruthy();
  });

  it("deve filtrar capitulos por titulo", () => {
    const chapters = [
      makeChapter({ id: "ch1", number: "1", title: "O Inicio" }),
      makeChapter({ id: "ch2", number: "2", title: "O Fim" }),
    ];

    render(
      <TabCapitulos
        chapters={chapters}
        sourceId="src-test"
        onDownloadRequest={onDownloadRequest}
      />,
    );

    const input = screen.getByPlaceholderText("Buscar por título...");
    fireEvent.change(input, { target: { value: "Inicio" } });

    // highlightMatch gera <mark>Inicio</mark> — verifica que o mark existe
    const marks = document.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].textContent).toBe("Inicio");
    expect(screen.queryByText("O Fim")).toBeNull();
  });
});
