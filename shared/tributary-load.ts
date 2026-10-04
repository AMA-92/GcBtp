export type RectangularFloor = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  gk: number;
  qk: number;
  spanDirection: "x" | "y";
  distributionMode?: "one-way" | "two-way";
};

export type BeamSupport = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  levelId?: string;
};

export type TributaryContribution = {
  floorId: string;
  beamId: string;
  area: number;
  gk: number;
  qk: number;
  source: string;
};

function minMax(a: number, b: number) { return [Math.min(a, b), Math.max(a, b)] as const; }
function overlap(a1: number, a2: number, b1: number, b2: number) { return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1)); }
function near(a: number, b: number, tolerance = 1e-6) { return Math.abs(a - b) <= tolerance; }

export function distributeFloorToBeams(floor: RectangularFloor, beams: BeamSupport[]): TributaryContribution[] {
  const [x1, x2] = minMax(floor.x1, floor.x2);
  const [y1, y2] = minMax(floor.y1, floor.y2);
  const width = x2 - x1;
  const height = y2 - y1;
  if (width <= 0 || height <= 0) return [];

  const boundaryCandidates = beams.map(beam => {
    const [bx1, bx2] = minMax(beam.x1, beam.x2);
    const [by1, by2] = minMax(beam.y1, beam.y2);
    const horizontalOverlap = overlap(bx1, bx2, x1, x2);
    const verticalOverlap = overlap(by1, by2, y1, y2);
    const spanOverlap = floor.spanDirection === "x" ? horizontalOverlap : verticalOverlap;
    const boundaries = floor.spanDirection === "x"
      ? [Math.min(Math.abs(by1 - y1), Math.abs(by2 - y1)), Math.min(Math.abs(by1 - y2), Math.abs(by2 - y2))]
      : [Math.min(Math.abs(bx1 - x1), Math.abs(bx2 - x1)), Math.min(Math.abs(bx1 - x2), Math.abs(bx2 - x2))];
    return { beam, spanOverlap, horizontalOverlap, verticalOverlap, boundaries };
  });
  const selectBest = (items: typeof boundaryCandidates) =>
    items.sort((a, b) => Math.max(b.horizontalOverlap, b.verticalOverlap) - Math.max(a.horizontalOverlap, a.verticalOverlap))[0]?.beam;
  const supports = floor.distributionMode === "two-way"
    ? [
        selectBest(boundaryCandidates.filter(item => Math.min(Math.abs(item.beam.y1 - y1), Math.abs(item.beam.y2 - y1)) <= 1e-6 && item.horizontalOverlap > 0)),
        selectBest(boundaryCandidates.filter(item => Math.min(Math.abs(item.beam.y1 - y2), Math.abs(item.beam.y2 - y2)) <= 1e-6 && item.horizontalOverlap > 0)),
        selectBest(boundaryCandidates.filter(item => Math.min(Math.abs(item.beam.x1 - x1), Math.abs(item.beam.x2 - x1)) <= 1e-6 && item.verticalOverlap > 0)),
        selectBest(boundaryCandidates.filter(item => Math.min(Math.abs(item.beam.x1 - x2), Math.abs(item.beam.x2 - x2)) <= 1e-6 && item.verticalOverlap > 0)),
      ].filter((beam): beam is BeamSupport => Boolean(beam))
    : [0, 1].map(side => boundaryCandidates.filter(item => item.spanOverlap > 0 && item.boundaries[side] <= 1e-6).sort((a, b) => b.spanOverlap - a.spanOverlap)[0]?.beam).filter((beam): beam is BeamSupport => Boolean(beam));
  const uniqueSupports = Array.from(new Map((supports.length ? supports : beams).map(beam => [beam.id, beam])).values());
  if (uniqueSupports.length === 0) return [];

  const tributaryArea = (width * height) / uniqueSupports.length;
  return uniqueSupports.map(beam => ({
    floorId: floor.id,
    beamId: beam.id,
    area: tributaryArea,
    gk: floor.gk * tributaryArea / (width * height),
    qk: floor.qk * tributaryArea / (width * height),
    source: `Dalle ${floor.id} · ${floor.distributionMode === "two-way" ? "répartition bidirectionnelle" : `portée ${floor.spanDirection.toUpperCase()}`} · surface tributaire ${tributaryArea.toFixed(2)} m² · appui ${beam.id}`,
  }));
}

export type PropagatedLoad = { gk: number; qk: number; sources: string[] };

export type StructuralPropagationInput = {
  contributions: TributaryContribution[];
  beamToColumns: Record<string, string[]>;
  columnToFoundation: Record<string, string>;
};

export function aggregateTributaryContributions(contributions: TributaryContribution[]) {
  return contributions.reduce<Record<string, { area: number; gk: number; qk: number; sources: string[] }>>((acc, contribution) => {
    const current = acc[contribution.beamId] ?? { area: 0, gk: 0, qk: 0, sources: [] };
    current.area += contribution.area;
    current.gk += contribution.gk;
    current.qk += contribution.qk;
    current.sources.push(contribution.source);
    acc[contribution.beamId] = current;
    return acc;
  }, {});
}

function addLoad(target: Record<string, PropagatedLoad>, id: string, load: PropagatedLoad) {
  const current = target[id] ?? { gk: 0, qk: 0, sources: [] };
  current.gk += load.gk;
  current.qk += load.qk;
  current.sources.push(...load.sources);
  target[id] = current;
}

export function propagateToFoundations(input: StructuralPropagationInput) {
  const beamTotals = aggregateTributaryContributions(input.contributions);
  const beams: Record<string, PropagatedLoad> = {};
  const columns: Record<string, PropagatedLoad> = {};
  const foundations: Record<string, PropagatedLoad> = {};
  const warnings: string[] = [];

  for (const [beamId, total] of Object.entries(beamTotals)) {
    const supports = input.beamToColumns[beamId] ?? [];
    if (supports.length === 0) {
      warnings.push(`Poutre ${beamId} sans poteau d’appui déclaré.`);
      continue;
    }
    const load = { gk: total.gk, qk: total.qk, sources: total.sources };
    beams[beamId] = load;
    const share = 1 / supports.length;
    for (const columnId of supports) {
      addLoad(columns, columnId, { gk: load.gk * share, qk: load.qk * share, sources: [`${beamId} → ${columnId}`, ...load.sources] });
    }
  }

  for (const [columnId, load] of Object.entries(columns)) {
    const foundationId = input.columnToFoundation[columnId];
    if (!foundationId) {
      warnings.push(`Poteau ${columnId} sans semelle d’appui déclarée.`);
      continue;
    }
    addLoad(foundations, foundationId, { ...load, sources: [`${columnId} → ${foundationId}`, ...load.sources] });
  }
  return { beams, columns, foundations, warnings };
}
