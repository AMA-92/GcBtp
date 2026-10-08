import { describe, expect, it } from "vitest";
import { FRENCH_BAEL_LEGACY_STANDARD } from "@shared/french-standard-profile";
import { designReinforcedConcrete, type RCDesignBasis } from "@shared/rc-design";
import {
  baelColumnLayoutForCount,
  baelColumnTieDiameterMm,
  baelMaximumColumnBarPitchMm,
  baelMaximumColumnTieSpacingMm,
  baelMinimumColumnBarCount,
  calculateBAELSecondOrderAxis,
  calculateBAELReferenceAnchorageMm,
  calculateBAELStraightAnchorageMm,
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
  bondStressMpa: 2.835,
  minClearSpacingMm: 20,
  maxLinkSpacingMm: 400,
  maxDeflectionRatio: 250,
  maxColumnSlenderness: 15,
  availableBarDiametersMm: [8, 10, 12, 14, 16, 20],
});

describe("BAEL 91 mod. 99 — calculs de poteaux", () => {
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

  it("applique les minima, pas de barres, cadres et scellement BAEL", () => {
    expect(minimumBAELColumnSteelAreaMm2("rectangular", 200, 300)).toBe(400);
    expect(minimumBAELColumnSteelAreaMm2("circular", 300, 300)).toBeCloseTo(0.4 * Math.PI * 300, 8);
    expect(baelMaximumColumnBarPitchMm(200, 300)).toBe(300);
    expect(baelMaximumColumnTieSpacingMm(200, 300, 12)).toBe(180);
    expect(baelColumnTieDiameterMm(14)).toBe(6);
    const anchorage = calculateBAELStraightAnchorageMm(10, 500, 25);
    expect(anchorage.tauSuMpa).toBeCloseTo(2.835, 8);
    expect(anchorage.lengthMm).toBeCloseTo(440.9171076, 5);
    expect(calculateBAELReferenceAnchorageMm(12, 500).lengthMm).toBe(600);
  });

  it("dimensionne une section rectangulaire avec second ordre, cadres et ancrage calculés", () => {
    const result = designReinforcedConcrete({
      basis: baelBasis(),
      members: [{ id: "P6", type: "column", combinationId: "ELU", combinationName: "ELU BAEL", sectionWidthMm: 200, sectionDepthMm: 300, lengthMm: 1000, anchorageAvailableTopMm: 800, anchorageAvailableBottomMm: 800, axialKn: 145.2, shearKn: 0, momentKnM: 0, momentXKnM: 0, momentYKnM: 0 }],
      slabs: [],
    });
    const design = result.elements[0];
    const secondOrder = design.checks.find(item => item.id === "column-second-order");
    expect(secondOrder?.status).toBe("satisfaisant");
    expect(secondOrder?.formula).toContain("Mx,Ed=");
    expect(secondOrder?.formula).toContain("My,Ed=");
    expect(design.checks.find(item => item.id === "column-bael-detailing")?.status).toBe("satisfaisant");
    expect(design.checks.find(item => item.id === "column-anchorage-length")?.status).toBe("satisfaisant");
    expect(design.checks.some(item => item.status === "à vérifier")).toBe(false);
    const longitudinal = design.reinforcement.find(item => item.id === "P6:longitudinal");
    const ties = design.reinforcement.find(item => item.id === "P6:ties");
    const anchor = design.reinforcement.find(item => item.id === "P6:anchorage");
    const anchorageCheck = design.checks.find(item => item.id === "column-anchorage-length");
    expect(longitudinal?.areaMm2).toBeGreaterThanOrEqual(400);
    expect(longitudinal?.diameterMm).toBeGreaterThanOrEqual(8);
    expect(ties?.label).toContain("Cadres BAEL");
    expect(ties?.lengthPerBarM).toBeGreaterThan(0);
    expect(anchor?.label).toContain("par extrémité");
    expect(anchor?.lengthPerBarM).toBeGreaterThan(0);
    expect(anchorageCheck?.demand).toBe(longitudinal!.diameterMm * 50);
    expect(anchorageCheck?.status).toBe("satisfaisant");
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

  it("exige deux mesures réelles et compare les longueurs d’ancrage BAEL", () => {
    const designForAnchorage = (top?: number, bottom?: number) => designReinforcedConcrete({
      basis: baelBasis(),
      members: [{ id: "PA", type: "column", combinationId: "ELU", combinationName: "ELU BAEL", sectionWidthMm: 200, sectionDepthMm: 300, lengthMm: 1000, anchorageAvailableTopMm: top, anchorageAvailableBottomMm: bottom, axialKn: 120, shearKn: 0, momentKnM: 0, momentXKnM: 0, momentYKnM: 0 }],
      slabs: [],
    }).elements[0].checks.find(item => item.id === "column-anchorage-length");
    expect(designForAnchorage()?.status).toBe("bloqué");
    expect(designForAnchorage()?.formula).toContain("longueur droite réellement disponible");
    expect(designForAnchorage(800, 800)?.status).toBe("satisfaisant");
    expect(designForAnchorage(800, 100)?.status).toBe("non satisfaisant");
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
