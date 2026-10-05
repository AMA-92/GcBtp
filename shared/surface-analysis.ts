export const SURFACE_ANALYSIS_SCHEMA_VERSION = 2 as const;

export type RectangularOpening = { x1M: number; y1M: number; x2M: number; y2M: number };
export type SurfacePanelInput = {
  id: string;
  x1M: number;
  y1M: number;
  x2M: number;
  y2M: number;
  thicknessM: number;
  elasticModulusKnM2: number;
  poissonRatio: number;
  uniformLoadKnM2: number;
  meshSizeM: number;
  openings?: RectangularOpening[];
};
export type SurfaceMeshNode = { id: string; xM: number; yM: number };
export type SurfaceTriangle = { id: string; nodeIds: [string, string, string]; areaM2: number; aspectRatio: number };
export type SurfaceMesh = {
  nodes: SurfaceMeshNode[];
  triangles: SurfaceTriangle[];
  grossAreaM2: number;
  openingAreaM2: number;
  netAreaM2: number;
  maximumAspectRatio: number;
  totalUniformLoadKn: number;
};
export type PlateNodeResult = { nodeId: string; deflectionM: number; mxKnMPerM: number; myKnMPerM: number; mxyKnMPerM: number };
export type PlateEdgeReaction = { edge: "left" | "right" | "bottom" | "top"; totalKn: number; lineLoadKnM: number };
export type RectangularSurfaceEdge = PlateEdgeReaction["edge"];
export type PlateBendingStiffness = { D11: number; D22: number; D12: number; D66: number };
export type RectangularPlateResult = {
  boundary: "simply-supported-four-edges" | "cantilever-fixed-edge" | "one-way-simply-supported";
  bendingRigidityKnM: number;
  totalLoadKn: number;
  maximumDeflectionM: number;
  maximumMxKnMPerM: number;
  maximumMyKnMPerM: number;
  edgeReactions: PlateEdgeReaction[];
  equilibriumResidualKn: number;
  nodeResults: PlateNodeResult[];
  warnings: string[];
};
export type SurfaceAnalysis = {
  mesh: SurfaceMesh | null;
  plate: RectangularPlateResult | null;
  errors: string[];
  warnings: string[];
};

const finite = (value: number) => Number.isFinite(value);
const uniqueSorted = (values: number[]) => values.sort((a, b) => a - b).filter((value, index, all) => index === 0 || value - all[index - 1] > 1e-9);
const contains = (opening: { x1: number; y1: number; x2: number; y2: number }, x: number, y: number) => x > opening.x1 + 1e-9 && x < opening.x2 - 1e-9 && y > opening.y1 + 1e-9 && y < opening.y2 - 1e-9;

function validatePanel(input: SurfacePanelInput) {
  const errors: string[] = [];
  const width = Math.abs(input.x2M - input.x1M);
  const height = Math.abs(input.y2M - input.y1M);
  if (![input.x1M, input.y1M, input.x2M, input.y2M].every(finite) || width <= 1e-8 || height <= 1e-8) errors.push("Le panneau doit être un rectangle de dimensions positives en mètres.");
  if (!finite(input.thicknessM) || input.thicknessM < 0.03 || input.thicknessM > 1) errors.push("L’épaisseur de plaque doit être comprise entre 0,03 et 1,00 m.");
  if (!finite(input.elasticModulusKnM2) || input.elasticModulusKnM2 <= 0) errors.push("Le module d’élasticité doit être strictement positif en kN/m².");
  if (!finite(input.poissonRatio) || input.poissonRatio <= -0.49 || input.poissonRatio >= 0.49) errors.push("Le coefficient de Poisson doit être compris entre −0,49 et 0,49.");
  if (!finite(input.uniformLoadKnM2) || input.uniformLoadKnM2 < 0) errors.push("La charge uniforme doit être positive ou nulle en kN/m² pour ce cas gravitaire.");
  if (!finite(input.meshSizeM) || input.meshSizeM < 0.1 || input.meshSizeM > 10) errors.push("La taille de maille doit être comprise entre 0,10 et 10 m.");
  return { errors, width, height, x0: Math.min(input.x1M, input.x2M), y0: Math.min(input.y1M, input.y2M), x1: Math.max(input.x1M, input.x2M), y1: Math.max(input.y1M, input.y2M) };
}

function normalizedOpenings(input: SurfacePanelInput, bounds: ReturnType<typeof validatePanel>) {
  const openings: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const inputOpenings = input.openings ?? [];
  for (let index = 0; index < inputOpenings.length; index++) {
    const opening = inputOpenings[index];
    if (![opening.x1M, opening.y1M, opening.x2M, opening.y2M].every(finite)) return { openings, error: `Ouverture ${index + 1} : coordonnées non finies.` };
    const x1 = bounds.x0 + Math.min(opening.x1M, opening.x2M);
    const x2 = bounds.x0 + Math.max(opening.x1M, opening.x2M);
    const y1 = bounds.y0 + Math.min(opening.y1M, opening.y2M);
    const y2 = bounds.y0 + Math.max(opening.y1M, opening.y2M);
    if (x2 - x1 <= 1e-6 || y2 - y1 <= 1e-6) return { openings, error: `Ouverture ${index + 1} : dimensions nulles ou négatives.` };
    if (x1 < bounds.x0 - 1e-8 || y1 < bounds.y0 - 1e-8 || x2 > bounds.x1 + 1e-8 || y2 > bounds.y1 + 1e-8) return { openings, error: `Ouverture ${index + 1} : elle doit rester entièrement à l’intérieur du panneau.` };
    if (openings.some(prior => Math.min(prior.x2, x2) - Math.max(prior.x1, x1) > 1e-8 && Math.min(prior.y2, y2) - Math.max(prior.y1, y1) > 1e-8)) return { openings, error: `Ouverture ${index + 1} : les ouvertures rectangulaires ne doivent pas se chevaucher.` };
    openings.push({ x1, y1, x2, y2 });
  }
  return { openings, error: null as string | null };
}

export type SurfacePlanSupportMember = { type: string; x: number; y: number; x2?: number; y2?: number };

/** Require a continuous real beam/wall path on each rectangular plate edge. */
export function checkRectangularSurfaceEdgeSupports(panel: { x1: number; y1: number; x2: number; y2: number }, members: SurfacePlanSupportMember[], tolerance = 1e-3) {
  const missingEdges: Array<"left" | "right" | "bottom" | "top"> = [];
  const x0 = Math.min(panel.x1, panel.x2), x1 = Math.max(panel.x1, panel.x2);
  const y0 = Math.min(panel.y1, panel.y2), y1 = Math.max(panel.y1, panel.y2);
  const usable = members.filter(item => (item.type === "Poutre" || item.type === "Voile") && item.x2 !== undefined && item.y2 !== undefined);
  const covered = (segments: Array<[number, number]>, start: number, end: number) => {
    let cursor = start;
    for (const [segmentStart, segmentEnd] of segments.sort((a, b) => a[0] - b[0])) {
      if (segmentEnd < cursor - tolerance) continue;
      if (segmentStart > cursor + tolerance) return false;
      cursor = Math.max(cursor, segmentEnd);
      if (cursor >= end - tolerance) return true;
    }
    return false;
  };
  const horizontal = (y: number) => covered(usable.filter(item => Math.abs(item.y - y) <= tolerance && Math.abs((item.y2 as number) - y) <= tolerance).map(item => [Math.min(item.x, item.x2 as number), Math.max(item.x, item.x2 as number)] as [number, number]), x0, x1);
  const vertical = (x: number) => covered(usable.filter(item => Math.abs(item.x - x) <= tolerance && Math.abs((item.x2 as number) - x) <= tolerance).map(item => [Math.min(item.y, item.y2 as number), Math.max(item.y, item.y2 as number)] as [number, number]), y0, y1);
  const edgeStatus: Record<RectangularSurfaceEdge, boolean> = { left: vertical(x0), right: vertical(x1), bottom: horizontal(y0), top: horizontal(y1) };
  for (const edge of ["left", "right", "bottom", "top"] as const) if (!edgeStatus[edge]) missingEdges.push(edge);
  const supportedEdges = (["left", "right", "bottom", "top"] as const).filter(edge => edgeStatus[edge]);
  return { supported: missingEdges.length === 0, missingEdges, supportedEdges };
}

/** Structured triangular display/transfer mesh for a rectangular slab with rectangular openings. */
export function meshRectangularSurface(input: SurfacePanelInput): { mesh: SurfaceMesh | null; errors: string[]; warnings: string[] } {
  const bounds = validatePanel(input);
  const errors = [...bounds.errors];
  const warnings: string[] = [];
  const openingData = normalizedOpenings(input, bounds);
  if (openingData.error) errors.push(openingData.error);
  if (errors.length) return { mesh: null, errors, warnings };
  const openings = openingData.openings;
  const nx = Math.max(2, Math.ceil(bounds.width / input.meshSizeM));
  const ny = Math.max(2, Math.ceil(bounds.height / input.meshSizeM));
  if (nx * ny > 10000) return { mesh: null, errors: ["Le maillage dépasse 10 000 cellules ; augmenter la taille de maille."], warnings };
  const xs = uniqueSorted([
    ...Array.from({ length: nx + 1 }, (_, index) => bounds.x0 + (bounds.width * index) / nx),
    ...openings.flatMap(item => [item.x1, item.x2]),
  ]);
  const ys = uniqueSorted([
    ...Array.from({ length: ny + 1 }, (_, index) => bounds.y0 + (bounds.height * index) / ny),
    ...openings.flatMap(item => [item.y1, item.y2]),
  ]);
  const nodes: SurfaceMeshNode[] = [];
  const nodeIds = new Map<string, string>();
  const addNode = (xM: number, yM: number) => {
    const key = `${xM.toFixed(9)}:${yM.toFixed(9)}`;
    let id = nodeIds.get(key);
    if (!id) {
      id = `SN${String(nodes.length + 1).padStart(5, "0")}`;
      nodeIds.set(key, id);
      nodes.push({ id, xM, yM });
    }
    return id;
  };
  const triangles: SurfaceTriangle[] = [];
  let openingAreaM2 = openings.reduce((sum, item) => sum + (item.x2 - item.x1) * (item.y2 - item.y1), 0);
  for (let ix = 0; ix < xs.length - 1; ix++) {
    for (let iy = 0; iy < ys.length - 1; iy++) {
      const left = xs[ix], right = xs[ix + 1], bottom = ys[iy], top = ys[iy + 1];
      const centerX = (left + right) / 2, centerY = (bottom + top) / 2;
      if (openings.some(opening => contains(opening, centerX, centerY))) continue;
      const corners = [addNode(left, bottom), addNode(right, bottom), addNode(right, top), addNode(left, top)];
      for (const triangleIds of [[corners[0], corners[1], corners[2]], [corners[0], corners[2], corners[3]]] as const) {
        const ids: [string, string, string] = [...triangleIds];
        const points = ids.map(id => nodes.find(node => node.id === id)!);
        const twiceArea = Math.abs((points[1].xM - points[0].xM) * (points[2].yM - points[0].yM) - (points[2].xM - points[0].xM) * (points[1].yM - points[0].yM));
        const areaM2 = twiceArea / 2;
        const lengths = [
          Math.hypot(points[1].xM - points[0].xM, points[1].yM - points[0].yM),
          Math.hypot(points[2].xM - points[1].xM, points[2].yM - points[1].yM),
          Math.hypot(points[0].xM - points[2].xM, points[0].yM - points[2].yM),
        ];
        const aspectRatio = twiceArea > 1e-12 ? Math.max(...lengths) ** 2 / twiceArea : Infinity;
        triangles.push({ id: `ST${String(triangles.length + 1).padStart(5, "0")}`, nodeIds: ids, areaM2, aspectRatio });
      }
    }
  }
  const grossAreaM2 = bounds.width * bounds.height;
  const netAreaM2 = grossAreaM2 - openingAreaM2;
  const meshAreaM2 = triangles.reduce((sum, triangle) => sum + triangle.areaM2, 0);
  const maximumAspectRatio = Math.max(0, ...triangles.map(item => item.aspectRatio));
  const areaResidual = Math.abs(meshAreaM2 - netAreaM2);
  if (areaResidual > Math.max(1e-8, netAreaM2 * 1e-8)) errors.push(`La conservation d’aire du maillage échoue (${areaResidual.toExponential(2)} m²).`);
  if (maximumAspectRatio > 5) warnings.push(`Qualité de maillage à vérifier : rapport d’aspect maximal ${maximumAspectRatio.toFixed(2)}.`);
  const mesh: SurfaceMesh = {
    nodes,
    triangles,
    grossAreaM2,
    openingAreaM2,
    netAreaM2,
    maximumAspectRatio,
    totalUniformLoadKn: netAreaM2 * input.uniformLoadKnM2,
  };
  return { mesh: errors.length ? null : mesh, errors, warnings };
}

function plateField(xM: number, yM: number, widthM: number, heightM: number, rigidity: number, loadKnM2: number, poissonRatio: number, terms: number) {
  let deflectionM = 0, mxKnMPerM = 0, myKnMPerM = 0, mxyKnMPerM = 0;
  for (let m = 1; m <= terms; m += 2) {
    const alpha = (m * Math.PI) / widthM;
    for (let n = 1; n <= terms; n += 2) {
      const beta = (n * Math.PI) / heightM;
      const lambda = (m / widthM) ** 2 + (n / heightM) ** 2;
      const coefficient = (16 * loadKnM2) / (Math.PI ** 6 * rigidity * m * n * lambda ** 2);
      const sx = Math.sin(alpha * xM), sy = Math.sin(beta * yM);
      const shape = sx * sy;
      const wxx = -(alpha ** 2) * coefficient * shape;
      const wyy = -(beta ** 2) * coefficient * shape;
      deflectionM += coefficient * shape;
      mxKnMPerM += -rigidity * (wxx + poissonRatio * wyy);
      myKnMPerM += -rigidity * (wyy + poissonRatio * wxx);
      mxyKnMPerM += -rigidity * (1 - poissonRatio) * alpha * beta * coefficient * Math.cos(alpha * xM) * Math.cos(beta * yM);
    }
  }
  return { deflectionM, mxKnMPerM, myKnMPerM, mxyKnMPerM };
}

function integrateEdgeFlux(input: SurfacePanelInput, widthM: number, heightM: number, rigidity: number, terms: number) {
  const integrate = (edge: "left" | "right" | "bottom" | "top") => {
    const length = edge === "left" || edge === "right" ? heightM : widthM;
    const steps = 160;
    let sum = 0;
    for (let index = 0; index <= steps; index++) {
      const position = (length * index) / steps;
      let shear = 0;
      for (let m = 1; m <= terms; m += 2) {
        const alpha = (m * Math.PI) / widthM;
        for (let n = 1; n <= terms; n += 2) {
          const beta = (n * Math.PI) / heightM;
          const lambda = (m / widthM) ** 2 + (n / heightM) ** 2;
          const coefficient = (16 * input.uniformLoadKnM2) / (Math.PI ** 6 * rigidity * m * n * lambda ** 2);
          if (edge === "left" || edge === "right") {
            const xFactor = edge === "left" ? 1 : Math.cos(m * Math.PI);
            shear += rigidity * Math.PI ** 2 * lambda * alpha * coefficient * xFactor * Math.sin(beta * position);
          } else {
            const yFactor = edge === "bottom" ? 1 : Math.cos(n * Math.PI);
            shear += rigidity * Math.PI ** 2 * lambda * beta * coefficient * yFactor * Math.sin(alpha * position);
          }
        }
      }
      const weight = index === 0 || index === steps ? 1 : index % 2 ? 4 : 2;
      sum += weight * Math.abs(shear);
    }
    return (sum * length) / (3 * steps);
  };
  return ["left", "right", "bottom", "top"].map(edge => ({ edge: edge as PlateEdgeReaction["edge"], raw: integrate(edge as PlateEdgeReaction["edge"]) }));
}

/**
 * Navier-series elastic Kirchhoff plate solution evaluated on a triangular mesh.
 * Domain: homogeneous rectangular isotropic slab, uniform downward load, all four edges simply supported.
 * Openings are meshed and excluded from area/load, but deliberately block this closed-rectangle solver.
 */
export function analyzeSimplySupportedRectangularPlate(input: SurfacePanelInput, terms = 21): SurfaceAnalysis {
  const meshed = meshRectangularSurface(input);
  const errors = [...meshed.errors];
  const warnings = [...meshed.warnings];
  if (!meshed.mesh) return { mesh: null, plate: null, errors, warnings };
  if ((input.openings ?? []).length) errors.push("Le maillage exclut bien les trémies et conserve l’aire/charge, mais le solveur Navier v1 ne résout pas encore une plaque avec ouverture : résultats bloqués.");
  const bounds = validatePanel(input);
  if (bounds.errors.length) errors.push(...bounds.errors);
  if (errors.length) return { mesh: meshed.mesh, plate: null, errors, warnings };
  const widthM = bounds.width, heightM = bounds.height;
  const rigidity = (input.elasticModulusKnM2 * input.thicknessM ** 3) / (12 * (1 - input.poissonRatio ** 2));
  const boundedTerms = Math.max(3, Math.min(41, Math.floor(terms) | 1));
  const nodeResults = meshed.mesh.nodes.map(node => {
    const field = plateField(node.xM - bounds.x0, node.yM - bounds.y0, widthM, heightM, rigidity, input.uniformLoadKnM2, input.poissonRatio, boundedTerms);
    return { nodeId: node.id, ...field };
  });
  const maxAbs = (key: "mxKnMPerM" | "myKnMPerM") => Math.max(0, ...nodeResults.map(item => Math.abs(item[key])));
  const edgeRaw = integrateEdgeFlux(input, widthM, heightM, rigidity, boundedTerms);
  const rawTotal = edgeRaw.reduce((sum, item) => sum + item.raw, 0);
  const totalLoadKn = input.uniformLoadKnM2 * meshed.mesh.netAreaM2;
  const reactions = edgeRaw.map(item => {
    const totalKn = rawTotal > 1e-12 ? totalLoadKn * item.raw / rawTotal : totalLoadKn / 4;
    const lengthM = item.edge === "left" || item.edge === "right" ? heightM : widthM;
    return { edge: item.edge, totalKn, lineLoadKnM: lengthM > 0 ? totalKn / lengthM : 0 };
  });
  const reactionTotal = reactions.reduce((sum, item) => sum + item.totalKn, 0);
  const equilibriumResidualKn = reactionTotal - totalLoadKn;
  warnings.push("Méthode Navier analytique, plaque homogène isotrope et appuis simples sur quatre côtés ; elle n’est pas couplée aux rigidités des poutres/voiles du modèle global.");
  warnings.push("Matériau, appuis réels, ouvertures et conditions de continuité doivent être vérifiés par l’ingénieur.");
  const plate: RectangularPlateResult = {
    boundary: "simply-supported-four-edges",
    bendingRigidityKnM: rigidity,
    totalLoadKn,
    maximumDeflectionM: Math.max(0, ...nodeResults.map(item => Math.abs(item.deflectionM))),
    maximumMxKnMPerM: maxAbs("mxKnMPerM"),
    maximumMyKnMPerM: maxAbs("myKnMPerM"),
    edgeReactions: reactions,
    equilibriumResidualKn,
    nodeResults,
    warnings,
  };
  return { mesh: meshed.mesh, plate, errors: [], warnings };
}

type RitzBoundary =
  | { kind: "cantilever"; fixedEdge: RectangularSurfaceEdge }
  | { kind: "one-way"; spanDirection: "X" | "Y" };

const GAUSS_5 = [
  { point: 0.046910077030668, weight: 0.118463442528095 },
  { point: 0.230765344947158, weight: 0.239314335249683 },
  { point: 0.5, weight: 0.284444444444444 },
  { point: 0.769234655052842, weight: 0.239314335249683 },
  { point: 0.953089922969332, weight: 0.118463442528095 },
];

function powerDerivative(power: number, order: number, value: number) {
  if (power < order) return 0;
  let coefficient = 1;
  for (let index = 0; index < order; index++) coefficient *= power - index;
  return coefficient * value ** (power - order);
}

function basisAlongSpan(s: number, index: number, kind: RitzBoundary["kind"]) {
  if (kind === "cantilever") {
    const power = index + 2;
    return { value: s ** power, first: powerDerivative(power, 1, s), second: powerDerivative(power, 2, s) };
  }
  const power = index + 1;
  return {
    value: s ** power - s ** (power + 1),
    first: powerDerivative(power, 1, s) - powerDerivative(power + 1, 1, s),
    second: powerDerivative(power, 2, s) - powerDerivative(power + 1, 2, s),
  };
}

function basisAcrossWidth(t: number, index: number) {
  const centered = 2 * t - 1;
  return {
    value: centered ** index,
    first: index === 0 ? 0 : 2 * index * centered ** (index - 1),
    second: index < 2 ? 0 : 4 * index * (index - 1) * centered ** (index - 2),
  };
}

function solveDenseSystem(matrix: number[][], vector: number[]) {
  const n = vector.length;
  const a = matrix.map(row => [...row]);
  const b = [...vector];
  const scale = Math.max(1, ...a.map((row, index) => Math.abs(row[index])));
  for (let column = 0; column < n; column++) {
    let pivotRow = column;
    for (let row = column + 1; row < n; row++) if (Math.abs(a[row][column]) > Math.abs(a[pivotRow][column])) pivotRow = row;
    if (Math.abs(a[pivotRow][column]) <= scale * 1e-13) return null;
    [a[column], a[pivotRow]] = [a[pivotRow], a[column]];
    [b[column], b[pivotRow]] = [b[pivotRow], b[column]];
    for (let row = column + 1; row < n; row++) {
      const factor = a[row][column] / a[column][column];
      if (!factor) continue;
      for (let j = column; j < n; j++) a[row][j] -= factor * a[column][j];
      b[row] -= factor * b[column];
    }
  }
  const solution = Array(n).fill(0) as number[];
  for (let row = n - 1; row >= 0; row--) {
    let value = b[row];
    for (let column = row + 1; column < n; column++) value -= a[row][column] * solution[column];
    solution[row] = value / a[row][row];
  }
  return solution.every(Number.isFinite) ? solution : null;
}

/**
 * Rayleigh–Ritz Kirchhoff plate solution for a cantilevered rectangular balcony
 * or a one-way orthotropic hollow-core slab. Results are evaluated at the nodes
 * of the same triangular surface mesh used for load/area accounting.
 */
function analyzeRitzRectangularPlate(input: SurfacePanelInput, stiffness: PlateBendingStiffness, boundary: RitzBoundary): SurfaceAnalysis {
  const meshed = meshRectangularSurface(input);
  const errors = [...meshed.errors];
  const warnings = [...meshed.warnings];
  if (!meshed.mesh) return { mesh: null, plate: null, errors, warnings };
  if ((input.openings ?? []).length) errors.push("Le maillage exclut bien les trémies et conserve l’aire/charge, mais le solveur Rayleigh–Ritz ne résout pas encore les plaques avec ouvertures : résultats bloqués.");
  const bounds = validatePanel(input);
  if (bounds.errors.length) errors.push(...bounds.errors);
  const { D11, D22, D12, D66 } = stiffness;
  if (![D11, D22, D12, D66].every(finite) || D11 <= 0 || D22 <= 0 || D66 <= 0 || D11 * D22 - D12 ** 2 <= 0) {
    errors.push("La matrice de rigidité orthotrope de la plaque n’est pas définie positive.");
  }
  if (errors.length) return { mesh: meshed.mesh, plate: null, errors, warnings };

  const alongX = boundary.kind === "one-way" ? boundary.spanDirection === "X" : boundary.fixedEdge === "left" || boundary.fixedEdge === "right";
  const spanM = alongX ? bounds.width : bounds.height;
  const widthM = alongX ? bounds.height : bounds.width;
  const local = (xM: number, yM: number) => {
    if (boundary.kind === "one-way") return { sM: alongX ? xM - bounds.x0 : yM - bounds.y0, tM: alongX ? yM - bounds.y0 : xM - bounds.x0 };
    switch (boundary.fixedEdge) {
      case "left": return { sM: xM - bounds.x0, tM: yM - bounds.y0 };
      case "right": return { sM: bounds.x1 - xM, tM: yM - bounds.y0 };
      case "bottom": return { sM: yM - bounds.y0, tM: xM - bounds.x0 };
      case "top": return { sM: bounds.y1 - yM, tM: xM - bounds.x0 };
    }
  };
  const order = 4;
  const terms = Array.from({ length: order * order }, (_, index) => ({ i: Math.floor(index / order), j: index % order }));
  const evaluateBasis = (i: number, j: number, sM: number, tM: number) => {
    const span = basisAlongSpan(Math.max(0, Math.min(1, sM / spanM)), i, boundary.kind);
    const width = basisAcrossWidth(Math.max(0, Math.min(1, tM / widthM)), j);
    return {
      value: span.value * width.value,
      ss: span.second * width.value / (spanM ** 2),
      tt: span.value * width.second / (widthM ** 2),
      st: span.first * width.first / (spanM * widthM),
    };
  };

  const size = terms.length;
  const matrix = Array.from({ length: size }, () => Array(size).fill(0) as number[]);
  const load = Array(size).fill(0) as number[];
  for (const gs of GAUSS_5) for (const gt of GAUSS_5) {
    const sM = gs.point * spanM, tM = gt.point * widthM;
    const jacobianWeight = spanM * widthM * gs.weight * gt.weight;
    const values = terms.map(term => evaluateBasis(term.i, term.j, sM, tM));
    for (let row = 0; row < size; row++) {
      load[row] += input.uniformLoadKnM2 * values[row].value * jacobianWeight;
      for (let column = 0; column < size; column++) {
        const a = values[row], b = values[column];
        matrix[row][column] += jacobianWeight * (
          D11 * a.ss * b.ss + D22 * a.tt * b.tt
          + D12 * (a.ss * b.tt + a.tt * b.ss)
          + 4 * D66 * a.st * b.st
        );
      }
    }
  }
  const coefficients = solveDenseSystem(matrix, load);
  if (!coefficients) return { mesh: meshed.mesh, plate: null, errors: ["Le système de plaque est singulier ou mal conditionné avec les conditions de bord choisies."], warnings };

  const nodeResults = meshed.mesh.nodes.map(node => {
    const position = local(node.xM, node.yM);
    let deflectionM = 0, kss = 0, ktt = 0, kst = 0;
    terms.forEach((term, index) => {
      const field = evaluateBasis(term.i, term.j, position.sM, position.tM);
      deflectionM += coefficients[index] * field.value;
      kss += coefficients[index] * field.ss;
      ktt += coefficients[index] * field.tt;
      kst += coefficients[index] * field.st;
    });
    const momentS = -(D11 * kss + D12 * ktt);
    const momentT = -(D12 * kss + D22 * ktt);
    const mxyKnMPerM = -2 * D66 * kst;
    return {
      nodeId: node.id,
      deflectionM,
      mxKnMPerM: alongX ? momentS : momentT,
      myKnMPerM: alongX ? momentT : momentS,
      mxyKnMPerM,
    };
  });
  const totalLoadKn = input.uniformLoadKnM2 * meshed.mesh.netAreaM2;
  const supportedEdges: RectangularSurfaceEdge[] = boundary.kind === "cantilever"
    ? [boundary.fixedEdge]
    : boundary.spanDirection === "X" ? ["left", "right"] : ["bottom", "top"];
  const edgeLength = (edge: RectangularSurfaceEdge) => edge === "left" || edge === "right" ? bounds.height : bounds.width;
  const reactions = (["left", "right", "bottom", "top"] as const).map(edge => {
    const totalKn = supportedEdges.includes(edge) ? totalLoadKn / supportedEdges.length : 0;
    return { edge, totalKn, lineLoadKnM: edgeLength(edge) > 0 ? totalKn / edgeLength(edge) : 0 };
  });
  const equilibriumResidualKn = reactions.reduce((sum, reaction) => sum + reaction.totalKn, 0) - totalLoadKn;
  const warningsForPlate = boundary.kind === "cantilever"
    ? ["Modèle Kirchhoff–Love Rayleigh–Ritz : encastrement idéal sur la rive sélectionnée, trois autres rives libres. La liaison réelle à la façade/poutre et les armatures d’ancrage doivent être vérifiées par l’ingénieur."]
    : ["Modèle orthotrope équivalent Rayleigh–Ritz : appuis simples aux deux extrémités du sens de portée, rives longitudinales libres. Vérifier entraxe, nervures et rigidité réelle selon le fabricant/projet."];
  warnings.push(...warningsForPlate);
  const plate: RectangularPlateResult = {
    boundary: boundary.kind === "cantilever" ? "cantilever-fixed-edge" : "one-way-simply-supported",
    bendingRigidityKnM: D11,
    totalLoadKn,
    maximumDeflectionM: Math.max(0, ...nodeResults.map(item => Math.abs(item.deflectionM))),
    maximumMxKnMPerM: Math.max(0, ...nodeResults.map(item => Math.abs(item.mxKnMPerM))),
    maximumMyKnMPerM: Math.max(0, ...nodeResults.map(item => Math.abs(item.myKnMPerM))),
    edgeReactions: reactions,
    equilibriumResidualKn,
    nodeResults,
    warnings: warningsForPlate,
  };
  return { mesh: meshed.mesh, plate, errors: [], warnings };
}

export function analyzeCantileverRectangularPlate(input: SurfacePanelInput, stiffness: PlateBendingStiffness, fixedEdge: RectangularSurfaceEdge): SurfaceAnalysis {
  return analyzeRitzRectangularPlate(input, stiffness, { kind: "cantilever", fixedEdge });
}

export function analyzeOneWayOrthotropicRectangularPlate(input: SurfacePanelInput, stiffness: PlateBendingStiffness, spanDirection: "X" | "Y"): SurfaceAnalysis {
  const localStiffness = spanDirection === "X" ? stiffness : { D11: stiffness.D22, D22: stiffness.D11, D12: stiffness.D12, D66: stiffness.D66 };
  return analyzeRitzRectangularPlate(input, localStiffness, { kind: "one-way", spanDirection });
}
