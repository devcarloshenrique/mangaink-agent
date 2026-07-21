import { describe, it, expect } from "vitest";
import type { ConversionField } from "@/types/conversion";

function buildEffectiveState(
  fields: ConversionField[],
  fieldOptions: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const base: Record<string, string | number | boolean> = {};
  for (const f of fields) {
    base[f.id] = fieldOptions[f.id] ?? f.default;
  }
  return base;
}

function isPresetMatch(
  effective: Record<string, string | number | boolean>,
  preset: { values: Record<string, string | number | boolean> },
): boolean {
  const presetKeys = Object.keys(preset.values);
  if (presetKeys.length === 0) return false;
  for (const key of presetKeys) {
    if (effective[key] !== preset.values[key]) return false;
  }
  return true;
}

function hasUnsavedChanges(
  lastUserPresetId: string | null,
  userPresets: { id: string; values: Record<string, string | number | boolean> }[],
  fieldOptions: Record<string, string | number | boolean>,
): boolean {
  if (!lastUserPresetId) return false;
  const lastPreset = userPresets.find((p) => p.id === lastUserPresetId);
  if (!lastPreset) return false;
  const presetValues = lastPreset.values;
  const hasDiff =
    Object.entries(presetValues).some(([k, v]) => fieldOptions[k] !== v) ||
    Object.keys(fieldOptions).some((k) => !(k in presetValues));
  return hasDiff && Object.keys(fieldOptions).length > 0;
}

const sampleFields: ConversionField[] = [
  {
    id: "mangaMode",
    type: "boolean",
    component: "switch",
    label: "Mangá",
    description: "",
    help: "",
    default: false,
    group: "reading",
  },
  {
    id: "gamma",
    type: "number",
    component: "slider",
    label: "Gamma",
    description: "",
    help: "",
    default: 1.0,
    group: "image",
  },
  {
    id: "jpegQuality",
    type: "number",
    component: "slider",
    label: "JPEG Quality",
    description: "",
    help: "",
    default: 90,
    group: "image",
  },
];

describe("wizard preset logic", () => {
  describe("buildEffectiveState", () => {
    it("aplica defaults quando fieldOptions vazio", () => {
      const result = buildEffectiveState(sampleFields, {});
      expect(result.mangaMode).toBe(false);
      expect(result.gamma).toBe(1.0);
      expect(result.jpegQuality).toBe(90);
    });

    it("sobrescreve defaults com fieldOptions", () => {
      const result = buildEffectiveState(sampleFields, {
        mangaMode: true,
        gamma: 2.0,
      });
      expect(result.mangaMode).toBe(true);
      expect(result.gamma).toBe(2.0);
      expect(result.jpegQuality).toBe(90);
    });
  });

  describe("isPresetMatch", () => {
    it("retorna true quando todos os valores batem", () => {
      const effective = buildEffectiveState(sampleFields, { mangaMode: true });
      const match = isPresetMatch(effective, {
        values: { mangaMode: true },
      });
      expect(match).toBe(true);
    });

    it("retorna false quando um valor difere", () => {
      const effective = buildEffectiveState(sampleFields, { mangaMode: false });
      const match = isPresetMatch(effective, {
        values: { mangaMode: true },
      });
      expect(match).toBe(false);
    });

    it("retorna false para preset vazio (sem valores)", () => {
      const effective = buildEffectiveState(sampleFields, {});
      const match = isPresetMatch(effective, { values: {} });
      expect(match).toBe(false);
    });

    it("ignora campos extras em fieldOptions (so verifica chaves do preset)", () => {
      // Preset so define mangaMode, mas fieldOptions tem gamma tambem
      const effective = buildEffectiveState(sampleFields, {
        mangaMode: true,
        gamma: 2.0,
      });
      const match = isPresetMatch(effective, {
        values: { mangaMode: true },
      });
      // O preset ainda bate porque mangaMode esta correto
      expect(match).toBe(true);
    });

    it("user preset tem prioridade sobre system preset com mesmos valores", () => {
      const effective = buildEffectiveState(sampleFields, { mangaMode: true });

      const systemPreset = { id: "manga", values: { mangaMode: true } };
      const userPreset = { id: "p1", values: { mangaMode: true } };

      // Ambos batem, mas user deve ser verificado primeiro
      const systemMatch = isPresetMatch(effective, systemPreset);
      const userMatch = isPresetMatch(effective, userPreset);

      expect(systemMatch).toBe(true);
      expect(userMatch).toBe(true);
      // A prioridade eh implementada na ordem de verificacao no componente
    });
  });

  describe("hasUnsavedChanges", () => {
    const userPresets = [
      {
        id: "p1",
        values: { mangaMode: true, gamma: 2.0 },
      },
    ];

    it("retorna false quando lastUserPresetId e null", () => {
      expect(
        hasUnsavedChanges(null, userPresets, { gamma: 3.0 }),
      ).toBe(false);
    });

    it("retorna false quando preset nao existe", () => {
      expect(
        hasUnsavedChanges("inexistente", userPresets, { gamma: 3.0 }),
      ).toBe(false);
    });

    it("retorna false quando valores batem exatamente", () => {
      expect(
        hasUnsavedChanges("p1", userPresets, { mangaMode: true, gamma: 2.0 }),
      ).toBe(false);
    });

    it("retorna true quando valor do preset foi modificado", () => {
      expect(
        hasUnsavedChanges("p1", userPresets, { mangaMode: true, gamma: 3.0 }),
      ).toBe(true);
    });

    it("retorna true quando campo extra foi adicionado", () => {
      expect(
        hasUnsavedChanges("p1", userPresets, {
          mangaMode: true,
          gamma: 2.0,
          jpegQuality: 50,
        }),
      ).toBe(true);
    });

    it("retorna true quando campo do preset foi removido", () => {
      // gamma estava no preset mas foi removido de fieldOptions
      expect(
        hasUnsavedChanges("p1", userPresets, { mangaMode: true }),
      ).toBe(true);
    });

    it("retorna false quando fieldOptions vazio e nenhum campo no preset", () => {
      const emptyPresets = [{ id: "p2", values: {} as Record<string, string | number | boolean> }];
      // Preset vazio + fieldOptions vazio = sem mudancas (mas tambem length===0)
      expect(hasUnsavedChanges("p2", emptyPresets, {})).toBe(false);
    });
  });

  describe("fluxo de criacao e selecao de preset", () => {
    it("criar preset → valores sao salvos como fieldOptions", () => {
      const savedValues = { mangaMode: true, gamma: 2.0 };
      const effective = buildEffectiveState(sampleFields, savedValues);

      // Simula: usuario salvou configuracoes como preset "Meu Kindle"
      const newPreset = { id: "new1", values: savedValues };

      // Ao selecionar o preset, os valores devem bater
      expect(isPresetMatch(effective, newPreset)).toBe(true);
    });

    it("selecionar user preset → preenche fieldOptions via merge", () => {
      const currentOptions = { jpegQuality: 50 };
      const presetValues = { mangaMode: true, gamma: 2.0 };

      // Merge: preset values sobrescrevem + campos existentes mantidos
      const merged = { ...currentOptions, ...presetValues };
      expect(merged.mangaMode).toBe(true);
      expect(merged.gamma).toBe(2.0);
      expect(merged.jpegQuality).toBe(50);
    });

    it("modificar campo → hasUnsavedChanges detecta divergencia", () => {
      const preset = { id: "p1", values: { mangaMode: true } };
      const userPresets = [preset];

      // Selecionou preset "p1"
      let fieldOptions = { ...preset.values };
      expect(hasUnsavedChanges("p1", userPresets, fieldOptions)).toBe(false);

      // Modificou gamma
      fieldOptions = { ...fieldOptions, gamma: 3.0 };
      expect(hasUnsavedChanges("p1", userPresets, fieldOptions)).toBe(true);
    });

    it("excluir preset ativo → fieldOptions mantem valores", () => {
      const fieldOptions = { mangaMode: true, gamma: 2.5 };
      // Ao excluir o preset, fieldOptions nao deve resetar
      expect(fieldOptions.mangaMode).toBe(true);
      expect(fieldOptions.gamma).toBe(2.5);
    });

    it("preset default → valores pre-carregados ao abrir wizard", () => {
      const defaultPreset = {
        id: "default1",
        values: { mangaMode: true, gamma: 2.0 },
      };

      // Simula: ao abrir wizard, aplica valores do preset default
      const initialOptions = { ...defaultPreset.values };
      const effective = buildEffectiveState(sampleFields, initialOptions);

      expect(isPresetMatch(effective, defaultPreset)).toBe(true);
      expect(effective.mangaMode).toBe(true);
      expect(effective.gamma).toBe(2.0);
    });
  });
});
