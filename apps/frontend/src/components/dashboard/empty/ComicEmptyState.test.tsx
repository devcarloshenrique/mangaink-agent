import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComicEmptyState } from "./ComicEmptyState";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe("ComicEmptyState", () => {
  it("deve renderizar emoji, título e mensagem sem botão quando ctaTo/ctaLabel ausentes", () => {
    render(
      <ComicEmptyState
        emoji="📦"
        title="Nenhum item"
        text="Você ainda não adicionou nenhum item."
      />,
    );

    expect(screen.getByText("📦")).toBeInTheDocument();
    expect(screen.getByText("Nenhum item")).toBeInTheDocument();
    expect(screen.getByText("Você ainda não adicionou nenhum item.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("deve renderizar botão CTA quando ctaTo e ctaLabel informados", () => {
    render(
      <ComicEmptyState
        emoji="⚡"
        title="Começar"
        text="Clique para converter"
        ctaTo="/wizard"
        ctaLabel="Iniciar conversão"
      />,
    );

    const cta = screen.getByRole("link", { name: /Iniciar conversão/i });
    expect(cta).toBeInTheDocument();
    expect(cta.getAttribute("href")).toBe("/wizard");
  });
});
