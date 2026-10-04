import { describe, expect, it } from "vitest";
import { FOOTING_2D_SIZE, FOOTING_3D_HEIGHT, FOOTING_3D_HALF_X, FOOTING_3D_HALF_Y, footing2DBox } from "../shared/footing-geometry";

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
});
