export type BAELColumnSectionShape = "rectangular" | "circular";

export type BAELSecondOrderAxisInput = {
  axis: "Mx" | "My";
  axialKn: number;
  firstOrderMomentKnM: number;
  memberLengthMm: number;
  bucklingLengthMm: number;
  sectionDepthMm: number;
  alpha?: number;
  creepRatio?: number;
};

export type BAELSecondOrderAxisResult = {
  axis: "Mx" | "My";
  eccentricityAppliedMm: number;
  additionalEccentricityMm: number;
  firstOrderEccentricityMm: number;
  secondOrderEccentricityMm: number;
  totalMomentKnM: number;
  slendernessRatio: number;
  allowableSlendernessRatio: number;
  withinSimplifiedMethodDomain: boolean;
  alpha: number;
  creepRatio: number;
};

/** BAEL 91 révisé 99, A.4.3,5. f, h and l are in mm; moments use first-order ELU kN·m. */
export function calculateBAELSecondOrderAxis(input: BAELSecondOrderAxisInput): BAELSecondOrderAxisResult {
  const axialKn = Math.abs(input.axialKn);
  const h = input.sectionDepthMm;
  const l = input.memberLengthMm;
  const f = input.bucklingLengthMm;
  if (![axialKn, h, l, f].every(Number.isFinite) || axialKn <= 0 || h <= 0 || l <= 0 || f <= 0) {
    throw new Error("A.4.3,5 exige NEd, h, l et f strictement positifs.");
  }
  const alpha = Math.max(0, Math.min(1, input.alpha ?? 1));
  const creepRatio = Math.max(0, input.creepRatio ?? 2);
  const eccentricityAppliedMm = Math.abs(input.firstOrderMomentKnM) * 1000 / axialKn;
  const additionalEccentricityMm = Math.max(20, l / 250);
  const firstOrderEccentricityMm = eccentricityAppliedMm + additionalEccentricityMm;
  const secondOrderEccentricityMm = 3 * f ** 2 / (10_000 * h) * (2 + alpha * creepRatio);
  const slendernessRatio = f / h;
  const allowableSlendernessRatio = Math.max(15, 20 * firstOrderEccentricityMm / h);
  return {
    axis: input.axis,
    eccentricityAppliedMm,
    additionalEccentricityMm,
    firstOrderEccentricityMm,
    secondOrderEccentricityMm,
    totalMomentKnM: axialKn * (firstOrderEccentricityMm + secondOrderEccentricityMm) / 1000,
    slendernessRatio,
    allowableSlendernessRatio,
    withinSimplifiedMethodDomain: slendernessRatio < allowableSlendernessRatio,
    alpha,
    creepRatio,
  };
}

/** BAEL A.8.1,21: the greater of 0.2% of concrete area and 4 cm² per metre of perimeter. */
export function minimumBAELColumnSteelAreaMm2(shape: BAELColumnSectionShape, widthMm: number, depthMm: number) {
  const areaMm2 = shape === "circular" ? Math.PI * widthMm ** 2 / 4 : widthMm * depthMm;
  const perimeterMm = shape === "circular" ? Math.PI * widthMm : 2 * (widthMm + depthMm);
  return Math.max(0.002 * areaMm2, 0.4 * perimeterMm);
}

export function baelMaximumColumnBarPitchMm(widthMm: number, depthMm: number) {
  return Math.min(Math.min(widthMm, depthMm) + 100, 400);
}

export function baelMaximumColumnTieSpacingMm(widthMm: number, depthMm: number, largestLongitudinalDiameterMm: number) {
  return Math.min(15 * largestLongitudinalDiameterMm, 400, Math.min(widthMm, depthMm) + 100);
}

/** A.8.1,3: select the first standard diameter not less than one third of the largest longitudinal bar. */
export function baelColumnTieDiameterMm(largestLongitudinalDiameterMm: number) {
  return [6, 8, 10, 12, 14, 16, 20, 25, 32].find(diameter => diameter >= largestLongitudinalDiameterMm / 3) ?? null;
}

/** Minimum recommended longitudinal count and regular perimeter arrangement (A.8.1,22). */
export function baelMinimumColumnBarCount(shape: BAELColumnSectionShape, widthMm: number, depthMm: number, edgeInsetMm: number, maxPitchMm: number) {
  if (shape === "circular") {
    const usableDiameterMm = Math.max(0, widthMm - 2 * edgeInsetMm);
    let count = Math.max(6, Math.ceil(Math.PI * usableDiameterMm / Math.max(maxPitchMm, 1)));
    if (count % 2) count++;
    return count;
  }
  const usableWidthMm = Math.max(0, widthMm - 2 * edgeInsetMm);
  const usableDepthMm = Math.max(0, depthMm - 2 * edgeInsetMm);
  const barsAlongWidth = Math.max(2, Math.ceil(usableWidthMm / Math.max(maxPitchMm, 1)) + 1);
  const barsAlongDepth = Math.max(2, Math.ceil(usableDepthMm / Math.max(maxPitchMm, 1)) + 1);
  return 2 * barsAlongWidth + 2 * barsAlongDepth - 4;
}

export function baelColumnLayoutForCount(shape: BAELColumnSectionShape, widthMm: number, depthMm: number, count: number, diameterMm: number, tieDiameterMm: number, coverMm: number, maxPitchMm: number) {
  const edgeInsetMm = coverMm + tieDiameterMm + diameterMm / 2;
  if (shape === "circular") {
    if (count < 6) return { valid: false, minimumCount: 6, maxPitchMm: Number.POSITIVE_INFINITY, clearSpacingMm: Number.NEGATIVE_INFINITY };
    const centerlineDiameterMm = Math.max(0, widthMm - 2 * edgeInsetMm);
    const maxPitch = Math.PI * centerlineDiameterMm / count;
    const clearSpacingMm = 2 * (centerlineDiameterMm / 2) * Math.sin(Math.PI / count) - diameterMm;
    const minimumCount = baelMinimumColumnBarCount(shape, widthMm, depthMm, edgeInsetMm, maxPitchMm);
    return { valid: count >= minimumCount && maxPitch <= maxPitchMm && clearSpacingMm >= 0, minimumCount, maxPitchMm: maxPitch, clearSpacingMm };
  }
  let best: { nWidth: number; nDepth: number; maxPitchMm: number; clearSpacingMm: number } | null = null;
  for (let nWidth = 2; nWidth <= count + 2; nWidth++) {
    for (let nDepth = 2; nDepth <= count + 2; nDepth++) {
      if (2 * nWidth + 2 * nDepth - 4 !== count) continue;
      const pitchWidth = Math.max(0, widthMm - 2 * edgeInsetMm) / (nWidth - 1);
      const pitchDepth = Math.max(0, depthMm - 2 * edgeInsetMm) / (nDepth - 1);
      const maxPitch = Math.max(pitchWidth, pitchDepth);
      const clearSpacing = Math.min(pitchWidth, pitchDepth) - diameterMm;
      if (!best || maxPitch < best.maxPitchMm) best = { nWidth, nDepth, maxPitchMm: maxPitch, clearSpacingMm: clearSpacing };
    }
  }
  if (!best) return { valid: false, minimumCount: baelMinimumColumnBarCount(shape, widthMm, depthMm, edgeInsetMm, maxPitchMm), maxPitchMm: Number.POSITIVE_INFINITY, clearSpacingMm: Number.NEGATIVE_INFINITY };
  const minimumCount = baelMinimumColumnBarCount(shape, widthMm, depthMm, edgeInsetMm, maxPitchMm);
  return { valid: count >= minimumCount && best.maxPitchMm <= maxPitchMm && best.clearSpacingMm >= 0, minimumCount, maxPitchMm: best.maxPitchMm, clearSpacingMm: best.clearSpacingMm };
}


export type BAELIsolatedColumnEquilibriumInput = {
  shape: BAELColumnSectionShape;
  widthMm: number;
  depthMm: number;
  memberLengthMm: number;
  bucklingLengthMm: number;
  axialKn: number;
  firstOrderMomentXKnM: number;
  firstOrderMomentYKnM: number;
  fckMpa: number;
  fykMpa: number;
  gammaC: number;
  gammaS: number;
  coverMm: number;
  barDiameterMm: number;
  barCount: number;
  alpha?: number;
  creepRatio?: number;
  loadSteps?: number;
};

export type BAELIsolatedColumnEquilibriumResult = {
  converged: boolean;
  stableEquilibrium: boolean;
  withinMaterialLimits: boolean;
  maxConcreteCompressionStrain: number;
  concreteLimitStrain: number;
  maxSteelStrain: number;
  deflectionXmm: number;
  deflectionYmm: number;
  totalMomentXKnM: number;
  totalMomentYKnM: number;
  iterations: number;
  residual: number;
  reason: string;
};

/**
 * A.4.4 isolated-member pre-check: solves a nonlinear equilibrium in the first
 * pinned sinusoidal mode. The prescribed effective length f, constant first-
 * order end-moment envelope, A.4.4,31 imperfection, concrete tension cutoff,
 * BAEL design stress diagrams, and A.4.4,32 creep-affinity are explicit inputs.
 * This is not a substitute for a whole-frame stability analysis.
 */
export function solveBAELIsolatedColumnEquilibrium(input: BAELIsolatedColumnEquilibriumInput): BAELIsolatedColumnEquilibriumResult {
  const invalid = (): BAELIsolatedColumnEquilibriumResult => ({ converged: false, stableEquilibrium: false, withinMaterialLimits: false, maxConcreteCompressionStrain: 0, concreteLimitStrain: 0, maxSteelStrain: 0, deflectionXmm: 0, deflectionYmm: 0, totalMomentXKnM: 0, totalMomentYKnM: 0, iterations: 0, residual: Number.POSITIVE_INFINITY, reason: "Données de calcul non positives ou non finies." });
  const positiveValues = [input.widthMm, input.depthMm, input.memberLengthMm, input.bucklingLengthMm, input.axialKn, input.fckMpa, input.fykMpa, input.gammaC, input.gammaS, input.barDiameterMm, input.barCount];
  if (!positiveValues.every(value => Number.isFinite(value) && value > 0) || ![input.firstOrderMomentXKnM, input.firstOrderMomentYKnM, input.coverMm].every(Number.isFinite) || input.fckMpa > 60 || !Number.isInteger(input.barCount)) return invalid();

  const width = input.widthMm, depth = input.depthMm;
  const sectionArea = input.shape === "circular" ? Math.PI * width ** 2 / 4 : width * depth;
  const fcd = 0.85 * input.fckMpa / input.gammaC;
  const fyd = input.fykMpa / input.gammaS;
  const alpha = Math.max(0, Math.min(1, input.alpha ?? 1));
  const creep = Math.max(0, input.creepRatio ?? 2);
  const creepAffinity = 1 + alpha * creep;
  const concreteFlexureLimitStrain = 0.0035 * creepAffinity;
  const concreteCompressionLimitStrain = 0.002 * creepAffinity;
  const steelModulus = 200_000;
  const cellCount = 20;
  const fibers: Array<{ x: number; y: number; area: number }> = [];
  if (input.shape === "rectangular") {
    const cellArea = sectionArea / (cellCount * cellCount);
    for (let iy = 0; iy < cellCount; iy++) for (let ix = 0; ix < cellCount; ix++) {
      fibers.push({ x: -width / 2 + (ix + 0.5) * width / cellCount, y: -depth / 2 + (iy + 0.5) * depth / cellCount, area: cellArea });
    }
  } else {
    const candidates: Array<{ x: number; y: number }> = [];
    for (let iy = 0; iy < cellCount; iy++) for (let ix = 0; ix < cellCount; ix++) {
      const x = -width / 2 + (ix + 0.5) * width / cellCount;
      const y = -width / 2 + (iy + 0.5) * width / cellCount;
      if (x * x + y * y <= (width / 2) ** 2) candidates.push({ x, y });
    }
    if (!candidates.length) return invalid();
    for (const point of candidates) fibers.push({ ...point, area: sectionArea / candidates.length });
  }

  const barArea = Math.PI * input.barDiameterMm ** 2 / 4;
  const tieDia = baelColumnTieDiameterMm(input.barDiameterMm) ?? 6;
  const inset = input.coverMm + tieDia + input.barDiameterMm / 2;
  const bars: Array<{ x: number; y: number }> = [];
  if (input.shape === "circular") {
    const radius = Math.max(0, width / 2 - inset);
    for (let index = 0; index < input.barCount; index++) {
      const angle = 2 * Math.PI * index / input.barCount;
      bars.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    }
  } else {
    const x0 = -width / 2 + inset, x1 = width / 2 - inset;
    const y0 = -depth / 2 + inset, y1 = depth / 2 - inset;
    let layout: { nWidth: number; nDepth: number; maxPitch: number } | null = null;
    for (let nWidth = 2; nWidth <= input.barCount + 2; nWidth++) for (let nDepth = 2; nDepth <= input.barCount + 2; nDepth++) {
      if (2 * nWidth + 2 * nDepth - 4 !== input.barCount) continue;
      const pitch = Math.max((x1 - x0) / (nWidth - 1), (y1 - y0) / (nDepth - 1));
      if (!layout || pitch < layout.maxPitch) layout = { nWidth, nDepth, maxPitch: pitch };
    }
    if (!layout || x1 <= x0 || y1 <= y0) return invalid();
    for (let index = 0; index < layout.nWidth; index++) {
      const x = x0 + (x1 - x0) * index / (layout.nWidth - 1);
      bars.push({ x, y: y0 }, { x, y: y1 });
    }
    for (let index = 1; index < layout.nDepth - 1; index++) {
      const y = y0 + (y1 - y0) * index / (layout.nDepth - 1);
      bars.push({ x: x0, y }, { x: x1, y });
    }
  }
  // Replace concrete in the four nearest integration cells by each steel bar area.
  for (const bar of bars) {
    const nearest = fibers.map((fiber, index) => ({ index, d2: (fiber.x - bar.x) ** 2 + (fiber.y - bar.y) ** 2 })).sort((a, b) => a.d2 - b.d2).slice(0, 4);
    for (const item of nearest) fibers[item.index].area = Math.max(0, fibers[item.index].area - barArea / nearest.length);
  }

  const concreteStress = (strain: number) => {
    if (strain >= 0) return 0; // BAEL A.4.4,32: béton tendu négligé.
    const compression = -strain / creepAffinity;
    const ratio = Math.min(1, compression / 0.002);
    return -fcd * (compression <= 0.002 ? 2 * ratio - ratio * ratio : 1);
  };
  const steelStress = (strain: number) => Math.max(-fyd, Math.min(fyd, steelModulus * strain));
  const lengthScale = Math.max(width, depth);
  const imperfection = Math.max(20, input.memberLengthMm / 250);
  const axialDemand = input.axialKn;
  const firstMx = Math.abs(input.firstOrderMomentXKnM);
  const firstMy = Math.abs(input.firstOrderMomentYKnM);
  const loadSteps = Math.max(8, Math.min(32, Math.floor(input.loadSteps ?? 16)));
  const initialConcreteModulus = 11_000 * input.fckMpa ** (1 / 3);
  const steelArea = input.barCount * barArea;
  const initialAxialStiffness = Math.max((sectionArea - steelArea) * initialConcreteModulus / creepAffinity + steelArea * steelModulus, 1);
  const state = [Math.max(1e-8, axialDemand * 1000 / initialAxialStiffness), 0, 0]; // ε0, κx·Lscale, κy·Lscale
  let iterationTotal = 0;
  let lastResidual = Number.POSITIVE_INFINITY;
  let finalState: { mxKnM: number; myKnM: number; dx: number; dy: number; maxConcrete: number; maxSteel: number; concreteLimit: number } | null = null;

  const sectionResponse = (q: number[]) => {
    const kx = q[1] / lengthScale, ky = q[2] / lengthScale;
    let compressionKn = 0, mxKnM = 0, myKnM = 0, maxConcrete = 0, maxSteel = 0;
    let hasConcreteTension = false;
    for (const fiber of fibers) {
      const strain = -q[0] - kx * fiber.y - ky * fiber.x;
      if (strain > 0) hasConcreteTension = true;
      const stress = concreteStress(strain);
      compressionKn -= stress * fiber.area / 1000;
      mxKnM -= stress * fiber.y * fiber.area / 1e6;
      myKnM -= stress * fiber.x * fiber.area / 1e6;
      maxConcrete = Math.max(maxConcrete, Math.max(0, -strain));
    }
    for (const bar of bars) {
      const strain = -q[0] - kx * bar.y - ky * bar.x;
      const stress = steelStress(strain);
      compressionKn -= stress * barArea / 1000;
      mxKnM -= stress * bar.y * barArea / 1e6;
      myKnM -= stress * bar.x * barArea / 1e6;
      maxSteel = Math.max(maxSteel, Math.abs(strain));
    }
    const dx = kx * input.bucklingLengthMm ** 2 / Math.PI ** 2;
    const dy = ky * input.bucklingLengthMm ** 2 / Math.PI ** 2;
    return { compressionKn, mxKnM, myKnM, dx, dy, maxConcrete, maxSteel, concreteLimit: hasConcreteTension ? concreteFlexureLimitStrain : concreteCompressionLimitStrain };
  };
  const residualFor = (q: number[], loadFactor: number) => {
    const response = sectionResponse(q);
    const n = axialDemand * loadFactor;
    const targetMx = firstMx * loadFactor + n * (imperfection + response.dx) / 1000;
    const targetMy = firstMy * loadFactor + n * (imperfection + response.dy) / 1000;
    const nScale = Math.max(1, n), mScale = Math.max(1, targetMx, targetMy);
    return { values: [(response.compressionKn - n) / nScale, (response.mxKnM - targetMx) / mScale, (response.myKnM - targetMy) / mScale], response, targetMx, targetMy };
  };
  const solveLinear3 = (matrix: number[][], rhs: number[]) => {
    const a = matrix.map((row, i) => [...row, rhs[i]]);
    for (let col = 0; col < 3; col++) {
      let pivot = col;
      for (let row = col + 1; row < 3; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
      if (Math.abs(a[pivot][col]) < 1e-12) return null;
      [a[col], a[pivot]] = [a[pivot], a[col]];
      const divisor = a[col][col];
      for (let j = col; j < 4; j++) a[col][j] /= divisor;
      for (let row = 0; row < 3; row++) if (row !== col) {
        const factor = a[row][col];
        for (let j = col; j < 4; j++) a[row][j] -= factor * a[col][j];
      }
    }
    return [a[0][3], a[1][3], a[2][3]];
  };

  for (let step = 1; step <= loadSteps; step++) {
    const loadFactor = step / loadSteps;
    let converged = false;
    for (let iteration = 0; iteration < 35; iteration++) {
      iterationTotal++;
      const current = residualFor(state, loadFactor);
      const norm = Math.max(...current.values.map(Math.abs));
      lastResidual = norm;
      if (norm < 2e-5) { converged = true; finalState = current.response; break; }
      const jacobian = Array.from({ length: 3 }, () => Array(3).fill(0));
      for (let column = 0; column < 3; column++) {
        const h = column === 0 ? 1e-7 : 1e-7;
        const perturbed = [...state]; perturbed[column] += h;
        const next = residualFor(perturbed, loadFactor).values;
        for (let row = 0; row < 3; row++) jacobian[row][column] = (next[row] - current.values[row]) / h;
      }
      const delta = solveLinear3(jacobian, current.values.map(value => -value));
      if (!delta) break;
      let accepted = false;
      for (const damping of [1, 0.5, 0.25, 0.125, 0.0625]) {
        const trial = state.map((value, i) => value + damping * delta[i]);
        if (trial.some(value => !Number.isFinite(value) || Math.abs(value) > 0.02)) continue;
        const trialNorm = Math.max(...residualFor(trial, loadFactor).values.map(Math.abs));
        if (trialNorm < norm) { state.splice(0, 3, ...trial); accepted = true; break; }
      }
      if (!accepted) break;
    }
    if (!converged) return { converged: false, stableEquilibrium: false, withinMaterialLimits: false, maxConcreteCompressionStrain: finalState?.maxConcrete ?? 0, concreteLimitStrain: finalState?.concreteLimit ?? concreteCompressionLimitStrain, maxSteelStrain: finalState?.maxSteel ?? 0, deflectionXmm: finalState?.dx ?? 0, deflectionYmm: finalState?.dy ?? 0, totalMomentXKnM: finalState?.mxKnM ?? 0, totalMomentYKnM: finalState?.myKnM ?? 0, iterations: iterationTotal, residual: lastResidual, reason: `L’équilibre non linéaire n’a pas convergé au pas de charge ${step}/${loadSteps}; aucune stabilité n’est démontrée.` };
  }
  const final = residualFor(state, 1);
  finalState = final.response;
  const finalJacobian = Array.from({ length: 3 }, () => Array(3).fill(0));
  for (let column = 0; column < 3; column++) {
    const perturbed = [...state]; perturbed[column] += 1e-7;
    const next = residualFor(perturbed, 1).values;
    for (let row = 0; row < 3; row++) finalJacobian[row][column] = (next[row] - final.values[row]) / 1e-7;
  }
  const j = finalJacobian;
  const kxx = j[1][1] - j[1][0] * j[0][1] / Math.max(Math.abs(j[0][0]), 1e-12) * Math.sign(j[0][0]);
  const kxy = j[1][2] - j[1][0] * j[0][2] / Math.max(Math.abs(j[0][0]), 1e-12) * Math.sign(j[0][0]);
  const kyx = j[2][1] - j[2][0] * j[0][1] / Math.max(Math.abs(j[0][0]), 1e-12) * Math.sign(j[0][0]);
  const kyy = j[2][2] - j[2][0] * j[0][2] / Math.max(Math.abs(j[0][0]), 1e-12) * Math.sign(j[0][0]);
  const stableEquilibrium = kxx > 0 && kyy > 0 && kxx * kyy - kxy * kyx > 0;
  const withinMaterialLimits = stableEquilibrium && final.response.maxConcrete <= final.response.concreteLimit && final.response.maxSteel <= 0.01;
  return {
    converged: true,
    stableEquilibrium,
    withinMaterialLimits,
    maxConcreteCompressionStrain: final.response.maxConcrete,
    concreteLimitStrain: final.response.concreteLimit,
    maxSteelStrain: final.response.maxSteel,
    deflectionXmm: final.response.dx,
    deflectionYmm: final.response.dy,
    totalMomentXKnM: final.targetMx,
    totalMomentYKnM: final.targetMy,
    iterations: iterationTotal,
    residual: Math.max(...final.values.map(Math.abs)),
    reason: withinMaterialLimits ? "Équilibre stable convergé dans le modèle isolé, sous les hypothèses BAEL retenues." : !stableEquilibrium ? "Un état d’équilibre a été trouvé, mais sa rigidité tangentielle est instable; la stabilité A.4.4 n’est pas satisfaite." : final.response.maxConcrete > final.response.concreteLimit ? `L’équilibre dépasse la limite BAEL de raccourcissement du béton (${(final.response.concreteLimit * 1000).toFixed(1)} ‰); la stabilité n’est pas satisfaite.` : "La déformation acier dépasse la limite BAEL de 10 ‰; la stabilité n’est pas satisfaite.",
  };
}
