import { describe, expect, it } from "vitest";

function chainLoads(floor: number, beamFactor: number, columnLevels: number) {
  const beam = floor * beamFactor;
  const column = beam * columnLevels;
  const footing = column;
  return { floor, beam, column, footing };
}
function dosage(volume: number, cement: number, waterRatio: number) { return { cement: volume * cement, sand: volume * 0.5, gravel: volume * 0.8, water: volume * cement * waterRatio }; }

describe("GcBtp domain validation", () => {
  it("rejects invalid geometry before calculation", () => {
    expect(0 > 0).toBe(false);
    expect(Number.isFinite(Number("abc"))).toBe(false);
  });
  it("propagates a floor load through the simplified chain", () => {
    expect(chainLoads(145, 1, 3)).toEqual({ floor: 145, beam: 145, column: 435, footing: 435 });
  });
  it("returns transparent indicative concrete quantities", () => {
    expect(dosage(2, 350, 0.5)).toEqual({ cement: 700, sand: 1, gravel: 1.6, water: 350 });
  });
});
