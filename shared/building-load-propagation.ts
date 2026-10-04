import { distributeFloorToBeams, type BeamSupport, type RectangularFloor, type TributaryContribution, type PropagatedLoad } from "./tributary-load";
import type { FloorConfig } from "./floor-config";
import { MATERIAL_CATALOG } from "./load-catalog";
import { calculateStairPermanentLoad } from "./stair-load";

export type BuildingElementForLoads = { id: string; type: string; section?: string; x: number; y: number; x2?: number; y2?: number; levelId?: string; floorConfig?: Partial<FloorConfig>; stairGeometry?: { flight1?: { lowerA: { x: number; y: number }; lowerB: { x: number; y: number }; upperA: { x: number; y: number }; upperB: { x: number; y: number }; lowerLevelId: string; upperLevelId: string }; flight2?: { lowerA: { x: number; y: number }; lowerB: { x: number; y: number }; upperA: { x: number; y: number }; upperB: { x: number; y: number }; lowerLevelId: string; upperLevelId: string }; baseA?: { x: number; y: number }; baseB?: { x: number; y: number }; midA?: { x: number; y: number }; midB?: { x: number; y: number }; topA?: { x: number; y: number }; topB?: { x: number; y: number }; landingZ: number } };
export type BuildingLoadRow = {
  id: string;
  label: string;
  type: string;
  levelId: string;
  section?: string;
  gk: number;
  qk: number;
  nu: number;
  nser: number;
  moment?: number;
  sources: string[];
  supports: string[];
};
export type LevelLoadSummary = { floorCount: number; beamCount: number; columnCount: number; foundationCount: number; totalGk: number; totalQk: number };
export type BuildingLoadModel = {
  contributions: TributaryContribution[];
  beamToColumns: Record<string, string[]>;
  columnToFoundation: Record<string, string>;
  floors: RectangularFloor[];
  beams: BeamSupport[];
  warnings: string[];
  propagation: { beams: Record<string, PropagatedLoad>; columns: Record<string, PropagatedLoad>; foundations: Record<string, PropagatedLoad>; warnings: string[] };
  rows: BuildingLoadRow[];
  levelOrder: string[];
  levelLoads: Record<string, LevelLoadSummary>;
};

const EPSILON = 1e-6;
const CONCRETE_UNIT_WEIGHT = MATERIAL_CATALOG.find(item => item.id === "beton-arme")?.unitWeightKnM3 ?? 25;
const near = (a: number, b: number) => Math.abs(a - b) <= EPSILON;
const samePoint = (a: { x: number; y: number }, b: { x: number; y: number }) => near(a.x, b.x) && near(a.y, b.y);
const numeric = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const levelKey = (element: BuildingElementForLoads) => element.levelId ?? "rdc";
const addLoad = (target: Record<string, PropagatedLoad>, id: string, load: PropagatedLoad) => { const current = target[id] ?? { gk: 0, qk: 0, sources: [] }; current.gk += load.gk; current.qk += load.qk; current.sources.push(...load.sources); target[id] = current; };

function floorThickness(config: Partial<FloorConfig> | undefined) { const parts = (config?.thickness ?? "16+4 cm").match(/\d+(?:[.,]\d+)?/g)?.map(value => Number(value.replace(",", "."))) ?? [20]; return Math.max(0.05, parts.reduce((sum, value) => sum + value, 0) / 100); }
function floorSelfWeightRate(config: Partial<FloorConfig> | undefined) { if ((config?.type ?? "Corps creux") === "Dalle pleine") return 25 * floorThickness(config); const hollow = numeric((config?.hollowBlockHeight ?? "16").replace(",", "."), 16); const compression = numeric((config?.compressionSlab ?? "4").replace(",", "."), 4); const ribConcrete = 0.08 + Math.max(0, compression - 4) * 0.01; const blockWeight = 0.5 + Math.max(0, hollow - 16) * 0.03; return 25 * (compression / 100 + ribConcrete) + blockWeight; }
function beamAtPoint(element: BuildingElementForLoads, beam: BeamSupport) { return samePoint(element, { x: beam.x1, y: beam.y1 }) || samePoint(element, { x: beam.x2, y: beam.y2 }); }
const emptyLoad = (): PropagatedLoad => ({ gk: 0, qk: 0, sources: [] });
const sectionDimensions = (section: string, fallback: [number, number]) => { const match = section.match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/i); return match ? [Number(match[1].replace(",", ".")) / 100, Number(match[2].replace(",", ".")) / 100] as [number, number] : fallback; };
const selfWeight = (gk: number, source: string): PropagatedLoad => ({ gk, qk: 0, sources: [source] });

export function buildBuildingLoadModel(elements: BuildingElementForLoads[], options: { levelOrder?: string[]; levelHeights?: Record<string, number>; gridDistance?: number } = {}) {
  const warnings: string[] = [];
  const discovered = Array.from(new Set(elements.map(levelKey)));
  const levelOrder = options.levelOrder?.length ? options.levelOrder.filter(id => discovered.includes(id) || id === "foundation") : discovered;
  const baseTransferLevel = levelOrder.find(id => id === "rdc") ?? levelOrder.find(id => id !== "foundation") ?? "rdc";
  const gridScale = Math.max(numeric(options.gridDistance, 4), 0.1);
  const levelHeights = options.levelHeights ?? {};
  const levelHeight = (id: string) => Math.max(numeric(levelHeights[id], id === "foundation" ? 1 : 3.2), 0.1);
  for (const id of discovered) if (!levelOrder.includes(id)) levelOrder.push(id);
  const floors: RectangularFloor[] = elements.filter(e => (e.type === "Dalle" || e.type === "Escaliers") && e.x2 !== undefined && e.y2 !== undefined).map(e => {
    const x1 = Math.min(e.x, e.x2 as number), x2 = Math.max(e.x, e.x2 as number), y1 = Math.min(e.y, e.y2 as number), y2 = Math.max(e.y, e.y2 as number);
    const rectArea = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs((b.x - a.x) * (b.y - a.y));
    const intersectionArea = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) => Math.max(0, Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))) * Math.max(0, Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)));
    const stairGeometry = e.stairGeometry;
    const legacyGeometry = stairGeometry?.baseA && stairGeometry.baseB && stairGeometry.midA && stairGeometry.midB && stairGeometry.topA && stairGeometry.topB;
    const flight1 = stairGeometry?.flight1;
    const flight2 = stairGeometry?.flight2;
    const area = flight1 && flight2
      ? rectArea(flight1.lowerA, flight1.lowerB) + rectArea(flight1.upperA, flight1.upperB) + rectArea(flight2.lowerA, flight2.lowerB) + rectArea(flight2.upperA, flight2.upperB) - intersectionArea(flight1.upperA, flight1.upperB, flight2.lowerA, flight2.lowerB) + Math.max(0, 2 - intersectionArea(flight1.upperA, flight1.upperB, flight2.lowerA, flight2.lowerB))
      : legacyGeometry
        ? rectArea(stairGeometry.baseA!, stairGeometry.baseB!) + rectArea(stairGeometry.midA!, stairGeometry.midB!) + rectArea(stairGeometry.topA!, stairGeometry.topB!)
        : Math.max(0, (x2 - x1) * (y2 - y1));
    const physicalArea = area * gridScale * gridScale;
    const config = e.floorConfig ?? (e.type === "Escaliers" ? { type: "Dalle pleine", thickness: "15 cm", span: "3.00", direction: "X", concreteClass: "C25/30", characteristicImposedLoad: "2.50", stairRiser: "0.17", stairTread: "0.30", stairRise: "2.04", stairRun: "3.60" } : undefined);
    const rate = (value: string | undefined, fallback: number) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : fallback;
    const explicitPermanent = Number(String(config?.characteristicPermanentLoad ?? "").replace(",", "."));
    const explicitImposed = Number(String(config?.characteristicImposedLoad ?? "").replace(",", "."));
    const hasStairParameters = e.type === "Escaliers" && (Boolean(config?.stairRiser || config?.stairTread || config?.stairRise || config?.stairRun) || explicitPermanent === 3.75);
    const stairRate = hasStairParameters ? calculateStairPermanentLoad({ widthM: 1.2, horizontalRunM: rate(config?.stairRun, 3.6), riseM: rate(config?.stairRise, 2.04), slabThicknessM: floorThickness(config), concreteDensityKnM3: CONCRETE_UNIT_WEIGHT, stepHeightM: rate(config?.stairRiser, 0.17), treadM: rate(config?.stairTread, 0.30), finishLoadKnM2: rate(config?.stairFinishLoad, rate(config?.finishLoad, 0)) }) : null;
    const permanentRate = hasStairParameters ? stairRate!.permanentRateKnM2 : Number.isFinite(explicitPermanent) ? Math.max(0, explicitPermanent) : floorSelfWeightRate(config) + rate(config?.finishLoad, 1) + rate(config?.ceilingLoad, 0.3) + rate(config?.partitionLoad, 1) + rate(config?.equipmentLoad, 0.5);
    const imposedRate = Number.isFinite(explicitImposed) ? Math.max(0, explicitImposed) : rate(config?.imposedLoad, 2);
    return {
      id: e.id,
      x1,
      y1,
      x2,
      y2,
      gk: permanentRate * physicalArea,
      qk: imposedRate * physicalArea,
      spanDirection: (config?.direction ?? "X").toLowerCase() as "x" | "y",
      distributionMode: config?.type === "Dalle pleine" ? "two-way" : "one-way",
    };
  });
  const beams: BeamSupport[] = elements.filter(e => (e.type === "Poutre" || e.type === "Voile" || e.type === "Longrine de redressement") && e.x2 !== undefined && e.y2 !== undefined).map(e => ({ id: e.id, x1: e.x, y1: e.y, x2: e.x2 as number, y2: e.y2 as number, levelId: levelKey(e) }));
  const beamSelfWeights = Object.fromEntries(elements.filter(e => (e.type === "Poutre" || e.type === "Voile" || e.type === "Longrine de redressement") && e.x2 !== undefined && e.y2 !== undefined).map(e => { const [width, height] = e.type === "Voile" ? sectionDimensions(e.section ?? "", [0.2, 3.2]) : sectionDimensions(e.section ?? "", [0.2, 0.4]); const length = Math.max(Math.hypot((e.x2 as number) - e.x, (e.y2 as number) - e.y) * gridScale, 0.1); return [e.id, selfWeight(width * height * CONCRETE_UNIT_WEIGHT * length, `Poids propre ${e.id} · ${e.section ?? "section non renseignée"}`)]; }));
  const columns = elements.filter(e => e.type === "Poteau");
  const foundations = elements.filter(e => e.type === "Semelle");
  const supportsById = new Map(elements.map(element => [element.id, element]));
  const columnSelfWeights = Object.fromEntries(columns.map(e => { const [width, depth] = sectionDimensions(e.section ?? "", [0.2, 0.3]); const height = levelHeight(levelKey(e)); return [e.id, selfWeight(width * depth * CONCRETE_UNIT_WEIGHT * height, `Poids propre ${e.id} · ${e.section} · hauteur ${height.toFixed(2)} m`)]; }));
  const allContributions: TributaryContribution[] = [];
  const localBeamLoads: Record<string, PropagatedLoad> = {};
  const localColumnLoads: Record<string, PropagatedLoad> = {};
  const beamToColumns: Record<string, string[]> = {};
  const tieBeamToFoundations: Record<string, string[]> = {};
  const columnToFoundation: Record<string, string> = {};
  const levelDirect: Record<string, LevelLoadSummary> = {};
  const stairSupportElements = (element: BuildingElementForLoads) => {
    const nearStairPoint = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) <= 0.2;
    const pointToSegment = (point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) => {
      const dx = end.x - start.x, dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy;
      const ratio = lengthSquared > 0 ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)) : 0;
      return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
    };
    const flights = [element.stairGeometry?.flight1, element.stairGeometry?.flight2].filter(
      (flight): flight is NonNullable<BuildingElementForLoads["stairGeometry"]>["flight1"] => Boolean(flight)
    );
    const geometry = element.stairGeometry;
    const landingEndpoints = flights.flatMap(flight => flight ? [flight.upperA, flight.upperB, flight.lowerA, flight.lowerB] : []);
    const points = [...landingEndpoints, ...flights.flatMap(flight => flight ? [flight.lowerA, flight.lowerB, flight.upperA, flight.upperB] : [])];
    if (geometry?.baseA && geometry.baseB) points.push(geometry.baseA, geometry.baseB);
    if (geometry?.midA && geometry.midB) points.push(geometry.midA, geometry.midB);
    if (geometry?.topA && geometry.topB) points.push(geometry.topA, geometry.topB);
    const addLandingCorners = (flight: NonNullable<BuildingElementForLoads["stairGeometry"]>["flight1"] | undefined) => {
      if (!flight) return;
      const edge = { x: flight.upperB.x - flight.upperA.x, y: flight.upperB.y - flight.upperA.y };
      const edgeLength = Math.max(Math.hypot(edge.x, edge.y), 0.001);
      const lateral = { x: (flight.upperA.x - flight.upperB.x) / edgeLength, y: (flight.upperA.y - flight.upperB.y) / edgeLength };
      const run = { x: flight.upperA.x - flight.lowerA.x, y: flight.upperA.y - flight.lowerA.y };
      const runLength = Math.max(Math.hypot(run.x, run.y), 0.001);
      const depth = { x: run.x / runLength, y: run.y / runLength };
      const start = flight.upperB;
      const far = { x: start.x + lateral.x * 2, y: start.y + lateral.y * 2 };
      points.push(start, far, { x: far.x + depth.x, y: far.y + depth.y }, { x: start.x + depth.x, y: start.y + depth.y });
    };
    addLandingCorners(geometry?.flight1);
    addLandingCorners(geometry?.flight2);
    if (!points.length && element.x2 !== undefined && element.y2 !== undefined) {
      points.push({ x: element.x, y: element.y }, { x: element.x2, y: element.y2 });
    }
    const validFlights = flights.filter(Boolean) as Array<NonNullable<NonNullable<BuildingElementForLoads["stairGeometry"]>["flight1"]>>;
    const levelScopedPoints = validFlights.flatMap(flight => [
      { levelId: flight.lowerLevelId, point: flight.lowerA },
      { levelId: flight.lowerLevelId, point: flight.lowerB },
      { levelId: flight.upperLevelId, point: flight.upperA },
      { levelId: flight.upperLevelId, point: flight.upperB },
    ]);
    const scoped = columns.filter(column => levelScopedPoints.some(item => item.levelId === levelKey(column) && nearStairPoint(item.point, column)));
    const geometric = columns.filter(column => points.some(point => nearStairPoint(point, column)));
    const beamElements = elements.filter(candidate => (candidate.type === "Poutre" || candidate.type === "Voile") && candidate.x2 !== undefined && candidate.y2 !== undefined && points.some(point => pointToSegment(point, { x: candidate.x, y: candidate.y }, { x: candidate.x2 as number, y: candidate.y2 as number }) <= 0.2));
    return Array.from(new Map([...scoped, ...geometric, ...beamElements].map(support => [support.id, support])).values());
  };

  for (const levelId of levelOrder) {
    const levelElements = elements.filter(e => levelKey(e) === levelId);
    const levelFloors = floors.filter(f => levelKey(elements.find(e => e.id === f.id) ?? { id: "", type: "", x: 0, y: 0 }) === levelId);
    const levelBeams = beams.filter(b => levelKey(elements.find(e => e.id === b.id) ?? { id: "", type: "", x: 0, y: 0 }) === levelId);
    const levelColumns = columns.filter(c => levelKey(c) === levelId);
    const levelFoundations = foundations.filter(f => levelKey(f) === levelId);
    for (const beam of levelBeams) addLoad(localBeamLoads, beam.id, beamSelfWeights[beam.id] ?? emptyLoad());
    for (const column of levelColumns) addLoad(localColumnLoads, column.id, columnSelfWeights[column.id] ?? emptyLoad());
    for (const floor of levelFloors) {
      const floorElement = elements.find(element => element.id === floor.id);
      const isStair = floorElement?.type === "Escaliers";
      const stairSupports = isStair && floorElement ? stairSupportElements(floorElement) : [];
      if (isStair) {
        if (stairSupports.length) {
          const reactionGk = floor.gk / stairSupports.length;
          const reactionQk = floor.qk / stairSupports.length;
          const stairContributions = stairSupports.map(support => ({
            floorId: floor.id,
            beamId: support.id,
            area: 0,
            gk: reactionGk,
            qk: reactionQk,
            source: `Escalier ${floor.id} · entité monolithique · réaction vers ${support.type === "Poutre" || support.type === "Voile" ? "poutre/voile" : "poteau"} ${support.id}`,
          }));
          allContributions.push(...stairContributions);
          for (const contribution of stairContributions) {
            addLoad(supportsById.get(contribution.beamId)?.type === "Poutre" || supportsById.get(contribution.beamId)?.type === "Voile" ? localBeamLoads : localColumnLoads, contribution.beamId, {
              gk: contribution.gk,
              qk: contribution.qk,
              sources: [contribution.source],
            });
          }
        } else {
          warnings.push(`Escalier ${floor.id} sans poteau ou poutre d’appui géométrique identifié sur ${levelId}.`);
        }
        continue;
      }
      const contributions = distributeFloorToBeams(floor, levelBeams);
      if (!contributions.length) warnings.push(`Dalle ${floor.id} sans poutre réelle compatible sur ${levelId}.`);
      allContributions.push(...contributions);
      for (const contribution of contributions) addLoad(localBeamLoads, contribution.beamId, { gk: contribution.gk, qk: contribution.qk, sources: [contribution.source] });
    }
    for (const beam of levelBeams) {
      const beamElement = elements.find(element => element.id === beam.id);
      const isTieBeam = beamElement?.type === "Longrine de redressement";
      const supports = isTieBeam ? [] : levelColumns.filter(column => beamAtPoint(column, beam)).map(column => column.id);
      const foundationSupports = isTieBeam ? levelFoundations.filter(foundation => beamAtPoint(foundation, beam)).map(foundation => foundation.id) : [];
      beamToColumns[beam.id] = isTieBeam ? foundationSupports : supports;
      if (isTieBeam) {
        tieBeamToFoundations[beam.id] = foundationSupports;
        if (foundationSupports.length !== 2) warnings.push(`Longrine ${beam.id} non reliée à deux semelles sur ${levelId}.`);
      } else if (!supports.length) {
        warnings.push(`${beamElement?.type ?? "Poutre"} ${beam.id} sans poteaux réels à ses extrémités sur ${levelId}.`);
      }
      const beamLoad = localBeamLoads[beam.id] ?? emptyLoad();
      for (const columnId of supports) addLoad(localColumnLoads, columnId, { gk: beamLoad.gk / supports.length, qk: beamLoad.qk / supports.length, sources: [`${beam.id} → ${columnId}`, ...beamLoad.sources] });
    }
    for (const column of levelColumns) {
      const foundation = foundations.find(item => samePoint(column, item));
      if (foundation && (levelId === baseTransferLevel || levelId === "foundation")) columnToFoundation[column.id] = foundation.id;
      else if (levelId === baseTransferLevel || levelId === "foundation") warnings.push(`Poteau ${column.id} sans semelle réelle alignée.`);
    }
    levelDirect[levelId] = { floorCount: levelFloors.length, beamCount: levelBeams.length, columnCount: levelColumns.length, foundationCount: levelFoundations.length, totalGk: 0, totalQk: 0 };
  }

  const cumulativeColumns: Record<string, PropagatedLoad> = {};
  const incomingByLevel: Record<string, Record<string, PropagatedLoad>> = {};
  const foundationLoads: Record<string, PropagatedLoad> = {};
  for (const [tieBeamId, foundationIds] of Object.entries(tieBeamToFoundations)) {
    if (foundationIds.length !== 2) continue;
    const tieLoad = beamSelfWeights[tieBeamId] ?? emptyLoad();
    for (const foundationId of foundationIds) addLoad(foundationLoads, foundationId, { gk: tieLoad.gk / 2, qk: tieLoad.qk / 2, sources: [`${tieBeamId} → ${foundationId} · moitié de la longrine`] });
  }
  const columnLevel = (id: string) => levelKey(elements.find(e => e.id === id) ?? { id, type: "", x: 0, y: 0 });
  for (let index = levelOrder.length - 1; index >= 0; index--) {
    const levelId = levelOrder[index];
    const levelColumns = columns.filter(c => levelKey(c) === levelId);
    for (const column of levelColumns) {
      const incoming = incomingByLevel[levelId]?.[column.id] ?? emptyLoad();
      const direct = localColumnLoads[column.id] ?? emptyLoad();
      const total = { gk: direct.gk + incoming.gk, qk: direct.qk + incoming.qk, sources: [...direct.sources, ...incoming.sources, `Cumul niveau ${levelId}`] };
      cumulativeColumns[column.id] = total;
      const foundation = columnToFoundation[column.id];
      if (foundation) addLoad(foundationLoads, foundation, { ...total, sources: [`${column.id} → ${foundation}`, ...total.sources] });
      if (index > 0) {
        const lowerLevel = levelOrder[index - 1];
        const lowerColumns = columns.filter(c => levelKey(c) === lowerLevel);
        const lower = lowerColumns.find(c => samePoint(c, column));
        if (lower) { incomingByLevel[lowerLevel] ??= {}; addLoad(incomingByLevel[lowerLevel], lower.id, total); }
        else warnings.push(`Poteau ${column.id} du niveau ${levelId} sans poteau aligné au niveau inférieur ${lowerLevel}.`);
      }
    }
  }

  for (const levelId of levelOrder) {
    const ids = columns.filter(c => levelKey(c) === levelId).map(c => c.id);
    levelDirect[levelId].totalGk = ids.reduce((sum, id) => sum + (cumulativeColumns[id]?.gk ?? 0), 0);
    levelDirect[levelId].totalQk = ids.reduce((sum, id) => sum + (cumulativeColumns[id]?.qk ?? 0), 0);
  }
  const propagation = { beams: localBeamLoads, columns: cumulativeColumns, foundations: foundationLoads, warnings: [] as string[] };
  const allWarnings = [...warnings, ...propagation.warnings];
  const rows = elements.filter(e => ["Dalle", "Escaliers", "Poutre", "Voile", "Longrine de redressement", "Poteau", "Semelle"].includes(e.type)).map(e => {
    const floor = floors.find(f => f.id === e.id);
    const load: PropagatedLoad = (e.type === "Dalle" || e.type === "Escaliers")
      ? (floor ? { gk: floor.gk, qk: floor.qk, sources: [] } : emptyLoad())
      : (e.type === "Poutre" || e.type === "Voile" || e.type === "Longrine de redressement")
        ? (localBeamLoads[e.id] ?? emptyLoad())
        : e.type === "Poteau"
          ? (cumulativeColumns[e.id] ?? emptyLoad())
          : (foundationLoads[e.id] ?? emptyLoad());
    const gk = numeric(load.gk), qk = numeric(load.qk);
    const physicalSpan = e.x2 !== undefined && e.y2 !== undefined
      ? Math.max(Math.hypot(e.x2 - e.x, e.y2 - e.y) * gridScale, 0.1)
      : 0;
    const moment = ["Poutre", "Voile", "Longrine de redressement"].includes(e.type) && physicalSpan > 0
      ? ((gk + qk) * physicalSpan) / 8
      : undefined;
    const floorSources = floor
      ? [`${e.type} ${e.id} · surface ${(Math.abs(floor.x2 - floor.x1) * Math.abs(floor.y2 - floor.y1) * gridScale * gridScale).toFixed(2)} m² · ${floor.distributionMode === "two-way" ? "répartition bidirectionnelle" : `portée ${floor.spanDirection.toUpperCase()}`}`]
      : [];
    const supports = e.type === "Poteau"
      ? (columnToFoundation[e.id] ? [columnToFoundation[e.id]] : [])
      : ["Poutre", "Voile", "Longrine de redressement"].includes(e.type)
        ? (beamToColumns[e.id] ?? [])
        : [];
    return {
      id: e.id,
      label: `${e.type} ${e.id}`,
      type: e.type,
      levelId: levelKey(e),
      section: e.section,
      gk,
      qk,
      nu: 1.35 * gk + 1.5 * qk,
      nser: gk + qk,
      moment,
      sources: [...floorSources, ...(load.sources ?? [])],
      supports,
    };
  });
  return { contributions: allContributions, beamToColumns, columnToFoundation, floors, beams, warnings: allWarnings, propagation, rows, levelOrder, levelLoads: levelDirect };
}

export function summarizeBuildingLoads(model: BuildingLoadModel) {
  return { floorCount: model.floors.length, beamCount: model.beams.length, columnCount: Object.keys(model.propagation.columns).length, foundationCount: Object.keys(model.propagation.foundations).length, totalGk: Object.values(model.propagation.foundations).reduce((sum, load) => sum + numeric(load.gk), 0), totalQk: Object.values(model.propagation.foundations).reduce((sum, load) => sum + numeric(load.qk), 0), warnings: model.warnings, rows: model.rows, levelLoads: model.levelLoads };
}
