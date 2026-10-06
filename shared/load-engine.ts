import { getRegulatoryRule } from "./regulatory";
import { calculateStairPermanentLoad } from "./stair-load";
import { DEFAULT_LOAD_VALUES } from "./load-catalog";
import { FRENCH_EUROCODE_ACTION_CATALOG, formatFrenchCoefficient, getFrenchProjectUsageProfile, getFrenchPsiFactors, type FrenchProjectUsage } from "./french-load-catalog";

export type LoadCase = "permanent" | "exploitation" | "partitions" | "roof" | "wind" | "snow" | "seismic";
export type Material = "béton armé" | "acier" | "maçonnerie" | "bois";

export const MATERIALS: Record<Material, { density: number; label: string }> = {
  "béton armé": { density: 25, label: "Béton armé — 25 kN/m³" },
  acier: { density: 78.5, label: "Acier — 78,5 kN/m³" },
  maçonnerie: { density: 18, label: "Maçonnerie — valeur de pré-étude 18 kN/m³" },
  bois: { density: 5, label: "Bois — valeur de pré-étude 5 kN/m³" },
};

export type LoadInput = {
  country: string;
  city: string;
  structure: string;
  material: Material;
  levels: number;
  tributaryArea: number;
  slabThickness: number;
  selectedCases: Partial<Record<LoadCase, boolean>>;
  usage?: FrenchProjectUsage;
  location?: { latitude?: number; longitude?: number; altitude?: number; zone?: string };
  soil?: { profile?: string; allowableBearing?: number; groundwaterDepth?: number; foundationDepth?: number; seismicClass?: string };
  actions?: { windPressure?: number; snowPressure?: number; seismicCoefficient?: number; exploitationLoad?: number; partitionLoad?: number; roofLoad?: number };
  stairs?: { flights?: number; width: number; horizontalRun: number; rise: number; slabThickness: number; finishLoad?: number; imposedLoad?: number; stepLoad?: number; stepHeight?: number; tread?: number; landingCount?: number; landingLength?: number; landingWidth?: number; landingThickness?: number; landingFinishLoad?: number; landingImposedLoad?: number; supportReactions?: Array<{ id: string; gk: number; qk: number; source?: string }> };
  reference?: { code?: string; status?: string; source?: string };
  tributaryContributions?: Array<{ gk: number; qk: number; source: string }>;
};

export type LoadComponent = { value: number; unit: "kN"; source: string; status: "calculated" | "input" | "provisional" };

function positive(value: number | undefined, fallback = 0) { return Number.isFinite(value) && (value ?? 0) >= 0 ? value as number : fallback; }

export function calculateLoadDescent(input: LoadInput) {
  const material = MATERIALS[input.material];
  const activity = getFrenchProjectUsageProfile(input.usage);
  const psi = getFrenchPsiFactors(activity.psiCategory);
  const factors = FRENCH_EUROCODE_ACTION_CATALOG.partialFactors;
  const structureKey = input.structure;
  const structureFactor = 1;
  const permanent = input.selectedCases.permanent ? material.density * input.slabThickness * input.tributaryArea : 0;
  const partitionsRate = positive(input.actions?.partitionLoad, DEFAULT_LOAD_VALUES.partitions);
  const roofRate = positive(input.actions?.roofLoad, DEFAULT_LOAD_VALUES.roof);
  const exploitationRate = positive(input.actions?.exploitationLoad, activity.load);
  const stairImposedRate = positive(input.stairs?.imposedLoad, activity.stairLoad);
  const landingImposedRate = positive(input.stairs?.landingImposedLoad, stairImposedRate);
  const partitions = input.selectedCases.partitions ? partitionsRate * input.tributaryArea : 0;
  const roof = input.selectedCases.roof ? roofRate * input.tributaryArea : 0;
  const exploitation = input.selectedCases.exploitation ? exploitationRate * input.tributaryArea : 0;
  const stairsFlights = Math.max(1, Math.round(positive(input.stairs?.flights, 1)));
  const stairLength = input.stairs ? Math.sqrt(Math.pow(positive(input.stairs.horizontalRun), 2) + Math.pow(positive(input.stairs.rise), 2)) : 0;
  const stairArea = input.stairs ? positive(input.stairs.width) * stairLength * stairsFlights : 0;
  const landingCount = Math.max(0, Math.round(positive(input.stairs?.landingCount, 0)));
  const landingArea = input.stairs ? landingCount * positive(input.stairs.landingLength) * positive(input.stairs.landingWidth) : 0;
  const stairRate = input.stairs ? calculateStairPermanentLoad({ widthM: input.stairs.width, horizontalRunM: input.stairs.horizontalRun, riseM: input.stairs.rise, slabThicknessM: input.stairs.slabThickness, concreteDensityKnM3: material.density, stepHeightM: input.stairs.stepHeight, treadM: input.stairs.tread, finishLoadKnM2: input.stairs.finishLoad }) : null;
  const stairsPermanent = input.selectedCases.permanent && input.stairs ? stairRate!.permanentRateKnM2 * stairArea + (material.density * positive(input.stairs.landingThickness, positive(input.stairs.slabThickness)) + positive(input.stairs.landingFinishLoad)) * landingArea : 0;
  const stairsExploitation = input.selectedCases.exploitation && input.stairs ? stairImposedRate * stairArea + landingImposedRate * landingArea : 0;
  const stairReactionGk = (input.stairs?.supportReactions ?? []).reduce((sum, reaction) => sum + positive(reaction.gk), 0);
  const stairReactionQk = (input.stairs?.supportReactions ?? []).reduce((sum, reaction) => sum + positive(reaction.qk), 0);
  const windPressure = positive(input.actions?.windPressure, 0);
  const snowPressure = positive(input.actions?.snowPressure, 0);
  const seismicCoefficient = positive(input.actions?.seismicCoefficient, 0);
  const wind = input.selectedCases.wind ? windPressure * input.tributaryArea : 0;
  const snow = input.selectedCases.snow ? snowPressure * input.tributaryArea : 0;
  const tributaryGk = (input.tributaryContributions ?? []).reduce((sum, item) => sum + positive(item.gk), 0);
  const tributaryQk = (input.tributaryContributions ?? []).reduce((sum, item) => sum + positive(item.qk), 0);
  const gk = permanent + partitions + roof + stairsPermanent + stairReactionGk + tributaryGk;
  const qk = exploitation + stairsExploitation + stairReactionQk + tributaryQk;
  const seismic = input.selectedCases.seismic ? seismicCoefficient * (gk + psi.psi2 * qk) : 0;
  const gammaG = factors.permanentUnfavourable;
  const gammaQ = factors.variableUnfavourable;
  const designFloor = gammaG * gk + gammaQ * qk;
  const windDesign = input.selectedCases.wind ? gammaG * gk + gammaQ * wind + gammaQ * psi.psi0 * qk : 0;
  const snowDesign = input.selectedCases.snow ? gammaG * gk + gammaQ * snow + gammaQ * psi.psi0 * qk : 0;
  const seismicDesign = input.selectedCases.seismic ? factors.seismicPermanent * gk + factors.seismicAction * seismic + psi.psi2 * qk : 0;
  const beam = designFloor;
  const column = beam * Math.max(1, input.levels);
  const foundation = column * 1.15;
  const warnings = [
    ...(input.soil?.allowableBearing === undefined ? ["qadm non renseigné : fournir une étude géotechnique avant validation."] : []),
    ...(input.selectedCases.partitions && input.actions?.partitionLoad === undefined ? ["Cloisons : 1,00 kN/m² repris du défaut de catalogue, à remplacer par le poids réel des parois."] : []),
    ...(input.selectedCases.roof && input.actions?.roofLoad === undefined ? ["Toiture : 0,80 kN/m² correspond au cas H à faible pente avec étanchéité; confirmer la configuration réelle."] : []),
    ...(input.selectedCases.wind && windPressure === 0 ? ["Vent actif sans pression de site confirmée : contribution nulle, fournir la pression selon NF EN 1991-1-4/NA."] : []),
    ...(input.selectedCases.snow && snowPressure === 0 ? ["Neige active sans pression de site confirmée : contribution nulle, fournir la charge selon NF EN 1991-1-3/NA."] : []),
    ...(input.selectedCases.seismic && seismicCoefficient === 0 ? ["Séisme actif sans coefficient confirmé : contribution nulle, fournir les paramètres NF EN 1998/NA et l’étude de sol."] : []),
    "La chaîne poutre–poteau–fondation est un dépistage global simplifié, pas un modèle spatial ni une justification réglementaire.",
    "La fondation reçoit une majoration de transfert 1,15 de pré-étude; les réactions et la portance doivent provenir du modèle et de l’étude géotechnique.",
  ];
  const rule = getRegulatoryRule(input.country);
  return {
    rule,
    material,
    context: { country: input.country, city: input.city, structureFactor, structureKey, location: input.location ?? {}, soil: input.soil ?? {}, reference: input.reference ?? { code: rule.code, status: rule.status, source: rule.note } },
    assumptions: { permanent, partitions, roof, exploitation, stairsPermanent, stairsExploitation, stairReactionGk, stairReactionQk, landingArea, tributaryGk, tributaryQk, wind, snow, seismic, gk, qk, gammaG, gammaQ, psi0: psi.psi0, psi1: psi.psi1, psi2: psi.psi2, usageCategory: activity.category, usageReference: activity.source, qkFloorKnM2: activity.load, qkStairsKnM2: activity.stairLoad, qkBalconyKnM2: activity.balconyLoad, tributaryArea: input.tributaryArea, slabThickness: input.slabThickness, stairArea, stairLength, location: input.location ?? {}, soil: input.soil ?? {}, actions: { windPressure, snowPressure, seismicCoefficient, exploitationRate, partitionsRate, roofRate, stairImposedRate, landingImposedRate }, combinations: { gravity: designFloor, wind: windDesign, snow: snowDesign, seismic: seismicDesign } },
    chain: { floor: designFloor, beam, column, foundation },
    components: { permanent, partitions, roof, stairsPermanent, stairsExploitation, stairReactionGk, stairReactionQk, exploitation, tributaryGk, tributaryQk, wind, snow, seismic, windDesign, snowDesign, seismicDesign, floor: designFloor, beam, column, foundation },
    warnings,
    combination: `${formatFrenchCoefficient(gammaG)}·Gk + ${formatFrenchCoefficient(gammaQ)}·Qk = ${designFloor.toFixed(2)} kN`,
    units: "kN, m, kN/m²",
    location: `${input.city}, ${input.country}`,
    structure: input.structure,
  };
}

export function buildLoadDescentNote(result: ReturnType<typeof calculateLoadDescent>, foundation?: { soil: { label: string }; foundation: { label: string }; designBearing: number; requiredArea: number; width: number; length: number; pressure: number; utilization: number; status: string; assumptions: { depth: number; groundwaterDepth: number } }) {
  const active = Object.entries(result.assumptions)
    .filter(([key]) => ["permanent", "partitions", "roof", "exploitation", "stairsPermanent", "stairsExploitation", "wind", "snow", "seismic"].includes(key))
    .map(([key, value]) => `${key}=${Number(value).toFixed(2)} kN`)
    .join(", ");
  return [
    "Note de descente de charges — GcBtp",
    `Lieu : ${result.location}`,
    `Structure : ${result.structure}`,
    `Matériau : ${result.material.label}`,
    `Référentiel de calcul : ${result.rule.code} (${result.rule.status})`,
    `Unité d’usage : catégorie ${result.assumptions.usageCategory} · qk plancher ${formatFrenchCoefficient(result.assumptions.qkFloorKnM2)} kN/m² · qk escalier ${formatFrenchCoefficient(result.assumptions.qkStairsKnM2)} kN/m²`,
    `Unités : ${result.units}`,
    `Cas de charges : ${active}`,
    `Référence : ${result.context.reference.code ?? result.rule.code} — ${result.context.reference.status ?? result.rule.status}`,
    `Source / note : ${result.context.reference.source ?? result.rule.note}`,
    `Altitude du site : ${Number(result.context.location.altitude ?? 0).toFixed(0)} m`,
    `Sol déclaré : ${result.context.soil.profile ?? "non renseigné"}`,
    `Gk : ${result.assumptions.gk.toFixed(2)} kN`,
    `Qk : ${result.assumptions.qk.toFixed(2)} kN`,
    `γG : ${formatFrenchCoefficient(result.assumptions.gammaG)}`,
    `γQ : ${formatFrenchCoefficient(result.assumptions.gammaQ)}`,
    `ψ0/ψ1/ψ2 : ${formatFrenchCoefficient(result.assumptions.psi0)} / ${formatFrenchCoefficient(result.assumptions.psi1)} / ${formatFrenchCoefficient(result.assumptions.psi2)}`,
    `Surface tributaire : ${result.assumptions.tributaryArea.toFixed(2)} m²`,
    `Épaisseur dalle : ${result.assumptions.slabThickness.toFixed(3)} m`,
    `Surface escalier : ${result.assumptions.stairArea.toFixed(2)} m²`,
    `Surface paliers : ${result.assumptions.landingArea.toFixed(2)} m²`,
    `Réactions d’appui escalier : Gk ${result.assumptions.stairReactionGk.toFixed(2)} kN + Qk ${result.assumptions.stairReactionQk.toFixed(2)} kN`,
    `Pression vent saisie : ${result.assumptions.actions.windPressure.toFixed(2)} kN/m²`,
    `Pression neige saisie : ${result.assumptions.actions.snowPressure.toFixed(2)} kN/m²`,
    `Coefficient sismique saisi : ${result.assumptions.actions.seismicCoefficient.toFixed(3)}`,
    `Effet de calcul vent : ${result.components.windDesign.toFixed(2)} kN · neige : ${result.components.snowDesign.toFixed(2)} kN · séisme : ${result.components.seismicDesign.toFixed(2)} kN`,
    `Chaîne gravitaire : plancher ${result.chain.floor.toFixed(2)} kN → poutre ${result.chain.beam.toFixed(2)} kN → poteau ${result.chain.column.toFixed(2)} kN → fondation ${result.chain.foundation.toFixed(2)} kN`,
    `Combinaison gravitaire ELU : ${result.combination}`,
    ...result.warnings.map(warning => `Avertissement : ${warning}`),
    ...(foundation ? [`Sol : ${foundation.soil.label}`, `Fondation : ${foundation.foundation.label}`, `Assise : ${foundation.assumptions.depth.toFixed(2)} m`, `Nappe : ${foundation.assumptions.groundwaterDepth.toFixed(2)} m`, `q admissible de calcul : ${foundation.designBearing.toFixed(2)} kPa`, `Surface requise : ${foundation.requiredArea.toFixed(2)} m²`, `Dimensions proposées : ${foundation.width.toFixed(2)} × ${foundation.length.toFixed(2)} m`, `Pression moyenne : ${foundation.pressure.toFixed(2)} kPa`, `Taux d’utilisation : ${(foundation.utilization * 100).toFixed(0)}%`, `Statut fondation : ${foundation.status}`] : []),
    "Avertissement : pré-étude non certifiée; référentiel, données locales et vérifications détaillées à valider par un ingénieur.",
  ].join("\n");
}
