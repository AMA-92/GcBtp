import type { FloorConfig } from "./floor-config";
import { MATERIAL_CATALOG } from "./load-catalog";
import { calculateStairPermanentLoad } from "./stair-load";

type StructuralElement = { type: string; section: string; x?: number; y?: number; x2?: number; y2?: number; floorConfig?: FloorConfig };
const CONCRETE_UNIT_WEIGHT = MATERIAL_CATALOG.find(item => item.id === "beton-arme")?.unitWeightKnM3 ?? 25;
const dimensionsFromSection = (section: string, fallback: [number, number]) => { const match = section.match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/i); return match ? [Number(match[1].replace(",", ".")) / 100, Number(match[2].replace(",", ".")) / 100] as [number, number] : fallback; };
const floorSelfWeightRate = (config: FloorConfig) => { const parts = (config.thickness ?? "16+4 cm").match(/\d+(?:[.,]\d+)?/g)?.map(value => Number(value.replace(",", "."))) ?? [20]; if (config.type === "Dalle pleine") return CONCRETE_UNIT_WEIGHT * Math.max(0.05, parts.reduce((sum, value) => sum + value, 0) / 100); const hollow = Number((config.hollowBlockHeight ?? "16").replace(",", ".")) || 16; const compression = Number((config.compressionSlab ?? "4").replace(",", ".")) || 4; return CONCRETE_UNIT_WEIGHT * (compression / 100 + 0.08 + Math.max(0, compression - 4) * 0.01) + 0.5 + Math.max(0, hollow - 16) * 0.03; };

export function elementLoadSummary(element: StructuralElement, gridDistance: string, fallback: FloorConfig) {
  const distance = Math.max(Number(gridDistance.replace(",", ".")) || 4, 0.1);
  if (element.type === "Dalle" || element.type === "Escaliers") {
    const config = element.floorConfig ?? (element.type === "Escaliers" ? { ...fallback, type: "Dalle pleine", thickness: "15 cm", characteristicImposedLoad: "2.50", stairRiser: "0.17", stairTread: "0.30", stairRise: "2.04", stairRun: "3.60", stairFinishLoad: "0.00" } : fallback);
    const thicknesses = config.thickness.match(/\d+(?:[.,]\d+)?/g)?.map(Number) ?? [20];
    const thickness = thicknesses.reduce((a, b) => a + b, 0) / 100;
    const surface = Math.max(Math.abs((element.x2 ?? element.x ?? 0) - (element.x ?? 0)), 1) * Math.max(Math.abs((element.y2 ?? element.y ?? 0) - (element.y ?? 0)), 1) * distance * distance;
    const explicitPermanent = Number(String(config.characteristicPermanentLoad ?? "").replace(",", "."));
    const explicitImposed = Number(String(config.characteristicImposedLoad ?? "").replace(",", "."));
    const hasStairParameters = element.type === "Escaliers" && (Boolean(config.stairRiser || config.stairTread || config.stairRise || config.stairRun) || explicitPermanent === 3.75);
    const stairRate = hasStairParameters ? calculateStairPermanentLoad({ widthM: 1.2, horizontalRunM: Number(config.stairRun ?? 3.6), riseM: Number(config.stairRise ?? 2.04), slabThicknessM: thickness, concreteDensityKnM3: CONCRETE_UNIT_WEIGHT, stepHeightM: Number(config.stairRiser ?? 0.17), treadM: Number(config.stairTread ?? 0.30), finishLoadKnM2: Number(config.stairFinishLoad ?? 0) }) : null;
    const gkRate = hasStairParameters ? stairRate!.permanentRateKnM2 : Number.isFinite(explicitPermanent) ? Math.max(0, explicitPermanent) : floorSelfWeightRate(config);
    const qkRate = Number.isFinite(explicitImposed) ? Math.max(0, explicitImposed) : Number(config.imposedLoad ?? 2);
    const gk = surface * gkRate;
    const qk = surface * qkRate;
    return { surface, gk, qk, design: 1.35 * gk + 1.5 * qk, label: `${config.type} · portée ${config.span} m` };
  }
  if (element.type === "Poutre") {
    const span = Math.max(Math.hypot((element.x2 ?? element.x ?? 0) - (element.x ?? 0), (element.y2 ?? element.y ?? 0) - (element.y ?? 0)) * distance, 0.1);
    const [width, height] = dimensionsFromSection(element.section, [0.2, 0.4]);
    const gk = span * width * height * CONCRETE_UNIT_WEIGHT;
    return { surface: span, gk, qk: 0, design: 1.35 * gk, label: `Poids propre ${width.toFixed(2)}×${height.toFixed(2)} m · ${span.toFixed(2)} m` };
  }
  if (element.type === "Poteau") {
    const [width, depth] = dimensionsFromSection(element.section, [0.2, 0.3]);
    const gk = width * depth * CONCRETE_UNIT_WEIGHT;
    return { surface: 1, gk, qk: 0, design: 1.35 * gk, label: `Poids propre ${width.toFixed(2)}×${depth.toFixed(2)} m` };
  }
  return { surface: 1, gk: 12, qk: 0, design: 16.2, label: "Réaction transmise au sol" };
}
