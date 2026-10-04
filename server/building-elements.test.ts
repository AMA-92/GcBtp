import { describe, expect, it } from "vitest";
import { moveElement, removeElement, updateElement, type LevelRecord } from "../shared/building-elements";

const levels: LevelRecord[] = [
  { id: "rdc", label: "RDC", elevation: "0.00", elements: [{ id: "P1", type: "Poteau", section: "20×30", x: 1, y: 2 }] },
  { id: "r1", label: "R+1", elevation: "3.20", elements: [] },
];

describe("éléments de niveau", () => {
  it("modifie une section et une position", () => {
    const result = updateElement(levels, "rdc", { ...levels[0].elements[0], section: "25×35", x: 4, y: 5 });
    expect(result[0].elements[0]).toMatchObject({ section: "25×35", x: 4, y: 5 });
  });

  it("supprime un élément", () => {
    expect(removeElement(levels, "rdc", "P1")[0].elements).toHaveLength(0);
  });

  it("déplace un élément vers un autre niveau", () => {
    const result = moveElement(levels, "rdc", "r1", "P1");
    expect(result[0].elements).toHaveLength(0);
    expect(result[1].elements[0]).toMatchObject({ id: "P1", section: "20×30" });
  });

  it("permet de supprimer chaque famille d’élément sélectionnable", () => {
    const families = ["Dalle", "Poutre", "Poteau", "Semelle"];
    for (const type of families) {
      const source = [{ id: `${type}-1`, type, section: "modèle", x: 0, y: 0 }];
      expect(removeElement([{ ...levels[0], elements: source }], "rdc", `${type}-1`)[0].elements).toHaveLength(0);
    }
  });
});
