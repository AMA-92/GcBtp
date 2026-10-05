import { describe, expect, it } from "vitest";
import { elementLabel, renumberBuildingElements, renumberElements } from "../shared/element-labels";

describe("repères d’éléments DSRCAD", () => {
  it("numérote chaque famille avec le préfixe attendu", () => {
    const elements = [{ type: "Poteau" }, { type: "Poutre" }, { type: "Semelle" }, { type: "Dalle" }];
    expect(elementLabel(elements, "Poteau")).toBe("P2");
    expect(elementLabel(elements, "Poutre")).toBe("B2");
    expect(elementLabel(elements, "Semelle")).toBe("S2");
    expect(elementLabel(elements, "Dalle")).toBe("PL2");
    expect(elementLabel([], "Balcon")).toBe("BAL1");
  });

  it("compacte les repères de semelles en S1, S2, S3", () => {
    const elements = [{ id: "S2", type: "Semelle" }, { id: "S4", type: "Semelle" }, { id: "P1", type: "Poteau" }];
    expect(renumberElements(elements).map(element => element.id)).toEqual(["S1", "S2", "P1"]);
  });

  it("continue les nomenclatures entre niveaux sans doublon", () => {
    const levels = [{ elements: [{ id: "S8", type: "Semelle" }, { id: "P9", type: "Poteau" }, { id: "B4", type: "Poutre" }] }, { elements: [{ id: "S2", type: "Semelle" }, { id: "P1", type: "Poteau" }, { id: "PL1", type: "Dalle" }] }];
    expect(renumberBuildingElements(levels).map(level => level.elements.map(element => element.id))).toEqual([["S1", "P1", "B1"], ["S2", "P2", "PL1"]]);
  });

  it("normalise les noms d’éléments provenant d’un import externe", () => {
    const levels = [{ elements: [{ id: "beam-1", type: "Poutre BA" }, { id: "floor-1", type: "Plancher corps creux" }, { id: "col-1", type: "Column" }] }];
    const normalized = renumberBuildingElements(levels)[0].elements;
    expect(normalized.map(element => element.type)).toEqual(["Poutre", "Dalle", "Poteau"]);
    expect(normalized.map(element => element.id)).toEqual(["B1", "PL1", "P1"]);
  });

  it("normalise le balcon importé comme une famille de surface autonome", () => {
    const normalized = renumberElements([{ id: "balcony-8", type: "Balcony" }]);
    expect(normalized[0]).toMatchObject({ id: "BAL1", type: "Balcon" });
  });
});
