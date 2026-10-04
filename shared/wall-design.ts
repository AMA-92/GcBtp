import type { RCDesignBasis, RCDesignOverrides, RCElementDesign } from "./rc-design";

type WallDemand = { id: string; levelLabel?: string; combinationId: string; combinationName: string; lengthMm: number; thicknessMm: number; heightMm: number; axialKn: number; shearKn: number; momentXKnM: number; momentYKnM?: number; openingAreaRatio?: number; couplingShearKn?: number; seismicShearFactor?: number; foundationReactionKn?: number };
const positive = (v: number) => Number.isFinite(v) && v > 0;
const barArea = (d: number) => Math.PI * d * d / 4;
const check = (id: string, label: string, demand: number, resistance: number, unit: string, formula: string, c: WallDemand) => ({ id, label, demand, resistance, utilization: demand / Math.max(resistance, 1e-9), unit, status: demand <= resistance ? "satisfaisant" as const : "non satisfaisant" as const, formula, combinationId: c.combinationId, combinationName: c.combinationName });
const proposal = (id: string, label: string, d: number, count: number, required: number, lengthM: number) => ({ id, label, diameterMm: d, count, areaMm2: count * barArea(d), requiredAreaMm2: required, lengthPerBarM: lengthM, totalLengthM: count * lengthM, massKg: count * lengthM * barArea(d) * 0.00785 });

export function designWall(demand: WallDemand, basis: RCDesignBasis, overrides: RCDesignOverrides = {}): RCElementDesign {
  const limitations = ["Section rectangulaire et interaction N–Mx–My simplifiée ; les zones de rive, le confinement, le flambement hors plan et les ouvertures doivent être vérifiés dans le modèle final.", "Les dispositions sismiques EN 1998 sont signalées mais doivent être détaillées selon la zone, la classe de ductilité et le niveau de sollicitation."];
  const c = demand;
  if (![demand.lengthMm, demand.thicknessMm, demand.heightMm].every(positive)) return { elementId: demand.id, type: "wall", combinationId: c.combinationId, combinationName: c.combinationName, checks: [{ id: "wall-geometry", label: "Géométrie du voile", demand: null, resistance: null, utilization: null, unit: "mm", status: "bloqué", formula: "L, t, H > 0", combinationId: c.combinationId, combinationName: c.combinationName }], reinforcement: [], limitations };
  const fcd = basis.alphaCC * basis.fckMpa / basis.gammaC, fyd = basis.fykMpa / basis.gammaS;
  const grossArea = demand.lengthMm * demand.thicknessMm, minVertical = basis.minReinforcementRatio * grossArea;
  const defaultDiameter = Math.max(8, Math.min(...basis.availableBarDiametersMm.filter(positive)));
  const override = overrides[`${demand.id}:vertical`];
  const diameter = override?.diameterMm ?? defaultDiameter, count = override?.count ?? Math.max(2, Math.ceil(minVertical / barArea(diameter)));
  const asVertical = count * barArea(diameter), nRd = (0.8 * grossArea * fcd + asVertical * fyd) / 1000, mRd = asVertical * fyd * Math.max(0.8 * demand.lengthMm, 1) / 1e6, vRd = Math.max(1, 0.18 * basis.fckMpa * demand.thicknessMm * demand.heightMm / 1000);
  const interaction = Math.abs(demand.axialKn) / Math.max(nRd, 1e-9) + Math.abs(demand.momentXKnM) / Math.max(mRd, 1e-9) + Math.abs(demand.momentYKnM ?? 0) / Math.max(mRd, 1e-9);
  const horizontalDiameter = defaultDiameter, horizontalCount = Math.max(2, Math.ceil(minVertical * 0.5 / barArea(horizontalDiameter)));
  const seismicFactor = demand.seismicShearFactor ?? 1.5;
  const seismicShear = Math.abs(demand.shearKn) * seismicFactor;
  const openingRatio = demand.openingAreaRatio ?? 0;
  const couplingShear = Math.abs(demand.couplingShearKn ?? 0);
  const foundationReaction = Math.abs(demand.foundationReactionKn ?? demand.axialKn);
  const checks = [
    check("wall-axial", "Compression composée N", Math.abs(demand.axialKn), nRd, "kN", "NEd ≤ NRd", c),
    check("wall-interaction", "Interaction non linéaire N–Mx–My", interaction, 1, "—", "Domaine d’interaction conservatif N-M-M", c),
    check("wall-shear", "Cisaillement V", Math.abs(demand.shearKn), vRd, "kN", "VEd ≤ VRd,c", c),
    check("wall-slenderness", "Flambement hors plan H/t", demand.heightMm / demand.thicknessMm, 25, "—", "H/t ≤ 25 avant amplification de second ordre", c),
    check("wall-boundary", "Zones de rive confinées", minVertical * 0.25, asVertical * 0.5, "mm²", "As,rive ≥ 25 % As,min ; confinement à détailler", c),
    check("wall-lintel", "Couplage par linteau", couplingShear, Math.max(vRd, 1), "kN", "VEd,linteau ≤ VRd ; zéro si voile non couplé", c),
    check("wall-openings", "Ouvertures du voile", openingRatio, 0.25, "—", "Taux d’ouverture ≤ 25 % avant renforcement périphérique", c),
    check("wall-seismic-shear", "Cisaillement sismique amplifié", seismicShear, vRd, "kN", "VEd,sis = 1,50 VEd ; facteur à confirmer EN 1998", c),
    check("wall-ductility", "Ductilité et espacement horizontal", horizontalCount, Math.max(2, Math.floor(demand.heightMm / Math.min(250, 3 * demand.thicknessMm))), "barres", "Armatures horizontales et espacement de confinement", c),
    check("wall-anchorage", "Ancrage et recouvrement", 40 * diameter, Math.max(40 * diameter, demand.thicknessMm), "mm", "lb,rqd ≥ 40ϕ ; recouvrement et adhérence à vérifier", c),
    check("wall-foundation", "Transfert voile–fondation", foundationReaction, Math.max(nRd, 1), "kN", "NEd,fond ≤ NRd,interface ; clé et ferraillage de reprise à détailler", c),
  ];
  const reinforcement = [proposal(`${demand.id}:vertical`, "Armatures verticales · HA " + diameter + " / " + (demand.lengthMm / Math.max(1, count - 1)).toFixed(0) + " mm", diameter, count, minVertical, demand.heightMm / 1000), proposal(`${demand.id}:horizontal`, "Armatures horizontales · HA " + horizontalDiameter + " / " + (demand.heightMm / Math.max(1, horizontalCount - 1)).toFixed(0) + " mm", horizontalDiameter, horizontalCount, minVertical * 0.5, demand.lengthMm / 1000), proposal(`${demand.id}:boundary`, "Armatures de zones de rive · HA " + diameter, diameter, Math.max(2, Math.ceil(count * 0.25)), minVertical * 0.25, demand.heightMm / 1000)];
  return { elementId: demand.id, type: "wall", combinationId: c.combinationId, combinationName: c.combinationName, checks, reinforcement, limitations };
}
export type { WallDemand };
