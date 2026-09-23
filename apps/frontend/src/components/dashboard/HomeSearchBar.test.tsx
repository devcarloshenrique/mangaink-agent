import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeSearchBar } from "./HomeSearchBar";
import { DEFAULT_FILTERS, SearchFilters } from "./search-filter.types";

describe("HomeSearchBar", () => {
  it("renderiza o input de busca com placeholder correto", () => {
    render(<HomeSearchBar query="" onChange={vi.fn()} isFetching={false} />);

    const input = screen.getByRole("textbox", { name: "Buscar mangá" });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Buscar mangá — ex.: one piece");
  });

  it("chama onChange ao digitar no campo de busca", () => {
    const handleChange = vi.fn();
    render(<HomeSearchBar query="" onChange={handleChange} isFetching={false} />);

    const input = screen.getByRole("textbox", { name: "Buscar mangá" });
    fireEvent.change(input, { target: { value: "one piece" } });

    expect(handleChange).toHaveBeenCalledWith("one piece");
  });

  it("exibe botão de limpar quando há texto na query e limpa ao clicar", () => {
    const handleChange = vi.fn();
    render(<HomeSearchBar query="bleach" onChange={handleChange} isFetching={false} />);

    const clearButton = screen.getByRole("button", { name: "Limpar busca" });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(handleChange).toHaveBeenCalledWith("");
  });

  it("limpa a busca ao pressionar a tecla Escape", () => {
    const handleChange = vi.fn();
    render(<HomeSearchBar query="berserk" onChange={handleChange} isFetching={false} />);

    const input = screen.getByRole("textbox", { name: "Buscar mangá" });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(handleChange).toHaveBeenCalledWith("");
  });

  it("não dispara onChange com Escape se a query já estiver vazia", () => {
    const handleChange = vi.fn();
    render(<HomeSearchBar query="" onChange={handleChange} isFetching={false} />);

    const input = screen.getByRole("textbox", { name: "Buscar mangá" });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(handleChange).not.toHaveBeenCalled();
  });

  it("exibe spinner de loading quando isFetching for true", () => {
    const { container } = render(
      <HomeSearchBar query="naruto" onChange={vi.fn()} isFetching={true} />,
    );

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("não exibe botão de limpar quando a query estiver vazia", () => {
    render(<HomeSearchBar query="" onChange={vi.fn()} isFetching={false} />);

    expect(screen.queryByRole("button", { name: "Limpar busca" })).not.toBeInTheDocument();
  });

  it("renderiza o seletor de idioma dentro do input com valor padrão PT-BR", () => {
    render(<HomeSearchBar query="" onChange={vi.fn()} isFetching={false} />);

    const langTrigger = screen.getByRole("button", { name: /Idioma: Português/i });
    expect(langTrigger).toBeInTheDocument();
    expect(langTrigger.textContent?.trim()).toBe("PT-BR");
  });

  it("permite alterar o idioma e notifica via onFiltersChange", () => {
    const handleFiltersChange = vi.fn();
    render(
      <HomeSearchBar
        query=""
        onChange={vi.fn()}
        isFetching={false}
        filters={DEFAULT_FILTERS}
        onFiltersChange={handleFiltersChange}
      />,
    );

    const langTrigger = screen.getByRole("button", { name: /Idioma: Português/i });
    fireEvent.click(langTrigger);

    const englishOption = screen.getByRole("button", { name: /Inglês/i });
    expect(englishOption).toBeInTheDocument();
    fireEvent.click(englishOption);

    expect(handleFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "en",
      }),
    );
  });

  it("renderiza o botão externo de Filtro ao lado do input", () => {
    render(<HomeSearchBar query="" onChange={vi.fn()} isFetching={false} />);

    const filterButton = screen.getByRole("button", { name: "Filtro" });
    expect(filterButton).toBeInTheDocument();
  });

  it("exibe o badge com a contagem de filtros ativos no botão de filtro", () => {
    const activeFilters: SearchFilters = {
      language: "pt-br",
      workTypes: ["manga", "manhwa"],
      engines: ["api"],
      providers: ["mangalivre"],
    };

    render(
      <HomeSearchBar query="" onChange={vi.fn()} isFetching={false} filters={activeFilters} />,
    );

    const badge = screen.getByTestId("filter-badge");
    expect(badge).toBeInTheDocument();
    // 2 workTypes + 1 engine restrita + 1 provider restrito = 4
    expect(badge).toHaveTextContent("4");
  });

  it("não exibe o badge de filtros quando todos os filtros estão no padrão", () => {
    render(
      <HomeSearchBar query="" onChange={vi.fn()} isFetching={false} filters={DEFAULT_FILTERS} />,
    );

    expect(screen.queryByTestId("filter-badge")).not.toBeInTheDocument();
  });

  it("abre a gaveta de filtros ao clicar no botão Filtro", () => {
    render(<HomeSearchBar query="" onChange={vi.fn()} isFetching={false} />);

    const filterButton = screen.getByRole("button", { name: "Filtro" });
    fireEvent.click(filterButton);

    expect(screen.getByText("Filtros de Busca")).toBeInTheDocument();
    expect(screen.getByText("Tipo de Obra")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Filtrar por nome ou tag...")).toBeInTheDocument();
  });
});
