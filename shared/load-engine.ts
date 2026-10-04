import { getRegulatoryRule } from "./regulatory";
import { calculateStairPermanentLoad } from "./stair-load";

export type LoadCase = "permanent" | "exploitation" | "partitions" | "roof" | "wind" | "snow" | "seismic";
export type Material = "béton armé" | "acier" | "maçonnerie" | "bois";

export const MATERIALS: Record<Material, { density: number; label: string }> = {
  "béton armé": { density: 25, label: "Béton armé — 25 kN/m³" },
  acier: { density: 78.5, label: "Acier — 78,5 kN/m³" },
  maçonnerie: { density: 18, label: "Maçonnerie — 18 kN/m³" },
  bois: { density: 5, label: "Bois — 5 kN/m³" },
};

const COUNTRY_CONTEXT: Record<string, { windFactor: number; seismicFactor: number; note: string }> = {
  "Afrique du Sud": { windFactor: 1.15, seismicFactor: 1.05, note: "Paramètres provisoires inspirés du contexte SANS ; confirmer la zone et l’annexe." },
  "Algérie": { windFactor: 1.05, seismicFactor: 1.2, note: "Paramètres provisoires ; confirmer la zone sismique et l’annexe nationale." },
  "Maroc": { windFactor: 1.05, seismicFactor: 1.1, note: "Paramètres provisoires ; confirmer la zone de vent et de séisme." },
  "Égypte": { windFactor: 1.0, seismicFactor: 1.0, note: "Paramètres provisoires ; confirmer l’ECP et les données locales." },
  "Côte d’Ivoire": { windFactor: 1.0, seismicFactor: 0.85, note: "Paramètres de cadrage provisoires pour Abidjan ; confirmer les données locales." },
  "Sénégal": { windFactor: 1.05, seismicFactor: 0.85, note: "Paramètres de cadrage provisoires ; confirmer la zone de vent locale." },
};
const CITY_CONTEXT: Record<string, { siteFactor: number; note: string }> = {
  abidjan: { siteFactor: 1.05, note: "Zone urbaine côtière de cadrage — valeur à confirmer par étude locale." },
  dakar: { siteFactor: 1.08, note: "Zone urbaine côtière de cadrage — valeur à confirmer par étude locale." },
  lagos: { siteFactor: 1.05, note: "Zone urbaine côtière de cadrage — valeur à confirmer par étude locale." },
  "cape town": { siteFactor: 1.1, note: "Zone de cadrage — valeur à confirmer par données locales." },
  nairobi: { siteFactor: 1.0, note: "Zone intérieure de cadrage — valeur à confirmer par données locales." },
  cairo: { siteFactor: 1.0, note: "Zone de cadrage — valeur à confirmer par données locales." },
};
const STRUCTURE_FACTOR: Record<string, number> = { "Béton armé": 1, Maçonnerie: 1.05, "Structure métallique": 0.95, "Structure mixte": 1.02 };

export type LoadInput = {
  country: string;
  city: string;
  structure: string;
  material: Material;
  levels: number;
  tributaryArea: number;
  slabThickness: number;
  selectedCases: Partial<Record<LoadCase, boolean>>;
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
  const countryContext = COUNTRY_CONTEXT[input.country] ?? { windFactor: 1, seismicFactor: 1, note: "Pays non paramétré : renseigner les paramètres locaux avant validation." };
  const cityContext = CITY_CONTEXT[input.city.trim().toLowerCase()] ?? { siteFactor: 1, note: "Emplacement non paramétré : confirmer les données locales de vent, séisme et sol." };
  const structureKey = Object.keys(STRUCTURE_FACTOR).find(key => input.structure.startsWith(key)) ?? "Béton armé";
  const structureFactor = STRUCTURE_FACTOR[structureKey] ?? 1;
  const permanent = input.selectedCases.permanent ? material.density * input.slabThickness * input.tributaryArea * structureFactor : 0;
  const partitionsRate = positive(input.actions?.partitionLoad, 1.0);
  const roofRate = positive(input.actions?.roofLoad, 0.8);
  const exploitationRate = positive(input.actions?.exploitationLoad, 2.0);
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
  const stairsExploitation = input.selectedCases.exploitation && input.stairs ? positive(input.stairs.imposedLoad, exploitationRate) * stairArea + positive(input.stairs.landingImposedLoad, positive(input.stairs.imposedLoad, exploitationRate)) * landingArea : 0;
  const stairReactionGk = (input.stairs?.supportReactions ?? []).reduce((sum, reaction) => sum + positive(reaction.gk), 0);
  const stairReactionQk = (input.stairs?.supportReactions ?? []).reduce((sum, reaction) => sum + positive(reaction.qk), 0);
  const windPressure = positive(input.actions?.windPressure, 0.6 * countryContext.windFactor * cityContext.siteFactor);
  const snowPressure = positive(input.actions?.snowPressure, 0);
  const seismicCoefficient = positive(input.actions?.seismicCoefficient, 0.4 * countryContext.seismicFactor * cityContext.siteFactor);
  const wind = input.selectedCases.wind ? windPressure * input.tributaryArea : 0;
  const snow = input.selectedCases.snow ? snowPressure * input.tributaryArea : 0;
  const seismic = input.selectedCases.seismic ? seismicCoefficient * (permanent + partitions + roof + stairsPermanent) : 0;
  const tributaryGk = (input.tributaryContributions ?? []).reduce((sum, item) => sum + positive(item.gk), 0);
  const tributaryQk = (input.tributaryContributions ?? []).reduce((sum, item) => sum + positive(item.qk), 0);
  const gk = permanent + partitions + roof + stairsPermanent + stairReactionGk + tributaryGk;
  const qk = exploitation + stairsExploitation + stairReactionQk + tributaryQk;
  const gammaG = 1.35;
  const gammaQ = 1.5;
  const designFloor = gammaG * gk + gammaQ * qk;
  const windDesign = input.selectedCases.wind ? gammaQ * wind : 0;
  const snowDesign = input.selectedCases.snow ? gammaQ * snow : 0;
  const seismicDesign = input.selectedCases.seismic ? seismicCoefficient * (gk + 0.3 * qk) : 0;
  const beam = designFloor;
  const column = beam * Math.max(1, input.levels);
  const foundation = column * 1.15;
  const warnings = [
    ...(countryContext.note.includes("provisoire") || countryContext.note.includes("confirmer") ? [countryContext.note] : []),
    ...(cityContext.note.includes("confirmer") ? [cityContext.note] : []),
    ...(input.soil?.allowableBearing === undefined ? ["qadm non renseigné : fournir une étude géotechnique avant validation."] : []),
    ...(input.selectedCases.snow && snowPressure === 0 ? ["Neige activée sans pression renseignée : valeur calculée nulle."] : []),
    ...(input.selectedCases.wind && !input.actions?.windPressure ? ["Vent actif avec pression provisoire : confirmer la vitesse et la pression de calcul locales."] : []),
    ...(input.selectedCases.seismic && !input.actions?.seismicCoefficient ? ["Séisme actif avec coefficient provisoire : confirmer la zone, le sol et le spectre réglementaire."] : []),
  ];
  return {
    rule: getRegulatoryRule(input.country),
    material,
    context: { countryFactor: countryContext, cityFactor: cityContext, structureFactor, structureKey, location: input.location ?? {}, soil: input.soil ?? {}, reference: input.reference ?? { code: getRegulatoryRule(input.country).code, status: getRegulatoryRule(input.country).status, source: "Référentiel proposé — confirmation locale requise" } },
    assumptions: { permanent, partitions, roof, exploitation, stairsPermanent, stairsExploitation, stairReactionGk, stairReactionQk, landingArea, tributaryGk, tributaryQk, wind, snow, seismic, gk, qk, gammaG, gammaQ, tributaryArea: input.tributaryArea, slabThickness: input.slabThickness, stairArea, stairLength, location: input.location ?? {}, soil: input.soil ?? {}, actions: { windPressure, snowPressure, seismicCoefficient, exploitationRate, partitionsRate, roofRate }, combinations: { gravity: designFloor, wind: windDesign, snow: snowDesign, seismic: seismicDesign } },
    chain: { floor: designFloor, beam, column, foundation },
    components: { permanent, partitions, roof, stairsPermanent, stairsExploitation, stairReactionGk, stairReactionQk, exploitation, tributaryGk, tributaryQk, wind, snow, seismic, windDesign, snowDesign, seismicDesign, floor: designFloor, beam, column, foundation },
    warnings,
    combination: `${gammaG.toFixed(2)}·Gk + ${gammaQ.toFixed(2)}·Qk = ${designFloor.toFixed(2)} kN`,
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
    `Référentiel proposé : ${result.rule.code} (${result.rule.status})`,
    `Unités : ${result.units}`,
    `Cas de charges : ${active}`,
    `Référence : ${result.context.reference.code ?? result.rule.code} — ${result.context.reference.status ?? result.rule.status}`,
    `Source / note : ${result.context.reference.source ?? result.rule.note}`,
    `Altitude du site : ${Number(result.context.location.altitude ?? 0).toFixed(0)} m`,
    `Sol déclaré : ${result.context.soil.profile ?? "non renseigné"}`,
    `Gk : ${result.assumptions.gk.toFixed(2)} kN`,
    `Qk : ${result.assumptions.qk.toFixed(2)} kN`,
    `γG : ${result.assumptions.gammaG.toFixed(2)}`,
    `γQ : ${result.assumptions.gammaQ.toFixed(2)}`,
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
    `Combinaison gravitaire ELU : ${result.combination}` ,
    ...(foundation ? [`Sol : ${foundation.soil.label}`, `Fondation : ${foundation.foundation.label}`, `Assise : ${foundation.assumptions.depth.toFixed(2)} m`, `Nappe : ${foundation.assumptions.groundwaterDepth.toFixed(2)} m`, `q admissible de calcul : ${foundation.designBearing.toFixed(2)} kPa`, `Surface requise : ${foundation.requiredArea.toFixed(2)} m²`, `Dimensions proposées : ${foundation.width.toFixed(2)} × ${foundation.length.toFixed(2)} m`, `Pression moyenne : ${foundation.pressure.toFixed(2)} kPa`, `Taux d’utilisation : ${(foundation.utilization * 100).toFixed(0)}%`, `Statut fondation : ${foundation.status}`] : []),
    "Avertissement : référentiel et données locales à valider par un ingénieur.",
  ].join("\n");
}
