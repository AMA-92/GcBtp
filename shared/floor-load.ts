import type { FloorConfig } from "./floor-config";
import { defaultBalconyFloorConfig, isSlabElementType } from "./floor-config";
import { FRENCH_EUROCODE_ACTION_CATALOG, FRENCH_PROJECT_USAGE_CATALOG } from "./french-load-catalog";

const GAMMA_G = FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.permanentUnfavourable;
const GAMMA_Q = FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.variableUnfavourable;

type FloorElement = { type: string; section: string; x?: number; y?: number; x2?: number; y2?: number; floorConfig?: FloorConfig };

type GridMetricPositions = { xAxisPositionsM?: number[]; yAxisPositionsM?: number[] };
const indexToMetric = (value: number, positions: number[] | undefined, fallbackStep: number) => {
  if (!positions?.length) return value * fallbackStep;
  const last = positions.length - 1;
  if (value <= 0) return positions[0];
  if (value >= last) return positions[last];
  const index = Math.floor(value);
  const ratio = value - index;
  return positions[index] + (positions[index + 1] - positions[index]) * ratio;
};

export function summarizeFloorLoads(elements: FloorElement[], gridDistance: string, fallback: FloorConfig, axisPositions: GridMetricPositions = {}) {
  const slabs = elements.filter(element => isSlabElementType(element.type));
  const distance = Math.max(Number(gridDistance.replace(",", ".")) || 4, 0.1);
  const total = slabs.reduce((sum, slab) => {
    const config = slab.floorConfig ?? (slab.type === "Balcon" ? defaultBalconyFloorConfig(fallback) : fallback);
    const span = Number(config.span.replace(",", ".")) || distance;
    const thicknesses = config.thickness.match(/\d+(?:[.,]\d+)?/g)?.map(Number) ?? [20];
    const thickness = thicknesses.reduce((a, b) => a + b, 0) / 100;
    const startX = slab.x ?? 0;
    const startY = slab.y ?? 0;
    const xStartM = indexToMetric(startX, axisPositions.xAxisPositionsM, distance);
    const yStartM = indexToMetric(startY, axisPositions.yAxisPositionsM, distance);
    const xEndM = slab.x2 === undefined ? xStartM + distance : indexToMetric(slab.x2, axisPositions.xAxisPositionsM, distance);
    const yEndM = slab.y2 === undefined ? yStartM + distance : indexToMetric(slab.y2, axisPositions.yAxisPositionsM, distance);
    const surface = Math.abs(xEndM - xStartM) * Math.abs(yEndM - yStartM);
    const selfWeight = thickness * 25;
    const permanentRate = Number(String(config.characteristicPermanentLoad ?? "").replace(",", "."));
    const imposedRate = Number(String(config.characteristicImposedLoad ?? config.imposedLoad ?? FRENCH_PROJECT_USAGE_CATALOG.habitation.load).replace(",", "."));
    const permanent = Number.isFinite(permanentRate) ? Math.max(0, permanentRate) : selfWeight + Number(config.finishLoad ?? 1) + Number(config.ceilingLoad ?? 0.3) + Number(config.partitionLoad ?? 1) + Number(config.equipmentLoad ?? 0.5);
    const live = Number.isFinite(imposedRate) ? Math.max(0, imposedRate) : FRENCH_PROJECT_USAGE_CATALOG.habitation.load;
    return { surface: sum.surface + surface, permanent: sum.permanent + permanent * surface, live: sum.live + live * surface, maxSpan: Math.max(sum.maxSpan, span) };
  }, { surface: 0, permanent: 0, live: 0, maxSpan: 0 });
  return { slabCount: slabs.filter(element => element.type === "Dalle").length, balconyCount: slabs.filter(element => element.type === "Balcon").length, floorCount: slabs.length, ...total, designLoad: GAMMA_G * total.permanent + GAMMA_Q * total.live, unit: "kN" };
}
