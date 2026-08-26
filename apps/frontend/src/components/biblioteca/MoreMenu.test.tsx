import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Download, Trash2, BookOpen } from "lucide-react";
import { MoreMenu, type MoreMenuItem } from "@/components/biblioteca/MoreMenu";

describe("MoreMenu", () => {
  it("deve renderizar itens e disparar onClick ao selecionar", () => {
    const onDownload = vi.fn();
    const onClose = vi.fn();
    const items: MoreMenuItem[] = [{ icon: Download, label: "Baixar", onClick: onDownload }];

    render(<MoreMenu items={items} onClose={onClose} />);

    const itemBtn = screen.getByRole("menuitem", { name: /baixar/i });
    expect(itemBtn).toBeInTheDocument();

    fireEvent.click(itemBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it("não deve disparar onClick para itens desabilitados", () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    const items: MoreMenuItem[] = [
      { icon: Download, label: "Indisponível", disabled: true, onClick },
    ];

    render(<MoreMenu items={items} onClose={onClose} />);

    const itemBtn = screen.getByRole("menuitem", { name: /indisponível/i });
    expect(itemBtn).toBeDisabled();

    fireEvent.click(itemBtn);
    expect(onClick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("deve fechar ao pressionar a tecla Escape", () => {
    const onClose = vi.fn();
    render(
      <MoreMenu items={[{ icon: Download, label: "Item", onClick: vi.fn() }]} onClose={onClose} />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("deve fechar ao clicar fora do menu", () => {
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">Fora</div>
        <MoreMenu items={[{ icon: Download, label: "Item", onClick: vi.fn() }]} onClose={onClose} />
      </div>,
    );

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("não deve disparar onClose ao clicar em um trigger com aria-haspopup", () => {
    const onClose = vi.fn();
    render(
      <div>
        <button type="button" aria-haspopup="menu" data-testid="trigger">
          Menu Trigger
        </button>
        <MoreMenu items={[{ icon: Download, label: "Item", onClick: vi.fn() }]} onClose={onClose} />
      </div>,
    );

    fireEvent.mouseDown(screen.getByTestId("trigger"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("deve focar automaticamente o primeiro item habilitado", () => {
    const items: MoreMenuItem[] = [
      { icon: Download, label: "Desabilitado", disabled: true, onClick: vi.fn() },
      { icon: BookOpen, label: "Primeiro Habilitado", onClick: vi.fn() },
    ];

    render(<MoreMenu items={items} onClose={vi.fn()} />);

    const enabledBtn = screen.getByRole("menuitem", { name: /primeiro habilitado/i });
    expect(enabledBtn).toHaveFocus();
  });

  it("deve navegar entre botões com as setas ArrowDown e ArrowUp", () => {
    const items: MoreMenuItem[] = [
      { icon: Download, label: "Primeiro", onClick: vi.fn() },
      { icon: Trash2, label: "Segundo", onClick: vi.fn() },
    ];

    render(<MoreMenu items={items} onClose={vi.fn()} />);

    const firstBtn = screen.getByRole("menuitem", { name: /primeiro/i });
    const secondBtn = screen.getByRole("menuitem", { name: /segundo/i });

    expect(firstBtn).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(secondBtn).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    expect(firstBtn).toHaveFocus();
  });
});
