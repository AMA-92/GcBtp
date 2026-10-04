import { cumulativeGridPositions } from "./proportional-grid";
import { resolveConcreteMaterial } from "./model-catalog";
import { columnBaseElevation, elementElevation, levelElevation, postTopElevation } from "./vertical-structure";

export const ANALYTICAL_SCHEMA_VERSION = 2 as const;
export const ANALYTICAL_UNITS = { length: "m", force: "kN", stress: "kN/m²", moment: "kN·m" } as const;
export const DEFAULT_NODE_MERGE_TOLERANCE_M = 0.01;

export type DegreeOfFreedom = "ux" | "uy" | "uz" | "rx" | "ry" | "rz";
export type AnalyticalNode = { id: string; x: number; y: number; z: number; levelIds: string[]; sourceElementIds: string[] };
export type AnalyticalFrame = { id: string; sourceElementId: string; sourceType: string; startNodeId: string; endNodeId: string; sectionId: string; materialId: string; levelId: string; releases: { start: DegreeOfFreedom[]; end: DegreeOfFreedom[] }; eccentricityM: { start: [number, number, number]; end: [number, number, number] } };
export type AnalyticalSurface = { id: string; sourceElementId: string; sourceType: string; kind: "slab" | "wall" | "stair-flight" | "footing"; nodeIds: string[]; sectionId: string; materialId: string; levelId: string; openings: Array<{ nodeIds: string[] }> };
export type AnalyticalSupportKind = "fixed-base" | "articulated" | "sliding" | "elastic" | "contact";
export type AnalyticalSupport = { id: string; sourceElementId: string; nodeId: string; kind: AnalyticalSupportKind; role: "foundation-contact" | "column-base"; restrainedDofs: DegreeOfFreedom[]; stiffness?: Partial<Record<DegreeOfFreedom, number>>; selectionReason: string; status: "inferred-from-footing" | "declared" };
export type AnalyticalConnection = { id: string; sourceElementId: string; targetElementId: string; type: "monolithic" | "articulated" | "sliding" | "elastic" | "contact"; transmitted: Array<"N" | "Vx" | "Vy" | "Mx" | "My" | "Mz">; role: "stair-flight" | "intermediate-landing" | "arrival-landing" | "structural" };
export type MaterialProperty = { id: string; name: string; elasticModulusKnM2: number; poissonRatio: number; densityKnM3: number; provenance: "model-catalog" | "provisional-default"; concreteClass?: "C25/30" | "C30/37" | "C35/45"; fckMpa?: number; fcdMpa?: number; fctmMpa?: number; coverMm?: number };
export type SectionProperty = { id: string; name: string; shape: "rectangle" | "circle" | "unknown"; dimensionsM: number[]; areaM2: number | null; inertiaY4M4: number | null; inertiaZ4M4: number | null; torsionConstantM4?: number | null; provenance: "model-catalog" | "unresolved" };
export type MeshProperty = { globalSizeM: number; maxAspectRatio: number; refinementRegions: Array<{ elementId: string; sizeM: number }> };
export type AnalyticalDiagnostic = { severity: "error" | "warning"; code: string; message: string; elementIds: string[]; levelId?: string };
export type AnalyticalModel = { schemaVersion: typeof ANALYTICAL_SCHEMA_VERSION; units: typeof ANALYTICAL_UNITS; nodeMergeToleranceM: number; nodes: AnalyticalNode[]; frames: AnalyticalFrame[]; surfaces: AnalyticalSurface[]; supports: AnalyticalSupport[]; connections?: AnalyticalConnection[]; materials: MaterialProperty[]; sections: SectionProperty[]; mesh: MeshProperty; sourceElementIds: string[] };
export type AnalyticalPrecheck = { ok: boolean; errors: AnalyticalDiagnostic[]; warnings: AnalyticalDiagnostic[]; checkedNodeCount: number; checkedFrameCount: number; checkedSurfaceCount: number; supportedComponentCount: number };

export type AnalyticalGraphicElement = {
  id: string; type: string; section?: string; x: number; y: number; x2?: number; y2?: number; xM?: number; yM?: number; x2M?: number; y2M?: number; xMidM?: number; yMidM?: number;
  absoluteStairGeometry?: {
    flight1?: { lowerA: {x:number;y:number}; lowerB: {x:number;y:number}; upperA: {x:number;y:number}; upperB: {x:number;y:number}; lowerLevelId: string; upperLevelId: string };
    flight2?: { lowerA: {x:number;y:number}; lowerB: {x:number;y:number}; upperA: {x:number;y:number}; upperB: {x:number;y:number}; lowerLevelId: string; upperLevelId: string };
  };
  stairGeometry?: {
    flight1?: { lowerA: {x:number;y:number}; lowerB: {x:number;y:number}; upperA: {x:number;y:number}; upperB: {x:number;y:number}; lowerLevelId: string; upperLevelId: string };
    flight2?: { lowerA: {x:number;y:number}; lowerB: {x:number;y:number}; upperA: {x:number;y:number}; upperB: {x:number;y:number}; lowerLevelId: string; upperLevelId: string };
  };
};
export type AnalyticalGraphicLevel = { id: string; label: string; elevation: string; height?: string; elements: AnalyticalGraphicElement[] };
export type AnalyticalModelInput = {
  levels: AnalyticalGraphicLevel[];
  xDistancesM: number[];
  yDistancesM: number[];
  nodeMergeToleranceM?: number;
  structure?: string;
  modelCatalog?: Array<{ type: string; name: string; dimensions: string }>;
  concreteClass?: "C25/30" | "C30/37" | "C35/45";
  globalMeshSizeM?: number;
  foundationSupportKind?: AnalyticalSupportKind;
  foundationSpringStiffness?: Partial<Record<DegreeOfFreedom, number>>;
};
type StairFlight = NonNullable<NonNullable<AnalyticalGraphicElement["stairGeometry"]>["flight1"]>;

const DOFS: DegreeOfFreedom[] = ["ux", "uy", "uz", "rx", "ry", "rz"];
const finite = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const positive = (value: number, fallback: number) => Number.isFinite(value) && value > 0 ? value : fallback;
const pointDistance = (a: Pick<AnalyticalNode,"x"|"y"|"z">, b: Pick<AnalyticalNode,"x"|"y"|"z">) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

function coordinateAt(index: number, positions: number[]) {
  if (!positions.length) return index;
  if (positions.length === 1) return positions[0] + index * 4;
  if (index < 0) return positions[0] + index * (positions[1] - positions[0]);
  const last = positions.length - 1;
  if (index >= last) return positions[last] + (index - last) * (positions[last] - positions[last - 1]);
  const segment = Math.floor(index);
  const ratio = index - segment;
  return positions[segment] + ratio * (positions[segment + 1] - positions[segment]);
}

function indexAtCoordinate(coordinate: number, positions: number[]) {
  if (positions.length < 2) return coordinate / 4;
  if (coordinate <= positions[0]) return (coordinate - positions[0]) / (positions[1] - positions[0]);
  const last = positions.length - 1;
  if (coordinate >= positions[last]) return last + (coordinate - positions[last]) / (positions[last] - positions[last - 1]);
  const segment = positions.findIndex((position,index) => index < last && coordinate >= position && coordinate <= positions[index + 1]);
  if (segment < 0) return 0;
  return segment + (coordinate - positions[segment]) / (positions[segment + 1] - positions[segment]);
}

function parseDimensions(text: string | undefined, catalog: AnalyticalModelInput["modelCatalog"]) {
  const full = catalog?.find(item => item.name === text)?.dimensions ?? "";
  const values = (full.match(/\d+(?:[.,]\d+)?/g) ?? []).map(value => Number(value.replace(",", "."))).filter(value => Number.isFinite(value) && value > 0);
  return values;
}

function buildSection(type: string, name: string | undefined, catalog: AnalyticalModelInput["modelCatalog"]): SectionProperty {
  const dimensionsM = parseDimensions(name, catalog);
  const id = `section:${type}:${name || "unknown"}`;
  if (!dimensionsM.length) return { id, name: name || "Section non résolue", shape: "unknown", dimensionsM: [], areaM2: null, inertiaY4M4: null, inertiaZ4M4: null, torsionConstantM4: null, provenance: "unresolved" };
  if (/circulaire|pot_d|\bcircle\b/i.test(`${type} ${name ?? ""}`) || dimensionsM.length === 1) {
    const diameter = dimensionsM[0];
    const area = Math.PI * diameter ** 2 / 4;
    const inertia = Math.PI * diameter ** 4 / 64;
    return { id, name: name || "Section circulaire", shape: "circle", dimensionsM, areaM2: area, inertiaY4M4: inertia, inertiaZ4M4: inertia, torsionConstantM4: Math.PI * diameter ** 4 / 32, provenance: "model-catalog" };
  }
  const [width, depth] = dimensionsM;
  const area = width * depth;
  const a = Math.max(width, depth), c = Math.min(width, depth); const ratio = c / a; const jt = a * c ** 3 * (1 / 3 - 0.21 * ratio * (1 - ratio ** 4 / 12)); return { id, name: name || "Section rectangulaire", shape: "rectangle", dimensionsM, areaM2: area, inertiaY4M4: width * depth ** 3 / 12, inertiaZ4M4: depth * width ** 3 / 12, torsionConstantM4: jt, provenance: "model-catalog" };
}

function materialForStructure(structure: string | undefined, concreteClass: "C25/30" | "C30/37" | "C35/45" = "C25/30"): MaterialProperty {
  const normalized = (structure ?? "").toLowerCase();
  if (normalized.includes("acier")) return { id: "material:default-steel", name: "Acier — valeur générique provisoire", elasticModulusKnM2: 210_000_000, poissonRatio: 0.3, densityKnM3: 78.5, provenance: "provisional-default" };
  if (normalized.includes("bois")) return { id: "material:default-timber", name: "Bois — valeur générique provisoire", elasticModulusKnM2: 11_000_000, poissonRatio: 0.3, densityKnM3: 5, provenance: "provisional-default" };
  if (normalized.includes("maçon") || normalized.includes("macon")) return { id: "material:default-masonry", name: "Maçonnerie — valeur générique provisoire", elasticModulusKnM2: 1_500_000, poissonRatio: 0.2, densityKnM3: 18, provenance: "provisional-default" };
  const concrete = resolveConcreteMaterial(concreteClass);
  return {
    id: `material:concrete:${concrete.concreteClass}`,
    name: `Béton ${concrete.concreteClass} — catalogue`,
    elasticModulusKnM2: concrete.Ecm,
    poissonRatio: concrete.poissonRatio,
    densityKnM3: concrete.density,
    provenance: "model-catalog",
    concreteClass: concrete.concreteClass,
    fckMpa: concrete.fck,
    fcdMpa: concrete.fcd,
    fctmMpa: concrete.fctm,
    coverMm: concrete.cover,
  };
}
