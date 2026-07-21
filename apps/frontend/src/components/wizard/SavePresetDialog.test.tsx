import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SavePresetDialog } from "@/components/wizard/SavePresetDialog";
import type { UserPresetResponse } from "@/types/conversion";

const basePreset: UserPresetResponse = {
  id: "p1",
  name: "Meu Kindle",
  description: "Config Kindle",
  values: { mangaMode: true, gamma: 2.0 },
  isDefault: false,
  lastUsedAt: null,
  usageCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("SavePresetDialog", () => {
  it("valida nome obrigatorio — botao Salvar fica disabled quando nome vazio", () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <SavePresetDialog
        open={true}
        onOpenChange={onOpenChange}
        onSave={onSave}
        fieldOptions={{ mangaMode: true }}
        mode="create"
        existingNames={[]}
      />,
    );

    const saveBtn = screen.getByRole("button", { name: "Salvar" });
    expect(saveBtn).toBeDisabled();
  });

  it("rejeita nome duplicado com feedback inline", () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <SavePresetDialog
        open={true}
        onOpenChange={onOpenChange}
        onSave={onSave}
        fieldOptions={{}}
        mode="create"
        existingNames={["Meu Kindle"]}
      />,
    );

    const input = screen.getByPlaceholderText("Ex: Meu Kindle");
    fireEvent.change(input, { target: { value: "Meu Kindle" } });

    expect(screen.getByText("Nome ja existe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("permite nome diferente mesmo com outro preset de nome similar", () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <SavePresetDialog
        open={true}
        onOpenChange={onOpenChange}
        onSave={onSave}
        fieldOptions={{}}
        mode="create"
        existingNames={["Meu Kindle"]}
      />,
    );

    const input = screen.getByPlaceholderText("Ex: Meu Kindle");
    fireEvent.change(input, { target: { value: "Outro Nome" } });

    expect(screen.queryByText("Nome ja existe")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).not.toBeDisabled();
  });

  it("exibe resumo de fieldOptions", () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <SavePresetDialog
        open={true}
        onOpenChange={onOpenChange}
        onSave={onSave}
        fieldOptions={{ mangaMode: true, gamma: 2.0, jpegQuality: 85 }}
        mode="create"
        existingNames={[]}
      />,
    );

    expect(screen.getByText(/3 campos/)).toBeInTheDocument();
    expect(screen.getByText(/mangaMode/)).toBeInTheDocument();
    expect(screen.getByText(/gamma/)).toBeInTheDocument();
  });

  it("chama onSave com dados corretos ao submeter", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <SavePresetDialog
        open={true}
        onOpenChange={onOpenChange}
        onSave={onSave}
        fieldOptions={{ gamma: 2.0 }}
        mode="create"
        existingNames={[]}
      />,
    );

    const input = screen.getByPlaceholderText("Ex: Meu Kindle");
    fireEvent.change(input, { target: { value: "Novo Preset" } });

    const descInput = screen.getByPlaceholderText(
      "Ex: Configuracao otimizada para Kindle",
    );
    fireEvent.change(descInput, { target: { value: "Desc" } });

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        name: "Novo Preset",
        description: "Desc",
        values: { gamma: 2.0 },
        isDefault: true,
      });
    });
  });

  it("modo editar pre-preenche nome e descricao", () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <SavePresetDialog
        open={true}
        onOpenChange={onOpenChange}
        onSave={onSave}
        fieldOptions={{ gamma: 2.0 }}
        mode="edit"
        existingPreset={basePreset}
        existingNames={["Meu Kindle"]}
      />,
    );

    const input = screen.getByPlaceholderText("Ex: Meu Kindle") as HTMLInputElement;
    expect(input.value).toBe("Meu Kindle");

    expect(screen.getByText("Editar Preset")).toBeInTheDocument();
  });

  it("fecha ao clicar Cancelar", () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <SavePresetDialog
        open={true}
        onOpenChange={onOpenChange}
        onSave={onSave}
        fieldOptions={{}}
        mode="create"
        existingNames={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
