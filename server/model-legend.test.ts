import { describe, expect, it } from "vitest";
import { buildModelLegend, modelLegendText } from "../shared/model-legend";

describe("légende des modèles", () => {
  it("déduplique les sections utilisées et conserve leurs couleurs", () => {
    const legend = buildModelLegend([{ type: "Poteau", section: "Pot_20x30" }, { type: "Poteau", section: "Pot_20x30" }, { type: "Dalle", section: "Pl_E20", color: "#d92b2b" }]);
    expect(legend).toHaveLength(2);
    expect(legend[0].color).toBe("#27358f");
    expect(legend[1].color).toBe("#d92b2b");
  });
  it("produit une légende lisible pour le rapport", () => {
    const text = modelLegendText([{ type: "Semelle", section: "S1", color: "#7620a8" }]);
    expect(text).toContain("Semelle");
    expect(text).toContain("S1");
    expect(text).toContain("#7620a8");
  });
});
