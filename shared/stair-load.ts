export type StairLoadInput = {
  widthM: number;
  horizontalRunM: number;
  riseM: number;
  slabThicknessM: number;
  concreteDensityKnM3?: number;
  stepHeightM?: number;
  treadM?: number;
  finishLoadKnM2?: number;
};

export type StairLoadResult = {
  slopeLengthM: number;
  slopeFactor: number;
  stepHeightM: number;
  paillasseKnM2: number;
  stepsKnM2: number;
  finishKnM2: number;
  permanentRateKnM2: number;
  projectedAreaM2: number;
};

const nonNegative = (value: number | undefined, fallback = 0) => Number.isFinite(value) && (value ?? 0) >= 0 ? value as number : fallback;

/**
 * Charge permanente d'une volée exprimée sur sa projection horizontale.
 * La paillasse inclinée vaut γc × e / cos(θ), et les marches pleines
 * sont approchées par γc × h / 2, conformément à la fiche d'appuis fournie.
 */
export function calculateStairPermanentLoad(input: StairLoadInput): StairLoadResult {
  const widthM = nonNegative(input.widthM);
  const horizontalRunM = Math.max(nonNegative(input.horizontalRunM), 0.001);
  const riseM = nonNegative(input.riseM);
  const slabThicknessM = nonNegative(input.slabThicknessM);
  const density = nonNegative(input.concreteDensityKnM3, 25) || 25;
  const slopeLengthM = Math.hypot(horizontalRunM, riseM);
  const slopeFactor = slopeLengthM / horizontalRunM;
  const stepCount = Math.max(1, Math.round(horizontalRunM / Math.max(nonNegative(input.treadM, 0.30), 0.05)));
  const stepHeightM = Math.max(nonNegative(input.stepHeightM, riseM / stepCount), 0);
  const paillasseKnM2 = density * slabThicknessM * slopeFactor;
  const stepsKnM2 = density * stepHeightM / 2;
  const finishKnM2 = nonNegative(input.finishLoadKnM2);
  return {
    slopeLengthM,
    slopeFactor,
    stepHeightM,
    paillasseKnM2,
    stepsKnM2,
    finishKnM2,
    permanentRateKnM2: paillasseKnM2 + stepsKnM2 + finishKnM2,
    projectedAreaM2: widthM * horizontalRunM,
  };
}
