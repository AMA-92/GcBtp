import { describe, expect, it } from "vitest";
import { groupReinforcementElements } from "../shared/reinforcement-report";
import type { RCElementDesign } from "../shared/rc-design";

const element = (id: string, type: RCElementDesign["type"], bars: number): RCElementDesign => ({
  elementId: id,
  type,
  combinationId: "ULS1",
  combinationName: "ELU",
  checks: [],
  limitations: [],
  reinforcement: [{
    id: `${id}:longitudinal`, label: "Longitudinales", diameterMm: 12, count: bars,
    areaMm2: bars * 113, requiredAreaMm2: bars * 100, lengthPerBarM: 3, totalLengthM: bars * 3, massKg: bars * 3 * 0.888,
  }],
});

describe("regroupement des plans de ferraillage", () => {
  it("regroupe les poteaux de même section et conserve tous les repères", () => {
    const result = groupReinforcementElements(
      [element("P1", "column", 4), element("P5", "column", 4), element("P8", "column", 4), element("P10", "column", 4)],
      {
        P1: "Section : 150 × 150 mm · longueur 3 200 mm",
        P5: "Section : 150 × 150 mm · longueur 3 200 mm",
        P8: "Section : 150 × 150 mm · longueur 3 200 mm",
        P10: "Section : 150 × 150 mm · longueur 3 200 mm",
      },
    );
    expect(result).toHaveLength(1);
    expect(result[0].elements.map(item => item.elementId)).toEqual(["P1", "P5", "P8", "P10"]);
    expect(result[0].identicalReinforcement).toBe(true);
  });

  it("crée une fiche distincte lorsque la même section possède un ferraillage différent", () => {
    const result = groupReinforcementElements(
      [element("P1", "column", 4), element("P2", "column", 6)],
      {
        P1: "Section : 150 × 150 mm · longueur 3 200 mm",
        P2: "Section : 150 × 150 mm · longueur 3 200 mm",
      },
    );
    expect(result).toHaveLength(2);
    expect(result[0].elements).toHaveLength(1);
    expect(result[1].elements).toHaveLength(1);
  });

  it("sépare deux sections différentes", () => {
    const result = groupReinforcementElements(
      [element("P1", "column", 4), element("P2", "column", 6)],
      {
        P1: "Section : 150 × 150 mm · longueur 3 200 mm",
        P2: "Section : 200 × 200 mm · longueur 3 200 mm",
      },
    );
    expect(result).toHaveLength(2);
  });
});


describe("plans A4 représentatifs", () => {
  it("produit trois fiches représentatives pour trois sections de poteaux", () => {
    const result = groupReinforcementElements(
      [element("P1", "column", 4), element("P2", "column", 4), element("P3", "column", 4), element("P11", "column", 6), element("P12", "column", 6), element("P18", "column", 8)],
      {
        P1: "Section : 150 × 150 mm · longueur 3 200 mm", P2: "Section : 150 × 150 mm · longueur 3 200 mm", P3: "Section : 150 × 150 mm · longueur 3 200 mm",
        P11: "Section : 200 × 200 mm · longueur 3 200 mm", P12: "Section : 200 × 200 mm · longueur 3 200 mm",
        P18: "Section : 300 × 300 mm · longueur 3 200 mm",
      },
    );
    expect(result).toHaveLength(3);
    expect(result.map(group => group.elements.length)).toEqual([3, 2, 1]);
    expect(result[0].representative.elementId).toBe("P1");
  });
});
