export type CrackControlInput = {
  MserKnM: number;
  AsTensionMm2: number;
  effectiveDepthMm: number;
  widthMm: number;
  heightMm: number;
  coverMm: number;
  barDiameterMm: number;
  fykMpa: number;
  EsMpa?: number;
  k1?: number;
  k2?: number;
  k3?: number;
  k4?: number;
  kc?: number;
  k1c?: number;
  maxCrackWidthMm: number;
};

export type CrackControlResult = {
  steelStressMpa: number;
  rhoEff: number;
  srMaxMm: number;
  epsSmMinusEpsCm: number;
  wkMm: number;
  passes: boolean;
  warnings: string[];
};

/** EN 1992-1-1 crack-width control using the mean-strain method.
 * Coefficients are explicit inputs so the French NA/project values are traceable.
 */
export function checkCrackWidth(i: CrackControlInput): CrackControlResult {
  const Es = i.EsMpa ?? 200_000;
  const k1 = i.k1 ?? 0.8;
  const k2 = i.k2 ?? 0.5;
  const k3 = i.k3 ?? 3.4;
  const k4 = i.k4 ?? 0.425;
  const kc = i.kc ?? 0.4;
  const k1c = i.k1c ?? 0.8;
  const As = Math.max(i.AsTensionMm2, 1e-9);
  const z = Math.max(0.8 * i.effectiveDepthMm, 1e-9);
  const sigmaS = Math.abs(i.MserKnM) * 1e6 / Math.max(As * z, 1e-9);
  const hceff = Math.min(2.5 * Math.max(i.heightMm - i.effectiveDepthMm, 1), (i.heightMm - i.effectiveDepthMm) / 3, i.heightMm / 2);
  const rhoEff = As / Math.max(i.widthMm * hceff, 1e-9);
  const srMax = k3 * i.coverMm + k1 * k2 * k4 * i.barDiameterMm / Math.max(rhoEff, 1e-9);
  const fctEff = 2.9;
  const sigmaThreshold = kc * k1c * fctEff / Math.max(rhoEff, 1e-9) * (1 + 0.5 * Math.min(i.widthMm / Math.max(i.heightMm, 1), 1));
  const eps = Math.max(0, (sigmaS - sigmaThreshold) / Es, 0.6 * sigmaS / Es);
  const wk = srMax * eps;
  const warnings: string[] = [];
  if (i.fykMpa <= 0 || i.fykMpa > 700) warnings.push("fyk hors plage de la base de contrôle fissuration.");
  if (i.maxCrackWidthMm <= 0) warnings.push("La limite wk,max doit être fournie par la classe d’exposition et le dossier France.");
  return { steelStressMpa: sigmaS, rhoEff, srMaxMm: srMax, epsSmMinusEpsCm: eps, wkMm: wk, passes: warnings.length === 0 && wk <= i.maxCrackWidthMm, warnings };
}

export type TorsionCheckInput = {
  TEdKnM: number;
  bMm: number;
  hMm: number;
  coverMm: number;
  stirrupDiameterMm: number;
  longitudinalDiameterMm: number;
  fckMpa: number;
  fykMpa: number;
  gammaC: number;
  gammaS: number;
  alphaCC?: number;
  nuFactor?: number;
  alphaCW?: number;
  cotTheta?: number;
  AswPerSMm2PerMm: number;
  AslMm2: number;
};

export type TorsionCheckResult = {
  AkMm2: number;
  teffMm: number;
  thetaRad: number;
  TRdMaxKnM: number;
  TRdSKnM: number;
  AslReqMm2: number;
  passesConcrete: boolean;
  passesTransverse: boolean;
  passesLongitudinal: boolean;
  passes: boolean;
  warnings: string[];
};

/** EN 1992-1-1 thin-walled space-truss torsion screen for a solid rectangular section. */
export function checkRectangularTorsion(i: TorsionCheckInput): TorsionCheckResult {
  const fcd = (i.alphaCC ?? 0.85) * i.fckMpa / Math.max(i.gammaC, 1e-9);
  const fyd = i.fykMpa / Math.max(i.gammaS, 1e-9);
  const cotTheta = Math.min(2.5, Math.max(1, i.cotTheta ?? 2));
  const theta = Math.atan(1 / cotTheta);
  const innerB = Math.max(i.bMm - 2 * (i.coverMm + i.stirrupDiameterMm / 2), 1);
  const innerH = Math.max(i.hMm - 2 * (i.coverMm + i.stirrupDiameterMm / 2), 1);
  const Ak = innerB * innerH;
  const uK = 2 * (innerB + innerH);
  const teff = Math.max(Math.min(i.bMm, i.hMm) / 2, 1);
  const nu = i.nuFactor ?? 0.6 * (1 - i.fckMpa / 250);
  const alphaCW = i.alphaCW ?? 1;
  const TRdMax = 2 * alphaCW * nu * fcd * Ak * teff * Math.sin(theta) * Math.cos(theta) / 1e6;
  const TRdS = 2 * Ak * (i.AswPerSMm2PerMm * i.fykMpa / Math.max(i.gammaS, 1e-9)) * cotTheta / 1e6;
  const AslReq = Math.abs(i.TEdKnM) * 1e6 / Math.max(2 * Ak * fyd * cotTheta, 1e-9);
  const warnings: string[] = [];
  if (i.TEdKnM === 0) warnings.push("Torsion nulle dans la combinaison fournie : aucun ferraillage de torsion ne peut être conclu.");
  if (teff <= 0 || Ak <= 0) warnings.push("Géométrie de la section creuse équivalente invalide.");
  if (i.AswPerSMm2PerMm < 0 || i.AslMm2 < 0) warnings.push("Armatures de torsion négatives ou invalides.");
  const passesConcrete = Math.abs(i.TEdKnM) <= TRdMax;
  const passesTransverse = Math.abs(i.TEdKnM) <= TRdS;
  const passesLongitudinal = i.AslMm2 >= AslReq;
  return { AkMm2: Ak, teffMm: teff, thetaRad: theta, TRdMaxKnM: TRdMax, TRdSKnM: TRdS, AslReqMm2: AslReq, passesConcrete, passesTransverse, passesLongitudinal, passes: warnings.length === 0 && passesConcrete && passesTransverse && passesLongitudinal, warnings };
}

export type Eurocode2BondCondition = "good" | "poor";

export function calculateEurocode2StraightAnchorageMm(input: {
  barDiameterMm: number;
  fckMpa: number;
  fykMpa: number;
  gammaC: number;
  gammaS: number;
  bondCondition: Eurocode2BondCondition;
  alphaProduct?: number;
}) {
  const { barDiameterMm, fckMpa, fykMpa, gammaC, gammaS } = input;
  if (![barDiameterMm, fckMpa, fykMpa, gammaC, gammaS].every(Number.isFinite)
    || barDiameterMm <= 0 || fckMpa < 15 || fckMpa > 90 || fykMpa <= 0 || gammaC <= 0 || gammaS <= 0) {
    throw new Error("Le calcul d’ancrage EC2 exige des paramètres matériaux et un diamètre valides.");
  }
  const alphaProduct = input.alphaProduct ?? 1;
  if (!Number.isFinite(alphaProduct) || alphaProduct <= 0 || alphaProduct > 1) {
    throw new Error("Le produit α1·α2·α3·α4·α5 doit être compris entre 0 et 1.");
  }
  const fctmMpa = fckMpa <= 50
    ? 0.3 * fckMpa ** (2 / 3)
    : 2.12 * Math.log(1 + (fckMpa + 8) / 10);
  const fctk005Mpa = 0.7 * fctmMpa;
  const fctdMpa = fctk005Mpa / gammaC; // αct = 1, sans réduction nationale implicite.
  const eta1 = input.bondCondition === "good" ? 1 : 0.7;
  const eta2 = barDiameterMm <= 32 ? 1 : Math.max(0, (132 - barDiameterMm) / 100);
  const fbdMpa = 2.25 * eta1 * eta2 * fctdMpa;
  const sigmaSdMpa = fykMpa / gammaS; // Hypothèse conservatrice : acier à fyd.
  const lbRqdMm = (barDiameterMm / 4) * (sigmaSdMpa / fbdMpa);
  const minimumCompressionLengthMm = Math.max(0.6 * lbRqdMm, 10 * barDiameterMm, 100);
  const designLengthMm = Math.max(alphaProduct * lbRqdMm, minimumCompressionLengthMm);
  return {
    fctmMpa, fctk005Mpa, fctdMpa, eta1, eta2, fbdMpa, sigmaSdMpa,
    lbRqdMm, alphaProduct, minimumCompressionLengthMm, designLengthMm,
  };
}

export type SecondOrderColumnInput = {
  NEdKn: number;
  M0EdKnM: number;
  bMm: number;
  hMm: number;
  L0Mm: number;
  dMm: number;
  AsMm2: number;
  fykMpa: number;
  EsMpa?: number;
  gammaS: number;
  curvatureFactor?: number;
  momentAmplificationLimit?: number;
};

export type SecondOrderColumnResult = {
  e2Mm: number;
  M2EdKnM: number;
  MEdKnM: number;
  amplification: number;
  passes: boolean;
  warnings: string[];
};

/** Nominal-curvature second-order check. The curvature factor is project/code data, never inferred silently. */
export function checkColumnSecondOrder(i: SecondOrderColumnInput): SecondOrderColumnResult {
  const Es = i.EsMpa ?? 200_000;
  const epsyd = i.fykMpa / Math.max(i.gammaS, 1e-9) / Es;
  const curvature = (i.curvatureFactor ?? 1) * epsyd / Math.max(0.45 * i.dMm, 1e-9);
  const e2 = curvature * i.L0Mm ** 2 / (Math.PI ** 2);
  const M2 = Math.abs(i.NEdKn) * e2 / 1000;
  const MEd = Math.abs(i.M0EdKnM) + M2;
  const amplification = Math.abs(i.M0EdKnM) > 1e-9 ? MEd / Math.abs(i.M0EdKnM) : (M2 > 0 ? Number.POSITIVE_INFINITY : 1);
  const limit = i.momentAmplificationLimit ?? 5;
  const warnings: string[] = [];
  if (i.NEdKn <= 0) warnings.push("Le contrôle de second ordre nominal est destiné à un poteau comprimé.");
  if (i.L0Mm <= 0 || i.dMm <= 0 || i.AsMm2 <= 0) warnings.push("Longueur de flambement, hauteur utile et armature nécessaires au contrôle de second ordre.");
  return { e2Mm: e2, M2EdKnM: M2, MEdKnM: MEd, amplification, passes: warnings.length === 0 && amplification <= limit, warnings };
}

export type SeismicDetailingInput = {
  ductilityClass: "DCL" | "DCM" | "DCH";
  member: "beam" | "column";
  widthMm: number;
  depthMm: number;
  clearHeightMm: number;
  longitudinalRatio: number;
  transverseDiameterMm: number;
  transverseSpacingMm: number;
  coverMm: number;
  fykMpa: number;
};

export function checkSeismicDetailing(i: SeismicDetailingInput) {
  const rhoMin = i.member === "column" ? (i.ductilityClass === "DCH" ? 0.01 : 0.004) : (i.ductilityClass === "DCH" ? 0.005 : 0.003);
  const spacingLimit = i.member === "column" ? Math.min(0.5 * i.widthMm, 10 * i.transverseDiameterMm, 175) : Math.min(0.75 * i.depthMm, 175);
  const confinementLength = i.member === "column" ? Math.max(i.widthMm, i.depthMm, i.clearHeightMm / 6) : Math.max(2 * i.depthMm, 0.2 * i.clearHeightMm);
  const warnings: string[] = [];
  if (i.ductilityClass === "DCH") warnings.push("DCH : vérifier séparément toutes les clauses d'EN 1998-1 et l'annexe nationale française.");
  const passes = i.longitudinalRatio >= rhoMin && i.transverseSpacingMm <= spacingLimit && i.transverseDiameterMm >= 6 && i.coverMm > 0;
  return { rhoMin, spacingLimitMm: spacingLimit, confinementLengthMm: confinementLength, passes, warnings };
}
