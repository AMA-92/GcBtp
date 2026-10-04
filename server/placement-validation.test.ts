import { describe, expect, it } from "vitest";
import { canCoLocate, canPlaceBeamBetween, canPlaceTieBeamBetween, hasPostAt, hasSimilarElementAt } from "../shared/placement-validation";

describe("régression du placement tactile", () => {
  const posts = [{ type: "Poteau", x: 1, y: 1 }, { type: "Poteau", x: 3, y: 1 }, { type: "Semelle", x: 1, y: 1 }];

  it("autorise semelle et poteau au même point", () => {
    expect(canCoLocate("Semelle")).toBe(true);
    expect(canCoLocate("Poteau")).toBe(true);
    expect(hasPostAt(posts, 1, 1)).toBe(true);
    expect(hasSimilarElementAt([{ type: "Poteau", x: 1, y: 1 }], { type: "Semelle", x: 1, y: 1 })).toBe(false);
    expect(hasSimilarElementAt([{ type: "Semelle", x: 1, y: 1 }], { type: "Poteau", x: 1, y: 1 })).toBe(false);
  });

  it("valide le tracé entre deux intersections, même sans poteaux", () => {
    expect(canPlaceBeamBetween(posts, { x: 1, y: 1 }, { x: 3, y: 1 })).toBe(true);
    expect(canPlaceBeamBetween(posts, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(true);
    expect(canPlaceBeamBetween(posts, { x: 2, y: 2 }, { x: 2, y: 2 })).toBe(false);
  });

  it("exige deux semelles distinctes pour une longrine de redressement", () => {
    const foundations = [
      { type: "Semelle", x: 1, y: 1 }, { type: "Semelle", x: 3, y: 1 },
      { type: "Poteau", x: 1, y: 1 }, { type: "Poteau", x: 3, y: 1 },
    ];
    expect(canPlaceTieBeamBetween(foundations, { x: 1, y: 1 }, { x: 3, y: 1 })).toBe(true);
    expect(canPlaceTieBeamBetween(foundations, { x: 1, y: 1 }, { x: 2, y: 1 })).toBe(false);
    expect(canPlaceTieBeamBetween([{ type: "Semelle", x: 1, y: 1 }, { type: "Semelle", x: 3, y: 1 }], { x: 1, y: 1 }, { x: 3, y: 1 })).toBe(false);
    expect(canPlaceTieBeamBetween(foundations, { x: 1, y: 1 }, { x: 1, y: 1 })).toBe(false);
  });

  it("rejette les superpositions similaires par famille", () => {
    const elements = [
      { type: "Semelle", x: 1, y: 1 },
      { type: "Poteau", x: 2, y: 2 },
      { type: "Poutre", x: 0, y: 0, x2: 3, y2: 0 },
      { type: "Dalle", x: 0, y: 0, x2: 2, y2: 2 },
    ];
    expect(hasSimilarElementAt(elements, { type: "Semelle", x: 1, y: 1 })).toBe(true);
    expect(hasSimilarElementAt(elements, { type: "Poteau", x: 2, y: 2 })).toBe(true);
    expect(hasSimilarElementAt(elements, { type: "Poutre", x: 3, y: 0, x2: 0, y2: 0 })).toBe(true);
    expect(hasSimilarElementAt(elements, { type: "Dalle", x: 1, y: 1, x2: 3, y2: 3 })).toBe(true);
    expect(hasSimilarElementAt(elements, { type: "Dalle", x: 3, y: 3, x2: 4, y2: 4 })).toBe(false);
  });
});
