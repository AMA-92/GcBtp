/**
 * Nouveau moteur autonome de vérification des poteaux en béton armé.
 *
 * Ce module est volontairement indépendant des anciens moteurs de calcul du
 * dépôt. Il ne génère ni ne remplace les armatures saisies par l'utilisateur.
 * Les résultats sont une vérification de la configuration fournie.
 */

export type ColumnStandard = "bael-91-mod-99" | "eurocode-2";
export type ColumnStatus = "conforme" | "non conforme" | "calcul incomplet";
export type ColumnAxis = "x" | "y";
export type ColumnCheckStatus = "satisfaisant" | "non satisfaisant" | "bloqué" | "en attente du ferraillage" | "à renseigner" | "bloqué — contrôle non implémenté" | "à vérifier";

export type ColumnBar = {
  id?: string;
  diameterMm: number;
  xMm: number;
  yMm: number;
};

export type ColumnTie = {
  diameterMm: number;
  spacingMm: number;
};

export type ColumnActions = {
  GkKn?: number;
  QkKn?: number;
  M0xKnM?: number;
  M0yKnM?: number;
  NEdKn?: number;
  MEdxKnM?: number;
  MEdyKnM?: number;
  gammaG?: number;
  gammaQ?: number;
  source?: string;
};

export type ColumnDesignInput = {
  id: string;
  standard: ColumnStandard;
  section: { widthMm: number; depthMm: number };
  orientationDeg?: number;
  clearHeightMm: number;
  bucklingLengthMm?: { x?: number; y?: number };
  concrete: { fckMpa: number; gammaC?: number; alphaCC?: number };
  steel: { fykMpa: number; gammaS?: number; EsMpa?: number };
  coverMm: number;
  actions: ColumnActions;
  longitudinalBars: ColumnBar[];
  ties: ColumnTie;
  anchorage?: {
    availableTopMm?: number;
    availableBottomMm?: number;
    type?: "droit" | "crochet" | "ancrage mécanique";
    bondCondition?: "bonne" | "autre";
  };
  minClearSpacingMm?: number;
  maxSlenderness?: number;
};

export type ColumnCheck = {
  id: string;
  label: string;
  status: ColumnCheckStatus;
  utilization: number | null;
  demand: number | null;
  resistance: number | null;
  unit: string;
  formula: string;
  message?: string;
};

export type ColumnDesignResult = {
  id: string;
  standard: ColumnStandard;
  status: ColumnStatus;
  actions: {
    NEdKn: number | null;
    MEdxKnM: number | null;
    MEdyKnM: number | null;
    origin: string;
  };
  traceability: {
    orientationDeg: number;
    section: { widthMm: number; depthMm: number };
    concrete: ColumnDesignInput["concrete"];
    steel: ColumnDesignInput["steel"];
    clearHeightMm: number;
    bucklingLengthMm: ColumnDesignInput["bucklingLengthMm"];
    selectedBarCount: number;
  };
  geometry: {
    areaMm2: number;
    inertiaXmm4: number;
    inertiaYmm4: number;
    radiusXmm: number;
    radiusYmm: number;
    perimeterMm: number;
  };
  reinforcement: {
    providedAreaMm2: number;
    minimumAreaMm2: number | null;
    maximumAreaMm2: number;
    ratio: number;
  };
  slenderness: { x: number | null; y: number | null };
  checks: ColumnCheck[];
  warnings: string[];
  notes: string[];
};

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const positive = (v: unknown): v is number => finite(v) && v > 0;
const areaOfBar = (d: number) => Math.PI * d * d / 4;
const maxAbs = (values: number[]) => Math.max(...values.map(Math.abs), 0);

function check(id: string, label: string, demand: number, resistance: number, unit: string, formula: string, message?: string): ColumnCheck {
  const utilization = resistance > 0 ? demand / resistance : Number.POSITIVE_INFINITY;
  return { id, label, status: utilization <= 1 + 1e-9 ? "satisfaisant" : "non satisfaisant", utilization, demand, resistance, unit, formula, message };
}

function blocked(id: string, label: string, formula: string, message: string): ColumnCheck {
  return { id, label, status: "bloqué", utilization: null, demand: null, resistance: null, unit: "—", formula, message };
}

function solve3x3(matrix: number[][], vector: number[]) {
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let row = col + 1; row < 3; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-14) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = col + 1; row < 3; row++) {
      const factor = a[row][col] / a[col][col];
      for (let j = col; j < 4; j++) a[row][j] -= factor * a[col][j];
    }
  }
  const result = [0, 0, 0];
  for (let row = 2; row >= 0; row--) result[row] = (a[row][3] - a[row][row + 1] * result[row + 1] - (row < 2 ? a[row][row + 2] * result[row + 2] : 0)) / a[row][row];
  return result;
}

type Fiber = { x: number; y: number; area: number };
function sectionResponse(input: ColumnDesignInput, state: number[], fibers: Fiber[], bars: ColumnBar[]) {
  const { widthMm: b, depthMm: h } = input.section;
  const fcd = (input.concrete.alphaCC ?? 0.85) * input.concrete.fckMpa / (input.concrete.gammaC ?? 1.5);
  const fyd = input.steel.fykMpa / (input.steel.gammaS ?? 1.15);
  const Es = input.steel.EsMpa ?? 200_000;
  const steelAreaByBar = bars.map(bar => areaOfBar(bar.diameterMm));
  const [eps0, kx, ky] = state;
  let n = 0, mx = 0, my = 0, maxConcreteCompression = 0, maxSteelStrain = 0;
  const concreteStress = (strain: number) => {
    if (strain >= 0) return 0;
    const c = Math.min(-strain / 0.002, 1);
    return -fcd * (2 * c - c * c);
  };
  for (const fiber of fibers) {
    const strain = eps0 + kx * fiber.y + ky * fiber.x;
    const stress = concreteStress(strain);
    n += stress * fiber.area / 1000;
    mx += stress * fiber.y * fiber.area / 1e6;
    my += stress * fiber.x * fiber.area / 1e6;
    maxConcreteCompression = Math.max(maxConcreteCompression, -Math.min(0, strain));
  }
  bars.forEach((bar, i) => {
    const strain = eps0 + kx * bar.yMm + ky * bar.xMm;
    const stress = Math.max(-fyd, Math.min(fyd, Es * strain));
    const a = steelAreaByBar[i];
    n += stress * a / 1000;
    mx += stress * bar.yMm * a / 1e6;
    my += stress * bar.xMm * a / 1e6;
    maxSteelStrain = Math.max(maxSteelStrain, Math.abs(strain));
  });
  return { n, mx, my, maxConcreteCompression, maxSteelStrain, b, h };
}

/** Fibres béton + barres réelles; aucune disposition théorique n'est inventée. */
function biaxialCapacity(input: ColumnDesignInput, NEd: number, Mx: number, My: number) {
  const { widthMm: b, depthMm: h } = input.section;
  const cells = 24;
  const fibers: Fiber[] = [];
  const cellArea = b * h / (cells * cells);
  for (let iy = 0; iy < cells; iy++) for (let ix = 0; ix < cells; ix++) fibers.push({ x: -b / 2 + (ix + .5) * b / cells, y: -h / 2 + (iy + .5) * h / cells, area: cellArea });
  const demand = [NEd, Mx, My];
  const momentMagnitude = Math.hypot(Mx, My);
  const theta = momentMagnitude > 1e-9 ? Math.atan2(My, Mx) : 0;
  let bestLambda = 0;
  let bestState: number[] | null = null;
  const target = (lambda: number) => [demand[0] * lambda, demand[1] * lambda, demand[2] * lambda];
  const solveAt = (lambda: number) => {
    let state = [Math.min(-0.001, -Math.abs(NEd) * 1000 / Math.max(input.section.widthMm * input.section.depthMm * 10_000, 1)), 0, 0];
    // Seed curvature in the requested biaxial moment direction.
    state[1] = -Math.sin(theta) * 0.001 / Math.max(h, b);
    state[2] = -Math.cos(theta) * 0.001 / Math.max(h, b);
    for (let iteration = 0; iteration < 45; iteration++) {
      const response = sectionResponse(input, state, fibers, input.longitudinalBars);
      const residual = [response.n - target(lambda)[0], response.mx - target(lambda)[1], response.my - target(lambda)[2]];
      if (maxAbs(residual) < Math.max(1e-4, Math.abs(NEd) * 1e-6)) return { state, response };
      const jacobian: number[][] = [];
      for (let i = 0; i < 3; i++) {
        const perturbed = [...state];
        const step = i === 0 ? 1e-6 : 1e-8 / Math.max(b, h);
        perturbed[i] += step;
        const next = sectionResponse(input, perturbed, fibers, input.longitudinalBars);
        jacobian.push([(next.n - response.n) / step, (next.mx - response.mx) / step, (next.my - response.my) / step]);
      }
      const delta = solve3x3(jacobian, residual.map(v => -v));
      if (!delta) return null;
      state = state.map((v, i) => v + delta[i]);
      if (state.some(v => !finite(v) || Math.abs(v) > 0.1)) return null;
    }
    return null;
  };
  let low = 0, high = 1;
  for (let i = 0; i < 14; i++) {
    const solved = solveAt(high);
    const feasible = !!solved && solved.response.maxConcreteCompression <= 0.0035 + 1e-7 && solved.response.maxSteelStrain <= 0.025 + 1e-7;
    if (feasible) high *= 2; else break;
  }
  for (let i = 0; i < 32; i++) {
    const mid = (low + high) / 2;
    const solved = solveAt(mid);
    const feasible = !!solved && solved.response.maxConcreteCompression <= 0.0035 + 1e-7 && solved.response.maxSteelStrain <= 0.025 + 1e-7;
    if (feasible) { low = mid; bestLambda = mid; bestState = solved!.state; } else high = mid;
  }
  return { capacityFactor: bestLambda, converged: bestState !== null, governingConcreteStrain: bestState ? sectionResponse(input, bestState, fibers, input.longitudinalBars).maxConcreteCompression : null };
}

function anchorageRequirement(input: ColumnDesignInput, largestDiameterMm: number) {
  const fyk = input.steel.fykMpa;
  const gammaS = input.steel.gammaS ?? 1.15;
  const fck = input.concrete.fckMpa;
  if (input.standard === "bael-91-mod-99") {
    const psiS = 1.5;
    const ft28 = 0.6 + 0.06 * fck;
    const tauSu = 0.6 * psiS ** 2 * ft28;
    const lengthMm = largestDiameterMm * fyk / (4 * tauSu);
    return { lengthMm, formula: `BAEL A.6.1,221 : ls = Φ·fe/(4·τsu), τsu = 0,6·ψs²·ft28 = ${tauSu.toFixed(3)} MPa`, intermediates: `ft28 = ${ft28.toFixed(3)} MPa ; fyk = ${fyk.toFixed(1)} MPa ; Φ = ${largestDiameterMm.toFixed(1)} mm` };
  }
  const fctm = 0.3 * fck ** (2 / 3);
  const fctd = 0.7 * fctm / (input.concrete.gammaC ?? 1.5);
  const eta1 = input.anchorage?.bondCondition === "bonne" ? 1 : 0.7;
  const eta2 = largestDiameterMm <= 32 ? 1 : (132 - largestDiameterMm) / 100;
  const fbd = 2.25 * eta1 * eta2 * fctd;
  const lengthMm = largestDiameterMm / 4 * (fyk / gammaS) / Math.max(fbd, 1e-9);
  return { lengthMm, formula: `EC2 8.4 : lb,rqd = Φ/4·σsd/fbd, fbd = 2,25·η1·η2·fctd = ${fbd.toFixed(3)} MPa`, intermediates: `fctm = ${fctm.toFixed(3)} MPa ; fctd = ${fctd.toFixed(3)} MPa ; η1 = ${eta1.toFixed(2)} ; η2 = ${eta2.toFixed(2)} ; fyd = ${(fyk / gammaS).toFixed(1)} MPa` };
}

export type ColumnPredesignInput = Omit<ColumnDesignInput, "section" | "longitudinalBars" | "anchorage"> & {
  initialSection: { widthMm: number; depthMm: number };
  candidateSections?: Array<{ widthMm: number; depthMm: number }>;
  availableBarDiametersMm?: number[];
};

export type ColumnPredesignCandidate = {
  section: { widthMm: number; depthMm: number };
  estimatedLongitudinalAreaMm2: number;
  estimatedBarDiameterMm: number;
  estimatedBarCount: number;
  axialResistanceKn: number;
  interactionEstimate: number | null;
  status: "proposition préliminaire" | "rejetée par le pré-contrôle" | "à vérifier";
  reason: string;
};

export type ColumnPredesignResult = {
  id: string;
  status: "propositions disponibles" | "calcul incomplet";
  actions: { NEdKn: number | null; MEdxKnM: number | null; MEdyKnM: number | null; origin: string };
  initialSection: { widthMm: number; depthMm: number; provisional: true };
  candidates: ColumnPredesignCandidate[];
  warnings: string[];
  notes: string[];
};

/**
 * Phase 1 : estimation de section et d'acier. Elle ne demande ni barres
 * définitives ni longueur d'ancrage et ne délivre jamais une conformité finale.
 */
export function predesignColumn(input: ColumnPredesignInput): ColumnPredesignResult {
  const gammaG = input.actions.gammaG ?? 1.35;
  const gammaQ = input.actions.gammaQ ?? 1.5;
  const hasCombination = [input.actions.GkKn, input.actions.QkKn, input.actions.M0xKnM, input.actions.M0yKnM].every(finite);
  const hasDesign = [input.actions.NEdKn, input.actions.MEdxKnM, input.actions.MEdyKnM].every(finite);
  const NEd = hasDesign ? input.actions.NEdKn! : hasCombination ? gammaG * input.actions.GkKn! + gammaQ * input.actions.QkKn! : null;
  const Mx = hasDesign ? input.actions.MEdxKnM! : hasCombination ? input.actions.M0xKnM! : null;
  const My = hasDesign ? input.actions.MEdyKnM! : hasCombination ? input.actions.M0yKnM! : null;
  const origin = hasDesign ? (input.actions.source ?? "efforts de dimensionnement fournis") : hasCombination ? `NEd = ${gammaG}·Gk + ${gammaQ}·Qk` : "efforts ELU absents";
  const initialSection = { ...input.initialSection, provisional: true as const };
  const candidates = input.candidateSections?.length ? input.candidateSections : [
    initialSection,
    { widthMm: input.initialSection.widthMm + 50, depthMm: input.initialSection.depthMm },
    { widthMm: input.initialSection.widthMm, depthMm: input.initialSection.depthMm + 50 },
    { widthMm: input.initialSection.widthMm + 50, depthMm: input.initialSection.depthMm + 50 },
  ];
  if (NEd === null || Mx === null || My === null) return { id: input.id, status: "calcul incomplet", actions: { NEdKn: NEd, MEdxKnM: Mx, MEdyKnM: My, origin }, initialSection, candidates: [], warnings: ["Calcul incomplet : donnée requise — efforts d'une même combinaison requis."], notes: ["Aucune section n'est retenue sans sollicitations cohérentes."] };
  const fcd = (input.concrete.alphaCC ?? 0.85) * input.concrete.fckMpa / (input.concrete.gammaC ?? 1.5);
  const fyd = input.steel.fykMpa / (input.steel.gammaS ?? 1.15);
  const diameters = (input.availableBarDiametersMm ?? [12, 14, 16, 20]).filter(positive).sort((a, b) => a - b);
  const resultCandidates: ColumnPredesignCandidate[] = candidates.map(section => {
    const area = section.widthMm * section.depthMm;
    const asMin = input.standard === "bael-91-mod-99" ? Math.max(.002 * area, .4 * 2 * (section.widthMm + section.depthMm)) : Math.max(.1 * NEd * 1000 / fyd, .002 * area);
    const asRequiredAxial = Math.max(asMin, Math.max(0, (Math.abs(NEd) * 1000 - .8 * area * fcd) / Math.max(fyd, 1e-9)));
    const diameter = diameters[0] ?? 12;
    const count = Math.max(4, Math.ceil(asRequiredAxial / areaOfBar(diameter)));
    const asEstimated = count * areaOfBar(diameter);
    const axialResistance = (.8 * area * fcd + asEstimated * fyd) / 1000;
    const leverX = Math.max(section.depthMm * .8, 1);
    const leverY = Math.max(section.widthMm * .8, 1);
    const mxCapacity = Math.max(asEstimated * fyd * leverX / 1e6, 1e-6);
    const myCapacity = Math.max(asEstimated * fyd * leverY / 1e6, 1e-6);
    const interaction = Math.abs(NEd) / Math.max(axialResistance, 1e-9) + Math.abs(Mx) / mxCapacity + Math.abs(My) / myCapacity;
    const valid = positive(section.widthMm) && positive(section.depthMm) && asEstimated <= .05 * area && axialResistance >= Math.abs(NEd) && interaction <= 1;
    return { section, estimatedLongitudinalAreaMm2: asEstimated, estimatedBarDiameterMm: diameter, estimatedBarCount: count, axialResistanceKn: axialResistance, interactionEstimate: interaction, status: valid ? "proposition préliminaire" : "rejetée par le pré-contrôle", reason: valid ? "Pré-contrôle géométrique, axial et interaction indicative satisfaits; validation détaillée N–Mx–My et stabilité encore requise." : interaction > 1 ? "Interaction indicative supérieure à 1; revoir la section ou l'estimation d'acier." : "Section ou taux d'acier estimé incompatible avec les efforts." };
  });
  return { id: input.id, status: "propositions disponibles", actions: { NEdKn: NEd, MEdxKnM: Mx, MEdyKnM: My, origin }, initialSection, candidates: resultCandidates, warnings: ["Les propositions sont préliminaires : aucune conformité réglementaire finale n'est déclarée."], notes: ["La section initiale reste provisoire; aucune hauteur de fondation ni longueur de flambement n'a été modifiée.", "L'ancrage sera calculé uniquement après sélection des barres et renseignement des longueurs réellement disponibles."] };
}

export function designColumn(input: ColumnDesignInput): ColumnDesignResult {
  const checks: ColumnCheck[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  const { widthMm: b, depthMm: h } = input.section;
  const area = b * h;
  const ix4 = b * h ** 3 / 12;
  const iy4 = h * b ** 3 / 12;
  const rx = Math.sqrt(ix4 / area);
  const ry = Math.sqrt(iy4 / area);
  const perimeter = 2 * (b + h);
  const validGeometry = [b, h, input.clearHeightMm, input.coverMm, input.concrete.fckMpa, input.steel.fykMpa, input.ties.diameterMm, input.ties.spacingMm].every(positive);
  const actions = input.actions;
  const gammaG = actions.gammaG ?? 1.35, gammaQ = actions.gammaQ ?? 1.5;
  const hasCombination = [actions.GkKn, actions.QkKn, actions.M0xKnM, actions.M0yKnM].every(finite);
  const hasDesign = [actions.NEdKn, actions.MEdxKnM, actions.MEdyKnM].every(finite);
  const NEd = hasDesign ? actions.NEdKn! : hasCombination ? gammaG * actions.GkKn! + gammaQ * actions.QkKn! : null;
  const Mx = hasDesign ? actions.MEdxKnM! : hasCombination ? actions.M0xKnM! : null;
  const My = hasDesign ? actions.MEdyKnM! : hasCombination ? actions.M0yKnM! : null;
  const origin = hasDesign ? (actions.source ?? "efforts de dimensionnement fournis") : hasCombination ? `NEd = ${gammaG}·Gk + ${gammaQ}·Qk` : "efforts ELU absents";
  const barsValid = input.longitudinalBars.length > 0 && input.longitudinalBars.every(bar => positive(bar.diameterMm) && finite(bar.xMm) && finite(bar.yMm));
  const providedArea = barsValid ? input.longitudinalBars.reduce((sum, bar) => sum + areaOfBar(bar.diameterMm), 0) : 0;
  const fyd = input.steel.fykMpa / (input.steel.gammaS ?? 1.15);
  const minArea = NEd !== null ? input.standard === "bael-91-mod-99" ? Math.max(.002 * area, .4 * perimeter) : Math.max(.1 * NEd * 1000 / fyd, .002 * area) : null;
  const maxArea = .05 * area;
  const lowerInset = input.coverMm + input.ties.diameterMm;
  const positionsValid = barsValid && input.longitudinalBars.every(bar => Math.abs(bar.xMm) <= b / 2 - lowerInset - bar.diameterMm / 2 + 1e-6 && Math.abs(bar.yMm) <= h / 2 - lowerInset - bar.diameterMm / 2 + 1e-6);
  let minClear = Number.POSITIVE_INFINITY;
  for (let i = 0; i < input.longitudinalBars.length; i++) for (let j = i + 1; j < input.longitudinalBars.length; j++) {
    const a = input.longitudinalBars[i], c = input.longitudinalBars[j];
    minClear = Math.min(minClear, Math.hypot(a.xMm - c.xMm, a.yMm - c.yMm) - a.diameterMm / 2 - c.diameterMm / 2);
  }
  const requiredClear = input.minClearSpacingMm ?? 20;
  if (!validGeometry) checks.push(blocked("geometry", "Géométrie du poteau", "b > 0, h > 0, H > 0, enrobage et cadres positifs", "Calcul incomplet : donnée requise"));
  if (NEd === null || Mx === null || My === null) checks.push(blocked("actions", "Efforts de dimensionnement", "NEd, MEd,x et MEd,y requis", "Calcul incomplet : donnée requise — efforts par combinaison indisponibles."));
  checks.push({ id: "geometry-area", label: "Aire de béton", status: validGeometry ? "satisfaisant" : "bloqué", utilization: null, demand: area, resistance: area, unit: "mm²", formula: "Ac = b·h", message: `${b} × ${h} = ${area.toFixed(0)} mm²` });
  if (minArea !== null) checks.push(check("steel-min", "Armatures longitudinales minimales", minArea, providedArea, "mm²", input.standard === "bael-91-mod-99" ? "As,min = max(0,2 %·Ac ; 4 cm²/m·u)" : "As,min = max(0,10·NEd/fyd ; 0,2 %·Ac)"));
  else checks.push(blocked("steel-min", "Armatures longitudinales minimales", "NEd requis pour le minimum réglementaire", "Calcul incomplet : donnée requise"));
  checks.push(check("steel-max", "Armatures longitudinales maximales", providedArea, maxArea, "mm²", "As ≤ 5 %·Ac"));
  if (!barsValid) checks.push({ ...blocked("bar-input", "Armatures choisies par l'utilisateur", "Chaque barre doit avoir un diamètre et une position", input.longitudinalBars.length === 0 ? "En attente du ferraillage" : "À renseigner : diamètre et position de chaque barre."), status: input.longitudinalBars.length === 0 ? "en attente du ferraillage" : "à renseigner" });
  else {
    checks.push({ ...check("bar-cover-layout", "Enrobage et position des barres", positionsValid ? 0 : 1, 1, "—", "barre dans le contour utile = section − enrobage − cadre − Φ/2", positionsValid ? undefined : "Disposition des armatures non conforme : revoir l'espacement, l'enrobage ou les diamètres."), status: positionsValid ? "satisfaisant" : "non satisfaisant" });
    checks.push(check("bar-clear-spacing", "Espacement libre des barres", requiredClear, minClear, "mm", "sclair ≥ espacement minimal déclaré", minClear < requiredClear ? "Disposition des armatures non conforme : revoir l'espacement, l'enrobage ou les diamètres." : undefined));
  }
  if (!barsValid && input.longitudinalBars.length === 0) {
    checks.push({ id: "anchorage", label: "Longueur d'ancrage", status: "en attente du ferraillage", utilization: null, demand: null, resistance: null, unit: "mm", formula: "Calcul après sélection des barres : Φ, fyk, béton, adhérence, enrobage et longueur disponible", message: "En attente du ferraillage" });
  } else if (!barsValid) {
    checks.push({ id: "anchorage", label: "Longueur d'ancrage", status: "à renseigner", utilization: null, demand: null, resistance: null, unit: "mm", formula: "Diamètre et position de chaque barre requis avant le calcul d'ancrage", message: "À renseigner : ferraillage longitudinal valide." });
  } else if (input.anchorage?.type && input.anchorage.type !== "droit") {
    checks.push({ id: "anchorage", label: "Longueur d'ancrage", status: "bloqué — contrôle non implémenté", utilization: null, demand: null, resistance: null, unit: "mm", formula: `${input.standard === "bael-91-mod-99" ? "BAEL" : "EC2"} · ancrage ${input.anchorage.type}`, message: "Bloqué — contrôle non implémenté : le détail d'ancrage sélectionné doit être vérifié séparément." });
  } else if (!finite(input.anchorage?.availableTopMm) || !finite(input.anchorage?.availableBottomMm)) {
    checks.push({ id: "anchorage", label: "Longueur d'ancrage", status: "à renseigner", utilization: null, demand: null, resistance: null, unit: "mm", formula: "ls,req ≤ min(Ldisponible,tête ; Ldisponible,pied)", message: "À renseigner : longueurs réellement disponibles en tête et en pied." });
  } else {
    const largestDiameter = Math.max(...input.longitudinalBars.map(bar => bar.diameterMm));
    const anchorage = anchorageRequirement(input, largestDiameter);
    const available = Math.min(input.anchorage!.availableTopMm!, input.anchorage!.availableBottomMm!);
    checks.push(check("anchorage", "Longueur d'ancrage", anchorage.lengthMm, available, "mm", `${anchorage.formula} ; ${anchorage.intermediates} ; Ldisponible = min(${input.anchorage!.availableTopMm!.toFixed(0)} ; ${input.anchorage!.availableBottomMm!.toFixed(0)}) = ${available.toFixed(0)} mm`, available < anchorage.lengthMm ? "Longueur d'ancrage insuffisante : examiner les dispositions d'ancrage possibles." : undefined));
  }
  const tieLimit = input.standard === "bael-91-mod-99" ? Math.min(15 * maxAbs(input.longitudinalBars.map(bv => bv.diameterMm)), 400, Math.min(b, h) + 100) : Math.min(20 * maxAbs(input.longitudinalBars.map(bv => bv.diameterMm)), 400, Math.min(b, h));
  checks.push(check("ties", "Cadres et espacement", input.ties.spacingMm, tieLimit, "mm", `s ≤ ${input.standard === "bael-91-mod-99" ? "min(15·Φlong, 400, petit côté+100)" : "min(20·Φlong, 400, petit côté)"}`, input.ties.spacingMm > tieLimit ? "Armatures transversales non conformes : vérifier leur diamètre, leur espacement et le maintien des barres longitudinales." : undefined));
  const lambdaX = input.bucklingLengthMm?.x && rx > 0 ? input.bucklingLengthMm.x / rx : null;
  const lambdaY = input.bucklingLengthMm?.y && ry > 0 ? input.bucklingLengthMm.y / ry : null;
  if (lambdaX === null || lambdaY === null) checks.push(blocked("stability", "Élancement et stabilité", "λx = l0x/ix ; λy = l0y/iy", "Calcul incomplet : donnée requise — longueur(s) de flambement réelle(s) à renseigner."));
  else {
    const limit = input.maxSlenderness ?? 15;
    checks.push(check("slenderness", "Élancement dans les deux axes", Math.max(lambdaX, lambdaY), limit, "—", "λx = l0x/ix ; λy = l0y/iy", Math.max(lambdaX, lambdaY) > limit ? "Vérifier la stabilité du poteau : augmenter la section, revoir les conditions de maintien ou recalculer les effets du second ordre." : undefined));
  }
  let capacity: ReturnType<typeof biaxialCapacity> | null = null;
  if (validGeometry && barsValid && NEd !== null && Mx !== null && My !== null) {
    capacity = biaxialCapacity(input, Math.abs(NEd), Math.abs(Mx), Math.abs(My));
    if (!capacity.converged) checks.push(blocked("biaxial", "Résistance N–Mx–My", "compatibilité des déformations et équilibre des forces", "Calcul incomplet : donnée requise ou absence de convergence numérique."));
    else checks.push(check("biaxial", "Résistance N–Mx–My", 1, capacity.capacityFactor, "—", "ΣFc + ΣFs = NEd ; ΣMx = MEd,x ; ΣMy = MEd,y", capacity.capacityFactor < 1 ? "Résistance N-Mx-My insuffisante : revoir la section et/ou la disposition des armatures." : undefined));
  } else checks.push(blocked("biaxial", "Résistance N–Mx–My", "compatibilité des déformations et équilibre des forces", "Calcul incomplet : donnée requise"));
  if (capacity && capacity.capacityFactor < 1) warnings.push(capacity.capacityFactor < 0.8 ? "Section de béton insuffisante : augmenter la section du poteau et relancer le calcul." : "Armatures longitudinales insuffisantes : augmenter la section d’acier ou revoir leur disposition.");
  if (checks.some(item => item.status === "non satisfaisant")) warnings.push(...checks.filter(item => item.status === "non satisfaisant" && item.message).map(item => item.message!));
  const incomplete = checks.some(item => ["bloqué", "à renseigner", "en attente du ferraillage", "bloqué — contrôle non implémenté", "à vérifier"].includes(item.status));
  if (incomplete) warnings.push("Calcul incomplet : donnée requise ou contrôle non disponible");
  const status: ColumnStatus = incomplete ? "calcul incomplet" : checks.some(item => item.status === "non satisfaisant") ? "non conforme" : "conforme";
  if (actions.source) notes.push(`Origine des efforts : ${actions.source}`);
  notes.push("Les barres et les cadres saisis ont été vérifiés tels quels; aucune modification automatique n'a été appliquée.");
  return { id: input.id, standard: input.standard, status, actions: { NEdKn: NEd, MEdxKnM: Mx, MEdyKnM: My, origin }, traceability: { orientationDeg: input.orientationDeg ?? 0, section: input.section, concrete: input.concrete, steel: input.steel, clearHeightMm: input.clearHeightMm, bucklingLengthMm: input.bucklingLengthMm, selectedBarCount: input.longitudinalBars.length }, geometry: { areaMm2: area, inertiaXmm4: ix4, inertiaYmm4: iy4, radiusXmm: rx, radiusYmm: ry, perimeterMm: perimeter }, reinforcement: { providedAreaMm2: providedArea, minimumAreaMm2: minArea, maximumAreaMm2: maxArea, ratio: area > 0 ? providedArea / area : 0 }, slenderness: { x: lambdaX, y: lambdaY }, checks, warnings: [...new Set(warnings)], notes };
}
