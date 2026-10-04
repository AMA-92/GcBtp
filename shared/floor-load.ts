import type { FloorConfig } from "./floor-config";

type FloorElement = { type: string; section: string; x?: number; y?: number; x2?: number; y2?: number; floorConfig?: FloorConfig };

export function summarizeFloorLoads(elements: FloorElement[], gridDistance: string, fallback: FloorConfig) {
  const slabs = elements.filter(element => element.type === "Dalle");
  const distance = Math.max(Number(gridDistance.replace(",", ".")) || 4, 0.1);
  const total = slabs.reduce((sum, slab) => {
    const config = slab.floorConfig ?? fallback;
    const span = Number(config.span.replace(",", ".")) || distance;
    const thicknesses = config.thickness.match(/\d+(?:[.,]\d+)?/g)?.map(Number) ?? [20];
    const thickness = thicknesses.reduce((a, b) => a + b, 0) / 100;
    const startX = slab.x ?? 0;
    const startY = slab.y ?? 0;
    const surface = Math.max(Math.abs((slab.x2 ?? startX) - startX), 1) * Math.max(Math.abs((slab.y2 ?? startY) - startY), 1) * distance * distance;
    const selfWeight = thickness * 25;
    const permanent = config.type === "Corps creux" ? selfWeight + 1.2 : selfWeight;
    return { surface: sum.surface + surface, permanent: sum.permanent + permanent * surface, live: sum.live + 2 * surface, maxSpan: Math.max(sum.maxSpan, span) };
  }, { surface: 0, permanent: 0, live: 0, maxSpan: 0 });
  return { slabCount: slabs.length, ...total, designLoad: 1.35 * total.permanent + 1.5 * total.live, unit: "kN" };
}
