import type { AnalyticalModel, AnalyticalSurface } from "./analytical-model";

export type MeshPoint3D = { x: number; y: number; z: number };
export type MeshNode3D = MeshPoint3D & { id: string };
export type MeshTriangle3D = { id: string; surfaceId: string; nodeIds: [string, string, string]; areaM2: number };
export type SurfaceMeshCoverage = {
  surfaceId: string;
  sourceElementId: string;
  sourceType: string;
  kind: AnalyticalSurface["kind"];
  nodeCount: number;
  triangleCount: number;
  areaM2: number;
  errors: string[];
  warnings: string[];
};
export type AnalyticalSurfaceMesh = {
  targetSizeM: number;
  nodes: MeshNode3D[];
  triangles: MeshTriangle3D[];
  surfaces: SurfaceMeshCoverage[];
  errors: string[];
  warnings: string[];
};

const distance = (a: MeshPoint3D, b: MeshPoint3D) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const triangleArea = (a: MeshPoint3D, b: MeshPoint3D, c: MeshPoint3D) => {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  return Math.hypot(ab.y * ac.z - ab.z * ac.y, ab.z * ac.x - ab.x * ac.z, ab.x * ac.y - ab.y * ac.x) / 2;
};
const uniquePoints = (points: MeshPoint3D[]) => points.filter((point, index) => points.findIndex(other => distance(point, other) <= 1e-8) === index);

/**
 * Build a shared-node, triangulated geometric mesh for every analytical surface.
 * This is a geometry/coverage mesh; it does not imply shell stiffness, diaphragm,
 * opening, or frame-shell coupling in the structural solver.
 */
export function meshAnalyticalSurfaces(model: AnalyticalModel, targetSizeM: number): AnalyticalSurfaceMesh {
  const result: AnalyticalSurfaceMesh = { targetSizeM, nodes: [], triangles: [], surfaces: [], errors: [], warnings: [] };
  if (!Number.isFinite(targetSizeM) || targetSizeM < 0.1 || targetSizeM > 10) {
    result.errors.push("La taille de maille doit être comprise entre 0,10 et 10 m.");
    return result;
  }
  const modelNodes = new Map(model.nodes.map(node => [node.id, node]));
  const sharedNodes = new Map<string, string>();
  let totalCells = 0;
  const addNode = (point: MeshPoint3D) => {
    const key = `${point.x.toFixed(7)}:${point.y.toFixed(7)}:${point.z.toFixed(7)}`;
    const existing = sharedNodes.get(key);
    if (existing) return existing;
    const id = `MN${String(result.nodes.length + 1).padStart(6, "0")}`;
    sharedNodes.set(key, id);
    result.nodes.push({ id, ...point });
    return id;
  };
  for (const surface of model.surfaces) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const points = uniquePoints(surface.nodeIds.map(id => modelNodes.get(id)).filter((node): node is NonNullable<typeof node> => Boolean(node)).map(({ x, y, z }) => ({ x, y, z })));
    const missingReferences = surface.nodeIds.length - points.length;
    if (missingReferences) errors.push(`${missingReferences} nœud(s) manquant(s) ou dupliqué(s) dans le contour analytique.`);
    if (points.length < 3) errors.push("Une surface maillable doit avoir au moins trois sommets distincts.");
    const contourAreaM2 = points.length >= 3
      ? points.slice(1, -1).reduce((area, point, index) => area + triangleArea(points[0], point, points[index + 2]), 0)
      : 0;
    if (points.length >= 3 && contourAreaM2 <= 1e-10) errors.push("Le contour est de surface nulle ou dégénéré ; corrigez les sommets de la surface.");
    const localTriangles: Array<[MeshPoint3D, MeshPoint3D, MeshPoint3D]> = [];
    if (!errors.length && points.length === 4) {
      const [a, b, c, d] = points;
      const nx = Math.max(1, Math.ceil(Math.max(distance(a, b), distance(d, c)) / targetSizeM));
      const ny = Math.max(1, Math.ceil(Math.max(distance(b, c), distance(a, d)) / targetSizeM));
      if (nx * ny > 10_000 || totalCells + nx * ny > 100_000) errors.push("Le maillage de surface dépasse la limite de calcul (10 000 cellules par surface, 100 000 au total) ; augmentez la taille cible.");
      else {
        totalCells += nx * ny;
        const grid: MeshPoint3D[][] = [];
        for (let i = 0; i <= nx; i++) {
          const u = i / nx;
          grid[i] = [];
          for (let j = 0; j <= ny; j++) {
            const v = j / ny;
            grid[i][j] = {
              x: (1 - u) * (1 - v) * a.x + u * (1 - v) * b.x + u * v * c.x + (1 - u) * v * d.x,
              y: (1 - u) * (1 - v) * a.y + u * (1 - v) * b.y + u * v * c.y + (1 - u) * v * d.y,
              z: (1 - u) * (1 - v) * a.z + u * (1 - v) * b.z + u * v * c.z + (1 - u) * v * d.z,
            };
          }
        }
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
          localTriangles.push([grid[i][j], grid[i + 1][j], grid[i + 1][j + 1]], [grid[i][j], grid[i + 1][j + 1], grid[i][j + 1]]);
        }
      }
    } else if (!errors.length) {
      if (points.length > 4) warnings.push("Contour polygonal maillé en éventail ; vérifier visuellement la qualité de triangulation.");
      for (let index = 1; index < points.length - 1; index++) localTriangles.push([points[0], points[index], points[index + 1]]);
    }
    const surfaceNodeIds = new Set<string>();
    let areaM2 = 0;
    for (const [a, b, c] of localTriangles) {
      const area = triangleArea(a, b, c);
      if (!Number.isFinite(area) || area <= 1e-10) {
        errors.push("Le contour produit un triangle dégénéré ; corrigez les sommets de la surface.");
        continue;
      }
      const nodeIds: [string, string, string] = [addNode(a), addNode(b), addNode(c)];
      nodeIds.forEach(id => surfaceNodeIds.add(id));
      const id = `MT${String(result.triangles.length + 1).padStart(7, "0")}`;
      result.triangles.push({ id, surfaceId: surface.id, nodeIds, areaM2: area });
      areaM2 += area;
    }
    if (localTriangles.length && !errors.length && areaM2 <= 1e-10) errors.push("Aire triangulée nulle.");
    const uniqueErrors = [...new Set(errors)];
    const coverage: SurfaceMeshCoverage = { surfaceId: surface.id, sourceElementId: surface.sourceElementId, sourceType: surface.sourceType, kind: surface.kind, nodeCount: surfaceNodeIds.size, triangleCount: result.triangles.filter(triangle => triangle.surfaceId === surface.id).length, areaM2, errors: uniqueErrors, warnings };
    result.surfaces.push(coverage);
    result.errors.push(...uniqueErrors.map(message => `${surface.sourceElementId} (${surface.kind}) · ${message}`));
    result.warnings.push(...warnings.map(message => `${surface.sourceElementId} · ${message}`));
  }
  if (!model.surfaces.length) result.warnings.push("Le modèle analytique ne contient aucune surface à mailler.");
  return result;
}
