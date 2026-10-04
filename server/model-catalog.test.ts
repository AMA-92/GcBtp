import { describe, expect, it } from "vitest";
import { MODEL_CATALOG, mergeModelCatalog, modelColor, modelFamilies, modelSpec } from "../shared/model-catalog";

describe("catalogue Mes modèles DSRCAD", () => {
  it("contient les familles structurelles et les escaliers", () => {
    expect(modelFamilies()).toEqual(["Poteau (Rect)", "Poteau (Cir)", "Poutre", "Voile", "Longrine de redressement", "Semelle", "Plancher (Corps Creux)", "Plancher (Dalle BA)", "Escaliers"]);
    expect(MODEL_CATALOG).toHaveLength(11);
  });
  it("associe une couleur stable à chaque modèle", () => {
    expect(modelColor("Poteau", "Pot_20x30")).toBe("#27358f");
    expect(modelColor("Dalle", "Pl_E20")).toBe("#d92b2b");
    expect(modelSpec("Semelle", "S1")?.dimensions).toContain("1.00");
    expect(modelSpec("Escaliers", "Escalier BA 15 cm")?.dimensions).toContain("0.15");
    expect(modelSpec("Voile", "Voile_20cm")?.dimensions).toContain("0.20");
    expect(modelSpec("Longrine de redressement", "Longrine_20x40")?.dimensions).toContain("0.20");
  });
});

  it("fusionne les modèles personnalisés dans le catalogue visible", () => {
    const custom = { family: "Poutre", type: "Poutre", name: "Poutre_TEST", dimensions: "0.30 × 0.50", color: "#123456" } as const;
    const overridden = { family: "Poteau (Rect)", type: "Poteau", name: "Pot_20x30", dimensions: "0.25 × 0.35", color: "#abcdef" } as const;
    const merged = mergeModelCatalog([custom, overridden]);
    expect(merged.find(item => item.name === "Poutre_TEST")?.dimensions).toBe("0.30 × 0.50");
    expect(merged.filter(item => item.type === "Poteau" && item.name === "Pot_20x30")).toHaveLength(1);
    expect(merged.find(item => item.type === "Poteau" && item.name === "Pot_20x30")?.color).toBe("#abcdef");
  });
