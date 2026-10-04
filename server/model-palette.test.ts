import { describe, expect, it } from "vitest";
import { MODEL_COLOR_PALETTE, nextModelColor, normalizeModelColor } from "../shared/model-palette";

describe("palette de couleurs des modèles", () => {
  it("génère automatiquement une couleur stable", () => {
    expect(nextModelColor(0)).toBe(MODEL_COLOR_PALETTE[0]);
    expect(nextModelColor(MODEL_COLOR_PALETTE.length)).toBe(MODEL_COLOR_PALETTE[0]);
  });
  it("accepte une couleur hexadécimale et remplace une valeur invalide", () => {
    expect(normalizeModelColor("#abcdef")).toBe("#abcdef");
    expect(normalizeModelColor("orange", "#27358f")).toBe("#27358f");
  });
});
