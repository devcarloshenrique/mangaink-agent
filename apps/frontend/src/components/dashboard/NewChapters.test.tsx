import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewChapters } from "./NewChapters";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe("NewChapters", () => {
  it("deve renderizar a prateleira de novos capítulos com capas e botões de navegação", () => {
    render(<NewChapters />);

    expect(screen.getByText("Novos capítulos")).toBeInTheDocument();
    expect(screen.getByText(/lançamentos recentes/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver agenda/i })).toBeInTheDocument();

    expect(screen.getAllByText("One Piece").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jujutsu Kaisen").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chainsaw Man").length).toBeGreaterThan(0);

    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThan(0);

    const prevBtn = screen.getByRole("button", { name: /Rolar para a esquerda/i });
    const nextBtn = screen.getByRole("button", { name: /Rolar para a direita/i });
    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();
  });
});
