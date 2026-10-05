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
export type AnalyticalSupport = { id: string; sourceElementId: string; nodeId: string; kind: AnalyticalSupportKind; role: "foundation-contact" | "column-base" | "stair-slab-contact"; restrainedDofs: DegreeOfFreedom[]; stiffness?: Partial<Record<DegreeOfFreedom, number>>; selectionReason: string; status: "inferred-from-footing" | "declared" };
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
  return { id: `material:concrete:${concrete.concreteClass}`, name: `Béton ${concrete.concreteClass} — catalogue`, elasticModulusKnM2: concrete.Ecm, poissonRatio: concrete.poissonRatio, densityKnM3: concrete.density, provenance: "model-catalog", concreteClass: concrete.concreteClass, fckMpa: concrete.fck, fcdMpa: concrete.fcd, fctmMpa: concrete.fctm, coverMm: concrete.cover };
}

export function buildAnalyticalModel(input: AnalyticalModelInput): { model: AnalyticalModel; precheck: AnalyticalPrecheck } {
  const tolerance = Math.min(Math.max(positive(finite(input.nodeMergeToleranceM, DEFAULT_NODE_MERGE_TOLERANCE_M), DEFAULT_NODE_MERGE_TOLERANCE_M), 0.001), 0.25);
  const xPositions = cumulativeGridPositions(input.xDistancesM.map(value => positive(value, 4)), Math.max(2, input.xDistancesM.length + 1));
  const yPositions = cumulativeGridPositions(input.yDistancesM.map(value => positive(value, 4)), Math.max(2, input.yDistancesM.length + 1));
  const nodes: AnalyticalNode[] = [];
  const frames: AnalyticalFrame[] = [];
  const surfaces: AnalyticalSurface[] = [];
  const supports: AnalyticalSupport[] = [];
  const connections: AnalyticalConnection[] = [];
  const sections = new Map<string, SectionProperty>();
  const diagnostics: AnalyticalDiagnostic[] = [];
  const material = materialForStructure(input.structure, input.concreteClass);
  const levels = input.levels;
  const levelById = new Map(levels.map((level, index) => [level.id, { level, index }]));
  const elements = levels.flatMap(level => level.elements.map(element => ({ ...element, levelId: level.id })));
  const elementById = new Map(elements.map(element => [element.id, element]));
  const stairSurfaceInterfaces: Array<[string, string]> = [];
  const nodeForMetric = (x: number, y: number, z: number, levelId: string, elementId: string) => {
    const point = { x: finite(x), y: finite(y), z: finite(z) };
    const prior = nodes.find(node => pointDistance(node, point) <= tolerance);
    if (prior) {
      if (!prior.levelIds.includes(levelId)) prior.levelIds.push(levelId);
      if (!prior.sourceElementIds.includes(elementId)) prior.sourceElementIds.push(elementId);
      return prior.id;
    }
    const node: AnalyticalNode = { id: `N${String(nodes.length + 1).padStart(5,"0")}`, ...point, levelIds: [levelId], sourceElementIds: [elementId] };
    nodes.push(node);
    return node.id;
  };
  const nodeFor = (xIndex: number, yIndex: number, z: number, levelId: string, elementId: string) =>
    nodeForMetric(coordinateAt(xIndex, xPositions), coordinateAt(yIndex, yPositions), z, levelId, elementId);
  const sectionFor = (type: string, name?: string) => {
    const value = buildSection(type, name, input.modelCatalog);
    sections.set(value.id, value);
    if (value.provenance === "unresolved") diagnostics.push({ severity: "error", code: "section-unresolved", message: `Section « ${name || "non renseignée"} » non résolue dans le catalogue ; les propriétés nécessaires au solveur sont inconnues.`, elementIds: elements.filter(element => element.type === type && element.section === name).map(element => element.id) });
    return value;
  };
  const addFrame = (element: AnalyticalGraphicElement & { levelId: string }, start: [number,number,number], end: [number,number,number], sourceType = element.type) => {
    const section = sectionFor(element.type, element.section);
    const startNodeId = nodeForMetric(start[0], start[1], start[2], element.levelId, element.id);
    const endNodeId = nodeForMetric(end[0], end[1], end[2], element.levelId, element.id);
    frames.push({ id: `F:${element.id}`, sourceElementId: element.id, sourceType, startNodeId, endNodeId, sectionId: section.id, materialId: material.id, levelId: element.levelId, releases: { start: [], end: [] }, eccentricityM: { start: [0,0,0], end: [0,0,0] } });
  };
  const addSurface = (element: AnalyticalGraphicElement & { levelId: string }, kind: AnalyticalSurface["kind"], points: Array<[number,number,number]>, section = sectionFor(element.type, element.section)) => {
    // Deux côtés d’un palier peuvent partager exactement le même sommet.
    // Le conserver deux fois créait des contours dégénérés dans l’export.
    const nodeIds = Array.from(new Set(points.map(point => nodeForMetric(point[0], point[1], point[2], element.levelId, element.id))));
    surfaces.push({ id: `S:${element.id}:${surfaces.filter(surface => surface.sourceElementId === element.id).length + 1}`, sourceElementId: element.id, sourceType: element.type, kind, nodeIds, sectionId: section.id, materialId: material.id, levelId: element.levelId, openings: [] });
  };

  for (const element of elements) {
    const levelRecord = levelById.get(element.levelId);
    if (!levelRecord) continue;
    const { level, index } = levelRecord;
    const x = finite(element.x), y = finite(element.y), x2 = finite(element.x2, x), y2 = finite(element.y2, y);
    const xM = Number.isFinite(Number(element.xM)) ? Number(element.xM) : coordinateAt(x, xPositions);
    const yM = Number.isFinite(Number(element.yM)) ? Number(element.yM) : coordinateAt(y, yPositions);
    const x2M = Number.isFinite(Number(element.x2M)) ? Number(element.x2M) : coordinateAt(x2, xPositions);
    const y2M = Number.isFinite(Number(element.y2M)) ? Number(element.y2M) : coordinateAt(y2, yPositions);
    const baseZ = levelElevation(level, index);
    if (element.type === "Poteau") {
      addFrame(element, [xM,yM,columnBaseElevation(levels,index)], [xM,yM,postTopElevation(level,index)]);
    } else if (element.type === "Poutre") {
      if (element.x2 === undefined || element.y2 === undefined) {
        diagnostics.push({ severity: "error", code: "beam-endpoint-missing", message: `Poutre ${element.id} sans deux extrémités définies.`, elementIds: [element.id], levelId: element.levelId });
        continue;
      }
      const z = postTopElevation(level,index);
      addFrame(element, [xM,yM,z], [x2M,y2M,z]);
    } else if (element.type === "Longrine de redressement") {
      if (element.x2 === undefined || element.y2 === undefined) {
        diagnostics.push({ severity: "error", code: "tie-beam-endpoint-missing", message: `Longrine ${element.id} sans deux appuis définis.`, elementIds: [element.id], levelId: element.levelId });
        continue;
      }
      addFrame(element, [xM,yM,elementElevation(level,index,element.type)], [x2M,y2M,elementElevation(level,index,element.type)]);
    } else if (element.type === "Dalle") {
      if (element.x2 === undefined || element.y2 === undefined || Math.abs(x2-x) < 1e-8 || Math.abs(y2-y) < 1e-8) {
        diagnostics.push({ severity: "error", code: "slab-invalid-contour", message: `Dalle ${element.id} n’a pas un contour rectangulaire valide.`, elementIds: [element.id], levelId: element.levelId });
        continue;
      }
      const z = elementElevation(level,index,element.type);
      addSurface(element,"slab",[[xM,yM,z],[x2M,yM,z],[x2M,y2M,z],[xM,y2M,z]]);
    } else if (element.type === "Voile") {
      if (element.x2 === undefined || element.y2 === undefined || Math.hypot(x2-x,y2-y) < 1e-8) {
        diagnostics.push({ severity: "error", code: "wall-invalid-axis", message: `Voile ${element.id} n’a pas un axe valide.`, elementIds: [element.id], levelId: element.levelId });
        continue;
      }
      const top = baseZ + Math.max(positive(finite(level.height,3.2),3.2),0.1);
      addSurface(element,"wall",[[xM,yM,baseZ],[x2M,y2M,baseZ],[x2M,y2M,top],[xM,yM,top]]);
    } else if (element.type === "Semelle") {
      const dims = parseDimensions(element.section,input.modelCatalog);
      const width = dims[0] ?? 1;
      const depth = dims[1] ?? width;
      const z = elementElevation(level,index,element.type);
      const halfX = width/2, halfY = depth/2;
      const centerX = xM, centerY = yM;
      const xA = centerX-halfX, xB = centerX+halfX;
      const yA = centerY-halfY, yB = centerY+halfY;
      addSurface(element,"footing",[[xA,yA,z],[xB,yA,z],[xB,yB,z],[xA,yB,z]]);
    } else if (element.type === "Escaliers") {
      const host = levelById.get(element.levelId);
      const rawFlights = [element.stairGeometry?.flight1, element.stairGeometry?.flight2].filter((flight): flight is StairFlight => Boolean(flight));
      // Les anciens projets pouvaient conserver le niveau de la volée 2 après
      // une duplication d’escalier. Le niveau hôte est le palier intermédiaire:
      // volée 1 = niveau précédent → hôte, volée 2 = hôte → niveau suivant.
      // On ne modifie que les références incohérentes, jamais la géométrie XY.
      const flights = rawFlights.map((flight, flightIndex) => {
        if (!host || host.index <= 0 || rawFlights.length < 2) return flight;
        if (flightIndex === 0 && flight.upperLevelId === host.level.id) {
          return { ...flight, lowerLevelId: levels[host.index - 1]?.id ?? flight.lowerLevelId, upperLevelId: host.level.id };
        }
        if (flightIndex === 1 && rawFlights[0]?.upperLevelId === host.level.id) {
          return { ...flight, lowerLevelId: host.level.id, upperLevelId: levels[host.index + 1]?.id ?? flight.upperLevelId };
        }
        return flight;
      });
      if (!flights.length) {
        diagnostics.push({ severity: "warning", code: "stair-geometry-unresolved", message: `Escalier ${element.id} sans géométrie de volée explicite ; géométrie analytique omise.`, elementIds: [element.id], levelId: element.levelId });
      }
      flights.forEach((flight, flightIndex) => {
        const lower = levelById.get(flight.lowerLevelId);
        const upper = levelById.get(flight.upperLevelId);
        if (!lower || !upper) {
          diagnostics.push({ severity: "error", code: "stair-level-unresolved", message: `Escalier ${element.id} référence un niveau absent.`, elementIds: [element.id], levelId: element.levelId });
          return;
        }
        const absoluteFlight = element.absoluteStairGeometry?.[`flight${flightIndex + 1}` as "flight1" | "flight2"];
        const point = (value: {x:number;y:number}, z: number): [number,number,number] => [absoluteFlight ? value.x : coordinateAt(value.x, xPositions), absoluteFlight ? value.y : coordinateAt(value.y, yPositions), z];
        // Les extrémités des volées arrivent sur le dessus du plancher/palier,
        // donc à la même cote que les poutres et les dalles porteuses. Utiliser
        // levelElevation() ici plaçait la volée en pied de niveau et empêchait
        // toute fusion avec les appuis supérieurs.
        const z0 = elementElevation(lower.level, lower.index, "Dalle"), z1 = elementElevation(upper.level, upper.index, "Dalle");
        const flightGeometry = absoluteFlight ?? flight; const nodePoints = [point(flightGeometry.lowerA,z0),point(flightGeometry.lowerB,z0),point(flightGeometry.upperB,z1),point(flightGeometry.upperA,z1)];
        const section = sectionFor(element.type,element.section);
        addSurface({...element,id:`${element.id}:volée-${flightIndex+1}`} as AnalyticalGraphicElement & {levelId:string},"stair-flight",nodePoints,section);
      });
      if (flights.length >= 2) {
        const first = flights[0];
        const second = flights[1];
        const middle = levelById.get(first.upperLevelId);
        const upper = levelById.get(second.upperLevelId);
        if (middle) {
          const z = elementElevation(middle.level, middle.index, "Dalle");
          addSurface({...element, id: `${element.id}:palier-intermediaire`} as AnalyticalGraphicElement & { levelId: string }, "stair-flight", [
            [element.absoluteStairGeometry?.flight1?.upperA.x ?? coordinateAt(first.upperA.x, xPositions), element.absoluteStairGeometry?.flight1?.upperA.y ?? coordinateAt(first.upperA.y, yPositions), z],
            [element.absoluteStairGeometry?.flight1?.upperB.x ?? coordinateAt(first.upperB.x, xPositions), element.absoluteStairGeometry?.flight1?.upperB.y ?? coordinateAt(first.upperB.y, yPositions), z],
            [element.absoluteStairGeometry?.flight2?.lowerB.x ?? coordinateAt(second.lowerB.x, xPositions), element.absoluteStairGeometry?.flight2?.lowerB.y ?? coordinateAt(second.lowerB.y, yPositions), z],
            [element.absoluteStairGeometry?.flight2?.lowerA.x ?? coordinateAt(second.lowerA.x, xPositions), element.absoluteStairGeometry?.flight2?.lowerA.y ?? coordinateAt(second.lowerA.y, yPositions), z],
          ], sectionFor(element.type, element.section));
        }
        if (upper) {
          const run = { x: second.upperA.x - second.lowerA.x, y: second.upperA.y - second.lowerA.y };
          const runLength = Math.max(Math.hypot(run.x, run.y), 0.001);
          const depth = { x: run.x / runLength, y: run.y / runLength };
          const edge = { x: second.upperB.x - second.upperA.x, y: second.upperB.y - second.upperA.y };
          const edgeLength = Math.max(Math.hypot(edge.x, edge.y), 0.001);
          const lateral = { x: -edge.y / edgeLength, y: edge.x / edgeLength };
          const start = second.upperB;
          const z = elementElevation(upper.level, upper.index, "Dalle");
          const corner = (x: number, y: number): [number, number, number] => [coordinateAt(x, xPositions), coordinateAt(y, yPositions), z];
          addSurface({...element, id: `${element.id}:palier-arrivee`} as AnalyticalGraphicElement & { levelId: string }, "stair-flight", [
            corner(start.x, start.y),
            corner(start.x + lateral.x * 2, start.y + lateral.y * 2),
            corner(start.x + lateral.x * 2 + depth.x, start.y + lateral.y * 2 + depth.y),
            corner(start.x + depth.x, start.y + depth.y),
          ], sectionFor(element.type, element.section));
        }
      }
    }
  }

  const pointToSegmentDistance = (point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) => {
    const dx = end.x - start.x, dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared > 0 ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)) : 0;
    return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
  };
  const structuralNodes = nodes.filter(node => node.sourceElementIds.some(id => {
    const type = elementById.get(id)?.type;
    return type === "Poteau" || type === "Poutre";
  }));
  for (const surface of surfaces.filter(item => item.kind === "stair-flight")) {
    const stairNodes = surface.nodeIds.map(id => nodes.find(node => node.id === id)).filter((node): node is AnalyticalNode => Boolean(node));
    const connected = new Set<string>();
    for (const stairNode of stairNodes) {
      for (const structuralNode of structuralNodes) {
        const isNearNode = Math.hypot(stairNode.x - structuralNode.x, stairNode.y - structuralNode.y) <= tolerance;
        const beam = structuralNode.sourceElementIds.map(id => elementById.get(id)).find(item => item?.type === "Poutre");
        const isOnBeam = beam?.x2 !== undefined && beam.y2 !== undefined && pointToSegmentDistance(
          stairNode,
          { x: coordinateAt(beam.x, xPositions), y: coordinateAt(beam.y, yPositions) },
          { x: coordinateAt(beam.x2, xPositions), y: coordinateAt(beam.y2, yPositions) },
        ) <= tolerance;
        if (isNearNode || isOnBeam) connected.add(structuralNode.id);
      }
    }
    // La première volée démarre sur le plancher porteur. Ce contact vertical
    // explicite représente les deux appuis bas de la volée, même lorsqu’aucun
    // poteau ou aucune poutre n’est dessiné exactement sous ces points.
    const stairElementId = surface.sourceElementId.split(":")[0];
    const stairElement = elementById.get(stairElementId);
    const firstFlight = stairElement?.stairGeometry?.flight1;
    const isFirstFlightSlabContact = surface.sourceElementId.includes(":volée-1") && Boolean(firstFlight);
    if (isFirstFlightSlabContact) {
      const lowestZ = Math.min(...stairNodes.map(node => node.z));
      stairNodes.filter(node => Math.abs(node.z - lowestZ) <= tolerance).forEach(node => {
        const supportId = `SUP:${stairElementId}:dallage:${node.id}`;
        if (!supports.some(support => support.id === supportId)) supports.push({ id: supportId, sourceElementId: stairElementId, nodeId: node.id, kind: "contact", role: "stair-slab-contact", restrainedDofs: ["uz"], selectionReason: "Contact vertical de l’un des deux appuis bas de la première volée avec le plancher porteur.", status: "declared" });
        connected.add(node.id);
      });
    }
    connected.forEach(structuralNodeId => stairNodes.forEach(stairNode => {
      stairSurfaceInterfaces.push([stairNode.id, structuralNodeId]);
      const structuralIds = nodes.find(node => node.id === structuralNodeId)?.sourceElementIds ?? [];
      const targetElementId = structuralIds.find(id => elementById.get(id)?.type === "Poutre" || elementById.get(id)?.type === "Poteau" || elementById.get(id)?.type === "Voile");
      if (targetElementId) connections.push({ id: `CON:${surface.sourceElementId}:${targetElementId}:${stairNode.id}`, sourceElementId: surface.sourceElementId.split(":")[0], targetElementId, type: "monolithic", transmitted: ["N", "Vx", "Vy", "Mx", "My", "Mz"], role: surface.sourceElementId.includes("palier-intermediaire") ? "intermediate-landing" : surface.sourceElementId.includes("palier-arrivee") ? "arrival-landing" : "stair-flight" });
    }));
    if (!connected.size) diagnostics.push({ severity: "error", code: "stair-support-missing", message: `Escalier ${surface.sourceElementId} sans appui connecté : le palier ou la volée ne rejoint ni poteau ni poutre.`, elementIds: [surface.sourceElementId], levelId: surface.levelId });
  }

  // Infer fixed supports only at column bases having an actual footing at the same plan location.
  const columns = elements.filter(element => element.type === "Poteau");
  const footings = elements.filter(element => element.type === "Semelle");
  const foundationIndex = levels.findIndex(level => /fondation/i.test(level.label) || /fondation/i.test(level.id));
  const firstSupportedLevelIndex = foundationIndex >= 0 ? foundationIndex + 1 : 0;
  const supportLevelIndex = foundationIndex >= 0 && columns.some(column => levelById.get(column.levelId)?.index === foundationIndex)
    ? foundationIndex
    : firstSupportedLevelIndex;
  for (const column of columns) {
    const levelRecord = levelById.get(column.levelId);
    if (!levelRecord) continue;
    const { level, index } = levelRecord;
    // Les poteaux des étages supérieurs transmettent leurs efforts aux poteaux
    // inférieurs ; ils ne constituent pas de nouveaux appuis au sol.
    if (index !== supportLevelIndex) continue;
    const footing = footings.find(candidate => {
      const dx = coordinateAt(candidate.x,xPositions)-coordinateAt(column.x,xPositions);
      const dy = coordinateAt(candidate.y,yPositions)-coordinateAt(column.y,yPositions);
      return Math.hypot(dx,dy) <= tolerance;
    });
    const baseNode = nodes.find(node => node.sourceElementIds.includes(column.id) && Math.abs(node.x-coordinateAt(column.x,xPositions))<=tolerance && Math.abs(node.y-coordinateAt(column.y,yPositions))<=tolerance && Math.abs(node.z-columnBaseElevation(levels,index))<=tolerance);
    if (!baseNode) continue;
    if (!footing) {
      diagnostics.push({ severity: "error", code: "column-without-footing", message: `Poteau ${column.id} sans semelle détectée sous son axe ; l’appui n’est pas inféré.`, elementIds: [column.id], levelId: column.levelId });
      continue;
    }
    const kind = input.foundationSupportKind ?? "fixed-base";
    const restrainedDofs: DegreeOfFreedom[] = kind === "articulated" ? ["ux", "uy", "uz"] : kind === "sliding" ? ["uy", "uz"] : kind === "contact" ? ["uz"] : kind === "elastic" ? [] : [...DOFS];
    supports.push({ id: `SUP:${footing.id}:${column.id}`, sourceElementId: footing.id, nodeId: baseNode.id, kind, role: "column-base", restrainedDofs, stiffness: kind === "elastic" ? input.foundationSpringStiffness : undefined, selectionReason: input.foundationSupportKind ? `Type déclaré par le projet : ${kind}.` : "Poteau directement posé sur une semelle identifiée au même nœud ; encastrement de base retenu par défaut.", status: input.foundationSupportKind ? "declared" : "inferred-from-footing" });
  }

  // Explicitly flag beam end nodes that have no member reaching them (typical floating beam case).
  const frameDegree = new Map<string, number>();
  for (const frame of frames) {
    frameDegree.set(frame.startNodeId,(frameDegree.get(frame.startNodeId) ?? 0)+1);
    frameDegree.set(frame.endNodeId,(frameDegree.get(frame.endNodeId) ?? 0)+1);
    const start = nodes.find(node => node.id === frame.startNodeId)!;
    const end = nodes.find(node => node.id === frame.endNodeId)!;
    if (pointDistance(start,end) <= tolerance * 0.1) diagnostics.push({ severity: "error", code: "zero-length-frame", message: `Barre ${frame.sourceElementId} de longueur nulle ou inférieure à la tolérance.`, elementIds: [frame.sourceElementId], levelId: frame.levelId });
  }
  for (const frame of frames.filter(item => item.sourceType === "Poutre")) {
    for (const [endName,nodeId] of [["départ",frame.startNodeId],["arrivée",frame.endNodeId]] as const) {
      if ((frameDegree.get(nodeId) ?? 0) < 2) diagnostics.push({ severity: "error", code: "beam-floating-end", message: `Extrémité ${endName} de la poutre ${frame.sourceElementId} sans élément porteur connecté.`, elementIds: [frame.sourceElementId], levelId: frame.levelId });
    }
  }

  // Build member/surface connectivity graph, then prove each component reaches an inferred support.
  const adjacency = new Map(nodes.map(node => [node.id,new Set<string>()]));
  const connect = (a: string,b: string) => { if (a === b) return; adjacency.get(a)?.add(b); adjacency.get(b)?.add(a); };
  for (const frame of frames) connect(frame.startNodeId,frame.endNodeId);
  stairSurfaceInterfaces.forEach(([stairNodeId, structuralNodeId]) => connect(stairNodeId, structuralNodeId));
  for (const surface of surfaces) {
    for (let index=0; index<surface.nodeIds.length; index++) connect(surface.nodeIds[index],surface.nodeIds[(index+1)%surface.nodeIds.length]);
  }
  const supported = new Set<string>();
  const queue = supports.map(support => support.nodeId);
  queue.forEach(nodeId => supported.add(nodeId));
  while (queue.length) {
    const current = queue.shift()!;
    for (const neighbor of Array.from(adjacency.get(current) ?? [])) if (!supported.has(neighbor)) { supported.add(neighbor); queue.push(neighbor); }
  }
  for (const frame of frames) {
    if (!supported.has(frame.startNodeId) || !supported.has(frame.endNodeId)) diagnostics.push({ severity: "error", code: "unsupported-frame-component", message: `La barre ${frame.sourceElementId} n’appartient pas à un chemin connecté jusqu’à une semelle/appui.`, elementIds: [frame.sourceElementId], levelId: frame.levelId });
  }
  for (const surface of surfaces.filter(item => item.kind === "slab" || item.kind === "wall" || item.kind === "stair-flight")) {
    if (!surface.nodeIds.some(nodeId => supported.has(nodeId))) diagnostics.push({ severity: "error", code: "unsupported-surface", message: `${surface.sourceType} ${surface.sourceElementId} sans connexion à un appui connu.`, elementIds: [surface.sourceElementId], levelId: surface.levelId });
  }
  if (elements.length && nodes.length && supports.length === 0) diagnostics.push({ severity: "error", code: "no-structural-supports", message: "Aucun appui fixe relié à une semelle n’a pu être établi.", elementIds: [] });
  if (elements.length === 0) diagnostics.push({ severity: "error", code: "empty-model", message: "Le modèle ne contient aucun élément structurel à analyser.", elementIds: [] });
  const unresolvedIds = new Set([...frames.map(frame=>frame.sourceElementId),...surfaces.map(surface=>surface.sourceElementId)].map(id => id.split(":")[0]));
  for (const element of elements) if (!["Poteau","Poutre","Longrine de redressement","Dalle","Voile","Semelle","Escaliers"].includes(element.type) || (!unresolvedIds.has(element.id) && element.type !== "Poteau")) diagnostics.push({ severity: "warning", code: "element-not-analytical", message: `L’élément ${element.id} (${element.type}) n’a pas d’équivalent analytique généré.`, elementIds: [element.id], levelId: element.levelId });

  const model: AnalyticalModel = {
    schemaVersion: ANALYTICAL_SCHEMA_VERSION,
    units: ANALYTICAL_UNITS,
    nodeMergeToleranceM: tolerance,
    nodes, frames, surfaces, supports, connections, materials: [material], sections: Array.from(sections.values()),
    mesh: { globalSizeM: positive(finite(input.globalMeshSizeM,1),1), maxAspectRatio: 5, refinementRegions: [] },
    sourceElementIds: Array.from(new Set(elements.map(element=>element.id))),
  };
  const errors = diagnostics.filter(item=>item.severity === "error");
  const warnings = diagnostics.filter(item=>item.severity === "warning");
  const precheck: AnalyticalPrecheck = { ok: errors.length === 0, errors, warnings, checkedNodeCount: nodes.length, checkedFrameCount: frames.length, checkedSurfaceCount: surfaces.length, supportedComponentCount: supports.length ? 1 : 0 };
  return { model, precheck };
}

export function validateAnalyticalModel(model: AnalyticalModel, initialDiagnostics: AnalyticalDiagnostic[] = []): AnalyticalPrecheck {
  const errors = [...initialDiagnostics.filter(item=>item.severity === "error")];
  const warnings = [...initialDiagnostics.filter(item=>item.severity === "warning")];
  const nodeIds = new Set(model.nodes.map(node=>node.id));
  for (const frame of model.frames) {
    if (!nodeIds.has(frame.startNodeId) || !nodeIds.has(frame.endNodeId)) errors.push({severity:"error",code:"frame-node-missing",message:`La barre ${frame.sourceElementId} référence un nœud absent.`,elementIds:[frame.sourceElementId],levelId:frame.levelId});
  }
  for (const surface of model.surfaces) {
    if (surface.nodeIds.length < 3 || surface.nodeIds.some(id=>!nodeIds.has(id))) errors.push({severity:"error",code:"surface-node-invalid",message:`La surface ${surface.sourceElementId} référence un contour incomplet.`,elementIds:[surface.sourceElementId],levelId:surface.levelId});
  }
  for (const support of model.supports) if (!nodeIds.has(support.nodeId)) errors.push({severity:"error",code:"support-node-missing",message:`L’appui ${support.id} référence un nœud absent.`,elementIds:[support.sourceElementId]});
  const nodesWithMembers = new Set<string>();
  model.frames.forEach(frame=>{ nodesWithMembers.add(frame.startNodeId); nodesWithMembers.add(frame.endNodeId); });
  model.surfaces.forEach(surface=>surface.nodeIds.forEach(id=>nodesWithMembers.add(id)));
  for (const node of model.nodes) if (!nodesWithMembers.has(node.id) && !model.supports.some(support=>support.nodeId===node.id)) warnings.push({severity:"warning",code:"orphan-node",message:`Nœud ${node.id} sans élément analytique incident.`,elementIds:node.sourceElementIds});
  if ((model.frames.length || model.surfaces.length) && model.supports.length === 0) errors.push({severity:"error",code:"model-unrestrained",message:"Aucun appui contraignant n’est défini ; le modèle est instable.",elementIds:[]});
  return {ok:errors.length===0,errors,warnings,checkedNodeCount:model.nodes.length,checkedFrameCount:model.frames.length,checkedSurfaceCount:model.surfaces.length,supportedComponentCount:model.supports.length ? 1 : 0};
}
