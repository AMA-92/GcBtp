import { describe, expect, it } from "vitest";
import { calculateEurocode2StraightAnchorageMm, checkColumnSecondOrder, checkCrackWidth, checkRectangularTorsion, checkSeismicDetailing } from "@shared/rc-eurocode-checks";

describe("contrôles Eurocode paramétriques", () => {
  it("calcule la longueur d’ancrage EC2 et distingue la qualité d’adhérence", () => {
    const good = calculateEurocode2StraightAnchorageMm({ barDiameterMm: 12, fckMpa: 25, fykMpa: 500, gammaC: 1.5, gammaS: 1.15, bondCondition: "good" });
    const poor = calculateEurocode2StraightAnchorageMm({ barDiameterMm: 12, fckMpa: 25, fykMpa: 500, gammaC: 1.5, gammaS: 1.15, bondCondition: "poor" });
    expect(good.designLengthMm).toBeGreaterThan(480);
    expect(good.designLengthMm).toBeLessThan(500);
    expect(poor.designLengthMm).toBeGreaterThan(good.designLengthMm);
    expect(good.alphaProduct).toBe(1);
  });

  it("calcule une ouverture de fissure finie et vérifie la limite", () => {
    const result = checkCrackWidth({ MserKnM: 35, AsTensionMm2: 1200, effectiveDepthMm: 450, widthMm: 300, heightMm: 500, coverMm: 30, barDiameterMm: 16, fykMpa: 500, maxCrackWidthMm: 0.3 });
    expect(result.wkMm).toBeGreaterThan(0);
    expect(Number.isFinite(result.wkMm)).toBe(true);
  });

  it("dimensionne la résistance de torsion et détecte une armature insuffisante", () => {
    const result = checkRectangularTorsion({ TEdKnM: 40, bMm: 300, hMm: 500, coverMm: 30, stirrupDiameterMm: 8, longitudinalDiameterMm: 16, fckMpa: 30, fykMpa: 500, gammaC: 1.5, gammaS: 1.15, AswPerSMm2PerMm: 0.2, AslMm2: 0 });
    expect(result.TRdMaxKnM).toBeGreaterThan(0);
    expect(result.TRdSKnM).toBeGreaterThan(0);
    expect(result.passesLongitudinal).toBe(false);
  });

  it("amplifie le moment d'un poteau comprimé au second ordre", () => {
    const result = checkColumnSecondOrder({ NEdKn: 800, M0EdKnM: 30, bMm: 300, hMm: 300, L0Mm: 3200, dMm: 250, AsMm2: 2400, fykMpa: 500, gammaS: 1.15 });
    expect(result.M2EdKnM).toBeGreaterThan(0);
    expect(result.MEdKnM).toBeGreaterThan(30);
  });

  it("contrôle un minimum de détail sismique avec une classe de ductilité explicite", () => {
    const result = checkSeismicDetailing({ ductilityClass: "DCM", member: "column", widthMm: 300, depthMm: 300, clearHeightMm: 3000, longitudinalRatio: 0.01, transverseDiameterMm: 8, transverseSpacingMm: 60, coverMm: 30, fykMpa: 500 });
    expect(result.rhoMin).toBeGreaterThan(0);
    expect(result.spacingLimitMm).toBeGreaterThan(0);
    expect(result.passes).toBe(true);
  });
});
