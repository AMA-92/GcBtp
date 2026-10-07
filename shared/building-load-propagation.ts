import { distributeFloorToBeams, type BeamSupport, type RectangularFloor, type TributaryContribution, type PropagatedLoad } from "./tributary-load";
import type { FloorConfig } from "./floor-config";
import { defaultBalconyFloorConfig, defaultFloorConfig, isSlabElementType } from "./floor-config";
import { MATERIAL_CATALOG } from "./load-catalog";
import { calculateStairSurfaceLoads, type StairFlightPlan } from "./stair-load";
import { FRENCH_EUROCODE_ACTION_CATALOG } from "./french-load-catalog";
import { checkRectangularSurfaceEdgeSupports, type RectangularSurfaceEdge } from "./surface-analysis";

type StairFlightCoordinates = StairFlightPlan & { lowerLevelId: string; upperLevelId: string };
type StairGeometryForLoads = { flight1?: StairFlightCoordinates; flight2?: StairFlightCoordinates; baseA?: { x: number; y: number }; baseB?: { x: number; y: number }; midA?: { x: number; y: number }; midB?: { x: number; y: number }; topA?: { x: number; y: number }; topB?: { x: number; y: number }; landingZ?: number };
export type BuildingElementForLoads = { id: string; type: string; section?: string; x: number; y: number; x2?: number; y2?: number; levelId?: string; floorConfig?: Partial<FloorConfig>; stairGeometry?: StairGeometryForLoads; absoluteStairGeometry?: { flight1?: StairFlightPlan; flight2?: StairFlightPlan } };
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
  surfaceAssignments: Array<{ id: string; parentElementId: string; meshSurfaceId: string; loadName: string; sourceType: string; kind: "floor" | "flight" | "landing" | "balcony"; areaM2: number; gkKnM2: number; qkKnM2: number; gkKn: number; qkKn: number }>;
  beams: BeamSupport[];
  warnings: string[];
  propagation: { beams: Record<string, PropagatedLoad>; columns: Record<string, PropagatedLoad>; foundations: Record<string, PropagatedLoad>; warnings: string[] };
  rows: BuildingLoadRow[];
  levelOrder: string[];
  levelLoads: Record<string, LevelLoadSummary>;
};

const EPSILON = 1e-6;
const CONCRETE_UNIT_WEIGHT = MATERIAL_CATALOG.find(item => item.id === "beton-arme")?.unitWeightKnM3 ?? 25;
const GAMMA_G = FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.permanentUnfavourable;
const GAMMA_Q = FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.variableUnfavourable;
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
const axisIndexToMetric = (value: number, positions: number[] | undefined, fallbackStep: number) => {
  if (!positions?.length) return value * fallbackStep;
  const last = positions.length - 1;
  if (value <= 0) return positions[0];
  if (value >= last) return positions[last];
  const index = Math.floor(value);
  const ratio = value - index;
  return positions[index] + (positions[index + 1] - positions[index]) * ratio;
};

export function buildBuildingLoadModel(elements: BuildingElementForLoads[], options: { levelOrder?: string[]; levelHeights?: Record<string, number>; gridDistance?: number; xAxisPositionsM?: number[]; yAxisPositionsM?: number[] } = {}) {
  const warnings: string[] = [];
  const discovered = Array.from(new Set(elements.map(levelKey)));
  const levelOrder = options.levelOrder?.length ? options.levelOrder.filter(id => discovered.includes(id) || id === "foundation") : discovered;
  const baseTransferLevel = levelOrder.find(id => id === "rdc") ?? levelOrder.find(id => id !== "foundation") ?? "rdc";
  const gridScale = Math.max(numeric(options.gridDistance, 4), 0.1);
  const metricPoint = (point: { x: number; y: number }) => ({
    x: axisIndexToMetric(point.x, options.xAxisPositionsM, gridScale),
    y: axisIndexToMetric(point.y, options.yAxisPositionsM, gridScale),
  });
  const levelHeights = options.levelHeights ?? {};
  const levelHeight = (id: string) => Math.max(numeric(levelHeights[id], id === "foundation" ? 1 : 3.2), 0.1);
  for (const id of discovered) if (!levelOrder.includes(id)) levelOrder.push(id);
  const surfaceAssignments: BuildingLoadModel["surfaceAssignments"] = [];
  const floors: RectangularFloor[] = elements.filter(e => (isSlabElementType(e.type) || e.type === "Escaliers") && e.x2 !== undefined && e.y2 !== undefined).map(e => {
    const x1 = Math.min(e.x, e.x2 as number), x2 = Math.max(e.x, e.x2 as number), y1 = Math.min(e.y, e.y2 as number), y2 = Math.max(e.y, e.y2 as number);
    const rectArea = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      const start = metricPoint(a), end = metricPoint(b);
      return Math.abs((end.x - start.x) * (end.y - start.y));
    };
    const stairGeometry = e.stairGeometry;
    const legacyGeometry = stairGeometry?.baseA && stairGeometry.baseB && stairGeometry.midA && stairGeometry.midB && stairGeometry.topA && stairGeometry.topB;
    const config = e.floorConfig ?? (e.type === "Escaliers" ? { ...defaultFloorConfig, type: "Dalle pleine", thickness: "15 cm", characteristicImposedLoad: "2.50", stairRiser: "0.17", stairTread: "0.30", stairRise: "2.04", stairRun: "3.60" } : e.type === "Balcon" ? defaultBalconyFloorConfig() : defaultFloorConfig);
    const rate = (value: string | undefined, fallback: number) => { const parsed = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback; };
    const optionalRate = (value: string | undefined) => { if (value === undefined || value.trim() === "") return undefined; const parsed = Number(value.replace(",", ".")); return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined; };
    const explicitPermanent = optionalRate(config.characteristicPermanentLoad);
    const explicitImposed = optionalRate(config.characteristicImposedLoad);
    const imposedRate = explicitImposed ?? rate(config.imposedLoad, 2);
    const thicknessM = floorThickness(config);
    let areaM2 = rectArea({ x: x1, y: y1 }, { x: x2, y: y2 });
    let gk = 0;
    let qk = 0;
    if (e.type === "Escaliers") {
      const absoluteGeometry = e.absoluteStairGeometry;
      const toLoadCoordinates = (point: { x: number; y: number }, absolute: boolean) => absolute ? point : metricPoint(point);
      const flightPlan = (flight: StairFlightCoordinates | undefined, absolute: boolean): StairFlightPlan | undefined => flight ? {
        lowerA: toLoadCoordinates(flight.lowerA, absolute),
        lowerB: toLoadCoordinates(flight.lowerB, absolute),
        upperA: toLoadCoordinates(flight.upperA, absolute),
        upperB: toLoadCoordinates(flight.upperB, absolute),
      } : undefined;
      const flight1 = flightPlan(absoluteGeometry?.flight1 as StairFlightCoordinates | undefined ?? stairGeometry?.flight1, Boolean(absoluteGeometry?.flight1));
      const flight2 = flightPlan(absoluteGeometry?.flight2 as StairFlightCoordinates | undefined ?? stairGeometry?.flight2, Boolean(absoluteGeometry?.flight2));
      const stairLoads = calculateStairSurfaceLoads({
        flights: [flight1, flight2],
        landingDepthM: rate(config.stairLandingDepthM, 0),
        riseM: rate(config.stairRise, 2.04),
        slabThicknessM: thicknessM,
        concreteDensityKnM3: CONCRETE_UNIT_WEIGHT,
        stepHeightM: rate(config.stairRiser, 0.17),
        treadM: rate(config.stairTread, 0.30),
        flightFinishLoadKnM2: rate(config.stairFinishLoad, 0),
        landingFinishLoadKnM2: rate(config.stairLandingFinishLoad, rate(config.finishLoad, 0)),
        flightImposedLoadKnM2: imposedRate,
        landingImposedLoadKnM2: rate(config.stairLandingImposedLoad, imposedRate),
      });
      if (stairLoads.rows.length >= 2) {
        areaM2 = stairLoads.totalAreaM2;
        gk = stairLoads.totalGkKn;
        qk = stairLoads.totalQkKn;
        for (const load of stairLoads.rows) surfaceAssignments.push({
          id: `${e.id}:${load.id}`,
          meshSurfaceId: `${e.id}:${load.id}`,
          parentElementId: e.id,
          loadName: `${load.label} · ${e.id}`,
          sourceType: "Escaliers",
          kind: load.kind,
          areaM2: load.areaM2,
          gkKnM2: load.gkKnM2,
          qkKnM2: load.qkKnM2,
          gkKn: load.gkKn,
          qkKn: load.qkKn,
        });
        if (stairLoads.landingDepthWasDerived) warnings.push(`Escalier ${e.id} : profondeur des paliers non renseignée; valeur de secours ${stairLoads.landingDepthM.toFixed(2)} m (largeur mesurée de la volée). Enregistrer et confirmer sur plan.`);
      } else {
        warnings.push(`Escalier ${e.id} sans géométrie de volées complète : charge provisoire calculée sur son emprise rectangulaire.`);
        if (legacyGeometry) areaM2 = rectArea(stairGeometry!.baseA!, stairGeometry!.baseB!) + rectArea(stairGeometry!.midA!, stairGeometry!.midB!) + rectArea(stairGeometry!.topA!, stairGeometry!.topB!);
      }
    }
    if (e.type !== "Escaliers" || !surfaceAssignments.some(row => row.parentElementId === e.id)) {
      const physicalArea = areaM2;
      const permanentRate = explicitPermanent ?? floorSelfWeightRate(config) + rate(config.finishLoad, 1) + rate(config.ceilingLoad, 0.3) + rate(config.partitionLoad, 1) + rate(config.equipmentLoad, 0.5);
      gk = permanentRate * physicalArea;
      qk = imposedRate * physicalArea;
      const typeLabel = e.type === "Escaliers" ? "Escalier · géométrie héritée/provisoire" : e.type === "Balcon" ? "Balcon · dalle pleine" : config.type === "Dalle pleine" ? "Dalle pleine" : "Dalle à corps creux";
      surfaceAssignments.push({ id: e.id, meshSurfaceId: e.id, parentElementId: e.id, loadName: `${typeLabel} · ${e.id}`, sourceType: e.type, kind: e.type === "Balcon" ? "balcony" : "floor", areaM2: physicalArea, gkKnM2: permanentRate, qkKnM2: imposedRate, gkKn: gk, qkKn: qk });
    }
    return {
      id: e.id,
      x1,
      y1,
      x2,
      y2,
      gk,
      qk,
      spanDirection: (config?.direction ?? "X").toLowerCase() as "x" | "y",
      distributionMode: e.type === "Escaliers" ? "one-way" : config.type === "Dalle pleine" ? "two-way" : "one-way",
    };
  });
  const beams: BeamSupport[] = elements.filter(e => (e.type === "Poutre" || e.type === "Voile" || e.type === "Longrine de redressement") && e.x2 !== undefined && e.y2 !== undefined).map(e => ({ id: e.id, x1: e.x, y1: e.y, x2: e.x2 as number, y2: e.y2 as number, levelId: levelKey(e) }));
  const beamSelfWeights = Object.fromEntries(elements.filter(e => (e.type === "Poutre" || e.type === "Voile" || e.type === "Longrine de redressement") && e.x2 !== undefined && e.y2 !== undefined).map(e => { const [width, height] = e.type === "Voile" ? sectionDimensions(e.section ?? "", [0.2, 3.2]) : sectionDimensions(e.section ?? "", [0.2, 0.4]); const start = metricPoint(e), end = metricPoint({ x: e.x2 as number, y: e.y2 as number }); const length = Math.max(Math.hypot(end.x - start.x, end.y - start.y), 0.1); return [e.id, selfWeight(width * height * CONCRETE_UNIT_WEIGHT * length, `Poids propre ${e.id} · ${e.section ?? "section non renseignée"}`)]; }));
  const columns = elements.filter(e => e.type === "Poteau");
  const foundations = elements.filter(e => e.type === "Semelle");
  const supportsById = new Map(elements.map(element => [element.id, element]));
  const columnSelfWeights = Object.fromEntries(columns.map(e => { const [width, depth] = sectionDimensions(e.section ?? "", [0.2, 0.3]); const height = levelHeight(levelKey(e)); return [e.id, selfWeight(width * depth * CONCRETE_UNIT_WEIGHT * height, `Poids propre ${e.id} · ${e.section} · hauteur ${height.toFixed(2)} m`)]; }));
  const allContributions: TributaryContribution[] = [];
  const localBeamLoads: Record<string, PropagatedLoad> = {};
  const localColumnLoads: Record<string, PropagatedLoad> = {};
  const beamToColumns: Record<string, string[]> = {};
  const tieBeamToFoundations: Record<string, string[]> = {};
  const wallToFoundations: Record<string, string[]> = {};
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
      if (floorElement?.type === "Balcon") {
        const supportCheck = checkRectangularSurfaceEdgeSupports({ x1: floor.x1, y1: floor.y1, x2: floor.x2, y2: floor.y2 }, levelElements);
        const configuredEdge = floorElement.floorConfig?.balconySupportEdge ?? "auto";
        const fixedEdge: RectangularSurfaceEdge | undefined = configuredEdge === "auto"
          ? supportCheck.supportedEdges.length === 1 ? supportCheck.supportedEdges[0] : undefined
          : configuredEdge;
        if (!fixedEdge || !supportCheck.supportedEdges.includes(fixedEdge)) {
          warnings.push(`Balcon ${floor.id} : rive d’encastrement absente, non portée ou ambiguë sur ${levelId}; sa charge n’est pas répartie vers les rives libres.`);
          continue;
        }
        const xFixed = fixedEdge === "left" ? floor.x1 : fixedEdge === "right" ? floor.x2 : undefined;
        const yFixed = fixedEdge === "bottom" ? floor.y1 : fixedEdge === "top" ? floor.y2 : undefined;
        const segments = levelBeams.flatMap(beam => {
          const member = levelElements.find(element => element.id === beam.id);
          if (!member || (member.type !== "Poutre" && member.type !== "Voile")) return [];
          if (xFixed !== undefined && near(beam.x1, xFixed) && near(beam.x2, xFixed)) {
            const start = Math.max(floor.y1, Math.min(beam.y1, beam.y2));
            const end = Math.min(floor.y2, Math.max(beam.y1, beam.y2));
            return end > start ? [{ id: beam.id, overlap: end - start }] : [];
          }
          if (yFixed !== undefined && near(beam.y1, yFixed) && near(beam.y2, yFixed)) {
            const start = Math.max(floor.x1, Math.min(beam.x1, beam.x2));
            const end = Math.min(floor.x2, Math.max(beam.x1, beam.x2));
            return end > start ? [{ id: beam.id, overlap: end - start }] : [];
          }
          return [];
        });
        const totalOverlap = segments.reduce((sum, segment) => sum + segment.overlap, 0);
        if (totalOverlap <= EPSILON) {
          warnings.push(`Balcon ${floor.id} : la rive ${fixedEdge} ne correspond à aucune poutre/voile de transfert sur ${levelId}.`);
          continue;
        }
        const balconyContributions = segments.map(segment => ({
          floorId: floor.id,
          beamId: segment.id,
          area: 0,
          gk: floor.gk * segment.overlap / totalOverlap,
          qk: floor.qk * segment.overlap / totalOverlap,
          source: `Balcon ${floor.id} · porte-à-faux · réaction sur rive ${fixedEdge}`,
        }));
        allContributions.push(...balconyContributions);
        for (const contribution of balconyContributions) addLoad(localBeamLoads, contribution.beamId, { gk: contribution.gk, qk: contribution.qk, sources: [contribution.source] });
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
      const wallFoundationSupports = beamElement?.type === "Voile" && !supports.length
        ? foundations.filter(foundation => beamAtPoint(foundation, beam)).map(foundation => foundation.id)
        : [];
      beamToColumns[beam.id] = isTieBeam ? foundationSupports : supports.length ? supports : wallFoundationSupports;
      if (isTieBeam) {
        tieBeamToFoundations[beam.id] = foundationSupports;
        if (foundationSupports.length !== 2) warnings.push(`Longrine ${beam.id} non reliée à deux semelles sur ${levelId}.`);
      } else if (beamElement?.type === "Voile" && wallFoundationSupports.length) {
        wallToFoundations[beam.id] = wallFoundationSupports;
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
  for (const [wallId, foundationIds] of Object.entries(wallToFoundations)) {
    const wallLoad = localBeamLoads[wallId] ?? emptyLoad();
    for (const foundationId of foundationIds) addLoad(foundationLoads, foundationId, { gk: wallLoad.gk / foundationIds.length, qk: wallLoad.qk / foundationIds.length, sources: [`${wallId} → ${foundationId} · répartition du voile`, ...wallLoad.sources] });
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
  const rows = elements.filter(e => ["Dalle", "Balcon", "Escaliers", "Poutre", "Voile", "Longrine de redressement", "Poteau", "Semelle"].includes(e.type)).map(e => {
    const floor = floors.find(f => f.id === e.id);
    const load: PropagatedLoad = (isSlabElementType(e.type) || e.type === "Escaliers")
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
      ? surfaceAssignments.filter(assignment => assignment.parentElementId === e.id).map(assignment => `${assignment.loadName} · ${assignment.areaM2.toFixed(2)} m² · Gk ${assignment.gkKnM2.toFixed(2)} / Qk ${assignment.qkKnM2.toFixed(2)} kN/m²`)
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
      nu: GAMMA_G * gk + GAMMA_Q * qk,
      nser: gk + qk,
      moment,
      sources: [...floorSources, ...(load.sources ?? [])],
      supports,
    };
  });
  return { contributions: allContributions, beamToColumns, columnToFoundation, floors, surfaceAssignments, beams, warnings: allWarnings, propagation, rows, levelOrder, levelLoads: levelDirect };
}

export function summarizeBuildingLoads(model: BuildingLoadModel) {
  return { floorCount: model.floors.length, beamCount: model.beams.length, columnCount: Object.keys(model.propagation.columns).length, foundationCount: Object.keys(model.propagation.foundations).length, totalGk: Object.values(model.propagation.foundations).reduce((sum, load) => sum + numeric(load.gk), 0), totalQk: Object.values(model.propagation.foundations).reduce((sum, load) => sum + numeric(load.qk), 0), warnings: model.warnings, rows: model.rows, levelLoads: model.levelLoads };
}
