export const SURFACE_ANALYSIS_SCHEMA_VERSION = 1 as const;

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
export type RectangularPlateResult = {
  boundary: "simply-supported-four-edges";
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
  if (!vertical(x0)) missingEdges.push("left");
  if (!vertical(x1)) missingEdges.push("right");
  if (!horizontal(y0)) missingEdges.push("bottom");
  if (!horizontal(y1)) missingEdges.push("top");
  return { supported: missingEdges.length === 0, missingEdges };
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
  warnings.push("Méthode Navier analytique, plaque homogène isotrope et appuis simples sur quatre côtés ; ce résultat n’est pas couplé aux rigidités des poutres/voiles du modèle global.");
  warnings.push("Matériau et conditions de bord doivent être confirmés par l’ingénieur ; les dalles à corps creux, voiles, ouvertures et appuis continus ne sont pas résolus par ce solveur v1.");
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
