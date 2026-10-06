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

export type StairPoint2D = { x: number; y: number };
export type StairFlightPlan = { lowerA: StairPoint2D; lowerB: StairPoint2D; upperA: StairPoint2D; upperB: StairPoint2D };
export type StairSurfaceLoad = {
  id: string;
  label: string;
  kind: "flight" | "landing";
  areaM2: number;
  gkKnM2: number;
  qkKnM2: number;
  gkKn: number;
  qkKn: number;
};
export type StairSurfaceLoadsInput = {
  flights: Array<StairFlightPlan | undefined>;
  landingDepthM?: number;
  riseM: number;
  slabThicknessM: number;
  concreteDensityKnM3?: number;
  stepHeightM?: number;
  treadM?: number;
  flightFinishLoadKnM2?: number;
  landingFinishLoadKnM2?: number;
  flightImposedLoadKnM2: number;
  landingImposedLoadKnM2?: number;
};

const nonNegative = (value: number | undefined, fallback = 0) => Number.isFinite(value) && (value ?? 0) >= 0 ? value as number : fallback;
const pointDistance = (a: StairPoint2D, b: StairPoint2D) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: StairPoint2D, b: StairPoint2D): StairPoint2D => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const polygonArea = (points: StairPoint2D[]) => Math.abs(points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length];
  return sum + point.x * next.y - next.x * point.y;
}, 0)) / 2;
const add = (a: StairPoint2D, b: StairPoint2D): StairPoint2D => ({ x: a.x + b.x, y: a.y + b.y });
const scaled = (point: StairPoint2D, factor: number): StairPoint2D => ({ x: point.x * factor, y: point.y * factor });

/**
 * Charge permanente d'une volée exprimée sur sa projection horizontale.
 * La paillasse inclinée vaut γc × e / cos(θ), et les marches pleines
 * sont approchées par γc × h / 2 conformément au modèle de pré-étude.
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

/**
 * Assign separate G/Q values to both sloping flights and their landings.
 * Geometry coordinates must already be in metres. Flight area for loads is
 * its horizontal projection; the landing area is its actual horizontal area.
 */
export function calculateStairSurfaceLoads(input: StairSurfaceLoadsInput) {
  const depth = Number.isFinite(input.landingDepthM) && (input.landingDepthM ?? 0) > 0
    ? input.landingDepthM as number
    : Math.max(pointDistance(input.flights.find(Boolean)?.upperA ?? { x: 0, y: 0 }, input.flights.find(Boolean)?.upperB ?? { x: 1, y: 0 }), 0.001);
  const rows: StairSurfaceLoad[] = [];
  const validFlights = input.flights.filter((flight): flight is StairFlightPlan => Boolean(flight));
  const flightRates: number[] = [];
  for (const [index, flight] of input.flights.entries()) {
    if (!flight) continue;
    const lowerWidth = pointDistance(flight.lowerA, flight.lowerB);
    const upperWidth = pointDistance(flight.upperA, flight.upperB);
    const widthM = (lowerWidth + upperWidth) / 2;
    const runM = pointDistance(midpoint(flight.lowerA, flight.lowerB), midpoint(flight.upperA, flight.upperB));
    if (widthM <= 1e-8 || runM <= 1e-8) continue;
    const flightLoad = calculateStairPermanentLoad({
      widthM,
      horizontalRunM: runM,
      riseM: input.riseM,
      slabThicknessM: input.slabThicknessM,
      concreteDensityKnM3: input.concreteDensityKnM3,
      stepHeightM: input.stepHeightM,
      treadM: input.treadM,
      finishLoadKnM2: input.flightFinishLoadKnM2,
    });
    const qRate = nonNegative(input.flightImposedLoadKnM2);
    rows.push({
      id: `volée-${index + 1}`,
      label: `Escalier · volée ${index + 1}`,
      kind: "flight",
      areaM2: flightLoad.projectedAreaM2,
      gkKnM2: flightLoad.permanentRateKnM2,
      qkKnM2: qRate,
      gkKn: flightLoad.permanentRateKnM2 * flightLoad.projectedAreaM2,
      qkKn: qRate * flightLoad.projectedAreaM2,
    });
    flightRates[index] = flightLoad.permanentRateKnM2;
  }
  if (validFlights.length >= 2) {
    const [first, second] = validFlights;
    const rawIntermediate = [first.upperA, first.upperB, second.lowerB, second.lowerA];
    let intermediateAreaM2 = polygonArea(rawIntermediate);
    if (intermediateAreaM2 <= 1e-8) {
      const edgeX = second.lowerB.x - first.upperA.x;
      const edgeY = second.lowerB.y - first.upperA.y;
      const edgeLength = Math.hypot(edgeX, edgeY);
      const runX = first.upperA.x - first.lowerA.x;
      const runY = first.upperA.y - first.lowerA.y;
      const runLength = Math.hypot(runX, runY);
      const offsetDirection = edgeLength > 1e-8
        ? { x: -edgeY / edgeLength, y: edgeX / edgeLength }
        : runLength > 1e-8 ? { x: runX / runLength, y: runY / runLength } : null;
      if (offsetDirection) {
        const offset = scaled(offsetDirection, depth);
        const repaired = [first.upperA, second.lowerB, add(second.lowerB, offset), add(first.upperA, offset)];
        intermediateAreaM2 = polygonArea(repaired);
      }
    }
    if (intermediateAreaM2 > 1e-8) {
      const qRate = nonNegative(input.landingImposedLoadKnM2, nonNegative(input.flightImposedLoadKnM2));
      const gRate = nonNegative(input.concreteDensityKnM3, 25) * nonNegative(input.slabThicknessM) + nonNegative(input.landingFinishLoadKnM2);
      rows.push({ id: "palier-intermediaire", label: "Escalier · palier intermédiaire", kind: "landing", areaM2: intermediateAreaM2, gkKnM2: gRate, qkKnM2: qRate, gkKn: gRate * intermediateAreaM2, qkKn: qRate * intermediateAreaM2 });
    }
  }
  const last = validFlights.at(-1);
  if (last) {
    const widthM = (pointDistance(last.upperA, last.upperB) + pointDistance(last.lowerA, last.lowerB)) / 2;
    const arrivalAreaM2 = widthM * depth;
    if (arrivalAreaM2 > 1e-8) {
      const qRate = nonNegative(input.landingImposedLoadKnM2, nonNegative(input.flightImposedLoadKnM2));
      const gRate = nonNegative(input.concreteDensityKnM3, 25) * nonNegative(input.slabThicknessM) + nonNegative(input.landingFinishLoadKnM2);
      rows.push({ id: "palier-arrivee", label: "Escalier · palier d’arrivée", kind: "landing", areaM2: arrivalAreaM2, gkKnM2: gRate, qkKnM2: qRate, gkKn: gRate * arrivalAreaM2, qkKn: qRate * arrivalAreaM2 });
    }
  }
  return {
    rows,
    landingDepthM: depth,
    landingDepthWasDerived: !(Number.isFinite(input.landingDepthM) && (input.landingDepthM ?? 0) > 0),
    totalAreaM2: rows.reduce((sum, row) => sum + row.areaM2, 0),
    totalGkKn: rows.reduce((sum, row) => sum + row.gkKn, 0),
    totalQkKn: rows.reduce((sum, row) => sum + row.qkKn, 0),
    meanFlightPermanentRateKnM2: flightRates.length ? flightRates.reduce((sum, value) => sum + value, 0) / flightRates.length : 0,
  };
}
