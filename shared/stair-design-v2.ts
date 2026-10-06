export type StairInput = {
  spanM: number;
  riseM: number;
  widthM: number;
  thicknessM: number;
  permanentKnM2: number;
  imposedKnM2: number;
  gammaG: number;
  gammaQ: number;
  fykMpa: number;
  gammaS: number;
  coverMm: number;
  mainBarDiameterMm: number;
  minReinforcementRatio: number;
  maxReinforcementRatio: number;
};

export type StairPreDesign = {
  qULSKnM2: number;
  MEdKnMPerM: number;
  VEdKnPerM: number;
  slopeLengthM: number;
  effectiveDepthMm: number;
  AsMinimumMm2PerM: number;
  AsRequiredMm2PerM: number;
  AsMaximumMm2PerM: number;
  warnings: string[];
};

const positive = (value: number) => Number.isFinite(value) && value > 0;
const nonNegative = (value: number) => Number.isFinite(value) && value >= 0;

/**
 * Pré-dimensionnement indicatif d’une bande de volée de 1 m, simplement appuyée.
 * La portée utilisée est la projection horizontale. Cette fonction ne calcule pas
 * les paliers, la continuité, la torsion, le poinçonnement, le cisaillement normatif,
 * les ancrages, les recouvrements ni les dispositions sismiques.
 */
export function designStairV2(input: StairInput): StairPreDesign {
  const errors: string[] = [];
  if (!positive(input.spanM) || !positive(input.widthM) || !positive(input.riseM)) errors.push("Portée horizontale, largeur et hauteur de volée doivent être positives.");
  if (!positive(input.thicknessM) || input.thicknessM > 1) errors.push("Épaisseur de paillasse invalide (attendue en mètres).");
  if (!nonNegative(input.permanentKnM2) || !nonNegative(input.imposedKnM2)) errors.push("Charges permanentes et d’exploitation invalides.");
  if (!nonNegative(input.gammaG) || !nonNegative(input.gammaQ) || input.gammaG + input.gammaQ <= 0) errors.push("Facteurs de combinaison G/Q invalides ou nuls.");
  if (!positive(input.fykMpa) || !positive(input.gammaS) || !positive(input.mainBarDiameterMm)) errors.push("Données d’acier invalides.");
  if (!nonNegative(input.coverMm) || !positive(input.minReinforcementRatio) || !positive(input.maxReinforcementRatio) || input.maxReinforcementRatio <= input.minReinforcementRatio) errors.push("Enrobage ou taux d’armatures incohérent.");
  if (errors.length) throw new Error(errors.join(" "));

  const effectiveDepthMm = input.thicknessM * 1000 - input.coverMm - input.mainBarDiameterMm / 2;
  if (!positive(effectiveDepthMm)) throw new Error("Hauteur utile non positive après déduction de l’enrobage et du diamètre.");
  const qULSKnM2 = input.gammaG * input.permanentKnM2 + input.gammaQ * input.imposedKnM2;
  const MEdKnMPerM = qULSKnM2 * input.spanM ** 2 / 8;
  const VEdKnPerM = qULSKnM2 * input.spanM / 2;
  const fyd = input.fykMpa / input.gammaS;
  const zMm = 0.9 * effectiveDepthMm;
  const AsMinimumMm2PerM = input.minReinforcementRatio * 1000 * effectiveDepthMm;
  const AsRequiredMm2PerM = Math.max(AsMinimumMm2PerM, MEdKnMPerM * 1e6 / (zMm * fyd));
  const AsMaximumMm2PerM = input.maxReinforcementRatio * 1000 * effectiveDepthMm;
  return {
    qULSKnM2,
    MEdKnMPerM,
    VEdKnPerM,
    slopeLengthM: Math.hypot(input.spanM, input.riseM),
    effectiveDepthMm,
    AsMinimumMm2PerM,
    AsRequiredMm2PerM,
    AsMaximumMm2PerM,
    warnings: [
      "Modèle de bande simplement appuyée; chaque volée est isolée et la portée est la projection horizontale.",
      "Les paliers, la continuité, la répartition transversale réelle et les actions non gravitaires ne sont pas analysés.",
      "Pré-étude générique non réglementaire : cisaillement, flèche, fissuration, ancrages, recouvrements et détails sismiques restent à vérifier.",
    ],
  };
}
