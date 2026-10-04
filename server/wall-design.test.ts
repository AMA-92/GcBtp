import { describe, expect, it } from "vitest";
import { designWall } from "../shared/wall-design";

const basis = { schemaVersion: 1 as const, standard: "NF EN 1992", nationalAnnex: "FR", sourceReference: "test", basisConfirmed: true, fckMpa: 25, fykMpa: 500, gammaC: 1.5, gammaS: 1.15, alphaCC: 0.85, coverMm: 30, minReinforcementRatio: 0.002, maxReinforcementRatio: 0.04, concreteShearStressLimitMpa: 4, bondStressMpa: 2, minClearSpacingMm: 20, maxLinkSpacingMm: 250, maxDeflectionRatio: 250, maxColumnSlenderness: 100, availableBarDiametersMm: [8, 10, 12, 16, 20] };

describe("dimensionnement des voiles", () => {
  it("produit les armatures verticales et horizontales", () => {
    const result = designWall({ id: "V1", combinationId: "comb", combinationName: "ELU", lengthMm: 3000, thicknessMm: 200, heightMm: 3200, axialKn: 500, shearKn: 50, momentXKnM: 80 }, basis);
    expect(result.type).toBe("wall");
    expect(result.reinforcement.map(item => item.id)).toEqual(expect.arrayContaining(["V1:vertical", "V1:horizontal"]));
    expect(result.checks.map(item => item.id)).toEqual(expect.arrayContaining(["wall-axial", "wall-interaction", "wall-shear"]));
  });
});
