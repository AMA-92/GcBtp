export const RC_DESIGN_SCHEMA_VERSION = 1 as const;

import type { AnalyticalModel } from "./analytical-model";
import type { PlaneFrameResult, PlaneMemberLoad } from "./frame-solver-2d";
import type { Spatial3DResult } from "./frame-solver-3d";

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
  bondStressMpa: number;
  minClearSpacingMm: number;
  maxLinkSpacingMm: number;
  maxDeflectionRatio: number;
  maxColumnSlenderness: number;
  availableBarDiametersMm: number[];
};

export type RebarOverride = { diameterMm: number; count: number };
export type RCDesignOverrides = Record<string, RebarOverride>;
export type RCMemberDemand = {
  id: string;
  levelLabel?: string;
  type: "beam" | "column";
  combinationId: string;
  combinationName: string;
  sectionWidthMm: number;
  sectionDepthMm: number;
  lengthMm: number;
  axialKn: number;
  shearKn: number;
  momentKnM: number;
  positiveMomentKnM?: number;
  negativeMomentKnM?: number;
  momentXKnM?: number;
  momentYKnM?: number;
  serviceMomentKnM?: number;
  serviceDeflectionMm?: number;
  memberSubtype?: "beam" | "tie-beam";
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
};
export type RCElementDesign = {
  elementId: string;
  type: "beam" | "column" | "slab" | "wall" | "tie-beam" | "footing";
  combinationId: string;
  combinationName: string;
  checks: RCCheck[];
  reinforcement: RebarProposal[];
  limitations: string[];
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
  soilBearingKPa: number;
};

export type RCTieBeamDemand = RCMemberDemand & { type: "beam" };

export type RCDesignResult = {
  schemaVersion: typeof RC_DESIGN_SCHEMA_VERSION;
  status: "pré-étude — non réglementaire";
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
};

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
    };
    if (frame.sourceType === "Poteau") {
      demands.push({ ...common, type: "column", momentXKnM: input.result.plane === "YZ" ? momentKnM : 0, momentYKnM: input.result.plane === "XZ" ? momentKnM : 0 });
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
    const momentsX = [solved.startGlobal.mxKnM, solved.endGlobal.mxKnM];
    const momentsY = [solved.startGlobal.myKnM, solved.endGlobal.myKnM];
    const positiveMoment = Math.max(0, ...momentsX.map(Math.abs), ...momentsY.map(Math.abs));
    const common = {
      id: frame.sourceElementId, combinationId: input.combinationId, combinationName: input.combinationName,
      sectionWidthMm: section.dimensionsM[0] * 1000, sectionDepthMm: section.dimensionsM[1] * 1000, lengthMm: lengthM * 1000,
      axialKn: Math.max(Math.abs(solved.start.axialKn), Math.abs(solved.end.axialKn)),
      shearKn: solved.maxAbsShearKn, momentKnM: positiveMoment,
      momentXKnM: Math.max(...momentsX.map(Math.abs)), momentYKnM: Math.max(...momentsY.map(Math.abs)),
      memberSubtype: (frame.sourceType === "Longrine de redressement" ? "tie-beam" : frame.sourceType === "Poutre" ? "beam" : undefined) as "beam" | "tie-beam" | undefined,
      positiveMomentKnM: frame.sourceType === "Poutre" ? positiveMoment : undefined,
      negativeMomentKnM: frame.sourceType === "Poutre" ? positiveMoment : undefined,
    };
    demands.push({ ...common, type: frame.sourceType === "Poteau" ? "column" : "beam" });
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
  if (!basis.standard.trim()) errors.push("Le référentiel béton doit être déclaré.");
  if (!basis.nationalAnnex.trim()) errors.push("L’annexe nationale ou les règles locales doivent être déclarées.");
  if (!basis.sourceReference.trim()) errors.push("La référence des paramètres matériaux et de détail est obligatoire.");
  if (!positive(basis.fckMpa) || basis.fckMpa < 15 || basis.fckMpa > 90) errors.push("fck doit être compris entre 15 et 90 MPa.");
  if (!positive(basis.fykMpa) || basis.fykMpa < 250 || basis.fykMpa > 700) errors.push("fyk doit être compris entre 250 et 700 MPa.");
  if (!positive(basis.gammaC) || !positive(basis.gammaS) || !positive(basis.alphaCC)) errors.push("Les coefficients matériau γc, γs et αcc doivent être saisis et positifs.");
  if (!positive(basis.coverMm) || basis.coverMm > 120) errors.push("L’enrobage nominal doit être compris entre 0 et 120 mm.");
  if (!positive(basis.minReinforcementRatio) || !positive(basis.maxReinforcementRatio) || basis.maxReinforcementRatio <= basis.minReinforcementRatio || basis.maxReinforcementRatio > 0.08) errors.push("Les taux d’armatures minimal et maximal doivent être cohérents et déclarés.");
  if (!positive(basis.concreteShearStressLimitMpa)) errors.push("La contrainte de cisaillement du béton doit être renseignée selon le référentiel choisi.");
  if (!positive(basis.bondStressMpa)) errors.push("La contrainte d’adhérence de calcul doit être renseignée selon le référentiel choisi.");
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
  if (demand.serviceMomentKnM !== undefined && bottom) {
    const steelStress = Math.abs(demand.serviceMomentKnM) * 1e6 / Math.max(bottom.areaMm2 * z, 1e-9);
    checks.push({ ...check("crack-proxy", "Contrainte acier ELS (proxy fissuration)", steelStress, basis.fykMpa * 0.6, "MPa", "σs≈Mser/(As·z) ; ne calcule pas wk", combinationId, combinationName), status: "à vérifier" });
  } else checks.push(emptyCheck("cracking", "Ouverture de fissures wk", "mm", combinationId, combinationName, "Calcul de fissuration selon norme non implémenté"));
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
  const checks=[
    check("bearing-screen","Pression moyenne sous semelle",qAvg,demand.soilBearingKPa,"kPa","q = N/(B·L) ≤ qadm géotechnique",combinationId,combinationName),
    check("flexion-x","Flexion X · As",asXReq,dx.areaMm2,"mm²","As,prov ≥ max(As,req; As,min)",combinationId,combinationName),
    check("flexion-y","Flexion Y · As",asYReq,dy.areaMm2,"mm²","As,prov ≥ max(As,req; As,min)",combinationId,combinationName),
    check("punching","Poinçonnement",punchingStress,punchingResistance,"MPa","vEd ≤ vRd,c selon base BA déclarée",combinationId,combinationName),
    check("spacing-x","Espacement libre X",basis.minClearSpacingMm,dx.clearSpacingMm,"mm","sclair ≥ minimum déclaré",combinationId,combinationName),
    check("spacing-y","Espacement libre Y",basis.minClearSpacingMm,dy.clearSpacingMm,"mm","sclair ≥ minimum déclaré",combinationId,combinationName),
    emptyCheck("anchorage","Ancrage des armatures de semelle","mm",combinationId,combinationName,"lb,rqd/lbd selon EN 1992 et annexe nationale"),
  ];
  return {elementId:demand.id,type:"footing",combinationId,combinationName,checks,reinforcement,limitations};
}

function designColumn(demand: RCMemberDemand, basis: RCDesignBasis, overrides: RCDesignOverrides): RCElementDesign {
  const combinationId = demand.combinationId, combinationName = demand.combinationName;
  const limitations: string[] = [
    "Interaction N–Mx–My par somme linéaire de capacités axiales et uniaxiales : pré-contrôle conservateur, non un diagramme normatif d’interaction.",
    "Le second ordre, le fluage, les effets locaux/globalaux et les dispositions de confinement sismique ne sont pas vérifiés.",
  ];
  const width = demand.sectionWidthMm, height = demand.sectionDepthMm;
  if (!positive(width) || !positive(height) || !positive(demand.lengthMm)) return { elementId: demand.id, type: "column", combinationId, combinationName, checks: [emptyCheck("geometry", "Géométrie de poteau", "mm", combinationId, combinationName, "b, h, L > 0")], reinforcement: [], limitations };
  const areaGross = width * height;
  const minSteel = basis.minReinforcementRatio * areaGross;
  const maxSteel = basis.maxReinforcementRatio * areaGross;
  const fcd = basis.alphaCC * basis.fckMpa / basis.gammaC;
  const fyd = basis.fykMpa / basis.gammaS;
  const requiredSteel = Math.max(minSteel, Math.max(0, Math.abs(demand.axialKn) * 1000 - 0.8 * areaGross * fcd) / Math.max(fyd - 0.8 * fcd, 1e-9));
  const diameters = basis.availableBarDiametersMm.filter(positive);
  const preferredDiameter = Math.max(8, Math.min(...diameters));
  const override = overrides[`${demand.id}:longitudinal`];
  const minimumCount = 4;
  let count = override && positive(override.diameterMm) && Number.isInteger(override.count) && override.count >= minimumCount ? override.count : Math.max(minimumCount, Math.ceil(requiredSteel / barArea(preferredDiameter)));
  if (count % 2 !== 0) count++;
  const diameter = override?.diameterMm ?? preferredDiameter;
  const asProvided = count * barArea(diameter);
  const concreteArea = Math.max(0, areaGross - asProvided);
  const axialResistance = (0.8 * concreteArea * fcd + asProvided * fyd) / 1000;
  const leverX = Math.max(0, height - 2 * basis.coverMm);
  const leverY = Math.max(0, width - 2 * basis.coverMm);
  const mxResistance = asProvided * fyd * leverX * 0.25 / 1e6;
  const myResistance = asProvided * fyd * leverY * 0.25 / 1e6;
  const momentX = Math.abs(demand.momentXKnM ?? demand.momentKnM);
  const momentY = Math.abs(demand.momentYKnM ?? 0);
  const interaction = (Math.abs(demand.axialKn) / Math.max(axialResistance, 1e-9)) + momentX / Math.max(mxResistance, 1e-9) + momentY / Math.max(myResistance, 1e-9);
  const slendernessX = demand.lengthMm / Math.sqrt(height * height / 12);
  const slendernessY = demand.lengthMm / Math.sqrt(width * width / 12);
  const slenderness = Math.max(slendernessX, slendernessY);
  const tieDiameter = Math.max(6, Math.min(...diameters));
  const tieCount = Math.ceil(demand.lengthMm / basis.maxLinkSpacingMm) + 1;
  const tieLengthM = (2 * (Math.max(0, width - 2 * basis.coverMm) + Math.max(0, height - 2 * basis.coverMm)) + 200) / 1000;
  const reinforcement = [
    proposal(`${demand.id}:longitudinal`, "Longitudinal poteau · " + count + "HA" + diameter + " · répartition symétrique", diameter, count, requiredSteel, demand.lengthMm / 1000),
    proposal(`${demand.id}:ties`, "Cadres · HA " + tieDiameter + " / " + (demand.lengthMm / Math.max(1, tieCount - 1)).toFixed(0) + " mm · crochets 2×100 mm", tieDiameter, tieCount, 0, tieLengthM),
  ];
  const clearFaceSpacing = (Math.min(width, height) - 2 * basis.coverMm - 2 * diameter) / Math.max(1, count / 2 - 1);
  const checks = [
    check("column-axial", "Compression axiale", Math.abs(demand.axialKn), axialResistance, "kN", "NRd≈0,8·Ac·fcd+As·fyd", combinationId, combinationName),
    check("column-interaction", "Interaction N–Mx–My simplifiée", interaction, 1, "—", "NEd/NRd + |Mx|/MRdx + |My|/MRdy ≤ 1 ; enveloppe linéaire non normative", combinationId, combinationName),
    check("column-steel-min", "Armatures longitudinales minimales", minSteel, asProvided, "mm²", "As,prov ≥ ρmin·Ag", combinationId, combinationName),
    check("column-steel-max", "Armatures longitudinales maximales", asProvided, maxSteel, "mm²", "As,prov ≤ ρmax·Ag", combinationId, combinationName),
    check("column-bar-spacing", "Espacement libre des barres", basis.minClearSpacingMm, clearFaceSpacing, "mm", "Disposition symétrique indicative ; sclair ≥ minimum déclaré", combinationId, combinationName),
    check("column-slenderness", "Élancement géométrique", slenderness, basis.maxColumnSlenderness, "—", "λ = L0/i ; seuil déclaré, second ordre non calculé", combinationId, combinationName),
    emptyCheck("column-ties", "Cadres, confinement et continuité", "mm", combinationId, combinationName, "Détail normatif non implémenté"),
  ];
  return { elementId: demand.id, type: "column", combinationId, combinationName, checks, reinforcement, limitations };
}

function designSlab(demand: RCSlabDemand, basis: RCDesignBasis, overrides: RCDesignOverrides): RCElementDesign {
  const combinationId = demand.combinationId, combinationName = demand.combinationName;
  const limitations = [
    "La plaque Navier v1 est simplement appuyée sur quatre bords ; les résultats ne représentent pas une dalle continue ni une redistribution par poutres.",
    "La continuité réelle, la redistribution, la fissuration wk et les ancrages restent à vérifier avec les détails d’exécution.",
  ];
  const assumedSupportReaction = demand.supportReactionKn === undefined;
  const assumedColumnGeometry = !positive(demand.columnWidthMm ?? 0) || !positive(demand.columnDepthMm ?? 0);
  const negativeMx = demand.negativeMxKnMPerM ?? Math.abs(demand.mxKnMPerM) * 0.25;
  const negativeMy = demand.negativeMyKnMPerM ?? Math.abs(demand.myKnMPerM) * 0.25;
  const supportReaction = demand.supportReactionKn ?? Math.max(0, (demand.uniformLoadKnM2 ?? 0) * demand.spanXM * demand.spanYM / 4);
  const columnWidth = demand.columnWidthMm ?? 300;
  const columnDepth = demand.columnDepthMm ?? 300;
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
    check("slab-punching", "Poinçonnement au périmètre critique", supportReaction, Math.max(1, (2 * (columnWidth + columnDepth) + 4 * Math.min(demand.thicknessMm, 200)) / 1000 * demand.thicknessMm * 0.6), "kN", "VEd ≤ VRd,c ; données réelles à confirmer pour la note finale", combinationId, combinationName),
    demand.uniformLoadKnM2 !== undefined && demand.uniformLoadKnM2 >= 0
      ? check("slab-shear", "Cisaillement unidirectionnel", Math.abs(demand.uniformLoadKnM2 * Math.min(demand.spanXM, demand.spanYM) / 2), Math.max(1, 0.18 * basis.fckMpa * stripWidth * effectiveDepth / 1000), "kN", "VEd ≤ VRd,c ; vérification indicative par bande de 1 m", combinationId, combinationName)
      : emptyCheck("slab-shear", "Cisaillement unidirectionnel", "kN", combinationId, combinationName, "Charge uniforme ELS/ELU requise"),
    demand.openingAreaRatio !== undefined
      ? check("slab-openings", "Trémies et ouvertures", demand.openingAreaRatio, 0.25, "—", "Taux d’ouverture ≤ 25 % ; renforcement autour des trémies à détailler", combinationId, combinationName)
      : emptyCheck("slab-openings", "Trémies et ouvertures", "—", combinationId, combinationName, "Géométrie des ouvertures requise"),
    check("slab-negative-x", "Flexion négative aux appuis X", Math.abs(negativeMx), Math.max(minSteel, Math.abs(negativeMx) * 1e6 / Math.max(z * fyd, 1e-9)), "kN·m/m", "Enveloppe provisoire des moments négatifs X", combinationId, combinationName),
    check("slab-negative-y", "Flexion négative aux appuis Y", Math.abs(negativeMy), Math.max(minSteel, Math.abs(negativeMy) * 1e6 / Math.max(z * fyd, 1e-9)), "kN·m/m", "Enveloppe provisoire des moments négatifs Y", combinationId, combinationName),
    demand.serviceDeflectionMm === undefined ? emptyCheck("slab-deflection", "Flèche de service", "mm", combinationId, combinationName, "Résultat ELS requis") : check("slab-deflection", "Flèche de service", demand.serviceDeflectionMm, Math.min(demand.spanXM, demand.spanYM) * 1000 / basis.maxDeflectionRatio, "mm", "δser ≤ L/limite saisie", combinationId, combinationName),
  ];
  if (demand.floorType === "Corps creux") limitations.push("Plancher à corps creux : les nervures, entrevous, dalle de compression et zones pleines doivent être vérifiés séparément ; la plaque homogène n’est pas applicable automatiquement.");
  return { elementId: demand.id, type: "slab", combinationId, combinationName, checks, reinforcement, limitations };
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
}): RCOptimizationProposal[] {
  const proposals: RCOptimizationProposal[] = [];
  const overrides = input.overrides ?? {};
  for (const demand of input.members) {
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
  for (const demand of input.slabs) {\n    if (lockedElementIds.has(demand.id)) continue;
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
  for (const demand of (input.foundations ?? [])) {\n    if (lockedElementIds.has(demand.id)) continue;
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

export function designReinforcedConcrete(input: { basis: RCDesignBasis; members: RCMemberDemand[]; slabs: RCSlabDemand[]; foundations?: RCFootingDemand[]; overrides?: RCDesignOverrides }): RCDesignResult {
  const errors = validateRCDesignBasis(input.basis);
  const warnings: string[] = [];
  const blockers: string[] = [
    "Aucun jeu de règles nationales/annexe complète n’est certifié dans cette version ; les sorties restent des pré-études.",
    "Aucune vérification réglementaire des voiles, de la torsion, du poinçonnement ni des dispositions sismiques n’est fournie.",
  ];
  if (!input.basis.basisConfirmed) warnings.push("Les paramètres matériaux et de détail sont déclarés provisoires ou non confirmés.");
  if (!input.members.length && !input.slabs.length && !(input.foundations?.length ?? 0)) errors.push("Aucun effort calculé par le solveur/maillage n’est disponible pour dimensionner le béton armé.");
  if (input.members.some(item => !item.combinationId || !item.combinationName)) errors.push("Une combinaison gouvernante doit être identifiée pour chaque membre.");
  const elements: RCElementDesign[] = errors.length ? [] : [
    ...input.members.map(item => {
      const design = item.type === "beam" ? designBeam(item, input.basis, input.overrides ?? {}) : designColumn(item, input.basis, input.overrides ?? {});
      if (item.memberSubtype === "tie-beam") design.type = "tie-beam";
      return design;
    }),
    ...input.slabs.map(item => designSlab(item, input.basis, input.overrides ?? {})),
    ...(input.foundations ?? []).map(item => designFooting(item, input.basis, input.overrides ?? {})),
  ];
  const scheduleMap = new Map<number, { totalLengthM: number; massKg: number }>();
  for (const element of elements) for (const bar of element.reinforcement) {
    const current = scheduleMap.get(bar.diameterMm) ?? { totalLengthM: 0, massKg: 0 };
    scheduleMap.set(bar.diameterMm, { totalLengthM: current.totalLengthM + bar.totalLengthM, massKg: current.massKg + bar.massKg });
  }
  const schedule = Array.from(scheduleMap, ([diameterMm, totals]) => ({ diameterMm, ...totals })).sort((a, b) => a.diameterMm - b.diameterMm);
  return { schemaVersion: 1, status: "pré-étude — non réglementaire", standard: input.basis.standard, nationalAnnex: input.basis.nationalAnnex, sourceReference: input.basis.sourceReference, materialBasis: input.basis, regulatoryReady: false, elements, schedule, errors, warnings, blockers };
}
