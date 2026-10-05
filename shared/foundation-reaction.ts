import type { AnalyticalModel } from "./analytical-model";
import type { FramePlane, PlaneFrameResult } from "./frame-solver-2d";

export type FoundationReactionInput = {
  verticalReactionKn: number;
  horizontalReactionKn: number;
  momentReactionKnM: number;
  momentAxis: "x" | "y";
  widthXM: number;
  widthYM: number;
  thicknessM: number;
  columnWidthM: number;
  columnDepthM: number;
  allowableBearingKPa: number;
  bearingSafetyFactor: number;
  slidingSafetyFactor: number;
  frictionAngleDeg: number;
  footingSelfWeightKn?: number;
  soilCoverLoadKn?: number;
  concreteShearCapacityKPa?: number | null;
  subgradeModulusKnM3?: number | null;
  allowableSettlementMm?: number | null;
  provenance: string;
};

export type FoundationCheck = {
  id: "bearing" | "contact" | "sliding" | "punching" | "settlement";
  label: string;
  demand: number | null;
  resistance: number | null;
  unit: string;
  status: "satisfaisant" | "insuffisant" | "non vérifié";
  note: string;
};

export type FoundationReactionResult = {
  status: "pré-étude — satisfaisant, à valider" | "pré-étude — incomplet" | "pré-étude — insuffisant";
  effectiveAxialKn: number;
  eccentricityM: number;
  eccentricityRatio: number;
  maximumPressureKPa: number;
  minimumPressureKPa: number;
  effectiveContactWidthM: number;
  checks: FoundationCheck[];
  warnings: string[];
};

const finite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);
const positive = (value: number) => Number.isFinite(value) && value > 0;

/**
 * Indicative, single-support footing screen. Units: kN, kN·m, m, kPa and kN/m³.
 * This is not a code-compliant geotechnical design; missing design inputs remain explicit.
 */
export function checkFoundationReaction(input: FoundationReactionInput): FoundationReactionResult {
  const momentDimension = input.momentAxis === "x" ? input.widthXM : input.widthYM;
  const transverseDimension = input.momentAxis === "x" ? input.widthYM : input.widthXM;
  const effectiveAxialKn = input.verticalReactionKn + (input.footingSelfWeightKn ?? 0) + (input.soilCoverLoadKn ?? 0);
  const validation: string[] = [];
  if (!finite(input.verticalReactionKn) || !finite(input.horizontalReactionKn) || !finite(input.momentReactionKnM)) validation.push("Réactions du solveur absentes ou non finies.");
  if (!positive(effectiveAxialKn)) validation.push("La réaction verticale nette n’est pas en compression ; le contact de la semelle ne peut pas être vérifié par ce modèle.");
  if (![input.widthXM, input.widthYM, input.thicknessM, input.columnWidthM, input.columnDepthM].every(positive)) validation.push("Dimensions de semelle, épaisseur ou poteau manquantes.");
  if (!positive(input.allowableBearingKPa) || !positive(input.bearingSafetyFactor) || !positive(input.slidingSafetyFactor)) validation.push("Portance géotechnique et coefficients de sécurité positifs requis.");
  if (validation.length) throw new Error(validation.join(" "));

  const areaM2 = input.widthXM * input.widthYM;
  const eccentricityM = Math.abs(input.momentReactionKnM) / effectiveAxialKn;
  const eccentricityRatio = eccentricityM / momentDimension;
  const effectiveContactWidthM = Math.max(0, momentDimension - 2 * eccentricityM);
  const fullContact = eccentricityRatio <= 1 / 6;
  const contactPossible = eccentricityM < momentDimension / 2;
  const meanPressureKPa = effectiveAxialKn / areaM2;
  const maximumPressureKPa = !contactPossible
    ? Number.POSITIVE_INFINITY
    : fullContact
      ? meanPressureKPa * (1 + 6 * eccentricityRatio)
      : (2 * effectiveAxialKn) / (transverseDimension * effectiveContactWidthM);
  const minimumPressureKPa = fullContact ? meanPressureKPa * (1 - 6 * eccentricityRatio) : 0;
  const designBearingKPa = input.allowableBearingKPa / input.bearingSafetyFactor;
  const bearingStatus = maximumPressureKPa <= designBearingKPa ? "satisfaisant" : "insuffisant";
  const contactStatus = contactPossible ? (fullContact ? "satisfaisant" : "insuffisant") : "insuffisant";

  const frictionResistanceKn = effectiveAxialKn * Math.tan((input.frictionAngleDeg * Math.PI) / 180) / input.slidingSafetyFactor;
  const slidingStatus = Math.abs(input.horizontalReactionKn) <= frictionResistanceKn ? "satisfaisant" : "insuffisant";
  const effectiveDepthM = Math.max(0, input.thicknessM * 0.8);
  const punchingPerimeterM = 2 * (input.columnWidthM + input.columnDepthM + 2 * effectiveDepthM);
  const punchingInsideAreaM2 = (input.columnWidthM + effectiveDepthM) * (input.columnDepthM + effectiveDepthM);
  const punchingDemandKPa = effectiveDepthM > 0
    ? Math.max(0, effectiveAxialKn - meanPressureKPa * punchingInsideAreaM2) / (punchingPerimeterM * effectiveDepthM)
    : Number.POSITIVE_INFINITY;
  const punchingCapacity = input.concreteShearCapacityKPa;
  const punchingStatus = positive(punchingCapacity ?? 0)
    ? (punchingDemandKPa <= (punchingCapacity as number) ? "satisfaisant" : "insuffisant")
    : "non vérifié";
  const settlementCanRun = positive(input.subgradeModulusKnM3 ?? 0) && positive(input.allowableSettlementMm ?? 0);
  const estimatedSettlementMm = settlementCanRun
    ? (maximumPressureKPa / (input.subgradeModulusKnM3 as number)) * 1000
    : null;
  const settlementStatus = estimatedSettlementMm === null
    ? "non vérifié"
    : estimatedSettlementMm <= (input.allowableSettlementMm as number) ? "satisfaisant" : "insuffisant";
  const checks: FoundationCheck[] = [
    { id: "bearing", label: "Portance avec moment", demand: maximumPressureKPa, resistance: designBearingKPa, unit: "kPa", status: bearingStatus, note: `qmin ${minimumPressureKPa.toFixed(2)} kPa · qadm/sécurité ${designBearingKPa.toFixed(2)} kPa.` },
    { id: "contact", label: "Excentricité et décollement", demand: eccentricityM, resistance: momentDimension / 6, unit: "m", status: contactStatus, note: contactPossible ? (fullContact ? "Contact théorique intégral (e ≤ B/6)." : `Décollement partiel estimé ; largeur comprimée ${effectiveContactWidthM.toFixed(3)} m.`) : "Le résultant sort du noyau central élargi ; pas d’équilibre de contact dans ce modèle." },
    { id: "sliding", label: "Glissement", demand: Math.abs(input.horizontalReactionKn), resistance: frictionResistanceKn, unit: "kN", status: slidingStatus, note: `Résistance frictionnelle simplifiée à partir de φ = ${input.frictionAngleDeg}° ; pas de cohésion ni butée passive.` },
    { id: "punching", label: "Poinçonnement — screening", demand: punchingDemandKPa, resistance: positive(punchingCapacity ?? 0) ? punchingCapacity as number : null, unit: "kPa", status: punchingStatus, note: "La capacité doit provenir d’un détail BA et d’un référentiel vérifiés ; d = 0,8h est une approximation de pré-étude." },
    { id: "settlement", label: "Tassement — screening", demand: estimatedSettlementMm, resistance: finite(input.allowableSettlementMm) ? input.allowableSettlementMm : null, unit: "mm", status: settlementStatus, note: settlementCanRun ? `Estimation élastique grossière avec k = ${input.subgradeModulusKnM3} kN/m³ ; ne remplace pas l’étude géotechnique.` : "Module de réaction et limite de tassement issus de l’étude géotechnique requis." },
  ];
  const warnings = [
    "Pré-étude indicative uniquement ; confirmer les combinaisons, paramètres géotechniques, nappe, poids des terres, tassements et interactions par un ingénieur habilité.",
    `Source géotechnique déclarée : ${input.provenance || "non renseignée"}.`,
    "Réaction issue d’un solveur de portique plan ; les autres directions et interactions de groupe ne sont pas couvertes.",
  ];
  const failed = checks.some(check => check.status === "insuffisant");
  const incomplete = checks.some(check => check.status === "non vérifié");
  return {
    status: failed ? "pré-étude — insuffisant" : incomplete ? "pré-étude — incomplet" : "pré-étude — satisfaisant, à valider",
    effectiveAxialKn,
    eccentricityM,
    eccentricityRatio,
    maximumPressureKPa,
    minimumPressureKPa,
    effectiveContactWidthM,
    checks,
    warnings,
  };
}

export type FoundationReactionRecord = {
  footingId: string;
  columnId: string;
  nodeId: string;
  levelId: string;
  verticalReactionKn: number;
  horizontalReactionKn: number;
  momentReactionKnM: number;
  momentAxis: "x" | "y";
  widthXM: number;
  widthYM: number;
  thicknessM: number;
  columnWidthM: number;
  columnDepthM: number;
  geometricEccentricityXM: number;
  geometricEccentricityYM: number;
};

/** Join projected planar solver reactions to supports inferred from actual footings. */
export function mapFoundationReactions(model: AnalyticalModel, result: PlaneFrameResult, plane: FramePlane): { records: FoundationReactionRecord[]; warnings: string[] } {
  const warnings: string[] = [];
  const reactions = new Map(result.reactions.map(reaction => [reaction.nodeId, reaction]));
  const nodes = new Map(model.nodes.map(node => [node.id, node]));
  const frames = new Map(model.frames.filter(frame => frame.sourceType === "Poteau").map(frame => [frame.sourceElementId, frame]));
  const sections = new Map(model.sections.map(section => [section.id, section]));
  const footingSurfaces = new Map(model.surfaces.filter(surface => surface.kind === "footing").map(surface => {
    const points = surface.nodeIds.map(id => nodes.get(id)).filter((node): node is NonNullable<typeof node> => Boolean(node));
    const widthXM = points.length ? Math.max(...points.map(node => node.x)) - Math.min(...points.map(node => node.x)) : 0;
    const widthYM = points.length ? Math.max(...points.map(node => node.y)) - Math.min(...points.map(node => node.y)) : 0;
    const centerXM = points.length ? (Math.max(...points.map(node => node.x)) + Math.min(...points.map(node => node.x))) / 2 : 0;
    const centerYM = points.length ? (Math.max(...points.map(node => node.y)) + Math.min(...points.map(node => node.y))) / 2 : 0;
    const section = sections.get(surface.sectionId);
    return [surface.sourceElementId, { widthXM, widthYM, centerXM, centerYM, thicknessM: section?.dimensionsM[2] ?? 0 }] as const;
  }));
  const records: FoundationReactionRecord[] = [];
  const seenNodes = new Set<string>();
  for (const support of model.supports) {
    if (seenNodes.has(support.nodeId)) {
      warnings.push(`Appuis multiples au nœud ${support.nodeId} : réaction non répartie automatiquement entre les semelles.`);
      continue;
    }
    seenNodes.add(support.nodeId);
    const reaction = reactions.get(support.nodeId);
    if (!reaction) {
      warnings.push(`Aucune réaction de solveur disponible au nœud d’appui ${support.nodeId}.`);
      continue;
    }
    const footing = footingSurfaces.get(support.sourceElementId);
    const node = nodes.get(support.nodeId);
    const columnFrame = model.frames.find(frame => frame.sourceType === "Poteau" && frame.startNodeId === support.nodeId) ?? model.frames.find(frame => frame.sourceType === "Poteau" && (frame.startNodeId === support.nodeId || frame.endNodeId === support.nodeId));
    const section = columnFrame ? sections.get(columnFrame.sectionId) : undefined;
    const dimensions = section?.dimensionsM ?? [];
    const geometricEccentricityXM = footing && node ? node.x - footing.centerXM : 0;
    const geometricEccentricityYM = footing && node ? node.y - footing.centerYM : 0;
    const normalizedEccentricityX = footing?.widthXM ? Math.abs(geometricEccentricityXM) / footing.widthXM : 0;
    const normalizedEccentricityY = footing?.widthYM ? Math.abs(geometricEccentricityYM) / footing.widthYM : 0;
    const eccentricityAxis: "x" | "y" = normalizedEccentricityX >= normalizedEccentricityY ? "x" : "y";
    const geometricEccentricityM = Math.hypot(geometricEccentricityXM, geometricEccentricityYM);
    const momentAxis = geometricEccentricityM > 1e-6 ? eccentricityAxis : plane === "XZ" ? "x" : "y";
    const momentReactionKnM = geometricEccentricityM > 1e-6
      ? Math.abs(reaction.momentKnM) + Math.abs(reaction.fzKn) * geometricEccentricityM
      : reaction.momentKnM;
    if (!footing) warnings.push(`Semelle analytique absente pour l’appui ${support.id}.`);
    if (!section || dimensions.length < 2) warnings.push(`Section de poteau non résolue pour l’appui ${support.id}.`);
    if (geometricEccentricityM > 1e-6) warnings.push(`Semelle ${support.sourceElementId} excentrée de ${geometricEccentricityM.toFixed(3)} m (résultante X/Y) : moment géométrique N·e ajouté au screening de portance.`);
    if (Math.abs(geometricEccentricityXM) > 1e-6 && Math.abs(geometricEccentricityYM) > 1e-6) warnings.push(`Semelle ${support.sourceElementId} excentrée sur deux axes : le screening uniaxial utilise la résultante conservatrice et ne remplace pas une vérification biaxiale complète.`);
    if (geometricEccentricityM > 1e-6 && momentAxis !== (plane === "XZ" ? "x" : "y")) warnings.push(`L’excentricité géométrique de ${support.sourceElementId} agit hors du plan ${plane} ; le contrôle uniaxial reste un screening et ne remplace pas une vérification biaxiale.`);
    records.push({
      footingId: support.sourceElementId,
      columnId: columnFrame?.sourceElementId ?? support.id,
      nodeId: support.nodeId,
      levelId: columnFrame?.levelId ?? node?.levelIds[0] ?? "",
      verticalReactionKn: reaction.fzKn,
      horizontalReactionKn: reaction.fxKn,
      momentReactionKnM,
      momentAxis,
      widthXM: footing?.widthXM ?? 0,
      widthYM: footing?.widthYM ?? 0,
      thicknessM: footing?.thicknessM ?? 0,
      columnWidthM: dimensions[0] ?? 0,
      columnDepthM: dimensions[1] ?? dimensions[0] ?? 0,
      geometricEccentricityXM,
      geometricEccentricityYM,
    });
  }
  if (!records.length) warnings.push("Aucune réaction de fondation exploitable pour l’analyse 2D sélectionnée.");
  warnings.push(`Réactions projetées depuis le plan ${plane} uniquement.`);
  return { records, warnings };
}
