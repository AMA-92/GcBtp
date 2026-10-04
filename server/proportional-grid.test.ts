import { describe, expect, it } from "vitest";
import { cumulativeGridPositions, proportionalGridScale } from "../shared/proportional-grid";

describe("grille proportionnelle", () => {
  it("calcule des positions cumulées selon les entraxes", () => {
    expect(cumulativeGridPositions([2, 4, 1], 4)).toEqual([0, 2, 6, 7]);
  });

  it("conserve les proportions lors de la mise à l’échelle", () => {
    const positions = cumulativeGridPositions([2, 4, 1], 4);
    const scale = proportionalGridScale(positions, 68 * 3);
    expect(positions[2] - positions[1]).toBe(4);
    expect((positions[2] - positions[1]) * scale).toBeGreaterThan((positions[3] - positions[2]) * scale);
  });
});

  it("étend la séquence de cotation quand un axe est ajouté", () => {
    const withAddedAxis = cumulativeGridPositions([3, 4, 4], 4);
    expect(withAddedAxis).toEqual([0, 3, 7, 11]);
    expect(withAddedAxis).toHaveLength(4);
  });
