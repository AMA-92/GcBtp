export const CLIMATE_ACTION_SCHEMA_VERSION = 1 as const;

export type ClimateInputOrigin = "official" | "user-input" | "provisional" | "to-confirm";
export type ClimateFieldSource = { status: ClimateInputOrigin | "calculated"; source: string };
export type ClimateSpectrumPoint = { periodS: number; accelerationG: number };
export type ClimateActionInput = {
  sources?: Record<string, ClimateFieldSource>;
  metadata: {
    country: string;
    city: string;
    location: string;
    altitudeM: number | null;
    terrainCategory: string;
    seismicZone: string;
    soilClass: string;
    importanceClass: string;
    designLifeYears: number | null;
  };
  geometry: {
    storyHeightsM: number[];
    projectedWidthXM: number;
    projectedWidthYM: number;
    roofAreaM2: number;
    storyMassTonnes: number[];
  };
  wind: {
    basicSpeedMPerS: number | null;
    exposureFactor: number | null;
    orographyFactor: number | null;
    topographyFactor: number | null;
    netPressureCoefficientX: number | null;
    netPressureCoefficientY: number | null;
    airDensityKgM3: number;
  };
  snow: {
    groundLoadKnM2: number | null;
    shapeCoefficient: number | null;
    exposureCoefficient: number | null;
    thermalCoefficient: number | null;
    asymmetryRatio: number | null;
  };
  seismic: {
    referenceAccelerationG: number | null;
    importanceFactor: number | null;
    behaviourFactor: number | null;
    dampingFactor: number | null;
    spectrum: ClimateSpectrumPoint[];
    storyStiffnessKnPerM: number[];
  };
};

export type WindStoryLoad = { storyIndex: number; storyHeightM: number; projectedAreaXM2: number; projectedAreaYM2: number; xPlusKn: number; xMinusKn: number; yPlusKn: number; yMinusKn: number };
export type ClimateWindResult = { referencePressureKnM2: number; stories: WindStoryLoad[]; totalsKn: { xPlus: number; xMinus: number; yPlus: number; yMinus: number }; errors: string[]; warnings: string[] };
export type ClimateSnowResult = { roofPressureKnM2: number; totalKn: number; asymmetricX: { highHalfKn: number; lowHalfKn: number }; asymmetricY: { highHalfKn: number; lowHalfKn: number }; errors: string[]; warnings: string[] };
export type ClimateModeResult = { mode: number; periodS: number; frequencyHz: number; effectiveMassTonnes: number; cumulativeMassParticipation: number; designAccelerationG: number };
export type ClimateStorySeismicResult = { storyIndex: number; heightM: number; massTonnes: number; lateralForceKn: number; storyShearKn: number; displacementM: number; interstoryDriftM: number; driftRatio: number };
export type ClimateSeismicResult = { totalMassTonnes: number; baseShearKn: number; modes: ClimateModeResult[]; stories: ClimateStorySeismicResult[]; errors: string[]; warnings: string[] };
export type ClimateActionsResult = { wind: ClimateWindResult; snow: ClimateSnowResult; seismic: ClimateSeismicResult; errors: string[]; warnings: string[] };
export type CumulativeStoryLoad = { id: string; totalGk: number; totalQk: number };
export type StoryMassDistribution = { massesTonnes: number[]; totalTonnes: number; errors: string[] };

const isFinitePositive = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const isFiniteNonNegative = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

export function parseClimateSpectrum(text: string): { points: ClimateSpectrumPoint[]; errors: string[] } {
  const errors: string[] = [];
  const points: ClimateSpectrumPoint[] = [];
  const lines = text.split("\n").map(value => value.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const fields = line.split(/[;\t]/).map(value => Number(value.trim().replace(",", ".")));
    if (fields.length !== 2 || fields.some(value => !Number.isFinite(value))) {
      errors.push(`Spectre ligne ${index + 1} : saisir T(s);Sa/g avec deux nombres finis.`);
      continue;
    }
    const [periodS, accelerationG] = fields;
    if (periodS < 0 || accelerationG < 0) errors.push(`Spectre ligne ${index + 1} : la période et Sa/g ne peuvent pas être négatifs.`);
    else points.push({ periodS, accelerationG });
  }
  points.sort((a, b) => a.periodS - b.periodS);
  if (points.length < 2) errors.push("Saisir au moins deux points du spectre de calcul (T en s ; Sa/g), fournis par le référentiel du projet.");
  for (let index = 1; index < points.length; index++) if (points[index].periodS <= points[index - 1].periodS) errors.push("Les périodes du spectre doivent être strictement croissantes et uniques.");
  return { points, errors };
}

/** Convert bottom-to-top cumulative support loads into non-overlapping story masses. */
export function deriveStoryMassesFromCumulativeLoads(levelsBottomToTop: CumulativeStoryLoad[], permanentFraction: number, variableFraction: number, gravityMPerS2 = 9.80665): StoryMassDistribution {
  const errors: string[] = [];
  if (!isFiniteNonNegative(permanentFraction) || !isFiniteNonNegative(variableFraction)) errors.push("Les fractions de masse G/Q doivent être finies et positives ou nulles.");
  if (!isFinitePositive(gravityMPerS2)) errors.push("L’accélération de pesanteur de la source de masse est invalide.");
  const massesTonnes = levelsBottomToTop.map((level, index) => {
    const above = levelsBottomToTop[index + 1];
    const deltaG = level.totalGk - (above?.totalGk ?? 0);
    const deltaQ = level.totalQk - (above?.totalQk ?? 0);
    if (!Number.isFinite(deltaG) || !Number.isFinite(deltaQ)) {
      errors.push(`Charges cumulées non finies au niveau ${level.id}.`);
      return 0;
    }
    const tolerance = Math.max(0.01, Math.abs(level.totalGk) * 1e-6, Math.abs(level.totalQk) * 1e-6);
    if (deltaG < -tolerance || deltaQ < -tolerance) errors.push(`Les charges cumulées G/Q augmentent en montant au niveau ${level.id} ; la distribution par étage ne peut pas être déduite sans ambiguïté.`);
    const incrementalG = Math.max(0, deltaG);
    const incrementalQ = Math.max(0, deltaQ);
    return (incrementalG * permanentFraction + incrementalQ * variableFraction) / gravityMPerS2;
  });
  return { massesTonnes, totalTonnes: massesTonnes.reduce((sum, value) => sum + value, 0), errors };
}

function validateSpectrum(points: ClimateSpectrumPoint[]): string[] {
  const errors: string[] = [];
  if (points.length < 2) return ["Le spectre sismique utilisateur doit comporter au moins deux points."];
  for (let index = 0; index < points.length; index++) {
    const item = points[index];
    if (!Number.isFinite(item.periodS) || item.periodS < 0 || !isFiniteNonNegative(item.accelerationG)) errors.push(`Point de spectre ${index + 1} invalide.`);
    if (index > 0 && item.periodS <= points[index - 1].periodS) errors.push("Les périodes du spectre doivent être strictement croissantes et uniques.");
  }
  return errors;
}

function interpolateSpectrum(points: ClimateSpectrumPoint[], periodS: number): number | null {
  if (!points.length || periodS < points[0].periodS || periodS > points[points.length - 1].periodS) return null;
  if (periodS === points[0].periodS) return points[0].accelerationG;
  for (let index = 1; index < points.length; index++) {
    const right = points[index];
    if (periodS <= right.periodS) {
      const left = points[index - 1];
      const ratio = (periodS - left.periodS) / (right.periodS - left.periodS);
      return left.accelerationG + ratio * (right.accelerationG - left.accelerationG);
    }
  }
  return points[points.length - 1].accelerationG;
}

function eigenSymmetricJacobi(matrix: number[][]): { values: number[]; vectors: number[][] } {
  const n = matrix.length;
  const a = matrix.map(row => row.slice());
  const vectors: number[][] = Array.from({ length: n }, (_, row) => Array.from({ length: n }, (_, column) => row === column ? 1 : 0));
  const maxIterations = Math.max(1, 80 * n * n);
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let p = 0, q = 0, largest = 0;
    for (let row = 0; row < n; row++) for (let column = row + 1; column < n; column++) {
      const candidate = Math.abs(a[row][column]);
      if (candidate > largest) { largest = candidate; p = row; q = column; }
    }
    if (largest < 1e-10) break;
    const angle = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const app = a[p][p], aqq = a[q][q], apq = a[p][q];
    a[p][p] = cosine * cosine * app - 2 * sine * cosine * apq + sine * sine * aqq;
    a[q][q] = sine * sine * app + 2 * sine * cosine * apq + cosine * cosine * aqq;
    a[p][q] = 0; a[q][p] = 0;
    for (let k = 0; k < n; k++) if (k !== p && k !== q) {
      const akp = a[k][p], akq = a[k][q];
      a[k][p] = cosine * akp - sine * akq; a[p][k] = a[k][p];
      a[k][q] = sine * akp + cosine * akq; a[q][k] = a[k][q];
    }
    for (let k = 0; k < n; k++) {
      const vkp = vectors[k][p], vkq = vectors[k][q];
      vectors[k][p] = cosine * vkp - sine * vkq;
      vectors[k][q] = sine * vkp + cosine * vkq;
    }
  }
  const order = Array.from({ length: n }, (_, index) => index).sort((left, right) => a[right][right] - a[left][left]);
  return { values: order.map(index => a[index][index]), vectors: vectors.map(row => order.map(index => row[index])) };
}

function computeSeismic(input: ClimateActionInput): ClimateSeismicResult {
  const errors: string[] = [], warnings: string[] = [];
  const { seismic, geometry, metadata } = input;
  const n = geometry.storyHeightsM.length;
  const masses = geometry.storyMassTonnes;
  const stiffness = seismic.storyStiffnessKnPerM;
  if (n === 0) errors.push("Aucun niveau d’étage n’est disponible pour l’analyse sismique.");
  if (masses.length !== n || masses.some(value => !isFinitePositive(value))) errors.push("La masse sismique par étage doit être calculée et positive pour chaque niveau.");
  if (stiffness.length !== n || stiffness.some(value => !isFinitePositive(value))) errors.push("Une raideur latérale positive et documentée est requise pour chaque étage afin de calculer modes et dérives.");
  if (geometry.storyHeightsM.some(value => !isFinitePositive(value))) errors.push("Toutes les hauteurs d’étage doivent être strictement positives.");
  if (!isFinitePositive(seismic.referenceAccelerationG)) errors.push("Accélération de référence sismique (g) manquante ou invalide.");
  if (!isFinitePositive(seismic.importanceFactor)) errors.push("Facteur d’importance sismique manquant ou invalide.");
  if (!isFinitePositive(seismic.behaviourFactor)) errors.push("Facteur de comportement q manquant ou invalide.");
  if (!isFinitePositive(seismic.dampingFactor)) errors.push("Facteur de correction d’amortissement manquant ou invalide.");
  errors.push(...validateSpectrum(seismic.spectrum));
  const totalMassTonnes = masses.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  if (errors.length) return { totalMassTonnes, baseShearKn: 0, modes: [], stories: [], errors, warnings };
  if (!metadata.seismicZone.trim() || !metadata.soilClass.trim()) warnings.push("Zone sismique ou classe de sol non renseignée ; le spectre doit être justifié par une source locale.");
  if (metadata.altitudeM === null) warnings.push("Altitude non renseignée ; vérifier si elle intervient dans les données sismiques locales.");
  const matrix = Array.from({ length: n }, () => Array(n).fill(0) as number[]);
  for (let story = 0; story < n; story++) {
    matrix[story][story] += stiffness[story];
    if (story > 0) {
      matrix[story - 1][story - 1] += stiffness[story];
      matrix[story][story - 1] -= stiffness[story];
      matrix[story - 1][story] -= stiffness[story];
    }
  }
  const dynamicMatrix = matrix.map((row, i) => row.map((value, j) => value / Math.sqrt(masses[i] * masses[j])));
  const eigen = eigenSymmetricJacobi(dynamicMatrix);
  const modalData: Array<{ periodS: number; effectiveMassTonnes: number; participation: number; accelerationG: number; forceByStory: number[]; displacementByStory: number[] }> = [];
  let cumulativeMassParticipation = 0;
  for (let mode = 0; mode < n; mode++) {
    const lambda = eigen.values[mode];
    if (!(lambda > 0) || !Number.isFinite(lambda)) { errors.push(`Mode ${mode + 1} instable : valeur propre non positive.`); continue; }
    const periodS = 2 * Math.PI / Math.sqrt(lambda);
    const spectralAccelerationG = interpolateSpectrum(seismic.spectrum, periodS);
    if (spectralAccelerationG === null) {
      errors.push(`Le spectre fourni ne couvre pas T=${periodS.toFixed(3)} s du mode ${mode + 1}. Étendre les points T–Sa/g sans extrapolation automatique.`);
      continue;
    }
    const shape = Array.from({ length: n }, (_, story) => eigen.vectors[story][mode] / Math.sqrt(masses[story]));
    const modalMass = shape.reduce((sum, value, story) => sum + masses[story] * value * value, 0);
    const participationNumerator = shape.reduce((sum, value, story) => sum + masses[story] * value, 0);
    const gamma = participationNumerator / modalMass;
    const effectiveMassTonnes = participationNumerator * participationNumerator / modalMass;
    const participation = effectiveMassTonnes / totalMassTonnes;
    cumulativeMassParticipation += participation;
    const designAccelerationG = spectralAccelerationG * seismic.importanceFactor! * seismic.dampingFactor! / seismic.behaviourFactor!;
    const spectralDisplacementM = designAccelerationG * 9.80665 * periodS * periodS / (4 * Math.PI * Math.PI);
    modalData.push({
      periodS,
      effectiveMassTonnes,
      participation,
      accelerationG: designAccelerationG,
      forceByStory: shape.map((value, story) => Math.abs(masses[story] * value * gamma * designAccelerationG * 9.80665)),
      displacementByStory: shape.map(value => value * gamma * spectralDisplacementM),
    });
  }
  if (errors.length) return { totalMassTonnes, baseShearKn: 0, modes: [], stories: [], errors, warnings };
  const forceByStory = Array.from({ length: n }, (_, story) => Math.sqrt(modalData.reduce((sum, mode) => sum + mode.forceByStory[story] ** 2, 0)));
  const displacementByStory = Array.from({ length: n }, (_, story) => Math.sqrt(modalData.reduce((sum, mode) => sum + mode.displacementByStory[story] ** 2, 0)));
  const driftByStory = Array.from({ length: n }, (_, story) => Math.sqrt(modalData.reduce((sum, mode) => {
    const previous = story ? mode.displacementByStory[story - 1] : 0;
    return sum + (mode.displacementByStory[story] - previous) ** 2;
  }, 0)));
  const stories = Array.from({ length: n }, (_, story) => ({
    storyIndex: story,
    heightM: geometry.storyHeightsM[story],
    massTonnes: masses[story],
    lateralForceKn: forceByStory[story],
    storyShearKn: forceByStory.slice(story).reduce((sum, value) => sum + value, 0),
    displacementM: displacementByStory[story],
    interstoryDriftM: driftByStory[story],
    driftRatio: driftByStory[story] / geometry.storyHeightsM[story],
  }));
  if (cumulativeMassParticipation < 0.9) warnings.push(`Participation massique cumulée des modes calculés : ${(cumulativeMassParticipation * 100).toFixed(1)} % (<90 %). Augmenter les modes ou revoir le modèle dynamique.`);
  warnings.push("Analyse modale par bâtiment en cisaillement équivalent à raideurs d’étage saisies ; modes combinés par SRSS. Pas de diaphragme, torsion, couplage de portiques/voiles, effets P-Δ ni vérification normative.");
  return {
    totalMassTonnes,
    baseShearKn: Math.sqrt(modalData.reduce((sum, mode) => sum + mode.forceByStory.reduce((total, value) => total + value, 0) ** 2, 0)),
    modes: modalData.map((mode, index) => ({ mode: index + 1, periodS: mode.periodS, frequencyHz: 1 / mode.periodS, effectiveMassTonnes: mode.effectiveMassTonnes, cumulativeMassParticipation: modalData.slice(0, index + 1).reduce((sum, item) => sum + item.participation, 0), designAccelerationG: mode.accelerationG })),
    stories,
    errors,
    warnings,
  };
}

export function generateClimateActions(input: ClimateActionInput): ClimateActionsResult {
  const warnings: string[] = [];
  const windErrors: string[] = [];
  const { geometry, wind, snow } = input;
  if (!geometry.storyHeightsM.length || geometry.storyHeightsM.some(value => !isFinitePositive(value))) windErrors.push("Hauteurs d’étage manquantes ou invalides.");
  if (!isFinitePositive(geometry.projectedWidthXM) || !isFinitePositive(geometry.projectedWidthYM)) windErrors.push("Dimensions de façade manquantes ou invalides.");
  if (!isFinitePositive(wind.basicSpeedMPerS)) windErrors.push("Vitesse de vent de base manquante ; fournir la valeur et sa source.");
  if (!isFinitePositive(wind.exposureFactor) || !isFinitePositive(wind.orographyFactor) || !isFinitePositive(wind.topographyFactor)) windErrors.push("Facteurs d’exposition, d’orographie et de topographie positifs requis.");
  if (!isFinitePositive(wind.netPressureCoefficientX) || !isFinitePositive(wind.netPressureCoefficientY)) windErrors.push("Coefficients nets de pression X et Y requis séparément.");
  const stories: WindStoryLoad[] = [];
  let referencePressureKnM2 = 0;
  if (!windErrors.length) {
    referencePressureKnM2 = 0.5 * wind.airDensityKgM3 * (wind.basicSpeedMPerS as number) ** 2 * (wind.exposureFactor as number) * (wind.orographyFactor as number) * (wind.topographyFactor as number) / 1000;
    let elevation = 0;
    for (let storyIndex = 0; storyIndex < geometry.storyHeightsM.length; storyIndex++) {
      const height = geometry.storyHeightsM[storyIndex];
      const midHeight = elevation + height / 2;
      const projectedAreaXM2 = geometry.projectedWidthYM * height;
      const projectedAreaYM2 = geometry.projectedWidthXM * height;
      const x = referencePressureKnM2 * (wind.netPressureCoefficientX as number) * projectedAreaXM2;
      const y = referencePressureKnM2 * (wind.netPressureCoefficientY as number) * projectedAreaYM2;
      stories.push({ storyIndex, storyHeightM: midHeight, projectedAreaXM2, projectedAreaYM2, xPlusKn: x, xMinusKn: x, yPlusKn: y, yMinusKn: y });
      elevation += height;
    }
    warnings.push("Pressions de référence simplifiées à partir de la vitesse et de facteurs/coefficient nets saisis ; aucune zone de façade/toiture, variation avec z ni pression intérieure réglementaire n’est reconstruite automatiquement.");
  }
  const windTotalsKn = {
    xPlus: stories.reduce((sum, story) => sum + story.xPlusKn, 0),
    xMinus: stories.reduce((sum, story) => sum + story.xMinusKn, 0),
    yPlus: stories.reduce((sum, story) => sum + story.yPlusKn, 0),
    yMinus: stories.reduce((sum, story) => sum + story.yMinusKn, 0),
  };
  const snowErrors: string[] = [];
  if (!isFiniteNonNegative(snow.groundLoadKnM2)) snowErrors.push("Charge de neige au sol requise ; 0 n’est admis que si confirmé comme valeur applicable.");
  if (!isFinitePositive(snow.shapeCoefficient) || !isFinitePositive(snow.exposureCoefficient) || !isFinitePositive(snow.thermalCoefficient)) snowErrors.push("Coefficients de forme, exposition et thermique positifs requis.");
  if (!isFinitePositive(geometry.roofAreaM2)) snowErrors.push("Aire réelle de toiture manquante ou nulle.");
  if (snow.asymmetryRatio === null || !Number.isFinite(snow.asymmetryRatio) || snow.asymmetryRatio < 0 || snow.asymmetryRatio > 1) snowErrors.push("Le ratio de dissymétrie doit être compris entre 0 et 1.");
  let snowResult: ClimateSnowResult = { roofPressureKnM2: 0, totalKn: 0, asymmetricX: { highHalfKn: 0, lowHalfKn: 0 }, asymmetricY: { highHalfKn: 0, lowHalfKn: 0 }, errors: snowErrors, warnings: [] };
  if (!snowErrors.length) {
    const roofPressureKnM2 = (snow.groundLoadKnM2 as number) * (snow.shapeCoefficient as number) * (snow.exposureCoefficient as number) * (snow.thermalCoefficient as number);
    const totalKn = roofPressureKnM2 * geometry.roofAreaM2;
    const ratio = snow.asymmetryRatio as number;
    snowResult = {
      roofPressureKnM2,
      totalKn,
      asymmetricX: { highHalfKn: totalKn / 2 * (1 + ratio), lowHalfKn: totalKn / 2 * (1 - ratio) },
      asymmetricY: { highHalfKn: totalKn / 2 * (1 + ratio), lowHalfKn: totalKn / 2 * (1 - ratio) },
      errors: [],
      warnings: ["Charge sur toiture calculée par coefficient global utilisateur ; dérives de pluie, accumulation, obstacles et cas normatifs de dissymétrie ne sont pas automatiquement vérifiés."],
    };
  }
  if (windErrors.length) warnings.push(...windErrors);
  if (snowErrors.length) warnings.push(...snowErrors);
  const seismic = computeSeismic(input);
  warnings.push(...snowResult.warnings, ...seismic.warnings);
  return {
    wind: { referencePressureKnM2, stories, totalsKn: windTotalsKn, errors: windErrors, warnings: windErrors.length ? [] : ["Convention +/− : mêmes amplitudes opposées ; les coefficients de pression signés restent à confirmer par l’utilisateur."] },
    snow: snowResult,
    seismic,
    errors: [...windErrors, ...snowResult.errors, ...seismic.errors],
    warnings,
  };
}
