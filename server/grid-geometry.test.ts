import { describe, expect, it } from "vitest";
import { gridRectangle, isGridIntersection, normalizeGridSegment, snapToGridPoint } from "../shared/grid-geometry";

describe("géométrie de la grille de trame", () => {
  it("accepte uniquement les intersections existantes", () => {
    expect(isGridIntersection({ x: 2, y: 1 }, 4, 3)).toBe(true);
    expect(isGridIntersection({ x: 4, y: 1 }, 4, 3)).toBe(false);
    expect(isGridIntersection({ x: 1.5, y: 1 }, 4, 3)).toBe(false);
  });

  it("conserve les deux points d’une poutre", () => {
    expect(normalizeGridSegment({ x: 0, y: 1 }, { x: 3, y: 1 })).toEqual({ x: 0, y: 1, x2: 3, y2: 1 });
  });

  it("normalise une dalle en rectangle quel que soit l’ordre des clics", () => {
    expect(gridRectangle({ x: 3, y: 2 }, { x: 1, y: 0 })).toEqual({ x: 1, y: 0, width: 2, height: 2 });
  });

  it("accroche un toucher proche à l’intersection attendue", () => {
    expect(snapToGridPoint(99, 201, [0, 100, 220], [0, 200], 8)).toEqual({ x: 1, y: 1 });
  });

  it("rejette un toucher trop éloigné au lieu de choisir un autre point", () => {
    expect(snapToGridPoint(150, 150, [0, 100, 220], [0, 200], 8)).toBeNull();
  });
});
