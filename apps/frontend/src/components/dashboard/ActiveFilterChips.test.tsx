import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActiveFilterChips } from "./ActiveFilterChips";
import { ALL_ENGINES, ALL_WORK_TYPES, DEFAULT_FILTERS, SearchFilters } from "./search-filter.types";
import type { ProviderRecord } from "@/types/scraping";

const MOCK_PROVIDERS: ProviderRecord[] = [
  {
    slug: "p1",
    name: "P1",
    engine: "api",
    tags: ["pt-br"],
    status: "active",
    homepage: null,
    rateLimit: { maxConcurrent: 6, minTime: 50, reservoir: null, reservoirRefreshInterval: null },
  },
  {
    slug: "p2",
    name: "P2",
    engine: "cheerio",
    tags: ["pt-br"],
    status: "active",
    homepage: null,
    rateLimit: { maxConcurrent: 6, minTime: 50, reservoir: null, reservoirRefreshInterval: null },
  },
];

describe("ActiveFilterChips", () => {
  it("não renderiza nada quando os filtros estão nos valores padrão", () => {
    const { container } = render(
      <ActiveFilterChips
        filters={{ ...DEFAULT_FILTERS, providers: ["p1", "p2"] }}
        onChange={vi.fn()}
        providers={MOCK_PROVIDERS}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza chip de fontes quando há restrição de provedores e permite resetar", () => {
    const handleChange = vi.fn();
    render(
      <ActiveFilterChips
        filters={{ ...DEFAULT_FILTERS, providers: ["p1"] }}
        onChange={handleChange}
        providers={MOCK_PROVIDERS}
      />,
    );

    expect(screen.getByText("Fontes: 1/2")).toBeInTheDocument();

    const removeBtn = screen.getByRole("button", { name: /remover filtro fontes/i });
    fireEvent.click(removeBtn);

    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ providers: ["p1", "p2"] }));
  });

  it("renderiza chip de velocidade quando há restrição de engines e permite resetar", () => {
    const handleChange = vi.fn();
    render(
      <ActiveFilterChips
        filters={{ ...DEFAULT_FILTERS, engines: ["api"], providers: ["p1", "p2"] }}
        onChange={handleChange}
        providers={MOCK_PROVIDERS}
      />,
    );

    expect(screen.getByText("Velocidade: 1/3")).toBeInTheDocument();

    const removeBtn = screen.getByRole("button", { name: /remover filtro velocidade/i });
    fireEvent.click(removeBtn);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ engines: [...ALL_ENGINES] }),
    );
  });

  it("renderiza chip de tipo quando há restrição de workTypes e permite resetar", () => {
    const handleChange = vi.fn();
    render(
      <ActiveFilterChips
        filters={{ ...DEFAULT_FILTERS, workTypes: ["manga"], providers: ["p1", "p2"] }}
        onChange={handleChange}
        providers={MOCK_PROVIDERS}
      />,
    );

    expect(screen.getByText("Tipo: 1/5")).toBeInTheDocument();

    const removeBtn = screen.getByRole("button", { name: /remover filtro tipo/i });
    fireEvent.click(removeBtn);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ workTypes: [...ALL_WORK_TYPES] }),
    );
  });

  it("renderiza chip de idioma quando diferente de pt-br", () => {
    const handleChange = vi.fn();
    render(
      <ActiveFilterChips
        filters={{ ...DEFAULT_FILTERS, language: "en", providers: ["p1", "p2"] }}
        onChange={handleChange}
        providers={MOCK_PROVIDERS}
      />,
    );

    expect(screen.getByText("Idioma: EN")).toBeInTheDocument();

    const removeBtn = screen.getByRole("button", { name: /remover filtro idioma/i });
    fireEvent.click(removeBtn);

    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ language: "pt-br" }));
  });

  it("exibe botão Limpar tudo quando há múltiplos filtros ativos", () => {
    const handleChange = vi.fn();
    render(
      <ActiveFilterChips
        filters={{
          ...DEFAULT_FILTERS,
          engines: ["api"],
          workTypes: ["manga"],
          providers: ["p1", "p2"],
        }}
        onChange={handleChange}
        providers={MOCK_PROVIDERS}
      />,
    );

    const clearAllBtn = screen.getByRole("button", { name: "Limpar tudo" });
    expect(clearAllBtn).toBeInTheDocument();

    fireEvent.click(clearAllBtn);
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        engines: [...ALL_ENGINES],
        workTypes: [...ALL_WORK_TYPES],
        providers: ["p1", "p2"],
      }),
    );
  });
});
