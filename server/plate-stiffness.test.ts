import { describe, expect, it } from "vitest";
import { defaultFloorConfig } from "@shared/floor-config";
import { resolveFloorPlateStiffness } from "@shared/plate-stiffness";

describe("rigidité de plaque des planchers", () => {
  it("produit une rigidité isotrope cohérente pour une dalle pleine", () => {
    const config = { ...defaultFloorConfig, type: "Dalle pleine" as const, thickness: "20 cm" };
    const d = (30_000_000 * 0.2 ** 3) / (12 * (1 - 0.2 ** 2));
    expect(resolveFloorPlateStiffness(config, 30_000_000, 0.2)).toMatchObject({ D11: d, D22: d, D12: 0.2 * d, D66: 0.4 * d });
  });

  it("prend en compte les dimensions d’une section en T périodique pour un corps creux", () => {
    const xConfig = { ...defaultFloorConfig, type: "Corps creux" as const, direction: "X" as const, hollowBlockHeight: "16", compressionSlab: "4", ribWidth: "12", ribSpacing: "60" };
    const yConfig = { ...xConfig, direction: "Y" as const };
    const x = resolveFloorPlateStiffness(xConfig, 30_000_000, 0.2);
    const y = resolveFloorPlateStiffness(yConfig, 30_000_000, 0.2);
    expect(x.D11).toBeGreaterThan(x.D22);
    expect(x.D11).toBeCloseTo(y.D22);
    expect(x.D22).toBeCloseTo(y.D11);
    const tighterRibs = resolveFloorPlateStiffness({ ...xConfig, ribSpacing: "50" }, 30_000_000, 0.2);
    expect(tighterRibs.D11).toBeGreaterThan(x.D11);
  });
});
