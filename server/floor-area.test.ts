import { describe, expect, it } from "vitest";
import { findClosedFloorArea } from "../shared/floor-area";

describe("détection des espaces fermés de plancher", () => {
  it("détecte le rectangle entre quatre poteaux", () => {
    const area = findClosedFloorArea([
      { type: "Poteau", x: 1, y: 1 },
      { type: "Poteau", x: 3, y: 1 },
      { type: "Poteau", x: 1, y: 2 },
      { type: "Poteau", x: 3, y: 2 },
    ], 1, 1);
    expect(area).toEqual({ x: 1, y: 1, x2: 3, y2: 2, direction: "Y" });
  });

  it("ne produit aucune dalle sans quatre poteaux", () => {
    expect(findClosedFloorArea([{ type: "Poteau", x: 1, y: 1 }], 1, 1)).toBeNull();
  });
});
