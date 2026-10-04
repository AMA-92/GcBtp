import { describe, expect, it } from "vitest";
import { DESIGN_COMBINATIONS, LOAD_CATALOG, loadCatalogByCategory, loadCatalogForFloor } from "../shared/load-catalog";
import { defaultFloorConfig } from "../shared/floor-config";

describe("catalogue des charges", () => {
  it("covers the structural action families", () => {
    expect(loadCatalogByCategory("permanent").map(item => item.id)).toEqual(expect.arrayContaining(["slab-self-weight", "finishes", "ceiling", "partitions", "equipment", "walls"]));
    expect(loadCatalogByCategory("variable").map(item => item.id)).toEqual(expect.arrayContaining(["occupancy", "roof"]));
    expect(loadCatalogByCategory("climatic").map(item => item.id)).toEqual(expect.arrayContaining(["wind", "snow", "seismic"]));
    expect(loadCatalogByCategory("accidental").map(item => item.id)).toContain("fire");
    expect(LOAD_CATALOG.every(item => item.source.length > 0 && item.unit.length > 0)).toBe(true);
  });

  it("exposes traceable design combinations", () => {
    expect(DESIGN_COMBINATIONS.eluFundamental).toContain("1,35");
    expect(DESIGN_COMBINATIONS.elsCharacteristic).toContain("Gk");
  });

  it("calcule le poids propre du plancher corps creux 16+4", () => {
    const selfWeight = loadCatalogForFloor(defaultFloorConfig).find(item => item.id === "slab-self-weight");
    expect(selfWeight?.defaultValue).toBeCloseTo(3.5, 6);
    expect(selfWeight?.defaultValue).toBeGreaterThan(0);
  });
});
