import { describe, expect, it } from "vitest";
import { elementLoadSummary } from "../shared/element-loads";
import { defaultFloorConfig } from "../shared/floor-config";

describe("element load summary", () => {
  it("calculates the exact self-weight of a 20x40 beam over 4 m", () => {
    const result = elementLoadSummary({ type: "Poutre", section: "Poutre_20x40", x: 0, y: 0, x2: 1, y2: 0 }, "4.00", defaultFloorConfig);
    expect(result.gk).toBeCloseTo(8, 6);
    expect(result.qk).toBe(0);
    expect(result.design).toBeCloseTo(10.8, 6);
  });

  it("uses both axes for diagonal beam length", () => {
    const result = elementLoadSummary({ type: "Poutre", section: "Poutre_20x40", x: 0, y: 0, x2: 1, y2: 1 }, "4.00", defaultFloorConfig);
    expect(result.gk).toBeCloseTo(Math.sqrt(128), 6);
  });
});


it("calculates the DSRCAD characteristic slab loads", () => {
    const config = { ...defaultFloorConfig, type: "Corps creux" as const, thickness: "16+4 cm", hollowBlockHeight: "16", compressionSlab: "4", finishLoad: "1", ceilingLoad: "0.3", partitionLoad: "1", equipmentLoad: "0.5", imposedLoad: "2" };
    const result = elementLoadSummary({ type: "Dalle", section: "Dalle 16+4", x: 0, y: 0, x2: 1, y2: 1, floorConfig: config }, "4.00", config);
    expect(result.surface).toBeCloseTo(16, 6);
    expect(result.gk).toBeCloseTo(93.44, 6);
    expect(result.qk).toBeCloseTo(24, 6);
});

it("calculates the solid 20 cm slab profile separately", () => {
    const config = { ...defaultFloorConfig, type: "Dalle pleine" as const, thickness: "20 cm", characteristicPermanentLoad: "8.00", characteristicImposedLoad: "1.50" };
    const result = elementLoadSummary({ type: "Dalle", section: "Dalle pleine 20", x: 0, y: 0, x2: 1, y2: 1, floorConfig: config }, "4.00", config);
    expect(result.surface).toBeCloseTo(16, 6);
    expect(result.gk).toBeCloseTo(128, 6);
    expect(result.qk).toBeCloseTo(24, 6);
});

it("applies the balcony load profile to a full-slab balcony", () => {
  const result = elementLoadSummary({ type: "Balcon", section: "Balcon BA 20 cm", x: 0, y: 0, x2: 1, y2: 1 }, "4.00", defaultFloorConfig);
  expect(result.surface).toBeCloseTo(16, 6);
  expect(result.gk).toBeCloseTo(96, 6);
  expect(result.qk).toBeCloseTo(56, 6);
  expect(result.label).toContain("Balcon · dalle pleine");
});

it("calculates stair slab loads with the dedicated reinforced-concrete profile", () => {
  const result = elementLoadSummary(
    { type: "Escaliers", section: "Escalier BA 18 cm", x: 0, y: 0, x2: 1, y2: 1 },
    "4.00",
    defaultFloorConfig
  );
  expect(result.surface).toBeCloseTo(16, 6);
  expect(result.gk).toBeCloseTo(102.9637586, 6);
  expect(result.qk).toBeCloseTo(40, 6);
});
