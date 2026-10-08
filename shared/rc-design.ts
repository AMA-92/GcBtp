export const RC_DESIGN_SCHEMA_VERSION = 1 as const;

import type { AnalyticalModel } from "./analytical-model";
import type { PlaneFrameResult, PlaneMemberLoad } from "./frame-solver-2d";
import type { Spatial3DResult } from "./frame-solver-3d";
import { designStairV2 } from "./stair-design-v2";
import { resolveRCStandardProfile } from "./rc-standard-profile";
import { haCatalogBarAreaMm2 } from "./ha-bar-areas";
import { validateRCNormSelection } from "./rc-norms";
import { checkColumnSecondOrder, checkCrackWidth, checkRectangularTorsion, checkSeismicDetailing } from "./rc-eurocode-checks";
import { baelColumnBarPositions, baelColumnTieDiameterMm, baelMaximumColumnBarPitchMm, baelMaximumColumnTieSpacingMm, baelMinimumColumnBarCount, calculateBAELColumnCompression, calculateBAELSecondOrderAxis, minimumBAELColumnSteelAreaMm2, solveBAELIsolatedColumnEquilibrium, type BAELColumnSectionShape } from "./bael-column-checks";

export type RCDesignBasis = {
  schemaVersion: typeof RC_DESIGN_SCHEMA_VERSION;
  standard: string;
  nationalAnnex: string;
  sourceReference: string;
  basisConfirmed: boolean;
  fckMpa: number;
  fykMpa: number;
  gammaC: number;
  gammaS: number;
  alphaCC: number;
  coverMm: number;
  minReinforcementRatio: number;
  maxReinforcementRatio: number;
  concreteShearStressLimitMpa: number;
  minClearSpacingMm: number;
  maxLinkSpacingMm: number;
  maxDeflectionRatio: number;
  maxColumnSlenderness: number;
  availableBarDiametersMm: number[];
  maxCrackWidthMm?: number;
  seismicDetailingEnabled?: boolean;
  seismicDuctilityClass?: "DCL" | "DCM" | "DCH";
};

export type RebarOverride = { diameterMm: number; count: number };
export type RCDesignOverrides = Record<string, RebarOverride>;
export type RCColumnConnection = { elementId: string; type: string; role: "connected-member" | "surface" | "support" };
export type RCColumnContext = {
  classification: "poteau-de-fondation" | "RDC" | "étage-intermédiaire" | "dernier-niveau" | "non-déterminé";
  position: "angle" | "rive" | "intérieur" | "non-déterminée";
  xM: number;
  yM: number;
  zBaseM: number;
  zTopM: number;
  baseNodeId: string;
  topNodeId: string;
  connectedAtBase: RCColumnConnection[];
  connectedAtTop: RCColumnConnection[];
  baseSupportKind?: string;
  supportAssumption?: string;
};
export type RCMemberDemand = {
  id: string;
  levelLabel?: string;
  type: "beam" | "column";
  combinationId: string;
  combinationName: string;
  sectionWidthMm: number;
  sectionDepthMm: number;
  lengthMm: number;
  bucklingLengthMm?: number;
  axialKn: number;
  shearKn: number;
  momentKnM: number;
  positiveMomentKnM?: number;
  negativeMomentKnM?: number;
  momentXKnM?: number;
  momentYKnM?: number;
  sectionShape?: BAELColumnSectionShape;
  serviceMomentKnM?: number;
  serviceDeflectionMm?: number;
  torsionKnM?: number;
  memberSubtype?: "beam" | "tie-beam";
  columnContext?: RCColumnContext;
};
export type RCSlabDemand = {
  id: string;
  levelLabel?: string;
  combinationId: string;
  combinationName: string;
  spanXM: number;
  spanYM: number;
  thicknessMm: number;
  mxKnMPerM: number;
  myKnMPerM: number;
  serviceMxKnMPerM?: number;
  serviceMyKnMPerM?: number;
  serviceDeflectionMm?: number;
  uniformLoadKnM2?: number;
  supportReactionKn?: number;
  columnWidthMm?: number;
  columnDepthMm?: number;
  openingAreaRatio?: number;
  floorType?: "Dalle pleine" | "Corps creux";
  boundaryMode?: "simply-supported-four-edges" | "cantilever-fixed-edge" | "one-way-simply-supported";
  spanDirection?: "X" | "Y";
  negativeMxKnMPerM?: number;
  negativeMyKnMPerM?: number;
};
export type RCCheckStatus = "satisfaisant" | "non satisfaisant" | "bloqué" | "à vérifier";
export type RCCheck = {
  id: string;
  label: string;
  demand: number | null;
  resistance: number | null;
  utilization: number | null;
  unit: string;
  status: RCCheckStatus;
  /** false = contrôle complémentaire non bloquant pour le calcul structurel de pré-étude. */
  blocking?: boolean;
  formula: string;
  combinationId: string;
  combinationName: string;
};
export type RebarProposal = {
  id: string;
  label: string;
  diameterMm: number;
  count: number;
  areaMm2: number;
  requiredAreaMm2: number;
  lengthPerBarM: number;
  totalLengthM: number;
  massKg: number;
  /** Positions des centres de barres dans la section, coordonnées X/Y en mm depuis le centre. */
  barPositionsMm?: Array<{ xMm: number; yMm: number }>;
  /** Segments transversaux de maintien dans la section, coordonnées en mm depuis le centre. */
  tieSegmentsMm?: Array<{ x1Mm: number; y1Mm: number; x2Mm: number; y2Mm: number }>;
};
export type RCElementDesign = {
  elementId: string;
  type: "beam" | "column" | "slab" | "wall" | "tie-beam" | "footing" | "stair";
  combinationId: string;
  combinationName: string;
  checks: RCCheck[];
  reinforcement: RebarProposal[];
  limitations: string[];
  columnReport?: RCColumnCalculationSheet;
};
export type RCColumnCalculationSheet = {
  classification: RCColumnContext["classification"];
  position: RCColumnContext["position"];
  levelLabel?: string;
  xM?: number;
  yM?: number;
  sectionWidthMm: number;
  sectionDepthMm: number;
  heightMm: number;
  bucklingLengthMm: number;
  slendernessX: number;
  slendernessY: number;
  secondOrderRequired: boolean;
  combinationId: string;
  combinationName: string;
  NEdKn: number;
  MEdXKnM: number;
  MEdYKnM: number;
  VEdKn: number;
  TEdKnM: number;
  AsTheoreticalMm2: number;
  AsRequiredMm2: number;
  AsMinimumMm2: number;
  AsProvidedMm2: number;
  longitudinalBarCount: number;
  longitudinalDiameterMm: number;
  tieDiameterMm: number;
  tieSpacingMm: number;
  optimizationTrace: string[];
  baelCompression?: {
    minimumInertiaMm4: number;
    radiusGyrationMm: number;
    slenderness: number;
    alpha: number;
    reducedConcreteAreaMm2: number;
  };
  connectedAtBase: RCColumnConnection[];
  connectedAtTop: RCColumnConnection[];
  baseSupportKind?: string;
  finalStatus: "CONFORME" | "NON CONFORME" | "À VÉRIFIER";
};
export type RCFootingDemand = {
  id: string;
  levelLabel?: string;
  combinationId: string;
  combinationName: string;
  widthM: number;
  lengthM: number;
  thicknessM: number;
  columnWidthM: number;
  columnDepthM: number;
  axialKn: number;
  shearKn: number;
  momentXKnM: number;
  momentYKnM: number;
  soilBearingKPa: number | null;
};

export type RCTieBeamDemand = RCMemberDemand & { type: "beam" };
export type RCStairFlightDemand = {
  id: string;
  spanM: number;
  riseM: number;
  widthM: number;
  thicknessMm: number;
  permanentKnM2: number;
  imposedKnM2: number;
  gammaG: number;
  gammaQ: number;
};
export type RCStairDemand = {
  id: string;
  levelLabel?: string;
  combinationId: string;
  combinationName: string;
  flights: RCStairFlightDemand[];
};

export type RCDesignResult = {
  schemaVersion: typeof RC_DESIGN_SCHEMA_VERSION;
  status: "calculé numériquement — non certifié" | "bloqué — calcul numérique incomplet";
  standard: string;
  nationalAnnex: string;
  sourceReference: string;
  materialBasis: Omit<RCDesignBasis, "schemaVersion">;
  regulatoryReady: false;
  elements: RCElementDesign[];
  schedule: Array<{ diameterMm: number; totalLengthM: number; massKg: number }>;
  errors: string[];
  warnings: string[];
  blockers: string[];
  numericalSummary: {
    memberCount: number;
    slabCount: number;
    footingCount: number;
    stairCount: number;
    checkCount: number;
    passedCheckCount: number;
    failedCheckCount: number;
    blockedCheckCount: number;
    unverifiedCheckCount: number;
  };
};

function deriveColumnContext(model: AnalyticalModel, frame: AnalyticalModel["frames"][number]): RCColumnContext | undefined {
  const base = model.nodes.find(node => node.id === frame.startNodeId);
  const top = model.nodes.find(node => node.id === frame.endNodeId);
  if (!base || !top) return undefined;
  const [baseNode, topNode] = base.z <= top.z ? [base, top] : [top, base];
  const connectionsAt = (nodeId: string): RCColumnConnection[] => {
    const members = model.frames.filter(item => item.id !== frame.id && (item.startNodeId === nodeId || item.endNodeId === nodeId))
      .map(item => ({ elementId: item.sourceElementId, type: item.sourceType, role: "connected-member" as const }));
    const surfaces = model.surfaces.filter(item => item.nodeIds.includes(nodeId))
      .map(item => ({ elementId: item.sourceElementId, type: item.sourceType || item.kind, role: "surface" as const }));
    const supports = (model.supports ?? []).filter(item => item.nodeId === nodeId)
      .map(item => ({ elementId: item.sourceElementId, type: item.kind, role: "support" as const }));
    return [...members, ...surfaces, ...supports];
  };
  const connectedAtBase = connectionsAt(baseNode.id);
  const connectedAtTop = connectionsAt(topNode.id);
  const baseSupport = connectedAtBase.find(item => item.role === "support");
  const hasColumnAbove = connectedAtTop.some(item => item.type === "Poteau");
  const hasColumnBelow = connectedAtBase.some(item => item.type === "Poteau");
  const isFoundationLevel = /fondation|foundation/i.test(frame.levelId);
  const classification: RCColumnContext["classification"] = isFoundationLevel
    ? "poteau-de-fondation"
    : baseSupport && hasColumnAbove
      ? "RDC"
      : hasColumnAbove && hasColumnBelow
        ? "étage-intermédiaire"
        : !hasColumnAbove
          ? "dernier-niveau"
          : baseSupport
            ? "RDC"
            : "non-déterminé";

  const columnNodes = model.frames.filter(item => item.sourceType === "Poteau")
    .flatMap(item => [item.startNodeId, item.endNodeId])
    .map(id => model.nodes.find(node => node.id === id))
    .filter((node): node is NonNullable<typeof node> => Boolean(node));
  const xs = columnNodes.map(node => node.x), ys = columnNodes.map(node => node.y);
  const tolerance = Math.max(model.nodeMergeToleranceM ?? 0.01, 0.025);
  const hasXExtent = xs.length > 1 && Math.max(...xs) - Math.min(...xs) > tolerance;
  const hasYExtent = ys.length > 1 && Math.max(...ys) - Math.min(...ys) > tolerance;
  let position: RCColumnContext["position"] = "non-déterminée";
  if (hasXExtent && hasYExtent) {
    const atXEdge = Math.abs(baseNode.x - Math.min(...xs)) <= tolerance || Math.abs(baseNode.x - Math.max(...xs)) <= tolerance;
    const atYEdge = Math.abs(baseNode.y - Math.min(...ys)) <= tolerance || Math.abs(baseNode.y - Math.max(...ys)) <= tolerance;
    position = atXEdge && atYEdge ? "angle" : atXEdge || atYEdge ? "rive" : "intérieur";
  }
  return {
    classification,
    position,
    xM: (baseNode.x + topNode.x) / 2,
    yM: (baseNode.y + topNode.y) / 2,
    zBaseM: baseNode.z,
    zTopM: topNode.z,
    baseNodeId: baseNode.id,
    topNodeId: topNode.id,
    connectedAtBase,
    connectedAtTop,
    baseSupportKind: baseSupport?.type,
    supportAssumption: baseSupport?.elementId,
  };
}

export function deriveRCMemberDemandsFromPlane(input: {
  model: AnalyticalModel;
  result: PlaneFrameResult;
  combinationId: string;
  combinationName: string;
  memberLoads: PlaneMemberLoad[];
}) {
  const demands: RCMemberDemand[] = [];
  const warnings: string[] = [];
  const sectionById = new Map(input.model.sections.map(section => [section.id, section]));
  const frameById = new Map(input.model.frames.map(frame => [frame.id, frame]));
  for (const solved of input.result.elements) {
    const frame = frameById.get(solved.elementId);
    if (!frame || !["Poutre", "Longrine de redressement", "Poteau"].includes(frame.sourceType)) continue;
    const section = sectionById.get(frame.sectionId);
    if (!section || section.dimensionsM.length < 2) {
      warnings.push(`${frame.sourceElementId} ignoré : dimensions de section non résolues.`);
      continue;
    }
    const start = input.model.nodes.find(node => node.id === frame.startNodeId);
    const end = input.model.nodes.find(node => node.id === frame.endNodeId);
    const lengthM = start && end ? Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z) : solved.lengthM;
    const forces = solved.localEndForces;
    const axialKn = Math.max(Math.abs(forces.axialIKn), Math.abs(forces.axialJKn));
    const shearKn = Math.max(Math.abs(forces.shearIKn), Math.abs(forces.shearJKn));
    const distributedQ = input.memberLoads.filter(load => load.elementId === solved.elementId).reduce((sum, load) => sum + (load.qyKnM ?? 0), 0);
    const moments = [forces.momentIKnM, forces.momentJKnM];
    if (Math.abs(distributedQ) > 1e-12 && lengthM > 1e-9) {
      const stationaryX = -forces.shearIKn / distributedQ;
      if (stationaryX > 0 && stationaryX < lengthM) moments.push(forces.momentIKnM + forces.shearIKn * stationaryX + 0.5 * distributedQ * stationaryX * stationaryX);
    }
    const positiveMomentKnM = Math.max(0, ...moments);
    const negativeMomentKnM = Math.max(0, ...moments.map(value => -value));
    const momentKnM = positiveMomentKnM >= negativeMomentKnM ? positiveMomentKnM : -negativeMomentKnM;
    const common = {
      id: frame.sourceElementId,
      combinationId: input.combinationId,
      combinationName: input.combinationName,
      sectionWidthMm: section.dimensionsM[0] * 1000,
      sectionDepthMm: section.dimensionsM[1] * 1000,
      lengthMm: lengthM * 1000,
      axialKn,
      shearKn,
      momentKnM,
      torsionKnM: 0,
    };
    if (frame.sourceType === "Poteau") {
      demands.push({ ...common, type: "column", momentXKnM: input.result.plane === "YZ" ? momentKnM : 0, momentYKnM: input.result.plane === "XZ" ? momentKnM : 0, columnContext: deriveColumnContext(input.model, frame) });
    } else {
      demands.push({ ...common, type: "beam", memberSubtype: frame.sourceType === "Longrine de redressement" ? "tie-beam" : "beam", positiveMomentKnM, negativeMomentKnM });
    }
  }
  if (!demands.length) warnings.push("Aucune poutre, longrine ou poteau résolu n’est disponible dans le plan sélectionné.");
  return { demands, warnings };
}

export function deriveRCMemberDemandsFromSpatial(input: {
  model: AnalyticalModel;
  result: Spatial3DResult;
  combinationId: string;
  combinationName: string;
}) {
  const demands: RCMemberDemand[] = [];
  const warnings: string[] = [];
  const sectionById = new Map(input.model.sections.map(section => [section.id, section]));
  const frameById = new Map(input.model.frames.map(frame => [frame.id, frame]));
  for (const solved of input.result.elements) {
    const frame = frameById.get(solved.elementId);
    if (!frame || !["Poutre", "Longrine de redressement", "Poteau"].includes(frame.sourceType)) continue;
    const section = sectionById.get(frame.sectionId);
    if (!section || section.dimensionsM.length < 2) { warnings.push(`${frame.sourceElementId} ignoré : dimensions de section non résolues.`); continue; }
    const start = input.model.nodes.find(node => node.id === frame.startNodeId);
    const end = input.model.nodes.find(node => node.id === frame.endNodeId);
    const lengthM = start && end ? Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z) : solved.lengthM;
    const momentsLocalY = [solved.momentYEnvelope.minKnM, solved.momentYEnvelope.maxKnM];
    const momentsLocalZ = [solved.momentZEnvelope.minKnM, solved.momentZEnvelope.maxKnM];
    const positiveMoment = Math.max(0, ...momentsLocalY);
    const negativeMoment = Math.max(0, ...momentsLocalY.map(value => -value));
    const governingMoment = positiveMoment >= negativeMoment ? positiveMoment : -negativeMoment;
    const common = {
      id: frame.sourceElementId, combinationId: input.combinationId, combinationName: input.combinationName,
      sectionWidthMm: section.dimensionsM[0] * 1000, sectionDepthMm: section.dimensionsM[1] * 1000, lengthMm: lengthM * 1000,
      axialKn: Math.max(Math.abs(solved.start.axialKn), Math.abs(solved.end.axialKn)),
      shearKn: solved.maxAbsShearKn, momentKnM: governingMoment,
      torsionKnM: solved.maxAbsTorsionKnM,
      momentXKnM: Math.max(...momentsLocalZ.map(Math.abs)),
      momentYKnM: Math.max(...momentsLocalY.map(Math.abs)),
      memberSubtype: (frame.sourceType === "Longrine de redressement" ? "tie-beam" : frame.sourceType === "Poutre" ? "beam" : undefined) as "beam" | "tie-beam" | undefined,
      positiveMomentKnM: frame.sourceType === "Poutre" ? positiveMoment : undefined,
      negativeMomentKnM: frame.sourceType === "Poutre" ? negativeMoment : undefined,
    };
    demands.push({ ...common, type: frame.sourceType === "Poteau" ? "column" : "beam", ...(frame.sourceType === "Poteau" ? { columnContext: deriveColumnContext(input.model, frame) } : {}) });
  }
  if (!demands.length) warnings.push("Aucune poutre, longrine ou poteau 3D résolu n’est disponible pour le dimensionnement.");
  return { demands, warnings };
}

const positive = (value: number) => Number.isFinite(value) && value > 0;
const nonNegative = (value: number) => Number.isFinite(value) && value >= 0;
const barArea = (diameterMm: number) => Math.PI * diameterMm * diameterMm / 4;
const barMassKgPerM = (diameterMm: number) => 0.006165 * diameterMm * diameterMm;

export function validateRCDesignBasis(basis: RCDesignBasis): string[] {
  const errors: string[] = [];
  errors.push(...validateRCNormSelection(basis.standard, basis.nationalAnnex, basis.sourceReference));
  if (!basis.standard.trim()) errors.push("Le référentiel béton doit être déclaré.");
  else {
    const profile = resolveRCStandardProfile(basis.standard);
    if (!profile.supportedForPreDesign) errors.push(profile.note);
  }
  if (!basis.nationalAnnex.trim()) errors.push("L’annexe nationale ou les règles locales doivent être déclarées.");
  if (!basis.sourceReference.trim()) errors.push("La référence des paramètres matériaux et de détail est obligatoire.");
  if (!positive(basis.fckMpa) || basis.fckMpa < 15 || basis.fckMpa > 90) errors.push("fck doit être compris entre 15 et 90 MPa.");
  if (!positive(basis.fykMpa) || basis.fykMpa < 250 || basis.fykMpa > 700) errors.push("fyk doit être compris entre 250 et 700 MPa.");
  if (!positive(basis.gammaC) || !positive(basis.gammaS) || !positive(basis.alphaCC)) errors.push("Les coefficients matériau γc, γs et αcc doivent être saisis et positifs.");
  if (!positive(basis.coverMm) || basis.coverMm > 120) errors.push("L’enrobage nominal doit être compris entre 0 et 120 mm.");
  if (!positive(basis.minReinforcementRatio) || !positive(basis.maxReinforcementRatio) || basis.maxReinforcementRatio <= basis.minReinforcementRatio || basis.maxReinforcementRatio > 0.08) errors.push("Les taux d’armatures minimal et maximal doivent être cohérents et déclarés.");
  if (!positive(basis.concreteShearStressLimitMpa)) errors.push("La contrainte de cisaillement du béton doit être renseignée selon le référentiel choisi.");
  if (!positive(basis.minClearSpacingMm)) errors.push("L’espacement libre minimal doit être renseigné selon les règles de détail.");
  if (!positive(basis.maxLinkSpacingMm)) errors.push("L’espacement maximal des cadres doit être renseigné selon les règles de détail.");
  if (!positive(basis.maxDeflectionRatio)) errors.push("La limite de flèche doit être renseignée selon l’usage et le référentiel.");
  if (!positive(basis.maxColumnSlenderness)) errors.push("La limite d’élancement doit être renseignée selon le référentiel.");
  if (!basis.availableBarDiametersMm.length || basis.availableBarDiametersMm.some(value => !positive(value))) errors.push("Les diamètres d’acier disponibles doivent être renseignés.");
  return errors;
}

function emptyCheck(id: string, label: string, unit: string, combinationId: string, combinationName: string, formula: string): RCCheck {
  return { id, label, demand: null, resistance: null, utilization: null, unit, status: "bloqué", formula, combinationId, combinationName };
}
function unverifiedCheck(id: string, label: string, demand: number, unit: string, formula: string, combinationId: string, combinationName: string): RCCheck {
  return { id, label, demand, resistance: null, utilization: null, unit, status: "à vérifier", blocking: false, formula, combinationId, combinationName };
}
function check(id: string, label: string, demand: number, resistance: number, unit: string, formula: string, combinationId: string, combinationName: string): RCCheck {
  const utilization = resistance > 0 ? demand / resistance : Number.POSITIVE_INFINITY;
  return { id, label, demand, resistance, utilization, unit, status: utilization <= 1 ? "satisfaisant" : "non satisfaisant", formula, combinationId, combinationName };
}

function pickBars(requiredAreaMm2: number, widthMm: number, coverMm: number, stirrupDiameterMm: number, minimumClearSpacingMm: number, diameters: number[], override?: RebarOverride, minimumCount = 2) {
  const sorted = Array.from(new Set(diameters.filter(positive))).sort((a, b) => a - b);
  const candidates = sorted.map(diameterMm => {
    const count = Math.max(minimumCount, Math.ceil(requiredAreaMm2 / barArea(diameterMm)));
    const clearSpacingMm = count > 1 ? (widthMm - 2 * (coverMm + stirrupDiameterMm) - count * diameterMm) / (count - 1) : Infinity;
    return { diameterMm, count, areaMm2: count * barArea(diameterMm), clearSpacingMm };
  }).filter(item => item.clearSpacingMm >= minimumClearSpacingMm);
  let selected = candidates.sort((a, b) => a.areaMm2 - b.areaMm2 || a.diameterMm - b.diameterMm)[0];
  if (override && positive(override.diameterMm) && Number.isInteger(override.count) && override.count >= minimumCount) {
    const clearSpacingMm = (widthMm - 2 * (coverMm + stirrupDiameterMm) - override.count * override.diameterMm) / (override.count - 1);
    selected = { diameterMm: override.diameterMm, count: override.count, areaMm2: override.count * barArea(override.diameterMm), clearSpacingMm };
  }
  return selected;
}

function proposal(id: string, label: string, diameterMm: number, count: number, requiredAreaMm2: number, lengthPerBarM: number): RebarProposal {
  const totalLengthM = count * lengthPerBarM;
  return { id, label, diameterMm, count, areaMm2: count * barArea(diameterMm), requiredAreaMm2, lengthPerBarM, totalLengthM, massKg: totalLengthM * barMassKgPerM(diameterMm) };
}

function designBeam(demand: RCMemberDemand, basis: RCDesignBasis, overrides: RCDesignOverrides): RCElementDesign {
  const combinationId = demand.combinationId, combinationName = demand.combinationName;
  const limitations: string[] = [
    "Dimensionnement BA de la poutre/longrine selon la base déclarée ; les dispositions sismiques et l'annexe nationale doivent être renseignées pour une validation finale.",
    "La torsion, la redistribution plastique et la fissuration wk complète restent à vérifier selon le référentiel sélectionné.",
  ];
  if (!positive(demand.sectionWidthMm) || !positive(demand.sectionDepthMm) || !positive(demand.lengthMm)) {
    return { elementId: demand.id, type: "beam", combinationId, combinationName, checks: [emptyCheck("geometry", "Géométrie de poutre", "mm", combinationId, combinationName, "b, h, L > 0")], reinforcement: [], limitations };
  }
  const width = demand.sectionWidthMm, height = demand.sectionDepthMm;
  const linkDiameter = Math.max(6, Math.min(...basis.availableBarDiametersMm.filter(positive)));
  const mainDiameter = Math.max(8, Math.min(...basis.availableBarDiametersMm.filter(positive)));
  const effectiveDepth = height - basis.coverMm - linkDiameter - mainDiameter / 2;
  if (!positive(effectiveDepth)) return { elementId: demand.id, type: "beam", combinationId, combinationName, checks: [emptyCheck("effective-depth", "Hauteur utile", "mm", combinationId, combinationName, "d = h − cnom − ϕcadre − ϕbarre/2")], reinforcement: [], limitations };
  const fyd = basis.fykMpa / basis.gammaS;
  const z = 0.9 * effectiveDepth;
  const requiredAs = (momentKnM: number) => Math.abs(momentKnM) * 1e6 / (z * fyd);
  const asMin = basis.minReinforcementRatio * width * effectiveDepth;
  const asMax = basis.maxReinforcementRatio * width * effectiveDepth;
  const positiveMoment = demand.positiveMomentKnM ?? Math.max(0, demand.momentKnM);
  const negativeMoment = demand.negativeMomentKnM ?? Math.max(0, -demand.momentKnM);
  const bottomRequired = Math.max(asMin, requiredAs(positiveMoment));
  const topRequired = Math.max(asMin, requiredAs(negativeMoment));
  const bottom = pickBars(bottomRequired, width, basis.coverMm, linkDiameter, basis.minClearSpacingMm, basis.availableBarDiametersMm, overrides[`${demand.id}:bottom`]);
  const top = pickBars(topRequired, width, basis.coverMm, linkDiameter, basis.minClearSpacingMm, basis.availableBarDiametersMm, overrides[`${demand.id}:top`]);
  const reinforcement: RebarProposal[] = [];
  const checks: RCCheck[] = [];
  if (bottom) {
    reinforcement.push(proposal(`${demand.id}:bottom`, "Longitudinal inférieur", bottom.diameterMm, bottom.count, bottomRequired, demand.lengthMm / 1000 + 2 * Math.max(basis.coverMm, 0) / 1000));
    checks.push(check("bottom-flexure", "Flexion positive · armatures inférieures", bottomRequired, bottom.areaMm2, "mm²", "As,req = MEd/(z·fyd), As,prov ≥ max(As,req; As,min)", combinationId, combinationName));
    checks.push(check("bottom-max-ratio", "Taux maximal inférieur", bottom.areaMm2, asMax, "mm²", "As,prov ≤ ρmax·b·d", combinationId, combinationName));
    const clearSpacing = (width - 2 * (basis.coverMm + linkDiameter) - bottom.count * bottom.diameterMm) / (bottom.count - 1);
    checks.push(check("bottom-clear-spacing", "Espacement libre inférieur", basis.minClearSpacingMm, clearSpacing, "mm", "sclair ≥ espacement minimal déclaré", combinationId, combinationName));
  } else checks.push(emptyCheck("bottom-fit", "Disposition des barres inférieures", "mm²", combinationId, combinationName, "Respect des espacements et enrobage"));
  if (top) {
    reinforcement.push(proposal(`${demand.id}:top`, "Longitudinal supérieur", top.diameterMm, top.count, topRequired, demand.lengthMm / 1000 + 2 * Math.max(basis.coverMm, 0) / 1000));
    checks.push(check("top-flexure", "Flexion négative · armatures supérieures", topRequired, top.areaMm2, "mm²", "As,req = |MEd|/(z·fyd), As,prov ≥ max(As,req; As,min)", combinationId, combinationName));
    checks.push(check("top-max-ratio", "Taux maximal supérieur", top.areaMm2, asMax, "mm²", "As,prov ≤ ρmax·b·d", combinationId, combinationName));
    const clearSpacing = (width - 2 * (basis.coverMm + linkDiameter) - top.count * top.diameterMm) / (top.count - 1);
    checks.push(check("top-clear-spacing", "Espacement libre supérieur", basis.minClearSpacingMm, clearSpacing, "mm", "sclair ≥ espacement minimal déclaré", combinationId, combinationName));
  } else checks.push(emptyCheck("top-fit", "Disposition des barres supérieures", "mm²", combinationId, combinationName, "Respect des espacements et enrobage"));
  const concreteShearResistance = basis.concreteShearStressLimitMpa * width * effectiveDepth / 1000;
  const shearSteelPerSpacing = Math.max(0, Math.abs(demand.shearKn) - concreteShearResistance) * 1000 / (0.87 * fyd * z);
  const linkArea = 2 * barArea(linkDiameter);
  const recommendedLinkSpacing = shearSteelPerSpacing > 0 ? Math.min(basis.maxLinkSpacingMm, linkArea / shearSteelPerSpacing) : basis.maxLinkSpacingMm;
  const linkResistanceKn = (linkArea / recommendedLinkSpacing) * 0.87 * fyd * z / 1000;
  const linkCount = Math.ceil(demand.lengthMm / recommendedLinkSpacing) + 1;
  const linkLengthM = (2 * (Math.max(0, width - 2 * basis.coverMm) + Math.max(0, height - 2 * basis.coverMm)) + 200) / 1000;
  reinforcement.push(proposal(`${demand.id}:links`, "Cadres · HA " + linkDiameter + " / " + recommendedLinkSpacing.toFixed(0) + " mm · crochets 2×100 mm", linkDiameter, linkCount, shearSteelPerSpacing * recommendedLinkSpacing, linkLengthM));
  checks.push(check("shear-total", "Cisaillement · résistance béton + cadres", Math.abs(demand.shearKn), concreteShearResistance + linkResistanceKn, "kN", "VEd ≤ VRd,c + VRd,s ; τRd,c et cadres selon saisie", combinationId, combinationName));
  checks.push(check("shear-link-spacing", "Espacement maximal des cadres", recommendedLinkSpacing, basis.maxLinkSpacingMm, "mm", "sCadres ≤ espacement maximal déclaré", combinationId, combinationName));
  if (demand.serviceDeflectionMm !== undefined && Number.isFinite(demand.serviceDeflectionMm)) {
    checks.push(check("deflection", "Flèche de service", Math.abs(demand.serviceDeflectionMm), demand.lengthMm / basis.maxDeflectionRatio, "mm", "δser ≤ L/limite saisie", combinationId, combinationName));
  } else checks.push(emptyCheck("deflection", "Flèche de service", "mm", combinationId, combinationName, "Résultat ELS requis"));
  if (demand.serviceMomentKnM !== undefined && bottom && basis.maxCrackWidthMm && basis.maxCrackWidthMm > 0) {
    const crack = checkCrackWidth({ MserKnM: demand.serviceMomentKnM, AsTensionMm2: bottom.areaMm2, effectiveDepthMm: effectiveDepth, widthMm: width, heightMm: height, coverMm: basis.coverMm, barDiameterMm: bottom.diameterMm, fykMpa: basis.fykMpa, maxCrackWidthMm: basis.maxCrackWidthMm });
    checks.push({ ...check("cracking-wk", "Ouverture de fissures wk", crack.wkMm, basis.maxCrackWidthMm, "mm", "wk = sr,max·(εsm−εcm) selon méthode des déformations moyennes", combinationId, combinationName), status: crack.passes ? "satisfaisant" : "non satisfaisant" });
    if (crack.warnings.length) limitations.push(...crack.warnings);
  } else if (demand.serviceMomentKnM !== undefined && bottom) {
    const steelStress = Math.abs(demand.serviceMomentKnM) * 1e6 / Math.max(bottom.areaMm2 * z, 1e-9);
    checks.push({ ...check("crack-proxy", "Contrainte acier ELS (proxy fissuration)", steelStress, basis.fykMpa * 0.6, "MPa", "σs≈Mser/(As·z) ; limite wk,max requise pour conclure", combinationId, combinationName), status: "à vérifier" });
  } else checks.push(emptyCheck("cracking", "Ouverture de fissures wk", "mm", combinationId, combinationName, "Calcul de fissuration selon norme non implémenté"));
  if (demand.torsionKnM && Math.abs(demand.torsionKnM) > 1e-9 && bottom && top) {
    const torsion = checkRectangularTorsion({ TEdKnM: demand.torsionKnM, bMm: width, hMm: height, coverMm: basis.coverMm, stirrupDiameterMm: linkDiameter, longitudinalDiameterMm: Math.max(bottom.diameterMm, top.diameterMm), fckMpa: basis.fckMpa, fykMpa: basis.fykMpa, gammaC: basis.gammaC, gammaS: basis.gammaS, alphaCC: basis.alphaCC, AswPerSMm2PerMm: linkArea / Math.max(recommendedLinkSpacing, 1), AslMm2: bottom.areaMm2 + top.areaMm2 });
    checks.push(check("torsion-concrete", "Torsion · bielles comprimées", Math.abs(demand.torsionKnM), torsion.TRdMaxKnM, "kN·m", "TEd ≤ TRd,max selon modèle de treillis spatial", combinationId, combinationName));
    checks.push(check("torsion-transverse", "Torsion · armatures transversales", Math.abs(demand.torsionKnM), torsion.TRdSKnM, "kN·m", "TEd ≤ TRd,s ; cadres fermés et Asw/s", combinationId, combinationName));
    checks.push(check("torsion-longitudinal", "Torsion · armatures longitudinales", torsion.AslReqMm2, bottom.areaMm2 + top.areaMm2, "mm²", "Asl,req = TEd/(2·Ak·fyd·cotθ)", combinationId, combinationName));
    if (torsion.warnings.length) limitations.push(...torsion.warnings);
  } else checks.push(emptyCheck("torsion", "Vérification de torsion BA", "kN·m", combinationId, combinationName, "Effort de torsion et armatures fermées requis pour conclure"));
  if (basis.seismicDetailingEnabled && basis.seismicDuctilityClass && bottom && top) {
    const seismic = checkSeismicDetailing({ ductilityClass: basis.seismicDuctilityClass, member: "beam", widthMm: width, depthMm: height, clearHeightMm: demand.lengthMm, longitudinalRatio: (bottom.areaMm2 + top.areaMm2) / Math.max(width * height, 1), transverseDiameterMm: linkDiameter, transverseSpacingMm: recommendedLinkSpacing, coverMm: basis.coverMm, fykMpa: basis.fykMpa });
    checks.push(check("beam-seismic-detailing", "Détail sismique poutre", Math.max(seismic.rhoMin / Math.max((bottom.areaMm2 + top.areaMm2) / Math.max(width * height, 1), 1e-9), recommendedLinkSpacing / Math.max(seismic.spacingLimitMm, 1)), 1, "—", "ρ et espacement de confinement selon classe de ductilité déclarée", combinationId, combinationName));
    if (seismic.warnings.length) limitations.push(...seismic.warnings);
  } else if (basis.seismicDetailingEnabled) checks.push(emptyCheck("beam-seismic-detailing", "Détail sismique poutre", "—", combinationId, combinationName, "Classe de ductilité EN 1998 et paramètres de détail requis"));
  checks.push(emptyCheck("anchorage", "Ancrage et recouvrement", "mm", combinationId, combinationName, "Longueur normalisée selon adhérence, position et confinement non implémentée"));
  return { elementId: demand.id, type: "beam", combinationId, combinationName, checks, reinforcement, limitations };
}

function designFooting(demand: RCFootingDemand, basis: RCDesignBasis, overrides: RCDesignOverrides): RCElementDesign {
  const { combinationId, combinationName } = demand;
  const limitations = [
    "Semelle isolée : pression de contact et flexion biaxiale calculées à partir de la réaction du solveur et de la portance géotechnique fournie.",
    "Le poinçonnement, le cisaillement et les ancrages sont vérifiés avec les paramètres de la base BA ; la validation géotechnique reste obligatoire.",
  ];
  const B=demand.widthM*1000, L=demand.lengthM*1000, h=demand.thicknessM*1000;
  if (![B,L,h].every(positive) || !positive(demand.axialKn)) return {elementId:demand.id,type:"footing",combinationId,combinationName,checks:[emptyCheck("geometry","Géométrie de semelle","mm",combinationId,combinationName,"B,L,h > 0")],reinforcement:[],limitations};
  const fyd=basis.fykMpa/basis.gammaS;
  const d=Math.max(50,h-basis.coverMm-10);
  const lever=Math.max(0,0.9*d);
  const qAvg=demand.axialKn/(demand.widthM*demand.lengthM);
  const qx=qAvg + Math.abs(demand.momentYKnM)/(demand.widthM*demand.lengthM*Math.max(demand.widthM/6,1e-6));
  const qy=qAvg + Math.abs(demand.momentXKnM)/(demand.widthM*demand.lengthM*Math.max(demand.lengthM/6,1e-6));
  // q is in kN/m²; convert the cantilever dimensions from mm to m before
  // forming the footing moments (the previous expression inflated moments by
  // 1,000 and made every normal footing impossible to reinforce).
  const mX=qx*Math.pow(Math.max(B/2-demand.columnWidthM*500,0)/1000,2)/2;
  const mY=qy*Math.pow(Math.max(L/2-demand.columnDepthM*500,0)/1000,2)/2;
  const asXReq=Math.max(basis.minReinforcementRatio*B*d, Math.abs(mX)*1e6/(lever*fyd));
  const asYReq=Math.max(basis.minReinforcementRatio*L*d, Math.abs(mY)*1e6/(lever*fyd));
  const dx=pickBars(asXReq,L,basis.coverMm,10,basis.minClearSpacingMm,basis.availableBarDiametersMm,overrides[`${demand.id}:x`]);
  const dy=pickBars(asYReq,B,basis.coverMm,10,basis.minClearSpacingMm,basis.availableBarDiametersMm,overrides[`${demand.id}:y`]);
  if (!dx || !dy) return {elementId:demand.id,type:"footing",combinationId,combinationName,checks:[emptyCheck("bar-fit","Disposition des armatures de semelle","mm",combinationId,combinationName,"Choix d'un diamètre et d'un nombre de barres respectant les espacements")],reinforcement:[],limitations};
  const reinforcement=[proposal(`${demand.id}:x`,"Armatures principales X · HA " + dx.diameterMm + " / " + (demand.lengthM * 1000 / Math.max(1, dx.count - 1)).toFixed(0) + " mm",dx.diameterMm,dx.count,asXReq,demand.widthM+0.15),proposal(`${demand.id}:y`,"Armatures principales Y · HA " + dy.diameterMm + " / " + (demand.lengthM * 1000 / Math.max(1, dy.count - 1)).toFixed(0) + " mm",dy.diameterMm,dy.count,asYReq,demand.lengthM+0.15)];
  const punchingPerimeter=2*(demand.columnWidthM+demand.columnDepthM+4*(d/1000));
  const punchingArea=(demand.columnWidthM+2*d/1000)*(demand.columnDepthM+2*d/1000);
  const punchingV=Math.max(0,demand.axialKn-qAvg*punchingArea);
  const punchingStress=punchingV*1000/Math.max(punchingPerimeter*(d/1000)*1000,1);
  const punchingResistance=basis.concreteShearStressLimitMpa;
  const cantileverX=Math.max(0,demand.widthM/2-demand.columnWidthM/2-d/1000);
  const cantileverY=Math.max(0,demand.lengthM/2-demand.columnDepthM/2-d/1000);
  const oneWayShearX=Math.max(0,qAvg*demand.lengthM*cantileverX - demand.axialKn*(cantileverX/Math.max(demand.widthM, 1e-9)));
  const oneWayShearY=Math.max(0,qAvg*demand.widthM*cantileverY - demand.axialKn*(cantileverY/Math.max(demand.lengthM, 1e-9)));
  const oneWayStressX=oneWayShearX*1000/Math.max(demand.lengthM*1000*d, 1);
  const oneWayStressY=oneWayShearY*1000/Math.max(demand.widthM*1000*d, 1);
  const checks=[
    positive(demand.soilBearingKPa ?? 0)
      ? check("bearing-screen","Pression du sol · screening",Math.max(qx,qy),demand.soilBearingKPa as number,"kPa","qmax estimé depuis N, Mx/My et B/L ≤ valeur déclarée dans l’étude; screening uniquement",combinationId,combinationName)
      : unverifiedCheck("bearing-screen","Pression du sol · qadm non fourni",Math.max(qx,qy),"kPa","Donnée géotechnique absente : contrôle du sol séparé; la flexion BA indicative reste calculée depuis les réactions et la géométrie.",combinationId,combinationName),
    check("flexion-x","Flexion X · As",asXReq,dx.areaMm2,"mm²","As,prov ≥ max(As,req; As,min)",combinationId,combinationName),
    check("flexion-y","Flexion Y · As",asYReq,dy.areaMm2,"mm²","As,prov ≥ max(As,req; As,min)",combinationId,combinationName),
    check("punching","Poinçonnement",punchingStress,punchingResistance,"MPa","vEd ≤ vRd,c selon base BA déclarée",combinationId,combinationName),
    check("one-way-shear-x","Cisaillement unidirectionnel X",oneWayStressX,punchingResistance,"MPa","vEd = VEd/(b·d) ≤ vRd,c à d de la face du poteau",combinationId,combinationName),
    check("one-way-shear-y","Cisaillement unidirectionnel Y",oneWayStressY,punchingResistance,"MPa","vEd = VEd/(b·d) ≤ vRd,c à d de la face du poteau",combinationId,combinationName),
    check("spacing-x","Espacement libre X",basis.minClearSpacingMm,dx.clearSpacingMm,"mm","sclair ≥ minimum déclaré",combinationId,combinationName),
    check("spacing-y","Espacement libre Y",basis.minClearSpacingMm,dy.clearSpacingMm,"mm","sclair ≥ minimum déclaré",combinationId,combinationName),
    emptyCheck("anchorage","Ancrage des armatures de semelle","mm",combinationId,combinationName,"lb,rqd/lbd selon EN 1992 et annexe nationale"),
  ];
  return {elementId:demand.id,type:"footing",combinationId,combinationName,checks,reinforcement,limitations};
}

function designColumn(demand: RCMemberDemand, basis: RCDesignBasis, overrides: RCDesignOverrides): RCElementDesign {
  const combinationId = demand.combinationId, combinationName = demand.combinationName;
  const isBael = resolveRCStandardProfile(basis.standard).family === "bael-91-99";
  const shape: BAELColumnSectionShape = demand.sectionShape ?? "rectangular";
  const width = demand.sectionWidthMm, height = demand.sectionDepthMm, length = demand.lengthMm;
  const bucklingLengthMm = demand.bucklingLengthMm ?? length;
  const limitations: string[] = isBael ? [
    "Second ordre BAEL : A.4.3,5 dans son domaine (α=1, φ=2, f saisi séparément); hors domaine, équilibre non linéaire A.4.4 du poteau isolé, avec f comme longueur efficace, moment de premier ordre constant sur la hauteur et mode sinusoïdal articulé.",
    "Hors domaine A.4.3,5, A.4.4 vérifie la compatibilité par fibres au point calculé; dans le domaine A.4.3,5, la résistance N–Mx–My reste une enveloppe simplifiée. Aucun des deux cas ne démontre la stabilité globale de l’ossature ni les redistributions après modification de section. Résultat de pré-étude, non certifiable et non assimilable à un visa d’exécution.",
  ] : [
    "Interaction N–Mx–My par somme linéaire de capacités axiales et uniaxiales : pré-contrôle conservateur, non un diagramme normatif d’interaction.",
    "Le second ordre utilise le contrôle du profil Eurocode sélectionné; l’interaction complète et les dispositions de confinement sismique doivent être contrôlées séparément.",
  ];
  if (!demand.columnContext) limitations.push("Classification géométrique et connectivité non déduites : aucun contexte de modèle structural n’a été fourni pour ce poteau.");
  if (!positive(demand.bucklingLengthMm ?? 0)) limitations.push("Longueur de flambement non fournie : la hauteur du poteau est utilisée comme longueur efficace provisoire; confirmer les liaisons en tête et en pied.");
  if (!positive(width) || !positive(height) || !positive(length)) return { elementId: demand.id, type: "column", combinationId, combinationName, checks: [emptyCheck("geometry", "Géométrie de poteau", "mm", combinationId, combinationName, "b, h, L > 0")], reinforcement: [], limitations };
  const areaGross = shape === "circular" ? Math.PI * width ** 2 / 4 : width * height;
  const minSteel = isBael ? minimumBAELColumnSteelAreaMm2(shape, width, height) : basis.minReinforcementRatio * areaGross;
  const maxSteel = (isBael ? 0.05 : basis.maxReinforcementRatio) * areaGross;
  const fcd = (isBael ? 0.85 : basis.alphaCC) * basis.fckMpa / basis.gammaC;
  const fyd = basis.fykMpa / basis.gammaS;
  const columnBarArea = (diameterMm: number) => haCatalogBarAreaMm2(diameterMm) ?? barArea(diameterMm);
  const axialKn = Math.abs(demand.axialKn);
  const momentX = Math.abs(demand.momentXKnM ?? demand.momentKnM);
  const momentY = Math.abs(demand.momentYKnM ?? 0);
  const baelSecondX = isBael && axialKn > 0 ? calculateBAELSecondOrderAxis({ axis: "Mx", axialKn, firstOrderMomentKnM: momentX, memberLengthMm: length, bucklingLengthMm, sectionDepthMm: height, alpha: 1, creepRatio: 2 }) : null;
  const baelSecondY = isBael && axialKn > 0 ? calculateBAELSecondOrderAxis({ axis: "My", axialKn, firstOrderMomentKnM: momentY, memberLengthMm: length, bucklingLengthMm, sectionDepthMm: width, alpha: 1, creepRatio: 2 }) : null;
  const designMomentX = baelSecondX?.totalMomentKnM ?? momentX;
  const designMomentY = baelSecondY?.totalMomentKnM ?? momentY;
  const baelDomainRatio = baelSecondX && baelSecondY ? Math.max(baelSecondX.slendernessRatio / baelSecondX.allowableSlendernessRatio, baelSecondY.slendernessRatio / baelSecondY.allowableSlendernessRatio) : 0;
  const a43WithinDomain = !isBael || baelDomainRatio < 1;
  const initialImperfectionMm = Math.max(20, length / 250);
  const preselectionMomentX = a43WithinDomain ? designMomentX : momentX + axialKn * initialImperfectionMm / 1000;
  const preselectionMomentY = a43WithinDomain ? designMomentY : momentY + axialKn * initialImperfectionMm / 1000;
  const baelCompression = isBael ? calculateBAELColumnCompression({ shape, widthMm: width, depthMm: height, bucklingLengthMm, axialKn, fckMpa: basis.fckMpa, fykMpa: basis.fykMpa, gammaC: basis.gammaC, gammaS: basis.gammaS }) : undefined;
  const asTheoreticalMm2 = baelCompression?.theoreticalSteelAreaMm2 ?? Math.max(0, axialKn * 1000 - 0.8 * areaGross * fcd) / Math.max(fyd - 0.8 * fcd, 1e-9);
  const requiredSteel = Math.max(minSteel, asTheoreticalMm2);
  const diameters = basis.availableBarDiametersMm.filter(positive);
  const minLongitudinalDiameterMm = isBael ? 8 : 10;
  const longitudinalDiameters = diameters.filter(diameter => diameter >= minLongitudinalDiameterMm);
  if (!longitudinalDiameters.length) {
    const message = `Aucun diamètre longitudinal disponible n’est supérieur ou égal à ${minLongitudinalDiameterMm} mm; le dimensionnement du poteau est bloqué.`;
    const tieDiameter = Math.max(6, Math.min(...diameters));
    const tieSpacing = Math.max(1, Math.min(basis.maxLinkSpacingMm, 400));
    const tieCount = Math.ceil(length / tieSpacing) + 1;
    const tieLengthM = shape === "circular" ? Math.PI * Math.max(0, width - 2 * (basis.coverMm + tieDiameter / 2)) / 1000 : 2 * (Math.max(0, width - 2 * basis.coverMm - tieDiameter) + Math.max(0, height - 2 * basis.coverMm - tieDiameter)) / 1000;
    return { elementId: demand.id, type: "column", combinationId, combinationName, checks: [emptyCheck("column-longitudinal-diameter", "Diamètre longitudinal admissible", "mm", combinationId, combinationName, message)], reinforcement: [proposal(`${demand.id}:ties`, `Cadres · HA ${tieDiameter} / ${tieSpacing} mm`, tieDiameter, tieCount, 0, tieLengthM)], limitations: [...limitations, message] };
  }
  const override = overrides[`${demand.id}:longitudinal`];
  const overrideDiameterAdmissible = !!override && longitudinalDiameters.includes(override.diameterMm);
  const effectiveOverride = overrideDiameterAdmissible ? override : undefined;
  const ignoredLongitudinalOverride = !!override && !overrideDiameterAdmissible;
  const minimumCount = shape === "circular" ? 6 : 4;
  const barPitchLimitMm = isBael ? baelMaximumColumnBarPitchMm(width, height) : Number.POSITIVE_INFINITY;
  type CandidateBar = { xMm: number; yMm: number; diameterMm: number; areaMm2: number };
  type CandidateGroup = { diameterMm: number; count: number; areaMm2: number; positions: Array<{ xMm: number; yMm: number }> };
  const candidateFor = (cornerDiameterMm: number, middleDiameterMm: number, barCount: number) => {
    const largestDiameterMm = Math.max(cornerDiameterMm, middleDiameterMm);
    const tieDiameterMm = isBael ? (baelColumnTieDiameterMm(largestDiameterMm) ?? 6) : Math.max(6, Math.min(...diameters));
    const layout = baelColumnBarPositions(shape, width, height, barCount, largestDiameterMm, tieDiameterMm, basis.coverMm, barPitchLimitMm);
    const edgeInsetMm = basis.coverMm + tieDiameterMm + largestDiameterMm / 2;
    const cornerX = width / 2 - edgeInsetMm, cornerY = height / 2 - edgeInsetMm;
    const bars: CandidateBar[] = layout.positions.map(position => {
      const isCorner = shape === "rectangular" && Math.abs(Math.abs(position.xMm) - cornerX) < 1e-5 && Math.abs(Math.abs(position.yMm) - cornerY) < 1e-5;
      const diameterMm = isCorner ? cornerDiameterMm : middleDiameterMm;
      return { ...position, diameterMm, areaMm2: columnBarArea(diameterMm) };
    });
    const areaMm2 = bars.reduce((sum, bar) => sum + bar.areaMm2, 0);
    const grouped = new Map<number, CandidateGroup>();
    for (const bar of bars) {
      const group = grouped.get(bar.diameterMm) ?? { diameterMm: bar.diameterMm, count: 0, areaMm2: 0, positions: [] };
      group.count++;
      group.areaMm2 += bar.areaMm2;
      group.positions.push({ xMm: bar.xMm, yMm: bar.yMm });
      grouped.set(bar.diameterMm, group);
    }
    const groups = [...grouped.values()].sort((a, b) => b.diameterMm - a.diameterMm);
    let clearSpacingMm = Number.POSITIVE_INFINITY;
    for (let index = 0; index < bars.length; index++) {
      const current = bars[index], next = bars[(index + 1) % bars.length];
      const centerDistanceMm = Math.hypot(current.xMm - next.xMm, current.yMm - next.yMm);
      clearSpacingMm = Math.min(clearSpacingMm, centerDistanceMm - (current.diameterMm + next.diameterMm) / 2);
    }
    const coverValid = bars.every(bar => shape === "circular"
      ? Math.hypot(bar.xMm, bar.yMm) + bar.diameterMm / 2 <= width / 2 - basis.coverMm - tieDiameterMm + 1e-6
      : Math.abs(bar.xMm) + bar.diameterMm / 2 <= width / 2 - basis.coverMm - tieDiameterMm + 1e-6
        && Math.abs(bar.yMm) + bar.diameterMm / 2 <= height / 2 - basis.coverMm - tieDiameterMm + 1e-6);
    const tieSegmentsMm: Array<{ x1Mm: number; y1Mm: number; x2Mm: number; y2Mm: number }> = [];
    if (shape === "rectangular") {
      const leftMid = bars.find(bar => Math.abs(bar.xMm + cornerX) < 1e-5 && Math.abs(bar.yMm) < 1e-5);
      const rightMid = bars.find(bar => Math.abs(bar.xMm - cornerX) < 1e-5 && Math.abs(bar.yMm) < 1e-5);
      const bottomMid = bars.find(bar => Math.abs(bar.yMm + cornerY) < 1e-5 && Math.abs(bar.xMm) < 1e-5);
      const topMid = bars.find(bar => Math.abs(bar.yMm - cornerY) < 1e-5 && Math.abs(bar.xMm) < 1e-5);
      if (leftMid && rightMid) tieSegmentsMm.push({ x1Mm: leftMid.xMm, y1Mm: leftMid.yMm, x2Mm: rightMid.xMm, y2Mm: rightMid.yMm });
      if (bottomMid && topMid) tieSegmentsMm.push({ x1Mm: bottomMid.xMm, y1Mm: bottomMid.yMm, x2Mm: topMid.xMm, y2Mm: topMid.yMm });
    }
    const concreteAreaMm2 = Math.max(0, areaGross - areaMm2);
    const axialResistanceKn = baelCompression
      ? baelCompression.alpha * (baelCompression.reducedConcreteResistanceKn * 1000 + areaMm2 * basis.fykMpa / basis.gammaS) / 1000
      : (0.8 * concreteAreaMm2 * fcd + areaMm2 * fyd) / 1000;
    const mxResistanceKnM = fyd * bars.reduce((sum, bar) => sum + bar.areaMm2 * Math.abs(bar.yMm), 0) * 0.5 / 1e6;
    const myResistanceKnM = fyd * bars.reduce((sum, bar) => sum + bar.areaMm2 * Math.abs(bar.xMm), 0) * 0.5 / 1e6;
    const secondOrderMoment = (firstOrderMoment: number, sectionWidthMm: number, sectionDepthMm: number) => {
      if (isBael || axialKn <= 0 || firstOrderMoment <= 1e-9) return firstOrderMoment;
      return checkColumnSecondOrder({
        NEdKn: axialKn, M0EdKnM: firstOrderMoment, bMm: sectionWidthMm, hMm: sectionDepthMm,
        L0Mm: bucklingLengthMm,
        dMm: Math.max(50, sectionDepthMm - basis.coverMm - tieDiameterMm - largestDiameterMm / 2),
        AsMm2: areaMm2, fykMpa: basis.fykMpa, gammaS: basis.gammaS,
      }).MEdKnM;
    };
    const candidateMomentX = secondOrderMoment(preselectionMomentX, width, height);
    const candidateMomentY = secondOrderMoment(preselectionMomentY, height, width);
    const interactionRatio = axialKn / Math.max(axialResistanceKn, 1e-9)
      + candidateMomentX / Math.max(mxResistanceKnM, 1e-9)
      + candidateMomentY / Math.max(myResistanceKnM, 1e-9);
    return {
      diameterMm: largestDiameterMm, count: bars.length, areaMm2, groups, bars,
      axialResistanceKn, mxResistanceKnM, myResistanceKnM, interactionRatio, candidateMomentX, candidateMomentY,
      clearSpacingMm, maxPitchMm: layout.maxPitchMm,
      minimumCount: Math.max(minimumCount, layout.minimumCount),
      layoutValid: layout.valid && coverValid && clearSpacingMm >= basis.minClearSpacingMm,
      tieDiameterMm,
      tieSegmentsMm,
    };
  };
  const largestCount = Math.max(minimumCount, Math.min(100, Math.floor(maxSteel / Math.min(...longitudinalDiameters.map(columnBarArea)) / 2) * 2));
  const catalogCandidates = Array.from({ length: Math.floor((largestCount - minimumCount) / 2) + 1 }, (_, index) => minimumCount + index * 2)
    .flatMap(barCount => longitudinalDiameters.flatMap(cornerDiameterMm => {
      const candidates = [candidateFor(cornerDiameterMm, cornerDiameterMm, barCount)];
      if (shape === "rectangular" && barCount > 4) for (const middleDiameterMm of longitudinalDiameters) {
        if (middleDiameterMm < cornerDiameterMm) candidates.push(candidateFor(cornerDiameterMm, middleDiameterMm, barCount));
      }
      return candidates;
    }));
  const compareCandidates = (a: typeof catalogCandidates[number], b: typeof catalogCandidates[number]) =>
    a.count - b.count || a.areaMm2 - b.areaMm2 || a.groups.length - b.groups.length || a.diameterMm - b.diameterMm;
  const sortedCandidates = [...catalogCandidates].sort(compareCandidates);
  const isAcceptableCandidate = (candidate: typeof catalogCandidates[number]) =>
    candidate.areaMm2 >= minSteel && candidate.areaMm2 <= maxSteel
    && candidate.axialResistanceKn >= axialKn
    && candidate.interactionRatio <= 1
    && candidate.layoutValid && candidate.count >= candidate.minimumCount;
  const passingCandidates = sortedCandidates.filter(isAcceptableCandidate);
  const scoreCandidate = (candidate: typeof catalogCandidates[number]) => Math.max(
    axialKn / Math.max(candidate.axialResistanceKn, 1e-9),
    candidate.interactionRatio,
    minSteel / Math.max(candidate.areaMm2, 1e-9),
    candidate.areaMm2 / Math.max(maxSteel, 1e-9),
    basis.minClearSpacingMm / Math.max(candidate.clearSpacingMm, 1e-9),
    candidate.minimumCount / Math.max(candidate.count, 1),
    isBael ? candidate.maxPitchMm / Math.max(barPitchLimitMm, 1) : 0,
  );
  const overrideCount = effectiveOverride && Number.isInteger(effectiveOverride.count) && effectiveOverride.count >= minimumCount
    ? Math.max(minimumCount, effectiveOverride.count + (effectiveOverride.count % 2)) : undefined;
  let selectedBars = effectiveOverride && overrideCount
    ? candidateFor(effectiveOverride.diameterMm, effectiveOverride.diameterMm, overrideCount)
    : passingCandidates[0] ?? [...sortedCandidates].sort((a, b) => scoreCandidate(a) - scoreCandidate(b) || compareCandidates(a, b))[0] ?? candidateFor(longitudinalDiameters[0], longitudinalDiameters[0], minimumCount);
  const rejectionReason = (candidate: typeof catalogCandidates[number]) => candidate.areaMm2 < minSteel
    ? `As=${(candidate.areaMm2 / 100).toFixed(2)} cm² < As,min=${(minSteel / 100).toFixed(2)} cm²`
    : candidate.areaMm2 > maxSteel ? `As>${(maxSteel / 100).toFixed(2)} cm² maximal`
    : candidate.axialResistanceKn < axialKn ? `NRd=${candidate.axialResistanceKn.toFixed(1)} kN < NEd=${axialKn.toFixed(1)} kN`
    : candidate.interactionRatio > 1 ? `interaction N–Mx–My=${candidate.interactionRatio.toFixed(2)} > 1`
    : !candidate.layoutValid || candidate.count < candidate.minimumCount ? `espacement/détail non conforme (jeu ${candidate.clearSpacingMm.toFixed(0)} mm)`
    : null;
  const optimizationTrace = effectiveOverride ? [] : sortedCandidates
    .filter(candidate => candidate.areaMm2 > 0 && candidate.groups.length > 0 && candidate.areaMm2 < selectedBars.areaMm2 && rejectionReason(candidate))
    .slice(0, 5)
    .map(candidate => `${candidate.groups.map(group => `${group.count}HA${group.diameterMm}`).join("+")} (${(candidate.areaMm2 / 100).toFixed(2)} cm²) écarté : ${rejectionReason(candidate)}`);
  let baelIsolatedEquilibrium: ReturnType<typeof solveBAELIsolatedColumnEquilibrium> | null = null;
  if (isBael && !a43WithinDomain && baelSecondX && baelSecondY && basis.fckMpa <= 60) {
    const solveCandidate = (candidate: typeof selectedBars) => solveBAELIsolatedColumnEquilibrium({
      shape, widthMm: width, depthMm: height, memberLengthMm: length,
      bucklingLengthMm: demand.bucklingLengthMm ?? length,
      axialKn, firstOrderMomentXKnM: momentX, firstOrderMomentYKnM: momentY,
      fckMpa: basis.fckMpa, fykMpa: basis.fykMpa, gammaC: basis.gammaC, gammaS: basis.gammaS,
      coverMm: basis.coverMm, bars: candidate.bars.map(({ xMm, yMm, diameterMm, areaMm2 }) => ({ xMm, yMm, diameterMm, areaMm2 })),
      alpha: 1, creepRatio: 2,
    });
    baelIsolatedEquilibrium = solveCandidate(selectedBars);
    if (!effectiveOverride && !baelIsolatedEquilibrium.withinMaterialLimits) {
      const options = sortedCandidates
        .filter(candidate => candidate.areaMm2 >= minSteel && candidate.areaMm2 <= maxSteel && candidate.axialResistanceKn >= axialKn && candidate.layoutValid && candidate.count >= candidate.minimumCount && candidate.areaMm2 >= selectedBars.areaMm2)
        .slice(0, 24);
      let bestUtilization = baelIsolatedEquilibrium.converged
        ? Math.max(baelIsolatedEquilibrium.maxConcreteCompressionStrain / baelIsolatedEquilibrium.concreteLimitStrain, baelIsolatedEquilibrium.maxSteelStrain / 0.01, baelIsolatedEquilibrium.stableEquilibrium ? 0 : 2)
        : Number.POSITIVE_INFINITY;
      for (const candidate of options) {
        if (candidate === selectedBars) continue;
        const trial = solveCandidate(candidate);
        const utilization = trial.converged
          ? Math.max(trial.maxConcreteCompressionStrain / trial.concreteLimitStrain, trial.maxSteelStrain / 0.01, trial.stableEquilibrium ? 0 : 2)
          : Number.POSITIVE_INFINITY;
        if (trial.withinMaterialLimits) { selectedBars = candidate; baelIsolatedEquilibrium = trial; break; }
        if (utilization < bestUtilization) { selectedBars = candidate; baelIsolatedEquilibrium = trial; bestUtilization = utilization; }
      }
    }
  }
  const baelEquilibriumUtilization = baelIsolatedEquilibrium?.converged
    ? Math.max(baelIsolatedEquilibrium.maxConcreteCompressionStrain / baelIsolatedEquilibrium.concreteLimitStrain, baelIsolatedEquilibrium.maxSteelStrain / 0.01, baelIsolatedEquilibrium.stableEquilibrium ? 0 : 2)
    : null;
  const { count, diameterMm: diameter, areaMm2: asProvided } = selectedBars;
  const axialResistance = selectedBars.axialResistanceKn;
  const mxResistance = selectedBars.mxResistanceKnM;
  const myResistance = selectedBars.myResistanceKnM;
  const interactionMomentX = baelIsolatedEquilibrium?.converged ? baelIsolatedEquilibrium.totalMomentXKnM : selectedBars.candidateMomentX;
  const interactionMomentY = baelIsolatedEquilibrium?.converged ? baelIsolatedEquilibrium.totalMomentYKnM : selectedBars.candidateMomentY;
  const interaction = baelEquilibriumUtilization ?? (axialKn / Math.max(axialResistance, 1e-9)
    + interactionMomentX / Math.max(mxResistance, 1e-9)
    + interactionMomentY / Math.max(myResistance, 1e-9));
  const requiredAsX = interactionMomentX * asProvided / Math.max(mxResistance, 1e-9);
  const requiredAsY = interactionMomentY * asProvided / Math.max(myResistance, 1e-9);
  const longitudinalRequiredAreaMm2 = Math.max(minSteel, asTheoreticalMm2, requiredAsX, requiredAsY);
  const tieDiameter = selectedBars.tieDiameterMm;
  const tieSpacingLimitMm = isBael ? baelMaximumColumnTieSpacingMm(width, height, diameter) : basis.maxLinkSpacingMm;
  const tieCount = Math.ceil(length / Math.max(tieSpacingLimitMm, 1)) + 1;
  const tieSpacingMm = length / Math.max(1, tieCount - 1);
  const tieLengthM = shape === "circular"
    ? Math.PI * Math.max(0, width - 2 * (basis.coverMm + tieDiameter / 2)) / 1000
    : 2 * (Math.max(0, width - 2 * basis.coverMm - tieDiameter) + Math.max(0, height - 2 * basis.coverMm - tieDiameter)) / 1000;
  const interactionCheckLabel = isBael
    ? baelEquilibriumUtilization !== null ? "Résistance de section BAEL · compatibilité A.4.4" : "Interaction N–Mx–My · enveloppe de pré-étude"
    : "Interaction N–Mx–My simplifiée";
  const interactionCheckFormula = isBael
    ? baelEquilibriumUtilization !== null
      ? `Équilibre plan de déformations par fibres BAEL; Uε=${interaction.toFixed(3)}≤1; moments après second ordre Mx=${interactionMomentX.toFixed(2)}, My=${interactionMomentY.toFixed(2)} kN·m.`
      : `Enveloppe linéaire de pré-étude; moments après imperfections: Mx,Ed=${interactionMomentX.toFixed(2)} kN·m, My,Ed=${interactionMomentY.toFixed(2)} kN·m.`
    : "NEd/NRd + |Mx|/MRdx + |My|/MRdy ≤ 1 ; enveloppe linéaire non normative";
  const reinforcement: RebarProposal[] = [
    ...selectedBars.groups.map((group, index) => ({
      ...proposal(
        index === 0 ? `${demand.id}:longitudinal` : `${demand.id}:longitudinal:group-${index + 1}`,
        `Longitudinal poteau · ${group.count}HA${group.diameterMm} · ${shape === "circular" ? "répartition circulaire régulière" : "répartition symétrique sur les faces"}`,
        group.diameterMm,
        group.count,
        longitudinalRequiredAreaMm2 * group.areaMm2 / Math.max(asProvided, 1e-9),
        length / 1000,
      ),
      areaMm2: group.areaMm2,
      barPositionsMm: group.positions,
    })),
    proposal(`${demand.id}:ties`, `Cadres BAEL · HA ${tieDiameter} / ${tieSpacingMm.toFixed(0)} mm · ceinture continue`, tieDiameter, tieCount, 0, tieLengthM),
  ];
  if (selectedBars.tieSegmentsMm.length) {
    const averageSegmentLengthM = selectedBars.tieSegmentsMm.reduce((sum, segment) => sum + Math.hypot(segment.x2Mm - segment.x1Mm, segment.y2Mm - segment.y1Mm) / 1000, 0) / selectedBars.tieSegmentsMm.length;
    reinforcement.push({
      ...proposal(`${demand.id}:cross-ties`, `Épingles de maintien · HA ${tieDiameter} / ${tieSpacingMm.toFixed(0)} mm · longueur droite indicative`, tieDiameter, tieCount * selectedBars.tieSegmentsMm.length, 0, averageSegmentLengthM),
      tieSegmentsMm: selectedBars.tieSegmentsMm,
    });
    limitations.push("Les épingles de maintien sont représentées en longueur droite indicative; leurs crochets et détails d’exécution restent à définir.");
  }
  const checks: RCCheck[] = [
    check("column-axial", "Compression axiale", axialKn, axialResistance, "kN", isBael
      ? "Nu ≤ α·[Br·fc28/(0,9·γb) + As·fe/γs] — BAEL 91 mod. 99"
      : "NRd≈0,8·(Ac−As)·fcd+As·fyd", combinationId, combinationName),
    check("column-interaction", interactionCheckLabel, interaction, 1, "—", interactionCheckFormula, combinationId, combinationName),
    check("column-steel-axial", "Armatures théoriques · compression", asTheoreticalMm2, asProvided, "mm²", isBael
      ? "As,th = max[0 ; (Nu/α − Br·fc28/(0,9·γb))·γs/fe] — hors minimum réglementaire"
      : "As,th estimée selon l’équilibre axial du modèle de pré-étude", combinationId, combinationName),
    check("column-steel-min", "Armatures longitudinales minimales", minSteel, asProvided, "mm²", isBael ? "As ≥ max(0,2 %·Ag ; 4 cm²/m de périmètre) — A.8.1,21" : "As,prov ≥ ρmin·Ag", combinationId, combinationName),
    check("column-steel-max", "Armatures longitudinales maximales", asProvided, maxSteel, "mm²", isBael ? "As ≤ 5 %·Ag hors recouvrements — A.8.1,21" : "As,prov ≤ ρmax·Ag", combinationId, combinationName),
    check("column-bar-spacing", isBael ? "Répartition des barres sur le contour" : "Espacement libre des barres", isBael ? Math.max(selectedBars.maxPitchMm / Math.max(barPitchLimitMm, 1), basis.minClearSpacingMm / Math.max(selectedBars.clearSpacingMm, 1e-9)) : basis.minClearSpacingMm, isBael ? 1 : selectedBars.clearSpacingMm, isBael ? "—" : "mm", isBael ? "A.8.1,22 : pas de face ≤ min(petit côté+100 mm, 400 mm) et jeu libre conforme au minimum saisi" : "Disposition symétrique indicative ; sclair ≥ minimum déclaré", combinationId, combinationName),
    check("column-bar-layout-count", "Disposition longitudinale · nombre de barres", selectedBars.minimumCount, count, "barres", isBael ? (shape === "circular" ? "Au moins six barres équidistantes pour la section circulaire; adaptation géométrique A.8.1,22" : "Une barre à chaque angle et nombre suffisant pour le pas maximal A.8.1,22") : "Nombre pair ≥ 4 pour la répartition retenue", combinationId, combinationName),
    check("column-tie-spacing", "Espacement des cadres", tieSpacingMm, tieSpacingLimitMm, "mm", isBael ? `A.8.1,3 : s ≤ min(15·φlong=${(15 * diameter).toFixed(0)} mm, 400 mm, petit côté+100 mm)` : "sCadres ≤ espacement maximal déclaré dans la base du projet", combinationId, combinationName),
  ];
  if (isBael) {
    if (baelCompression && !baelCompression.withinAlphaRange) checks.push(check("column-bael-alpha-range", "Domaine d’élancement BAEL pour α", baelCompression.slenderness, 70, "—", "α(λ) BAEL tabulé jusqu’à λ=70; vérifier la stabilité globale et réduire l’élancement.", combinationId, combinationName));
    if (baelSecondX && baelSecondY) {
      const secondOrderFormula = `Domaine A.4.3,5 : f/h < max(15,20·e1/h) dans les deux axes; α=1, φ=2; ea=${baelSecondX.additionalEccentricityMm.toFixed(1)} mm; e2x=${baelSecondX.secondOrderEccentricityMm.toFixed(1)} mm, e2y=${baelSecondY.secondOrderEccentricityMm.toFixed(1)} mm; M1x=${momentX.toFixed(2)} kN·m, M1y=${momentY.toFixed(2)} kN·m.`;
      if (baelDomainRatio < 1) {
        checks.push(check("column-second-order", "Second ordre BAEL · A.4.3,5", baelDomainRatio, 1, "—", `${secondOrderFormula} Mx,Ed=${designMomentX.toFixed(2)} kN·m, My,Ed=${designMomentY.toFixed(2)} kN·m.`, combinationId, combinationName));
      } else if (baelIsolatedEquilibrium?.converged) {
        const equilibriumUtilization = baelEquilibriumUtilization ?? 2;
        const equilibriumFormula = `A.4.4,2–3 : équilibre non linéaire du poteau isolé, mode sinusoïdal articulé, f=${(demand.bucklingLengthMm ?? length).toFixed(0)} mm, moments de premier ordre constants; imperfection ea=${initialImperfectionMm.toFixed(1)} mm; α=1, φ=2. Déformations max: béton=${(baelIsolatedEquilibrium.maxConcreteCompressionStrain * 1000).toFixed(2)} ‰ / ${(baelIsolatedEquilibrium.concreteLimitStrain * 1000).toFixed(1)} ‰; acier=${(baelIsolatedEquilibrium.maxSteelStrain * 1000).toFixed(2)} ‰ / 10 ‰; rigidité tangentielle ${baelIsolatedEquilibrium.stableEquilibrium ? "stable" : "instable"}. Mx,Ed=${baelIsolatedEquilibrium.totalMomentXKnM.toFixed(2)}, My,Ed=${baelIsolatedEquilibrium.totalMomentYKnM.toFixed(2)} kN·m; δx=${baelIsolatedEquilibrium.deflectionXmm.toFixed(1)}, δy=${baelIsolatedEquilibrium.deflectionYmm.toFixed(1)} mm; résidu=${baelIsolatedEquilibrium.residual.toExponential(2)}. ${baelIsolatedEquilibrium.reason}`;
        checks.push(check("column-second-order", "Stabilité BAEL · A.4.4 (poteau isolé)", equilibriumUtilization, 1, "—", equilibriumFormula, combinationId, combinationName));
      } else {
        checks.push(emptyCheck("column-second-order", "Stabilité BAEL · A.4.4 non convergée", "—", combinationId, combinationName, `${secondOrderFormula} Domaine A.4.3,5 dépassé (ratio ${baelDomainRatio.toFixed(3)}). ${baelIsolatedEquilibrium?.reason ?? "L’équilibre non linéaire n’a pas été résolu; aucune conformité de stabilité n’est émise."}`));
      }
    } else checks.push(emptyCheck("column-second-order", "Second ordre BAEL · A.4.3,5", "—", combinationId, combinationName, "Un effort normal de compression positif est requis pour calculer les excentricités BAEL."));
    const detailUtilization = Math.max(
      minSteel / Math.max(asProvided, 1e-9), asProvided / Math.max(maxSteel, 1e-9),
      selectedBars.minimumCount / Math.max(count, 1),
      selectedBars.maxPitchMm / Math.max(barPitchLimitMm, 1),
      basis.minClearSpacingMm / Math.max(selectedBars.clearSpacingMm, 1e-9),
      tieSpacingMm / Math.max(tieSpacingLimitMm, 1),
      (baelColumnTieDiameterMm(diameter) ?? Number.POSITIVE_INFINITY) / Math.max(tieDiameter, 1),
    );
    const baelScopeRatio = basis.fckMpa <= 60 ? 1 : Number.POSITIVE_INFINITY;
    checks.push(check("column-bael-detailing", "Détails BAEL · barres et cadres A.8.1", Math.max(detailUtilization, baelScopeRatio), 1, "—", "A.8.1,21–3 : minimum/maximum d’acier, répartition, diamètre normalisé et pas des cadres. Les recouvrements entre étages ne sont pas modélisés dans cette fiche.", combinationId, combinationName));
    if (basis.fckMpa > 60) limitations.push("BAEL A.2.1,12/A.8.1 hors domaine déclaré pour fc28 > 60 MPa : aucune conclusion de conformité BAEL n’est émise.");
  } else {
    const slendernessX = bucklingLengthMm / Math.sqrt(height * height / 12);
    const slendernessY = bucklingLengthMm / Math.sqrt(width * width / 12);
    checks.push(check("column-slenderness", "Élancement mécanique", Math.max(slendernessX, slendernessY), basis.maxColumnSlenderness, "—", "λ = L0/i ; seuil déclaré avant contrôle de second ordre", combinationId, combinationName));
    const secondOrderX = checkColumnSecondOrder({ NEdKn: axialKn, M0EdKnM: momentX, bMm: width, hMm: height, L0Mm: bucklingLengthMm, dMm: Math.max(50, height - basis.coverMm - tieDiameter - diameter / 2), AsMm2: asProvided, fykMpa: basis.fykMpa, gammaS: basis.gammaS });
    const secondOrderY = checkColumnSecondOrder({ NEdKn: axialKn, M0EdKnM: momentY, bMm: height, hMm: width, L0Mm: bucklingLengthMm, dMm: Math.max(50, width - basis.coverMm - tieDiameter - diameter / 2), AsMm2: asProvided, fykMpa: basis.fykMpa, gammaS: basis.gammaS });
    const secondOrderAmplification = Math.max(momentX > 1e-9 ? secondOrderX.amplification : 0, momentY > 1e-9 ? secondOrderY.amplification : 0);
    checks.push(momentX <= 1e-9 && momentY <= 1e-9
      ? unverifiedCheck("column-second-order", "Second ordre · moments de premier ordre nuls", Math.max(secondOrderX.MEdKnM, secondOrderY.MEdKnM), "kN·m", "M0≈0 dans les deux axes : le ratio d’amplification est indéfini. L’imperfection calculée ne constitue pas une validation normative.", combinationId, combinationName)
      : check("column-second-order", "Second ordre · amplification biaxiale", secondOrderAmplification, 5, "—", `Contrôle indicatif par courbure nominale dans X et Y; L0=${bucklingLengthMm.toFixed(0)} mm. MEd,x=${secondOrderX.MEdKnM.toFixed(2)} kN·m; MEd,y=${secondOrderY.MEdKnM.toFixed(2)} kN·m.`, combinationId, combinationName));
    if (secondOrderX.warnings.length || secondOrderY.warnings.length) limitations.push(...secondOrderX.warnings, ...secondOrderY.warnings);
    checks.push(emptyCheck("column-bael-detailing", "Détails réglementaires Eurocode 2", "—", combinationId, combinationName, "Les dispositions détaillées et les recouvrements EC2 ne sont pas calculés par cette fiche."));
  }
  if (basis.seismicDetailingEnabled && basis.seismicDuctilityClass) {
    const seismic = checkSeismicDetailing({ ductilityClass: basis.seismicDuctilityClass, member: "column", widthMm: width, depthMm: height, clearHeightMm: length, longitudinalRatio: asProvided / Math.max(areaGross, 1), transverseDiameterMm: tieDiameter, transverseSpacingMm: tieSpacingMm, coverMm: basis.coverMm, fykMpa: basis.fykMpa });
    checks.push(check("column-seismic-detailing", "Détail sismique poteau", Math.max(seismic.rhoMin / Math.max(asProvided / Math.max(areaGross, 1), 1e-9), tieSpacingMm / Math.max(seismic.spacingLimitMm, 1)), 1, "—", "ρ et espacement de confinement selon classe de ductilité déclarée", combinationId, combinationName));
    if (seismic.warnings.length) limitations.push(...seismic.warnings);
  } else if (basis.seismicDetailingEnabled) checks.push(emptyCheck("column-seismic-detailing", "Détail sismique poteau", "—", combinationId, combinationName, "Classe de ductilité et paramètres de détail requis"));
  if (ignoredLongitudinalOverride) checks.push(emptyCheck("column-longitudinal-override", "Override longitudinal ignoré", "mm", combinationId, combinationName, `Override ignoré : le diamètre longitudinal doit être disponible au catalogue et supérieur ou égal à ${minLongitudinalDiameterMm} mm.`));
  const slendernessX = bucklingLengthMm / Math.sqrt(height * height / 12);
  const slendernessY = bucklingLengthMm / Math.sqrt(width * width / 12);
  const secondOrderRequired = isBael ? !a43WithinDomain : Math.max(slendernessX, slendernessY) > basis.maxColumnSlenderness;
  const finalStatus: RCColumnCalculationSheet["finalStatus"] = checks.some(item => item.status === "non satisfaisant" && item.blocking !== false)
    ? "NON CONFORME"
    : checks.some(item => (item.status === "bloqué" || item.status === "à vérifier") && item.blocking !== false)
      || checks.some(item => item.status !== "satisfaisant" && item.blocking === false)
      ? "À VÉRIFIER"
      : "CONFORME";
  const context = demand.columnContext;
  const columnReport: RCColumnCalculationSheet = {
    classification: context?.classification ?? "non-déterminé",
    position: context?.position ?? "non-déterminée",
    levelLabel: demand.levelLabel,
    xM: context?.xM,
    yM: context?.yM,
    sectionWidthMm: width,
    sectionDepthMm: height,
    heightMm: length,
    bucklingLengthMm,
    slendernessX,
    slendernessY,
    secondOrderRequired,
    combinationId,
    combinationName,
    NEdKn: axialKn,
    MEdXKnM: interactionMomentX,
    MEdYKnM: interactionMomentY,
    VEdKn: Math.abs(demand.shearKn),
    TEdKnM: Math.abs(demand.torsionKnM ?? 0),
    AsTheoreticalMm2: asTheoreticalMm2,
    AsRequiredMm2: longitudinalRequiredAreaMm2,
    AsMinimumMm2: minSteel,
    AsProvidedMm2: asProvided,
    longitudinalBarCount: count,
    longitudinalDiameterMm: diameter,
    tieDiameterMm: tieDiameter,
    tieSpacingMm: tieSpacingMm,
    optimizationTrace,
    baelCompression: baelCompression ? {
      minimumInertiaMm4: baelCompression.minimumInertiaMm4,
      radiusGyrationMm: baelCompression.radiusGyrationMm,
      slenderness: baelCompression.slenderness,
      alpha: baelCompression.alpha,
      reducedConcreteAreaMm2: baelCompression.reducedConcreteAreaMm2,
    } : undefined,
    connectedAtBase: context?.connectedAtBase ?? [],
    connectedAtTop: context?.connectedAtTop ?? [],
    baseSupportKind: context?.baseSupportKind,
    finalStatus,
  };
  return { elementId: demand.id, type: "column", combinationId, combinationName, checks, reinforcement, limitations, columnReport };
}

function designSlab(demand: RCSlabDemand, basis: RCDesignBasis, overrides: RCDesignOverrides): RCElementDesign {
  const combinationId = demand.combinationId, combinationName = demand.combinationName;
  const limitations = [
    "La continuité réelle, la redistribution, la fissuration wk et les ancrages restent à vérifier avec les détails d’exécution.",
  ];
  const lineSupported = demand.boundaryMode === "cantilever-fixed-edge" || demand.boundaryMode === "one-way-simply-supported";
  const assumedSupportReaction = !lineSupported && demand.supportReactionKn === undefined;
  const assumedColumnGeometry = !positive(demand.columnWidthMm ?? 0) || !positive(demand.columnDepthMm ?? 0);
  const negativeMx = demand.negativeMxKnMPerM ?? Math.abs(demand.mxKnMPerM) * 0.25;
  const negativeMy = demand.negativeMyKnMPerM ?? Math.abs(demand.myKnMPerM) * 0.25;
  const supportReaction = demand.supportReactionKn ?? (lineSupported ? 0 : Math.max(0, (demand.uniformLoadKnM2 ?? 0) * demand.spanXM * demand.spanYM / 4));
  const columnWidth = demand.columnWidthMm ?? 300;
  const columnDepth = demand.columnDepthMm ?? 300;
  if (demand.boundaryMode === "cantilever-fixed-edge") limitations.push("Balcon résolu comme plaque encastrée sur une rive ; la réaction calculée est linéique sur la façade/poutre et ne constitue pas une réaction ponctuelle de poteau.");
  else if (demand.boundaryMode === "one-way-simply-supported") limitations.push("Corps creux résolu comme plaque orthotrope équivalente sur deux rives de portée ; confirmer les rigidités et détails auprès du fabricant/projet.");
  else limitations.push("Plaque isotrope Navier simplement appuyée sur quatre bords ; la dalle continue et la redistribution par poutres ne sont pas représentées.");
  if (assumedSupportReaction) limitations.push("Réaction de poteau non fournie : q·Lx·Ly/4 utilisée pour la pré-étude du poinçonnement.");
  if (assumedColumnGeometry) limitations.push("Dimensions du poteau non fournies : poteau provisoire 300×300 mm utilisé pour le périmètre critique.");
  if (demand.negativeMxKnMPerM === undefined || demand.negativeMyKnMPerM === undefined) limitations.push("Moments négatifs non disponibles : 25 % des moments positifs utilisés comme enveloppe provisoire aux appuis.");
  if (!positive(demand.thicknessMm) || !positive(demand.spanXM) || !positive(demand.spanYM)) return { elementId: demand.id, type: "slab", combinationId, combinationName, checks: [emptyCheck("geometry", "Géométrie de dalle", "mm", combinationId, combinationName, "épaisseur et portées > 0")], reinforcement: [], limitations };
  const stripWidth = 1000;
  const effectiveDepth = demand.thicknessMm - basis.coverMm - 5;
  if (!positive(effectiveDepth)) return { elementId: demand.id, type: "slab", combinationId, combinationName, checks: [emptyCheck("effective-depth", "Hauteur utile de dalle", "mm", combinationId, combinationName, "d = h − cnom − ϕbarre/2 > 0")], reinforcement: [], limitations };
  const fyd = basis.fykMpa / basis.gammaS;
  const z = 0.9 * effectiveDepth;
  const minSteel = basis.minReinforcementRatio * stripWidth * effectiveDepth;
  const maxSteel = basis.maxReinforcementRatio * stripWidth * effectiveDepth;
  const reqX = Math.max(minSteel, Math.abs(demand.mxKnMPerM) * 1e6 / Math.max(z * fyd, 1e-9));
  const reqY = Math.max(minSteel, Math.abs(demand.myKnMPerM) * 1e6 / Math.max(z * fyd, 1e-9));
  const chooseSlabBars = (key: string, req: number) => {
    const override = overrides[`${demand.id}:${key}`];
    if (override && positive(override.diameterMm) && Number.isInteger(override.count) && override.count > 0) return { diameter: override.diameterMm, count: override.count };
    const diameter = Math.min(...basis.availableBarDiametersMm.filter(positive));
    const count = Math.max(1, Math.ceil(req / barArea(diameter)));
    return { diameter, count };
  };
  const x = chooseSlabBars("x", reqX), y = chooseSlabBars("y", reqY);
  const areaX = x.count * barArea(x.diameter), areaY = y.count * barArea(y.diameter);
  const reinforcement = [
    proposal(`${demand.id}:x`, "Nappe inférieure direction X · HA " + x.diameter + " / " + (1000 / Math.max(1, x.count)).toFixed(0) + " mm", x.diameter, x.count, reqX, demand.spanXM + 2 * basis.coverMm / 1000),
    proposal(`${demand.id}:y`, "Nappe inférieure direction Y · HA " + y.diameter + " / " + (1000 / Math.max(1, y.count)).toFixed(0) + " mm", y.diameter, y.count, reqY, demand.spanYM + 2 * basis.coverMm / 1000),
  ];
  const checks = [
    check("slab-flexure-x", "Flexion X · armatures inférieures", reqX, areaX, "mm²/m", "As,req = Mx/(z·fyd), par bande de 1 m", combinationId, combinationName),
    check("slab-max-x", "Taux maximal X", areaX, maxSteel, "mm²/m", "As,prov ≤ ρmax·b·d", combinationId, combinationName),
    check("slab-flexure-y", "Flexion Y · armatures inférieures", reqY, areaY, "mm²/m", "As,req = My/(z·fyd), par bande de 1 m", combinationId, combinationName),
    check("slab-max-y", "Taux maximal Y", areaY, maxSteel, "mm²/m", "As,prov ≤ ρmax·b·d", combinationId, combinationName),
    lineSupported
      ? emptyCheck("slab-punching", "Poinçonnement au périmètre critique", "kN", combinationId, combinationName, "réaction linéique sur poutre/façade ; la réaction ponctuelle au poteau et le poinçonnement ne sont pas calculés par ce modèle")
      : check("slab-punching", "Poinçonnement au périmètre critique", supportReaction, Math.max(1, (2 * (columnWidth + columnDepth) + 4 * Math.min(demand.thicknessMm, 200)) / 1000 * demand.thicknessMm * 0.6), "kN", "VEd ≤ VRd,c ; données réelles à confirmer pour la note finale", combinationId, combinationName),
    demand.uniformLoadKnM2 !== undefined && demand.uniformLoadKnM2 >= 0
      ? check("slab-shear", "Cisaillement unidirectionnel", Math.abs(demand.uniformLoadKnM2 * Math.min(demand.spanXM, demand.spanYM) / 2), Math.max(1, 0.18 * basis.fckMpa * stripWidth * effectiveDepth / 1000), "kN", "VEd ≤ VRd,c ; vérification indicative par bande de 1 m", combinationId, combinationName)
      : emptyCheck("slab-shear", "Cisaillement unidirectionnel", "kN", combinationId, combinationName, "Charge uniforme ELS/ELU requise"),
    demand.openingAreaRatio !== undefined
      ? check("slab-openings", "Trémies et ouvertures", demand.openingAreaRatio, 0.25, "—", "Taux d’ouverture ≤ 25 % ; renforcement autour des trémies à détailler", combinationId, combinationName)
      : emptyCheck("slab-openings", "Trémies et ouvertures", "—", combinationId, combinationName, "Géométrie des ouvertures requise"),
    check("slab-negative-x", "Flexion négative aux appuis X", Math.abs(negativeMx), Math.max(minSteel, Math.abs(negativeMx) * 1e6 / Math.max(z * fyd, 1e-9)), "kN·m/m", "Enveloppe provisoire des moments négatifs X", combinationId, combinationName),
    check("slab-negative-y", "Flexion négative aux appuis Y", Math.abs(negativeMy), Math.max(minSteel, Math.abs(negativeMy) * 1e6 / Math.max(z * fyd, 1e-9)), "kN·m/m", "Enveloppe provisoire des moments négatifs Y", combinationId, combinationName),
    demand.serviceDeflectionMm === undefined ? emptyCheck("slab-deflection", "Flèche de service", "mm", combinationId, combinationName, "Résultat ELS requis") : check("slab-deflection", "Flèche de service", demand.serviceDeflectionMm, (demand.spanDirection === "X" ? demand.spanXM : demand.spanDirection === "Y" ? demand.spanYM : Math.min(demand.spanXM, demand.spanYM)) * 1000 / basis.maxDeflectionRatio, "mm", "δser ≤ L/limite saisie", combinationId, combinationName),
  ];
  if (demand.floorType === "Corps creux") limitations.push("La plaque orthotrope utilise l’entraxe, la largeur des nervures et l’épaisseur de la table déclarés ; les zones pleines, ancrages, cisaillement des nervures et prescriptions fabricant restent à vérifier séparément.");
  return { elementId: demand.id, type: "slab", combinationId, combinationName, checks, reinforcement, limitations };
}

function designStair(demand: RCStairDemand, basis: RCDesignBasis): RCElementDesign {
  const { combinationId, combinationName } = demand;
  const limitations = [
    "Pré-étude de bandes de volée simplement appuyées, avec portée horizontale; la continuité et l’interaction avec la structure ne sont pas résolues.",
    "Les paliers, appuis réels, efforts latéraux, flexion transversale, torsion, flèche et fissuration ne sont pas calculés.",
    "Les longueurs de barres excluent ancrages, crochets et recouvrements; la géométrie affichée est schématique et non exécutable.",
  ];
  if (!demand.flights.length) return { elementId: demand.id, type: "stair", combinationId, combinationName, checks: [emptyCheck("stair-geometry", "Géométrie des volées", "m", combinationId, combinationName, "Au moins une volée correctement définie est requise")], reinforcement: [], limitations };
  const diameters = Array.from(new Set(basis.availableBarDiametersMm.filter(positive))).sort((a, b) => a - b);
  const reinforcement: RebarProposal[] = [];
  const checks: RCCheck[] = [];
  const chooseBars = (requiredAreaPerM: number, widthMm: number, effectiveDepthMm: number) => {
    const candidates = diameters.map(diameterMm => {
      const count = Math.max(2, Math.ceil(requiredAreaPerM * widthMm / 1000 / barArea(diameterMm)));
      const clearSpacingMm = (widthMm - 2 * basis.coverMm - count * diameterMm) / (count - 1);
      const areaPerM = count * barArea(diameterMm) / (widthMm / 1000);
      return { diameterMm, count, clearSpacingMm, areaPerM };
    }).filter(item => item.clearSpacingMm >= basis.minClearSpacingMm && item.areaPerM <= basis.maxReinforcementRatio * 1000 * effectiveDepthMm);
    return candidates.sort((a, b) => a.areaPerM - b.areaPerM || a.diameterMm - b.diameterMm)[0];
  };
  for (let index = 0; index < demand.flights.length; index++) {
    const flight = demand.flights[index];
    const flightPrefix = `${demand.id}:flight-${index + 1}`;
    if (![flight.spanM, flight.riseM, flight.widthM, flight.thicknessMm].every(positive)) {
      checks.push(emptyCheck(`${flightPrefix}:geometry`, `Volée ${index + 1} · géométrie`, "m", combinationId, combinationName, "Portée, hauteur, largeur et épaisseur doivent être positives"));
      continue;
    }
    const mainDiameter = diameters[diameters.length - 1];
    if (!mainDiameter) {
      checks.push(emptyCheck(`${flightPrefix}:catalogue`, `Volée ${index + 1} · catalogue HA`, "mm", combinationId, combinationName, "Diamètres d’armature disponibles requis"));
      continue;
    }
    let calculation: ReturnType<typeof designStairV2>;
    try {
      calculation = designStairV2({
        spanM: flight.spanM,
        riseM: flight.riseM,
        widthM: flight.widthM,
        thicknessM: flight.thicknessMm / 1000,
        permanentKnM2: flight.permanentKnM2,
        imposedKnM2: flight.imposedKnM2,
        gammaG: flight.gammaG,
        gammaQ: flight.gammaQ,
        fykMpa: basis.fykMpa,
        gammaS: basis.gammaS,
        coverMm: basis.coverMm,
        mainBarDiameterMm: mainDiameter,
        minReinforcementRatio: basis.minReinforcementRatio,
        maxReinforcementRatio: basis.maxReinforcementRatio,
      });
    } catch (error) {
      checks.push(emptyCheck(`${flightPrefix}:input`, `Volée ${index + 1} · données`, "—", combinationId, combinationName, error instanceof Error ? error.message : "Entrées invalides"));
      continue;
    }
    const main = chooseBars(calculation.AsRequiredMm2PerM, flight.widthM * 1000, calculation.effectiveDepthMm);
    const transverse = chooseBars(calculation.AsMinimumMm2PerM, calculation.slopeLengthM * 1000, calculation.effectiveDepthMm);
    const mainProvided = main?.areaPerM ?? 0;
    const transverseProvided = transverse?.areaPerM ?? 0;
    checks.push(check(`${flightPrefix}:flexure`, `Volée ${index + 1} · flexion longitudinale`, calculation.AsRequiredMm2PerM, mainProvided, "mm²/m", "Modèle indicatif MEd = qEd·Lh²/8; As = max(ρmin·b·d, MEd/(0,9d·fyd))", combinationId, combinationName));
    checks.push(check(`${flightPrefix}:main-ratio`, `Volée ${index + 1} · taux longitudinal maximal`, mainProvided, calculation.AsMaximumMm2PerM, "mm²/m", "As,prov ≤ ρmax·b·d selon la base déclarée", combinationId, combinationName));
    checks.push(check(`${flightPrefix}:distribution-min`, `Volée ${index + 1} · armatures transversales minimales`, calculation.AsMinimumMm2PerM, transverseProvided, "mm²/m", "Ratio minimal déclaré appliqué aux barres transversales; pré-étude uniquement", combinationId, combinationName));
    if (main) reinforcement.push(proposal(`${flightPrefix}:main`, `Volée ${index + 1} · principales HA${main.diameterMm} · espacement calculé ${((flight.widthM * 1000) / main.count).toFixed(0)} mm`, main.diameterMm, main.count, calculation.AsRequiredMm2PerM * flight.widthM, calculation.slopeLengthM));
    if (transverse) reinforcement.push(proposal(`${flightPrefix}:distribution`, `Volée ${index + 1} · répartition HA${transverse.diameterMm} · espacement calculé ${(calculation.slopeLengthM * 1000 / transverse.count).toFixed(0)} mm`, transverse.diameterMm, transverse.count, calculation.AsMinimumMm2PerM * calculation.slopeLengthM, flight.widthM));
    if (!main || !transverse) checks.push(emptyCheck(`${flightPrefix}:bar-fit`, `Volée ${index + 1} · disposition des barres`, "mm", combinationId, combinationName, "Catalogue disponible, enrobage et espacement libre minimal compatibles requis"));
    checks.push(emptyCheck(`${flightPrefix}:max-spacing`, `Volée ${index + 1} · espacement maximal normatif`, "mm", combinationId, combinationName, "Valeur de détail propre à l’édition et à l’annexe nationale à renseigner"));
    checks.push(emptyCheck(`${flightPrefix}:shear`, `Volée ${index + 1} · cisaillement`, "kN/m", combinationId, combinationName, "VEd calculé, mais résistance et dispositions de cisaillement normatives non implémentées"));
    checks.push(emptyCheck(`${flightPrefix}:anchorage`, `Volée ${index + 1} · ancrages et recouvrements`, "mm", combinationId, combinationName, "Calcul selon adhérence, position, confinement et référentiel non implémenté"));
  }
  return { elementId: demand.id, type: "stair", combinationId, combinationName, checks, reinforcement, limitations };
}

export type RCOptimizationProposal = {
  elementId: string;
  levelLabel?: string;
  type: RCElementDesign["type"];
  currentSection: { dimensions: number[]; unit: "m" | "mm" };
  proposedSection: { dimensions: number[]; unit: "m" | "mm" };
  utilization: number;
  currentUtilization: number | null;
  reason: string;
  estimatedMaterialRatio: number;
};

const allChecksPass = (design: RCElementDesign) => {
  if (!design.checks.length) return false;
  return design.checks.every(check => {
    if (check.status === "non satisfaisant") return false;
    if (check.status !== "bloqué") return true;
    // Ces blocages correspondent à des contrôles normatifs explicitement non implémentés
    // (ancrages/fissuration/second ordre). Ils ne doivent pas empêcher le pré-dimensionnement
    // d'explorer une section, mais restent signalés dans le résultat final.
    return /ancrage|recouvrement|fissuration|second ordre|torsion|disposition sismique/i.test(check.label);
  });
};
const maxUtilization = (design: RCElementDesign) => {
  const values = design.checks.map(check => check.utilization).filter((v): v is number => Number.isFinite(v));
  return values.length ? Math.max(...values) : Number.POSITIVE_INFINITY;
};
const uniqueDescending = (values: number[]) => Array.from(new Set(values.filter(v => Number.isFinite(v) && v > 0))).sort((a,b)=>b-a);

/**
 * Recherche la plus petite section candidate qui reste vérifiée par le même moteur BA.
 * Il s'agit d'une optimisation de pré-dimensionnement : aucune section n'est appliquée au modèle automatiquement.
 */
export function proposeOptimizedRCSections(input: {
  basis: RCDesignBasis;
  members: RCMemberDemand[];
  slabs: RCSlabDemand[];
  foundations?: RCFootingDemand[];
  overrides?: RCDesignOverrides;
  lockedElementIds?: ReadonlySet<string>;
}): RCOptimizationProposal[] {
  if (validateRCDesignBasis(input.basis).length) return [];
  const proposals: RCOptimizationProposal[] = [];
  const overrides = input.overrides ?? {};
  const lockedElementIds = input.lockedElementIds ?? new Set<string>();
  for (const demand of input.members) {
    if (lockedElementIds.has(demand.id)) continue;
    const current = [demand.sectionWidthMm, demand.sectionDepthMm];
    const isColumn = demand.type === "column";
    const baseW = Math.max(100, current[0]);
    const baseD = Math.max(100, current[1]);
    const widths = uniqueDescending([baseW, ...Array.from({length: 10}, (_,i)=>150+i*25).filter(v=>v<baseW), 150]);
    const depths = uniqueDescending([baseD, ...Array.from({length: 15}, (_,i)=>200+i*25).filter(v=>v<baseD), 200]);
    let best: RCElementDesign | null = null; let bestDims: number[] | null = null;
    const candidates = isColumn
      ? widths.filter(v=>v<=baseW).map(v=>[v,v])
      : widths.filter(v=>v<=baseW).flatMap(w=>depths.filter(d=>d<=baseD).map(d=>[w,d]));
    for (const dims of candidates.sort((a,b)=>(a[0]*a[1])-(b[0]*b[1]))) {
      const candidate = { ...demand, sectionWidthMm: dims[0], sectionDepthMm: dims[1] };
      const designed = designReinforcedConcrete({basis: input.basis, members:[candidate], slabs:[], foundations:[], overrides});
      const element = designed.elements[0];
      if (element && allChecksPass(element)) { best=element; bestDims=dims; break; }
    }
    if (best && bestDims && (bestDims[0] < baseW || bestDims[1] < baseD)) {
      const currentDesign = designReinforcedConcrete({basis: input.basis, members:[demand], slabs:[], foundations:[], overrides}).elements[0];
      proposals.push({elementId:demand.id, levelLabel:demand.levelLabel, type:demand.memberSubtype === "tie-beam" ? "tie-beam" : demand.type, currentSection:{dimensions:current,unit:"mm"}, proposedSection:{dimensions:bestDims,unit:"mm"}, utilization:maxUtilization(best), currentUtilization:currentDesign ? maxUtilization(currentDesign) : null, reason:`Section minimale testée satisfaisant les contrôles disponibles (${bestDims[0]} × ${bestDims[1]} mm).`, estimatedMaterialRatio:(bestDims[0]*bestDims[1])/(baseW*baseD)});
    }
  }
  for (const demand of input.slabs) {
    if (lockedElementIds.has(demand.id)) continue;
    const current=demand.thicknessMm;
    const candidates=[120,130,140,150,160,180,200,220,250].filter(v=>v<=current).sort((a,b)=>a-b);
    for (const h of candidates) {
      const designed=designReinforcedConcrete({basis:input.basis,members:[],slabs:[{...demand,thicknessMm:h}],foundations:[],overrides}).elements[0];
      if (designed && allChecksPass(designed) && h<current) {
        proposals.push({elementId:demand.id,levelLabel:demand.levelLabel,type:"slab",currentSection:{dimensions:[current],unit:"mm"},proposedSection:{dimensions:[h],unit:"mm"},utilization:maxUtilization(designed),currentUtilization:maxUtilization(designReinforcedConcrete({basis:input.basis,members:[],slabs:[demand],foundations:[],overrides}).elements[0]),reason:`Épaisseur minimale testée satisfaisant les contrôles disponibles (${h} mm).`,estimatedMaterialRatio:h/current});
        break;
      }
    }
  }
  for (const demand of (input.foundations ?? [])) {
    if (lockedElementIds.has(demand.id)) continue;
    const current=[demand.widthM,demand.lengthM,demand.thicknessM];
    const sizeCandidates=[0.30,0.35,0.40,0.45,0.50,0.60,0.70,0.80,0.90,1.00,1.10,1.20,1.40,1.60,1.80,2.00].sort((a,b)=>a-b);
    const thicknesses=[0.20,0.25,0.30,0.35,0.40,0.45,0.50].sort((a,b)=>a-b);
    const rectangularCandidates = sizeCandidates.flatMap(w => sizeCandidates.map(l => [w,l] as const))
      .filter(([w,l]) => w <= Math.max(current[0], current[1]) && l <= Math.max(current[0], current[1]))
      .sort((a,b)=>(a[0]*a[1])-(b[0]*b[1]));
    outer: for (const [widthM,lengthM] of rectangularCandidates) for (const h of thicknesses) {
      const candidate={...demand,widthM,lengthM,thicknessM:h};
      if (widthM > current[0] || lengthM > current[1] || h > current[2]) continue;
      if (widthM === current[0] && lengthM === current[1] && h === current[2]) continue;
      const designed=designReinforcedConcrete({basis:input.basis,members:[],slabs:[],foundations:[candidate],overrides}).elements[0];
      if (designed && allChecksPass(designed)) {
        const cur=designReinforcedConcrete({basis:input.basis,members:[],slabs:[],foundations:[demand],overrides}).elements[0];
        proposals.push({elementId:demand.id,levelLabel:demand.levelLabel,type:"footing",currentSection:{dimensions:current,unit:"m"},proposedSection:{dimensions:[widthM,lengthM,h],unit:"m"},utilization:maxUtilization(designed),currentUtilization:cur?maxUtilization(cur):null,reason:`Section de semelle minimale testée satisfaisant les contrôles disponibles (${widthM.toFixed(2)} × ${lengthM.toFixed(2)} × ${h.toFixed(2)} m).`,estimatedMaterialRatio:(widthM*lengthM*h)/(current[0]*current[1]*current[2])});
        break outer;
      }
    }
  }
  return proposals;
}

/** Cherche des sections de poteau plus grandes qui satisfont les contrôles utilisés dans la fiche. */
export function proposeColumnSectionIncreases(input: {
  basis: RCDesignBasis;
  member: RCMemberDemand;
  overrides?: RCDesignOverrides;
  selfWeightIncluded?: boolean;
  permanentLoadFactor?: number;
  concreteDensityKnM3?: number;
  maxIncreaseMm?: number;
}): RCOptimizationProposal[] {
  const { basis, member } = input;
  if (member.type !== "column" || validateRCDesignBasis(basis).length) return [];
  const currentWidth = member.sectionWidthMm;
  const currentDepth = member.sectionDepthMm;
  if (![currentWidth, currentDepth, member.lengthMm].every(Number.isFinite) || currentWidth <= 0 || currentDepth <= 0 || member.lengthMm <= 0) return [];

  const circular = member.sectionShape === "circular";
  const stepMm = 50;
  const maxSteps = Math.max(1, Math.min(16, Math.ceil((input.maxIncreaseMm ?? 500) / stepMm)));
  const densityKnM3 = input.concreteDensityKnM3 ?? 25;
  const permanentLoadFactor = input.permanentLoadFactor ?? 1;
  const areaM2 = (widthMm: number, depthMm: number) => circular
    ? Math.PI * (widthMm / 1000) ** 2 / 4
    : (widthMm * depthMm) / 1e6;
  const isBael = resolveRCStandardProfile(basis.standard).family === "bael-91-99";
  const requiredCheckIds = [
    "column-axial", "column-interaction", "column-steel-min", "column-steel-max",
    "column-bar-spacing", "column-bar-layout-count", "column-tie-spacing",
    ...(isBael ? ["column-second-order", "column-bael-detailing"] : []),
  ];
  const meetsModalChecks = (design: RCElementDesign) => {
    const coreChecks = design.checks.filter(item => requiredCheckIds.includes(item.id));
    return coreChecks.length === requiredCheckIds.length
      && coreChecks.every(item => item.status === "satisfaisant")
      && !design.checks.some(item => item.id === "column-longitudinal-diameter");
  };
  const designCurrent = designReinforcedConcrete({ basis, members: [member], slabs: [], overrides: input.overrides }).elements[0];
  const currentInteraction = designCurrent?.checks.find(item => item.id === "column-interaction")?.utilization ?? null;
  const candidates: Array<[number, number]> = [];
  if (circular) {
    for (let index = 1; index <= maxSteps; index += 1) {
      const diameter = currentWidth + index * stepMm;
      candidates.push([diameter, diameter]);
    }
  } else {
    for (let widthStep = 0; widthStep <= maxSteps; widthStep += 1) {
      for (let depthStep = 0; depthStep <= maxSteps; depthStep += 1) {
        if (widthStep === 0 && depthStep === 0) continue;
        candidates.push([currentWidth + widthStep * stepMm, currentDepth + depthStep * stepMm]);
      }
    }
  }
  candidates.sort((a, b) => areaM2(a[0], a[1]) - areaM2(b[0], b[1])
    || Number((a[0] > currentWidth) && (a[1] > currentDepth)) - Number((b[0] > currentWidth) && (b[1] > currentDepth))
    || a[0] - b[0] || a[1] - b[1]);

  const passing: Array<{ dimensions: [number, number]; utilization: number }> = [];
  const currentAreaM2 = areaM2(currentWidth, currentDepth);
  for (const dimensions of candidates) {
    const candidateAreaM2 = areaM2(dimensions[0], dimensions[1]);
    const additionalSelfWeightKn = input.selfWeightIncluded
      ? Math.max(0, candidateAreaM2 - currentAreaM2) * (member.lengthMm / 1000) * densityKnM3 * permanentLoadFactor
      : 0;
    const candidateDemand = {
      ...member,
      sectionWidthMm: dimensions[0],
      sectionDepthMm: dimensions[1],
      axialKn: Math.abs(member.axialKn) + additionalSelfWeightKn,
    };
    const design = designReinforcedConcrete({ basis, members: [candidateDemand], slabs: [], overrides: input.overrides }).elements[0];
    if (!design || !meetsModalChecks(design)) continue;
    const interactionUtilization = design.checks.find(item => item.id === "column-interaction")?.utilization;
    passing.push({ dimensions, utilization: interactionUtilization ?? maxUtilization(design) });
  }

  const unique = new Set<string>();
  const selected: typeof passing = [];
  const add = (candidate: typeof passing[number] | undefined) => {
    if (!candidate) return;
    const key = candidate.dimensions.join("x");
    if (unique.has(key)) return;
    unique.add(key);
    selected.push(candidate);
  };
  const minimum = passing[0];
  add(minimum);
  if (!circular) {
    add(passing.find(item => item.dimensions[0] > currentWidth && item.dimensions[1] === currentDepth));
    add(passing.find(item => item.dimensions[0] === currentWidth && item.dimensions[1] > currentDepth));
    add(passing.find(item => item.dimensions[0] > currentWidth && item.dimensions[1] > currentDepth));
  }
  return selected.slice(0, 3).map(item => ({
    elementId: member.id,
    levelLabel: member.levelLabel,
    type: "column",
    currentSection: { dimensions: [currentWidth, currentDepth], unit: "mm" },
    proposedSection: { dimensions: item.dimensions, unit: "mm" },
    utilization: item.utilization,
    currentUtilization: currentInteraction,
    reason: `Section testée avec les mêmes efforts et armatures; poids propre ajusté si activé (${item.dimensions[0]} × ${item.dimensions[1]} mm).`,
    estimatedMaterialRatio: areaM2(item.dimensions[0], item.dimensions[1]) / currentAreaM2,
  }));
}

export function designReinforcedConcrete(input: { basis: RCDesignBasis; members: RCMemberDemand[]; slabs: RCSlabDemand[]; foundations?: RCFootingDemand[]; stairs?: RCStairDemand[]; overrides?: RCDesignOverrides }): RCDesignResult {
  const errors = validateRCDesignBasis(input.basis);
  const warnings: string[] = [];
  const standardProfile = resolveRCStandardProfile(input.basis.standard);
  if (standardProfile.supportedForPreDesign) warnings.push(standardProfile.note);
  const blockers: string[] = [
    "Aucun jeu de règles nationales/annexe complète n’est certifié dans cette version ; les sorties restent des pré-études.",
    "Aucune vérification réglementaire des voiles, de la torsion, du poinçonnement ni des dispositions sismiques n’est fournie.",
  ];
  if (!input.basis.basisConfirmed) warnings.push("Les paramètres matériaux et de détail sont déclarés provisoires ou non confirmés.");
  if (!input.members.length && !input.slabs.length && !(input.foundations?.length ?? 0) && !(input.stairs?.length ?? 0)) errors.push("Aucun effort calculé par le solveur/maillage n’est disponible pour dimensionner le béton armé.");
  if (input.members.some(item => !item.combinationId || !item.combinationName)) errors.push("Une combinaison gouvernante doit être identifiée pour chaque membre.");
  const elements: RCElementDesign[] = errors.length ? [] : [
    ...input.members.map(item => {
      const design = item.type === "beam" ? designBeam(item, input.basis, input.overrides ?? {}) : designColumn(item, input.basis, input.overrides ?? {});
      if (item.memberSubtype === "tie-beam") design.type = "tie-beam";
      return design;
    }),
    ...input.slabs.map(item => designSlab(item, input.basis, input.overrides ?? {})),
    ...(input.foundations ?? []).map(item => designFooting(item, input.basis, input.overrides ?? {})),
    ...(input.stairs ?? []).map(item => designStair(item, input.basis)),
  ];
  const scheduleMap = new Map<number, { totalLengthM: number; massKg: number }>();
  for (const element of elements) for (const bar of element.reinforcement) {
    const current = scheduleMap.get(bar.diameterMm) ?? { totalLengthM: 0, massKg: 0 };
    scheduleMap.set(bar.diameterMm, { totalLengthM: current.totalLengthM + bar.totalLengthM, massKg: current.massKg + bar.massKg });
  }
  const schedule = Array.from(scheduleMap, ([diameterMm, totals]) => ({ diameterMm, ...totals })).sort((a, b) => a.diameterMm - b.diameterMm);
  const checks = elements.flatMap(element => element.checks);
  const numericalSummary = {
    memberCount: input.members.length,
    slabCount: input.slabs.length,
    footingCount: input.foundations?.length ?? 0,
    stairCount: input.stairs?.length ?? 0,
    checkCount: checks.length,
    passedCheckCount: checks.filter(item => item.status === "satisfaisant").length,
    failedCheckCount: checks.filter(item => item.status === "non satisfaisant").length,
    blockedCheckCount: checks.filter(item => item.status === "bloqué" || (item.status === "à vérifier" && item.blocking !== false)).length,
    unverifiedCheckCount: checks.filter(item => item.status === "à vérifier").length,
  };
  const missingAdmissibleColumnDiameter = elements.some(element => element.type === "column" && element.checks.some(item => item.id === "column-longitudinal-diameter" && item.status === "bloqué"));
  if (numericalSummary.checkCount === 0 || numericalSummary.blockedCheckCount > 0) blockers.push("Le calcul numérique est incomplet : chaque contrôle requis doit produire une valeur numérique et un verdict exploitable.");
  return { schemaVersion: 1, status: errors.length || numericalSummary.checkCount === 0 || missingAdmissibleColumnDiameter ? "bloqué — calcul numérique incomplet" : "calculé numériquement — non certifié", standard: input.basis.standard, nationalAnnex: input.basis.nationalAnnex, sourceReference: input.basis.sourceReference, materialBasis: input.basis, regulatoryReady: false, elements, schedule, errors, warnings, blockers, numericalSummary };
}
