import { describe, expect, it } from "vitest";
import {
  DEFAULT_REINFORCEMENT_3D_CATEGORIES,
  reinforcement3DCategory,
} from "@shared/reinforcement-3d";

describe("3D reinforcement category filters", () => {
  it("enables every category by default, including tie-beams", () => {
    expect(DEFAULT_REINFORCEMENT_3D_CATEGORIES).toEqual({
      columns: true,
      beams: true,
      longrines: true,
      slabs: true,
      foundations: true,
      walls: true,
      balconies: true,
      stairs: true,
      others: true,
    });
  });

  it.each([
    ["Poteau", "column", "columns"],
    ["Poutre", "beam", "beams"],
    ["Longrine de redressement", "tie-beam", "longrines"],
    ["Dalle", "slab", "slabs"],
    ["Balcon", "slab", "balconies"],
    ["Semelle", "footing", "foundations"],
    ["Voile", "wall", "walls"],
    ["Escaliers", "stair", "stairs"],
    ["Élément inconnu", "other", "others"],
  ])("classifies %s as %s", (itemType, designType, expected) => {
    expect(reinforcement3DCategory(itemType, designType)).toBe(expected);
  });
});
