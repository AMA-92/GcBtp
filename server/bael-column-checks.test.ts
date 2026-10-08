import { describe, expect, it } from "vitest";
import { FRENCH_BAEL_LEGACY_STANDARD } from "@shared/french-standard-profile";
import { designReinforcedConcrete, proposeColumnSectionIncreases, type RCDesignBasis } from "@shared/rc-design";
import {
  baelColumnLayoutForCount,
  baelColumnBarPositions,
  baelColumnTieDiameterMm,
  baelMaximumColumnBarPitchMm,
  baelMaximumColumnTieSpacingMm,
  baelMinimumColumnBarCount,
  calculateBAELColumnCompression,
  calculateBAELSecondOrderAxis,
  minimumBAELColumnSteelAreaMm2,
  solveBAELIsolatedColumnEquilibrium,
} from "@shared/bael-column-checks";

const baelBasis = (): RCDesignBasis => ({
  schemaVersion: 1,
  standard: FRENCH_BAEL_LEGACY_STANDARD,
  nationalAnnex: "Référence française de projet",
  sourceReference: "BAEL 91 mod. 99 — cas de référence du moteur",
  basisConfirmed: false,
  fckMpa: 25,
  fykMpa: 500,
  gammaC: 1.5,
  gammaS: 1.15,
  alphaCC: 0.85,
  coverMm: 30,
  minReinforcementRatio: 0.002,
  maxReinforcementRatio: 0.05,
  concreteShearStressLimitMpa: 0.55,
  minClearSpacingMm: 20,
  maxLinkSpacingMm: 400,
  maxDeflectionRatio: 250,
  maxColumnSlenderness: 15,
  availableBarDiametersMm: [8, 10, 12, 14, 16, 20],
});

describe("BAEL 91 mod. 99 — calculs de poteaux", () => {
  it("calcule Imin, i, λ, α, Br et As théorique pour un poteau 20×30", () => {
    const result = calculateBAELColumnCompression({ shape: "rectangular", widthMm: 200, depthMm: 300, bucklingLengthMm: 1000, axialKn: 776, fckMpa: 25, fykMpa: 500, gammaC: 1.5, gammaS: 1.15 });
    expect(result.minimumInertiaMm4).toBe(200_000_000);
    expect(result.radiusGyrationMm).toBeCloseTo(57.735, 2);
    expect(result.slenderness).toBeCloseTo(17.321, 2);
    expect(result.alpha).toBeCloseTo(0.8103, 3);
    expect(result.reducedConcreteAreaMm2).toBe(50_400);
    expect(result.theoreticalSteelAreaMm2).toBeGreaterThan(0);
    expect(result.withinAlphaRange).toBe(true);
  });

  it("place 9 barres rectangulaires de façon centrée et respecte la quantité imposée", () => {
    const layout = baelColumnBarPositions("rectangular", 300, 300, 9, 12, 6, 30, Number.POSITIVE_INFINITY);
    expect(layout.valid).toBe(true);
    expect(layout.positions).toHaveLength(9);
    expect(layout.positions).toContainEqual({ xMm: 0, yMm: 0 });

    const result = designReinforcedConcrete({
      basis: { ...baelBasis(), availableBarDiametersMm: [12] },
      members: [{ id: "P9", type: "column", combinationId: "ELU", combinationName: "ELU", sectionWidthMm: 300, sectionDepthMm: 300, lengthMm: 1000, bucklingLengthMm: 1000, axialKn: 100, shearKn: 0, momentKnM: 5, momentXKnM: 5, momentYKnM: 0 }],
      slabs: [],
      columnBarCountOverrides: { P9: 9 },
    });
    const design = result.elements[0];
    const bars = design.reinforcement.filter(item => item.id === "P9:longitudinal" || item.id.startsWith("P9:longitudinal:"));
    expect(bars).toHaveLength(1);
    expect(bars[0].count).toBe(9);
    expect(bars[0].diameterMm).toBe(12);
    expect(bars[0].barPositionsMm).toContainEqual({ xMm: 0, yMm: 0 });
    expect(design.checks.find(item => item.id === "column-bar-layout-count")?.status).toBe("satisfaisant");
  });

  it("applique les excentricités additionnelle et du second ordre de A.4.3,5", () => {
    const result = calculateBAELSecondOrderAxis({ axis: "Mx", axialKn: 100, firstOrderMomentKnM: 10, memberLengthMm: 3000, bucklingLengthMm: 3000, sectionDepthMm: 200, alpha: 1, creepRatio: 2 });
    expect(result.eccentricityAppliedMm).toBeCloseTo(100, 8);
    expect(result.additionalEccentricityMm).toBeCloseTo(20, 8);
    expect(result.secondOrderEccentricityMm).toBeCloseTo(54, 8);
    expect(result.totalMomentKnM).toBeCloseTo(17.4, 8);
    expect(result.withinSimplifiedMethodDomain).toBe(false);
  });

  it("calcule les imperfections et le moment de second ordre même si le moment de premier ordre est nul", () => {
    const result = calculateBAELSecondOrderAxis({ axis: "Mx", axialKn: 100, firstOrderMomentKnM: 0, memberLengthMm: 3000, bucklingLengthMm: 2000, sectionDepthMm: 200, alpha: 1, creepRatio: 2 });
    expect(result.eccentricityAppliedMm).toBe(0);
    expect(result.firstOrderEccentricityMm).toBe(20);
    expect(result.secondOrderEccentricityMm).toBeGreaterThan(0);
    expect(result.totalMomentKnM).toBeGreaterThan(0);
    expect(result.withinSimplifiedMethodDomain).toBe(true);
  });

  it("applique les minima, pas de barres et cadres BAEL", () => {
    expect(minimumBAELColumnSteelAreaMm2("rectangular", 200, 300)).toBe(400);
    expect(minimumBAELColumnSteelAreaMm2("circular", 300, 300)).toBeCloseTo(0.4 * Math.PI * 300, 8);
    expect(baelMaximumColumnBarPitchMm(200, 300)).toBe(300);
    expect(baelMaximumColumnTieSpacingMm(200, 300, 12)).toBe(180);
    expect(baelColumnTieDiameterMm(14)).toBe(6);
  });

  it("dimensionne une section rectangulaire avec second ordre et cadres", () => {
    const result = designReinforcedConcrete({
      basis: baelBasis(),
      members: [{ id: "P6", type: "column", combinationId: "ELU", combinationName: "ELU BAEL", sectionWidthMm: 200, sectionDepthMm: 300, lengthMm: 1000, axialKn: 145.2, shearKn: 0, momentKnM: 0, momentXKnM: 0, momentYKnM: 0 }],
      slabs: [],
    });
    const design = result.elements[0];
    const secondOrder = design.checks.find(item => item.id === "column-second-order");
    expect(secondOrder?.status).toBe("satisfaisant");
    expect(secondOrder?.label).toContain("compression centrée");
    expect(secondOrder?.formula).toContain("α=");
    expect(design.checks.find(item => item.id === "column-bael-detailing")?.status).toBe("satisfaisant");
    expect(design.checks.some(item => item.id === "column-anchorage-length")).toBe(false);
    expect(design.checks.some(item => item.status === "à vérifier")).toBe(false);
    const longitudinal = design.reinforcement.filter(item => item.id === "P6:longitudinal" || item.id.startsWith("P6:longitudinal:"));
    const ties = design.reinforcement.find(item => item.id === "P6:ties");
    expect(longitudinal.reduce((sum, item) => sum + item.areaMm2, 0)).toBeGreaterThanOrEqual(400);
    expect(longitudinal.every(item => (item.barPositionsMm?.length ?? 0) === item.count)).toBe(true);
    expect(longitudinal.every(item => item.diameterMm >= 8)).toBe(true);
    expect(ties?.label).toContain("Cadres BAEL");
    expect(ties?.lengthPerBarM).toBeGreaterThan(0);
  });

  it("dimensionne le cas BAEL 20×30 centré: As,req=max(As,th; As,min), puis retient 4HA12", () => {
    const result = designReinforcedConcrete({
      basis: baelBasis(),
      members: [{ id: "P-EX", type: "column", combinationId: "ELU", combinationName: "ELU catalogue", sectionWidthMm: 200, sectionDepthMm: 300, lengthMm: 1000, bucklingLengthMm: 700, axialKn: 776, shearKn: 0, momentKnM: 0, momentXKnM: 0, momentYKnM: 0 }],
      slabs: [],
    });
    const design = result.elements[0];
    const bars = design.reinforcement.filter(item => item.id === "P-EX:longitudinal" || item.id.startsWith("P-EX:longitudinal:"));
    expect(design.columnReport?.AsMinimumMm2).toBe(400);
    expect(design.columnReport?.baelCompression?.reducedConcreteAreaMm2).toBe(50_400);
    expect(design.columnReport?.baelCompression?.alpha).toBeCloseTo(0.8301, 3);
    expect(design.columnReport?.AsTheoreticalMm2).toBeLessThan(400);
    expect(design.columnReport?.AsRequiredMm2).toBe(400);
    expect(bars.map(item => `${item.count}HA${item.diameterMm}`)).toEqual(["4HA12"]);
    expect(bars.reduce((sum, item) => sum + item.areaMm2, 0)).toBeCloseTo(452, 8);
    expect(design.checks.find(item => item.id === "column-axial")?.status).toBe("satisfaisant");
    expect(design.checks.find(item => item.id === "column-interaction")?.status).toBe("satisfaisant");
  });

  it("ne conclut pas en compression centrée BAEL sans effort normal positif", () => {
    const result = designReinforcedConcrete({
      basis: baelBasis(),
      members: [{ id: "P-N0", type: "column", combinationId: "ELU", combinationName: "ELU nul", sectionWidthMm: 200, sectionDepthMm: 300, lengthMm: 1000, bucklingLengthMm: 700, axialKn: 0, shearKn: 0, momentKnM: 0, momentXKnM: 0, momentYKnM: 0 }],
      slabs: [],
    });
    const secondOrder = result.elements[0].checks.find(item => item.id === "column-second-order");
    expect(secondOrder?.status).not.toBe("satisfaisant");
    expect(secondOrder?.formula).toContain("effort normal de compression positif");
  });

  it("accepte 4HA12+2HA8 si la somme des aires HA tabulées couvre As requise", () => {
    const result = designReinforcedConcrete({
      basis: { ...baelBasis(), availableBarDiametersMm: [8, 12] },
      members: [{ id: "P-MIX-6", type: "column", combinationId: "ELU", combinationName: "ELU mixte", sectionWidthMm: 200, sectionDepthMm: 300, lengthMm: 1000, bucklingLengthMm: 700, axialKn: 776, shearKn: 0, momentKnM: 0, momentXKnM: 0, momentYKnM: 0 }],
      slabs: [],
      columnBarCountOverrides: { "P-MIX-6": 6 },
    });
    const design = result.elements[0];
    const bars = design.reinforcement.filter(item => item.id === "P-MIX-6:longitudinal" || item.id.startsWith("P-MIX-6:longitudinal:"));
    expect(bars.map(item => `${item.count}HA${item.diameterMm}`)).toEqual(["4HA12", "2HA8"]);
    expect(bars.reduce((sum, item) => sum + item.areaMm2, 0)).toBeCloseTo(552, 8);
    expect(bars.reduce((sum, item) => sum + item.requiredAreaMm2, 0)).toBe(400);
    expect(bars.every(item => item.barPositionsMm?.length === item.count)).toBe(true);
    expect(design.checks.find(item => item.id === "column-interaction")?.status).toBe("satisfaisant");
    expect(design.checks.find(item => item.id === "column-steel-max")?.status).toBe("satisfaisant");
    expect(design.reinforcement.some(item => item.id === "P-MIX-6:cross-ties" && !!item.tieSegmentsMm?.length)).toBe(true);
  });

  it("ne présente pas comme retenue une armature automatique au-delà de 5 % d’acier BAEL", () => {
    const result = designReinforcedConcrete({
      basis: baelBasis(),
      members: [{ id: "P-LIMIT", type: "column", combinationId: "ELU", combinationName: "ELU BAEL", sectionWidthMm: 200, sectionDepthMm: 300, lengthMm: 1000, bucklingLengthMm: 700, axialKn: 4000, shearKn: 0, momentKnM: 0, momentXKnM: 0, momentYKnM: 0 }],
      slabs: [],
    });
    const design = result.elements[0];
    expect(design.columnReport?.AsProvidedMm2).toBeLessThanOrEqual(3000);
    expect(design.checks.find(item => item.id === "column-steel-max")?.status).toBe("satisfaisant");
    expect(design.checks.find(item => item.id === "column-axial")?.status).toBe("non satisfaisant");
  });

  it("propose une augmentation B/H qui satisfait l’interaction biaxiale avec les armatures retenues", () => {
    const basis = { ...baelBasis(), availableBarDiametersMm: [14] };
    const member = { id: "P-RES", type: "column" as const, combinationId: "ELU", combinationName: "ELU BAEL", sectionWidthMm: 200, sectionDepthMm: 300, lengthMm: 1000, bucklingLengthMm: 1000, axialKn: 776, shearKn: 0, momentKnM: 0.48, momentXKnM: 0.39, momentYKnM: 0.48 };
    const proposals = proposeColumnSectionIncreases({
      basis,
      member,
      overrides: { "P-RES:longitudinal": { diameterMm: 14, count: 18 } },
      selfWeightIncluded: true,
      permanentLoadFactor: 1.35,
    });
    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.every(item => item.proposedSection.dimensions[0] >= 200 && item.proposedSection.dimensions[1] >= 300)).toBe(true);
    expect(proposals.every(item => item.utilization <= 1)).toBe(true);
    expect(proposals[0].proposedSection.dimensions).not.toEqual([200, 300]);
  });

  it("prend le relais par A.4.4 hors domaine A.4.3,5 et rend un verdict de stabilité", () => {
    const result = designReinforcedConcrete({
      basis: baelBasis(),
      members: [{ id: "P8", type: "column", combinationId: "ELU", combinationName: "ELU BAEL", sectionWidthMm: 200, sectionDepthMm: 200, lengthMm: 3000, bucklingLengthMm: 3000, axialKn: 100, shearKn: 0, momentKnM: 0, momentXKnM: 0, momentYKnM: 0 }],
      slabs: [],
    });
    const secondOrder = result.elements[0].checks.find(item => item.id === "column-second-order");
    expect(secondOrder?.status).toBe("satisfaisant");
    expect(secondOrder?.label).toContain("A.4.4");
    expect(secondOrder?.formula).toContain("équilibre non linéaire du poteau isolé");
  });

  it("recherche un équilibre non linéaire A.4.4 pour un poteau isolé avec moments biaxiaux", () => {
    const result = solveBAELIsolatedColumnEquilibrium({
      shape: "rectangular", widthMm: 200, depthMm: 300, memberLengthMm: 3000, bucklingLengthMm: 3000,
      axialKn: 150, firstOrderMomentXKnM: 2, firstOrderMomentYKnM: 1, fckMpa: 25, fykMpa: 500,
      gammaC: 1.5, gammaS: 1.15, coverMm: 30, barDiameterMm: 16, barCount: 4,
    });
    expect(result.converged).toBe(true);
    expect(result.stableEquilibrium).toBe(true);
    expect(result.withinMaterialLimits).toBe(true);
    expect(result.residual).toBeLessThan(2e-5);
    expect(result.totalMomentXKnM).toBeGreaterThan(2);
    expect(result.totalMomentYKnM).toBeGreaterThan(1);
  });

  it("refuse un état stable pour une compression bien supérieure à la capacité de section", () => {
    const result = solveBAELIsolatedColumnEquilibrium({
      shape: "rectangular", widthMm: 200, depthMm: 200, memberLengthMm: 3000, bucklingLengthMm: 3000,
      axialKn: 5000, firstOrderMomentXKnM: 0, firstOrderMomentYKnM: 0, fckMpa: 25, fykMpa: 500,
      gammaC: 1.5, gammaS: 1.15, coverMm: 30, barDiameterMm: 12, barCount: 4,
    });
    expect(result.withinMaterialLimits).toBe(false);
    expect(result.converged && result.stableEquilibrium && result.withinMaterialLimits).toBe(false);
  });

  it("accepte une section circulaire et impose au moins six barres régulières", () => {
    const minimumCount = baelMinimumColumnBarCount("circular", 300, 300, 42, 400);
    expect(minimumCount).toBeGreaterThanOrEqual(6);
    expect(baelColumnLayoutForCount("circular", 300, 300, 6, 10, 6, 30, 400).valid).toBe(true);
    const result = designReinforcedConcrete({
      basis: baelBasis(),
      members: [{ id: "P7", type: "column", sectionShape: "circular", combinationId: "ELU", combinationName: "ELU BAEL", sectionWidthMm: 300, sectionDepthMm: 300, lengthMm: 1000, axialKn: 100, shearKn: 0, momentKnM: 0, momentXKnM: 0, momentYKnM: 0 }],
      slabs: [],
    });
    const design = result.elements[0];
    const longitudinal = design.reinforcement.find(item => item.id === "P7:longitudinal");
    expect(longitudinal?.count).toBeGreaterThanOrEqual(6);
    expect(longitudinal?.label).toContain("répartition circulaire régulière");
    expect(design.checks.find(item => item.id === "column-bael-detailing")?.status).toBe("satisfaisant");
  });
});
