import type { FloorConfig } from "./floor-config";
import { defaultBalconyFloorConfig, defaultFloorConfig, isSlabElementType, normalizeFloorConfig } from "./floor-config";
import { MATERIAL_CATALOG } from "./load-catalog";
import { calculateStairPermanentLoad, calculateStairSurfaceLoads, type StairFlightPlan } from "./stair-load";
import { FRENCH_EUROCODE_ACTION_CATALOG, FRENCH_PROJECT_USAGE_CATALOG } from "./french-load-catalog";

type StructuralElement = {
  type: string;
  section: string;
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  floorConfig?: FloorConfig;
  stairGeometry?: { flight1?: StairFlightPlan; flight2?: StairFlightPlan };
  absoluteStairGeometry?: { flight1?: StairFlightPlan; flight2?: StairFlightPlan };
};
const CONCRETE_UNIT_WEIGHT = MATERIAL_CATALOG.find(item => item.id === "beton-arme")?.unitWeightKnM3 ?? 25;
const GAMMA_G = FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.permanentUnfavourable;
const GAMMA_Q = FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.variableUnfavourable;
const designLoad = (gk: number, qk: number) => GAMMA_G * gk + GAMMA_Q * qk;
const dimensionsFromSection = (section: string, fallback: [number, number]) => { const match = section.match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/i); return match ? [Number(match[1].replace(",", ".")) / 100, Number(match[2].replace(",", ".")) / 100] as [number, number] : fallback; };
const floorSelfWeightRate = (config: FloorConfig) => { const parts = (config.thickness ?? "16+4 cm").match(/\d+(?:[.,]\d+)?/g)?.map(value => Number(value.replace(",", "."))) ?? [20]; if (config.type === "Dalle pleine") return CONCRETE_UNIT_WEIGHT * Math.max(0.05, parts.reduce((sum, value) => sum + value, 0) / 100); const hollow = Number((config.hollowBlockHeight ?? "16").replace(",", ".")) || 16; const compression = Number((config.compressionSlab ?? "4").replace(",", ".")) || 4; return CONCRETE_UNIT_WEIGHT * (compression / 100 + 0.08 + Math.max(0, compression - 4) * 0.01) + 0.5 + Math.max(0, hollow - 16) * 0.03; };
const numeric = (value: unknown, fallback = 0) => { const parsed = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : fallback; };
const optionalNumeric = (value: unknown) => { if (value === undefined || value === null || String(value).trim() === "") return undefined; const parsed = numeric(value, NaN); return Number.isFinite(parsed) ? parsed : undefined; };

export function elementLoadSummary(element: StructuralElement, gridDistance: string, fallback: FloorConfig) {
  const distance = Math.max(numeric(gridDistance, 4), 0.1);
  if (isSlabElementType(element.type) || element.type === "Escaliers") {
    const sourceConfig = element.floorConfig ?? (element.type === "Escaliers"
      ? { ...defaultFloorConfig, type: "Dalle pleine" as const, thickness: "15 cm", characteristicImposedLoad: String(FRENCH_PROJECT_USAGE_CATALOG.habitation.stairLoad), stairRiser: "0.17", stairTread: "0.30", stairRise: "2.04", stairRun: "3.60", stairFinishLoad: "0.00" }
      : element.type === "Balcon" ? defaultBalconyFloorConfig(fallback) : fallback);
    const config = normalizeFloorConfig(sourceConfig);
    const thickness = (config.thickness.match(/\d+(?:[.,]\d+)?/g) ?? ["20"]).reduce((sum, part) => sum + numeric(part), 0) / 100;
    const gridArea = Math.max(Math.abs((element.x2 ?? element.x ?? 0) - (element.x ?? 0)) * distance, 0.01) * Math.max(Math.abs((element.y2 ?? element.y ?? 0) - (element.y ?? 0)) * distance, 0.01);
    const explicitPermanent = optionalNumeric(config.characteristicPermanentLoad);
    const explicitImposed = optionalNumeric(config.characteristicImposedLoad);
    if (element.type === "Escaliers") {
      const geometry = element.absoluteStairGeometry ?? element.stairGeometry;
      const scale = element.absoluteStairGeometry ? 1 : distance;
      const toMetric = (flight: StairFlightPlan | undefined): StairFlightPlan | undefined => flight ? {
        lowerA: { x: flight.lowerA.x * scale, y: flight.lowerA.y * scale },
        lowerB: { x: flight.lowerB.x * scale, y: flight.lowerB.y * scale },
        upperA: { x: flight.upperA.x * scale, y: flight.upperA.y * scale },
        upperB: { x: flight.upperB.x * scale, y: flight.upperB.y * scale },
      } : undefined;
      const stairs = calculateStairSurfaceLoads({
        flights: [toMetric(geometry?.flight1), toMetric(geometry?.flight2)],
        landingDepthM: numeric(config.stairLandingDepthM, 0),
        riseM: numeric(config.stairRise, 2.04),
        slabThicknessM: thickness,
        concreteDensityKnM3: CONCRETE_UNIT_WEIGHT,
        stepHeightM: numeric(config.stairRiser, 0.17),
        treadM: numeric(config.stairTread, 0.30),
        flightFinishLoadKnM2: numeric(config.stairFinishLoad, 0),
        landingFinishLoadKnM2: numeric(config.stairLandingFinishLoad, numeric(config.finishLoad, 0)),
        flightImposedLoadKnM2: explicitImposed ?? numeric(config.imposedLoad, FRENCH_PROJECT_USAGE_CATALOG.habitation.stairLoad),
        landingImposedLoadKnM2: numeric(config.stairLandingImposedLoad, explicitImposed ?? numeric(config.imposedLoad, FRENCH_PROJECT_USAGE_CATALOG.habitation.stairLoad)),
      });
      if (stairs.rows.length) return { surface: stairs.totalAreaM2, gk: stairs.totalGkKn, qk: stairs.totalQkKn, design: designLoad(stairs.totalGkKn, stairs.totalQkKn), label: `Escalier · volées et paliers individuels · ${stairs.rows.length} surfaces` };
      const provisionalFlightRate = calculateStairPermanentLoad({ widthM: 1.2, horizontalRunM: numeric(config.stairRun, 3.6), riseM: numeric(config.stairRise, 2.04), slabThicknessM: thickness, concreteDensityKnM3: CONCRETE_UNIT_WEIGHT, stepHeightM: numeric(config.stairRiser, 0.17), treadM: numeric(config.stairTread, 0.30), finishLoadKnM2: numeric(config.stairFinishLoad, 0) }).permanentRateKnM2;
      const qkRate = explicitImposed ?? numeric(config.imposedLoad, FRENCH_PROJECT_USAGE_CATALOG.habitation.stairLoad);
      const gk = provisionalFlightRate * gridArea;
      const qk = qkRate * gridArea;
      return { surface: gridArea, gk, qk, design: designLoad(gk, qk), label: "Escalier · géométrie non détaillée (charges configurées provisoires)" };
    }
    const surface = gridArea;
    const gkRate = explicitPermanent ?? floorSelfWeightRate(config) + numeric(config.finishLoad, 1) + numeric(config.ceilingLoad, 0.3) + numeric(config.partitionLoad, 1) + numeric(config.equipmentLoad, 0.5);
    const qkRate = explicitImposed ?? numeric(config.imposedLoad, FRENCH_PROJECT_USAGE_CATALOG.habitation.load);
    const gk = surface * gkRate;
    const qk = surface * qkRate;
    const label = element.type === "Balcon" ? "Balcon · dalle pleine" : config.type === "Dalle pleine" ? "Dalle pleine" : "Dalle à corps creux";
    return { surface, gk, qk, design: designLoad(gk, qk), label: `${label} · ${config.thickness} · portée ${config.span} m` };
  }
  if (element.type === "Poutre") {
    const span = Math.max(Math.hypot((element.x2 ?? element.x ?? 0) - (element.x ?? 0), (element.y2 ?? element.y ?? 0) - (element.y ?? 0)) * distance, 0.1);
    const [width, height] = dimensionsFromSection(element.section, [0.2, 0.4]);
    const gk = span * width * height * CONCRETE_UNIT_WEIGHT;
    return { surface: span, gk, qk: 0, design: GAMMA_G * gk, label: `Squelette · poutre · Poids propre ${width.toFixed(2)}×${height.toFixed(2)} m · ${span.toFixed(2)} m` };
  }
  if (element.type === "Poteau") {
    const [width, depth] = dimensionsFromSection(element.section, [0.2, 0.3]);
    const gk = width * depth * CONCRETE_UNIT_WEIGHT;
    return { surface: 1, gk, qk: 0, design: GAMMA_G * gk, label: `Squelette · poteau · Poids propre ${width.toFixed(2)}×${depth.toFixed(2)} m` };
  }
  return { surface: 1, gk: 12, qk: 0, design: GAMMA_G * 12, label: "Réaction transmise au sol" };
}
