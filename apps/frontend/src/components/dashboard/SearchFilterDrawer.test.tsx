import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchFilterDrawer } from "./SearchFilterDrawer";
import { DEFAULT_FILTERS, SearchFilters } from "./search-filter.types";

describe("SearchFilterDrawer", () => {
  it("renderiza o botão Filtro com acessibilidade", () => {
    render(
      <SearchFilterDrawer filters={DEFAULT_FILTERS} onChange={vi.fn()} activeFilterCount={0} />,
    );

    const button = screen.getByRole("button", { name: "Filtro" });
    expect(button).toBeInTheDocument();
    expect(screen.queryByTestId("filter-badge")).not.toBeInTheDocument();
  });

  it("exibe badge numérico quando activeFilterCount > 0", () => {
    render(
      <SearchFilterDrawer
        filters={{ ...DEFAULT_FILTERS, workTypes: ["manhwa"] }}
        onChange={vi.fn()}
        activeFilterCount={1}
      />,
    );

    const badge = screen.getByTestId("filter-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("1");
  });

  it("permite alternar tipos de obra", () => {
    const handleChange = vi.fn();
    render(
      <SearchFilterDrawer
        filters={DEFAULT_FILTERS}
        onChange={handleChange}
        activeFilterCount={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filtro" }));

    const manhwaBtn = screen.getByRole("button", { name: "Manhwa" });
    fireEvent.click(manhwaBtn);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        workTypes: ["manhwa"],
      }),
    );
  });

  it("permite filtrar a lista de provedores pela busca interna", () => {
    render(
      <SearchFilterDrawer filters={DEFAULT_FILTERS} onChange={vi.fn()} activeFilterCount={0} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filtro" }));

    const searchInput = screen.getByPlaceholderText("Filtrar por nome ou tag...");
    fireEvent.change(searchInput, { target: { value: "mangalivre" } });

    expect(screen.getByText("MangaLivre")).toBeInTheDocument();
    expect(screen.queryByText("Webtoon XYZ")).not.toBeInTheDocument();
  });

  it("permite selecionar provedores via checkbox", () => {
    const handleChange = vi.fn();
    render(
      <SearchFilterDrawer
        filters={DEFAULT_FILTERS}
        onChange={handleChange}
        activeFilterCount={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filtro" }));

    const mangalivreCheckbox = screen.getByLabelText(/Selecionar provedor MangaLivre/i);
    fireEvent.click(mangalivreCheckbox);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        providers: expect.arrayContaining(["mangalivre"]),
      }),
    );
  });

  it("seleciona apenas provedores PT-BR na ação rápida", () => {
    const handleChange = vi.fn();
    render(
      <SearchFilterDrawer
        filters={DEFAULT_FILTERS}
        onChange={handleChange}
        activeFilterCount={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filtro" }));

    const ptBrQuickAction = screen.getByRole("button", { name: "Apenas PT-BR" });
    fireEvent.click(ptBrQuickAction);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        providers: expect.arrayContaining(["mangalivre", "imperiodabritannia", "mangasbrasuka"]),
      }),
    );
  });

  it("altera a ordenação para alfabética", () => {
    const handleChange = vi.fn();
    render(
      <SearchFilterDrawer
        filters={DEFAULT_FILTERS}
        onChange={handleChange}
        activeFilterCount={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filtro" }));

    const alphaSortBtn = screen.getByRole("button", { name: /Alfabética \(A-Z\)/i });
    fireEvent.click(alphaSortBtn);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: "alphabetical",
      }),
    );
  });

  it("limpa todos os filtros quando clica em Limpar", () => {
    const handleChange = vi.fn();
    const activeFilters: SearchFilters = {
      language: "en",
      workTypes: ["manga"],
      providers: ["mangalivre"],
      sortBy: "alphabetical",
    };

    render(
      <SearchFilterDrawer filters={activeFilters} onChange={handleChange} activeFilterCount={3} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filtro" }));

    const clearButton = screen.getByRole("button", { name: "Limpar" });
    fireEvent.click(clearButton);

    expect(handleChange).toHaveBeenCalledWith({
      language: "en", // preserva o idioma escolhido no seletor
      workTypes: [],
      providers: [],
      sortBy: "relevance",
    });
  });
});
