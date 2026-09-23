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

  it("exibe todos os provedores marcados por padrão e permite desmarcar via checkbox", () => {
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
    expect(mangalivreCheckbox).toBeChecked();

    fireEvent.click(mangalivreCheckbox);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        providers: expect.not.arrayContaining(["mangalivre"]),
      }),
    );
  });

  it("permite alternar filtros de velocidade de busca (Ultra Rápido, Rápido, Padrão)", () => {
    const handleChange = vi.fn();
    render(
      <SearchFilterDrawer
        filters={DEFAULT_FILTERS}
        onChange={handleChange}
        activeFilterCount={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filtro" }));

    const standardSpeedBtn = screen.getByRole("button", { name: /Filtro velocidade Padrão/i });
    expect(standardSpeedBtn).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(standardSpeedBtn);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        engines: expect.not.arrayContaining(["playwright"]),
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

  it("permite selecionar todos os provedores ou limpar seleção", () => {
    const handleChange = vi.fn();
    render(
      <SearchFilterDrawer
        filters={{ ...DEFAULT_FILTERS, providers: [] }}
        onChange={handleChange}
        activeFilterCount={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filtro" }));

    const selectAllBtn = screen.getByRole("button", { name: "Todos" });
    fireEvent.click(selectAllBtn);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        providers: expect.arrayContaining(["mangalivre", "imperiodabritannia"]),
      }),
    );

    const clearSelectionBtn = screen.getByRole("button", { name: "Limpar seleção" });
    fireEvent.click(clearSelectionBtn);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        providers: [],
      }),
    );
  });

  it("limpa todos os filtros quando clica em Limpar, restaurando padrão com todos marcados", () => {
    const handleChange = vi.fn();
    const activeFilters: SearchFilters = {
      language: "en",
      workTypes: ["manga"],
      engines: ["api"],
      providers: ["mangalivre"],
    };

    render(
      <SearchFilterDrawer filters={activeFilters} onChange={handleChange} activeFilterCount={3} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filtro" }));

    const clearButton = screen.getByRole("button", { name: "Limpar" });
    fireEvent.click(clearButton);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "en", // preserva o idioma escolhido no seletor
        workTypes: [],
        engines: ["api", "cheerio", "playwright"],
        providers: expect.arrayContaining(["mangalivre", "imperiodabritannia"]),
      }),
    );
  });
});
