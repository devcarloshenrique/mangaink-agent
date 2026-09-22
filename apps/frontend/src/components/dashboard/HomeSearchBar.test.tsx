import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeSearchBar } from "./HomeSearchBar";

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
});
