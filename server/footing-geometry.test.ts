import { describe, expect, it } from "vitest";
import { FOOTING_2D_SIZE, FOOTING_3D_HEIGHT, FOOTING_3D_HALF_X, FOOTING_3D_HALF_Y, footing2DBox, footingCenterOffset } from "../shared/footing-geometry";

describe("géométrie des semelles DSRCAD", () => {
  it("conserve un carré 2D centré avec diagonales", () => {
    expect(footing2DBox(100)).toEqual({ start: 83, size: 34 });
    expect(FOOTING_2D_SIZE).toBe(34);
  });

  it("définit une semelle 3D extrudée", () => {
    expect(FOOTING_3D_HALF_X).toBeGreaterThan(0);
    expect(FOOTING_3D_HALF_Y).toBeGreaterThan(0);
    expect(FOOTING_3D_HEIGHT).toBeGreaterThan(0);
  });

  it("conserve le centrage et place le poteau à la limite B/6 du noyau central", () => {
    expect(footingCenterOffset("centered", undefined, 1, 1)).toEqual({ xM: 0, yM: 0 });
    const left = footingCenterOffset("eccentric", "left", 1, 1)!;
    const right = footingCenterOffset("eccentric", "right", 1, 1)!;
    const top = footingCenterOffset("eccentric", "top", 1, 1)!;
    const bottom = footingCenterOffset("eccentric", "bottom", 1, 1)!;
    expect(left.xM).toBeCloseTo(-1 / 6);
    expect(-0.5 + left.xM).toBeCloseTo(-2 / 3);
    expect(0.5 + left.xM).toBeCloseTo(1 / 3);
    expect(right.xM).toBeCloseTo(1 / 6);
    expect(-0.5 + right.xM).toBeCloseTo(-1 / 3);
    expect(0.5 + right.xM).toBeCloseTo(2 / 3);
    expect(top.yM).toBeCloseTo(-1 / 6);
    expect(-0.5 + top.yM).toBeCloseTo(-2 / 3);
    expect(0.5 + top.yM).toBeCloseTo(1 / 3);
    expect(bottom.yM).toBeCloseTo(1 / 6);
    expect(-0.5 + bottom.yM).toBeCloseTo(-1 / 3);
    expect(0.5 + bottom.yM).toBeCloseTo(2 / 3);
    expect(footingCenterOffset("eccentric", undefined, 1, 1)).toBeNull();
  });

  it("combine deux directions pour une semelle de coin", () => {
    const offset = footingCenterOffset("eccentric", { x: "right", y: "bottom" }, 1.2, 0.9)!;
    expect(offset.xM).toBeCloseTo(0.2);
    expect(offset.yM).toBeCloseTo(0.15);
    expect(-0.6 + offset.xM).toBeCloseTo(-0.4);
    expect(0.6 + offset.xM).toBeCloseTo(0.8);
    expect(-0.45 + offset.yM).toBeCloseTo(-0.3);
    expect(0.45 + offset.yM).toBeCloseTo(0.6);
    expect(footingCenterOffset("eccentric", { x: "none", y: "none" }, 1, 1)).toBeNull();
  });
});
