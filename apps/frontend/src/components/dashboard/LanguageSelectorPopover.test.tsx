import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageSelectorPopover } from "./LanguageSelectorPopover";

describe("LanguageSelectorPopover", () => {
  it("renderiza o botão exibindo somente o código do idioma selecionado (sem bandeira)", () => {
    render(<LanguageSelectorPopover value="pt-br" onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: /Idioma: Português/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("PT-BR");
    // Garante que não há texto extra de bandeira tipo "BR PT-BR"
    expect(trigger.textContent?.trim()).toBe("PT-BR");
  });

  it("abre o balão clean ao clicar no botão disparador", () => {
    render(<LanguageSelectorPopover value="pt-br" onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: /Idioma: Português/i });
    fireEvent.click(trigger);

    expect(screen.getByText("Todos os Idiomas")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Buscar idioma/i)).toBeInTheDocument();
  });

  it("permite selecionar Todos os Idiomas (all)", () => {
    const handleChange = vi.fn();
    render(<LanguageSelectorPopover value="pt-br" onChange={handleChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Idioma: Português/i }));

    const allBtn = screen.getByRole("button", { name: /Todos os Idiomas/i });
    fireEvent.click(allBtn);

    expect(handleChange).toHaveBeenCalledWith("all");
  });

  it("permite filtrar a lista de idiomas pelo campo de busca", () => {
    render(<LanguageSelectorPopover value="pt-br" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Idioma: Português/i }));

    const searchInput = screen.getByPlaceholderText(/Buscar idioma/i);
    fireEvent.change(searchInput, { target: { value: "coreano" } });

    expect(screen.getByText("Coreano")).toBeInTheDocument();
    expect(screen.queryByText("Alemão")).not.toBeInTheDocument();
  });

  it("seleciona um idioma da lista e notifica onChange", () => {
    const handleChange = vi.fn();
    render(<LanguageSelectorPopover value="pt-br" onChange={handleChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Idioma: Português/i }));

    const japaneseBtn = screen.getByRole("button", { name: /Japonês/i });
    fireEvent.click(japaneseBtn);

    expect(handleChange).toHaveBeenCalledWith("ja");
  });
});
