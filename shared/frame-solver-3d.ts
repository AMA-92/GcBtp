import type { AnalyticalModel, AnalyticalFrame, DegreeOfFreedom } from "./analytical-model";
import type { BuildingLoadModel } from "./building-load-propagation";
import type { LoadCombination, LoadProgram } from "./load-case-program";
import { buildGravityMemberLoads } from "./frame-solver-2d";
import { classifyFrameStrain, type ConstitutiveState } from "./nonlinear-material";

export type Spatial3DReaction = { nodeId: string; fxKn: number; fyKn: number; fzKn: number; mxKnM: number; myKnM: number; mzKnM: number };
export type Spatial3DEndForces = { axialKn: number; shearYKn: number; shearZKn: number; torsionKnM: number; momentYKnM: number; momentZKnM: number };
export type Spatial3DGlobalEndForces = { fxKn: number; fyKn: number; fzKn: number; mxKnM: number; myKnM: number; mzKnM: number };
export type Spatial3DElementResult = {
  elementId: string;
  sourceElementId: string;
  lengthM: number;
  start: Spatial3DEndForces;
  end: Spatial3DEndForces;
  startGlobal: Spatial3DGlobalEndForces;
  endGlobal: Spatial3DGlobalEndForces;
  axialForceKn: number;
  maxAbsMomentKnM: number;
  maxAbsShearKn: number;
  maxAbsTorsionKnM: number;
  compressionKn: number;
  tensionKn: number;
  strain: number;
};
export type Spatial3DResult = {
  nodeDisplacements: Array<{ nodeId: string; uxM: number; uyM: number; uzM: number; rxRad: number; ryRad: number; rzRad: number }>;
  reactions: Spatial3DReaction[];
  elements: Spatial3DElementResult[];
  equilibrium: {
    appliedFxKn: number; appliedFyKn: number; appliedFzKn: number;
    reactionFxKn: number; reactionFyKn: number; reactionFzKn: number;
    appliedMxKnM?: number; appliedMyKnM?: number; appliedMzKnM?: number;
    reactionMxKnM?: number; reactionMyKnM?: number; reactionMzKnM?: number;
  };
  elementCount: number;
  warnings: string[];
  pDelta?: { stabilityIndex: number; displacementAmplification: number; iterations: number; converged: boolean };
  nonlinearStates?: Array<{ elementId: string; axialStrain: number; state: ConstitutiveState }>;
};
export type Spatial3DPreparation = { result: Spatial3DResult | null; errors: string[]; warnings: string[] };
export type Spatial3DStoryLateralLoad = { storyIndex: number; fxKn: number; fyKn: number };
export type Spatial3DOptions = {
  storyLateralLoads?: Spatial3DStoryLateralLoad[];
  pDelta?: boolean;
  pDeltaMaxIterations?: number;
  pDeltaTolerance?: number;
  pDeltaLimit?: number;
  rigidDiaphragm?: boolean;
};

const zeros = (n: number) => Array.from({ length: n }, () => Array(n).fill(0) as number[]);
const dot = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const matVec = (a: number[][], x: number[]) => a.map(row => dot(row, x));
const transpose = (a: number[][]) => a[0].map((_, j) => a.map(row => row[j]));
const multiply = (a: number[][], b: number[][]) => a.map(row => b[0].map((_, j) => row.reduce((sum, value, i) => sum + value * b[i][j], 0)));
const addBlock = (target: number[][], block: number[][], ids: number[]) => block.forEach((row, i) => row.forEach((value, j) => { target[ids[i]][ids[j]] += value; }));
const addVector = (target: number[], source: number[], ids: number[]) => source.forEach((value, i) => { target[ids[i]] += value; });
const finite = (value: number | undefined) => Number.isFinite(value) ? value! : 0;

/** Dense Gaussian solver retained as a small-model reference solver. */
export function solveDenseSystem(matrix: number[][], rhs: number[], tolerance = 1e-12) {
  const n = rhs.length;
  if (matrix.length !== n || matrix.some(row => row.length !== n)) throw new Error("Matrice de rigidité non carrée.");
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  const scale = Math.max(1, ...matrix.flat().map(value => Math.abs(value)));
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) <= tolerance * scale) throw new Error(`Matrice 3D singulière au degré de liberté ${col} (mécanisme, release ou appui insuffisant).`);
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const d = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= d;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      if (Math.abs(factor) < 1e-30) continue;
      for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map(row => row[n]);
}

function cross(a: number[], b: number[]) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a: number[]) { return Math.hypot(...a); }
function unit(a: number[]) { const n = norm(a); if (n < 1e-12) throw new Error("Axe local de barre indéterminé."); return a.map(value => value / n); }
function localAxes(dx: number, dy: number, dz: number) {
  const ex = unit([dx, dy, dz]);
  const reference = Math.abs(ex[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  const ey = unit(cross(reference, ex));
  const ez = unit(cross(ex, ey));
  return [ex, ey, ez];
}
function transformation12(r: number[][]) {
  const t = Array.from({ length: 12 }, () => Array(12).fill(0));
  for (let block = 0; block < 4; block++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) t[block * 3 + i][block * 3 + j] = r[i][j];
  return t;
}

/** Saint-Venant torsion constant for common sections. */
function torsionConstant(section: { shape?: string; dimensionsM?: number[]; inertiaY4M4?: number | null; inertiaZ4M4?: number | null }) {
  if (section.shape === "circle" && section.dimensionsM?.[0]) {
    const d = section.dimensionsM[0];
    return Math.PI * d ** 4 / 32;
  }
  const b = section.dimensionsM?.[0] ?? 0;
  const h = section.dimensionsM?.[1] ?? 0;
  if (b > 0 && h > 0) {
    const a = Math.max(b, h), c = Math.min(b, h);
    // Exact series approximation for a solid rectangle; sufficiently accurate for structural sections.
    const ratio = c / a;
    return a * c ** 3 * (1 / 3 - 0.21 * ratio * (1 - ratio ** 4 / 12));
  }
  return Math.max(1e-12, Math.min(section.inertiaY4M4 ?? 0, section.inertiaZ4M4 ?? 0) * 2);
}

function localStiffness3D(E: number, nu: number, A: number, Iy: number, Iz: number, Jt: number, L: number) {
  const k = zeros(12);
  const G = E / (2 * (1 + nu));
  const a = E * A / L, t = G * Jt / L;
  const by = 12 * E * Iy / L ** 3, cy = 6 * E * Iy / L ** 2, dy = 4 * E * Iy / L, ey = 2 * E * Iy / L;
  const bz = 12 * E * Iz / L ** 3, cz = 6 * E * Iz / L ** 2, dz = 4 * E * Iz / L, ez = 2 * E * Iz / L;
  const put = (i: number, j: number, value: number) => { k[i][j] += value; };
  put(0, 0, a); put(0, 6, -a); put(6, 0, -a); put(6, 6, a);
  put(3, 3, t); put(3, 9, -t); put(9, 3, -t); put(9, 9, t);
  // v / rz -> bending about local z, uses Iz.
  [[1, 1, bz], [1, 5, cz], [1, 7, -bz], [1, 11, cz], [5, 1, cz], [5, 5, dz], [5, 7, -cz], [5, 11, ez], [7, 1, -bz], [7, 5, -cz], [7, 7, bz], [7, 11, -cz], [11, 1, cz], [11, 5, ez], [11, 7, -cz], [11, 11, dz]].forEach(([i, j, value]) => put(i as number, j as number, value as number));
  // w / ry -> bending about local y, uses Iy.
  [[2, 2, by], [2, 4, -cy], [2, 8, -by], [2, 10, -cy], [4, 2, -cy], [4, 4, dy], [4, 8, cy], [4, 10, ey], [8, 2, -by], [8, 4, cy], [8, 8, by], [8, 10, cy], [10, 2, -cy], [10, 4, ey], [10, 8, cy], [10, 10, dy]].forEach(([i, j, value]) => put(i as number, j as number, value as number));
  return k;
}

/** Geometric stiffness for a compression force. It is used iteratively for P-Delta. */
function localGeometricStiffness(compressionKn: number, L: number) {
  const kg = zeros(12);
  if (compressionKn <= 0) return kg;
  const c = compressionKn / (30 * L);
  const addPlane = (ids: [number, number, number, number]) => {
    const [i, ri, j, rj] = ids;
    const m = [[36, 3 * L, -36, 3 * L], [3 * L, 4 * L * L, -3 * L, -L * L], [-36, -3 * L, 36, -3 * L], [3 * L, -L * L, -3 * L, 4 * L * L]];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) kg[[i, ri, j, rj][a]][[i, ri, j, rj][b]] -= c * m[a][b];
  };
  addPlane([1, 5, 7, 11]);
  addPlane([2, 4, 8, 10]);
  return kg;
}

function offsetBlock(offset: [number, number, number]) {
  const b = Array.from({ length: 6 }, () => Array(6).fill(0));
  for (let i = 0; i < 6; i++) b[i][i] = 1;
  // u_point = u_node + theta x r
  b[0][4] = offset[2]; b[0][5] = -offset[1];
  b[1][3] = -offset[2]; b[1][5] = offset[0];
  b[2][3] = offset[1]; b[2][4] = -offset[0];
  return b;
}
function blockDiagonal(a: number[][], b: number[][]) {
  const out = zeros(12);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { out[i][j] = a[i][j]; out[i + 6][j + 6] = b[i][j]; }
  return out;
}

function solveSmall(matrix: number[][], rhs: number[], tolerance = 1e-12) { return solveDenseSystem(matrix, rhs, tolerance); }

/** Condense released local DOFs so released moments/forces are exactly zero. */
function applyLocalReleases(k: number[][], f: number[], releases: { start: DegreeOfFreedom[]; end: DegreeOfFreedom[] }) {
  const dofIndex: Record<DegreeOfFreedom, number> = { ux: 0, uy: 1, uz: 2, rx: 3, ry: 4, rz: 5 };
  const released = [...releases.start.map(d => dofIndex[d]), ...releases.end.map(d => 6 + dofIndex[d])];
  const unique = Array.from(new Set(released)).filter(i => i >= 0 && i < 12);
  if (!unique.length) return { k, f, released: unique, retained: Array.from({ length: 12 }, (_, i) => i), fullK: k, fullF: f };
  const retained = Array.from({ length: 12 }, (_, i) => i).filter(i => !unique.includes(i));
  const kqq = unique.map(i => unique.map(j => k[i][j]));
  const krq = retained.map(i => unique.map(j => k[i][j]));
  const kqr = unique.map(i => retained.map(j => k[i][j]));
  const krr = retained.map(i => retained.map(j => k[i][j]));
  const fq = unique.map(i => f[i]);
  let invF: number[];
  try { invF = solveSmall(kqq, fq); } catch { throw new Error("Release d’extrémité incompatible avec la rigidité de la barre."); }
  const correctionF = krq.map(row => dot(row, invF));
  const effectiveF = retained.map((_, i) => f[retained[i]] - correctionF[i]);
  const effectiveK = krr.map((row, i) => row.map((value, j) => value - dot(krq[i], solveSmall(kqq, kqr.map(r => r[j])))));
  const outK = zeros(12), outF = Array(12).fill(0) as number[];
  retained.forEach((i, ri) => { outF[i] = effectiveF[ri]; retained.forEach((j, rj) => { outK[i][j] = effectiveK[ri][rj]; }); });
  return { k: outK, f: outF, released: unique, retained, fullK: k, fullF: f };
}

function expandReleasedDisplacement(raw: number[], releaseData: ElementData["releaseData"]) {
  if (!releaseData.released.length) return raw;
  const out = raw.slice();
  const kqq = releaseData.released.map(i => releaseData.released.map(j => releaseData.fullK[i][j]));
  const kqr = releaseData.released.map(i => releaseData.retained.map(j => releaseData.fullK[i][j]));
  const fq = releaseData.released.map(i => releaseData.fullF[i]);
  const retainedD = releaseData.retained.map(i => raw[i]);
  const rhs = fq.map((value, i) => value - dot(kqr[i], retainedD));
  const q = solveSmall(kqq, rhs);
  releaseData.released.forEach((index, i) => { out[index] = q[i]; });
  return out;
}

function equivalentUniformLoad(qGlobal: [number, number, number], length: number, r: number[][]) {
  const q = matVec(r, qGlobal);
  const f = Array(12).fill(0) as number[];
  // Axial distributed load.
  f[0] = q[0] * length / 2; f[6] = q[0] * length / 2;
  // Transverse local y.
  f[1] = q[1] * length / 2; f[5] = q[1] * length ** 2 / 12; f[7] = q[1] * length / 2; f[11] = -q[1] * length ** 2 / 12;
  // Transverse local z.
  f[2] = q[2] * length / 2; f[4] = -q[2] * length ** 2 / 12; f[8] = q[2] * length / 2; f[10] = q[2] * length ** 2 / 12;
  return f;
}

function endForcesFromLocal(p: number[]): Spatial3DEndForces[] {
  return [
    { axialKn: p[0], shearYKn: p[1], shearZKn: p[2], torsionKnM: p[3], momentYKnM: p[4], momentZKnM: p[5] },
    { axialKn: p[6], shearYKn: p[7], shearZKn: p[8], torsionKnM: p[9], momentYKnM: p[10], momentZKnM: p[11] },
  ];
}
function globalEndForcesFromLocal(p: number[], transform: number[][], offset: 0 | 6): Spatial3DGlobalEndForces {
  const r = [transform[0].slice(0, 3), transform[1].slice(0, 3), transform[2].slice(0, 3)];
  const forceLocal = [p[offset], p[offset + 1], p[offset + 2]];
  const momentLocal = [p[offset + 3], p[offset + 4], p[offset + 5]];
  const rt = transpose(r);
  const f = matVec(rt, forceLocal), m = matVec(rt, momentLocal);
  return { fxKn: f[0], fyKn: f[1], fzKn: f[2], mxKnM: m[0], myKnM: m[1], mzKnM: m[2] };
}

function addRigidDiaphragmConstraints(K: number[][], model: AnalyticalModel, nodeIndex: Map<string, number>, warnings: string[]) {
  const slabNodesByLevel = new Map<string, Set<string>>();
  for (const slab of model.surfaces.filter(item => item.kind === "slab")) {
    const nodes = slabNodesByLevel.get(slab.levelId) ?? new Set<string>(); slab.nodeIds.forEach(id => nodes.add(id)); slabNodesByLevel.set(slab.levelId, nodes);
  }
  if (!slabNodesByLevel.size) return;
  // Penalty constraints implement the correct rigid-body kinematics relative to the first/master node:
  // ux_i = ux_m - rz_m*(y_i-y_m), uy_i = uy_m + rz_m*(x_i-x_m), rz_i = rz_m.
  const maximumDiagonal = Math.max(1, ...K.map((row, index) => Math.abs(row[index] ?? 0)));
  const penalty = maximumDiagonal * 1e7;
  slabNodesByLevel.forEach((nodeIds, levelId) => {
    const ids = Array.from(nodeIds).filter(id => nodeIndex.has(id));
    if (ids.length < 3) { warnings.push(`Diaphragme ${levelId} non activé : au moins trois nœuds de dalle sont nécessaires.`); return; }
    const masterNode = model.nodes[nodeIndex.get(ids[0])!];
    const master = nodeIndex.get(ids[0])!;
    for (const nodeId of ids.slice(1)) {
      const node = model.nodes[nodeIndex.get(nodeId)!];
      const dx = node.x - masterNode.x, dy = node.y - masterNode.y;
      const slave = nodeIndex.get(nodeId)!;
      const constraints = [
        { terms: [[6 * slave, 1], [6 * master, -1], [6 * master + 5, dy]] as Array<[number, number]> },
        { terms: [[6 * slave + 1, 1], [6 * master + 1, -1], [6 * master + 5, -dx]] as Array<[number, number]> },
        { terms: [[6 * slave + 5, 1], [6 * master + 5, -1]] as Array<[number, number]> },
      ];
      for (const constraint of constraints) for (const [i, ai] of constraint.terms) for (const [j, aj] of constraint.terms) K[i][j] += penalty * ai * aj;
    }
  });
  warnings.push(`Diaphragmes rigides activés sur ${slabNodesByLevel.size} niveau(x) avec cinématique Ux/Uy/Rz correcte.`);
}

function assembleGeometric(K: number[][], elementData: ElementData[], displacement: number[]) {
  const out = K.map(row => row.slice());
  for (const element of elementData) {
    const localD = expandReleasedDisplacement(matVec(element.transform, element.ids.map(id => displacement[id])), element.releaseData);
    const strain = (localD[6] - localD[0]) / Math.max(element.L, 1e-12);
    const firstOrderForces = matVec(element.releaseData.fullK, localD).map((value, i) => value - element.releaseData.fullF[i]);
    const compression = strain < 0 ? Math.max(Math.abs(firstOrderForces[0]), Math.abs(firstOrderForces[6])) : 0;
    if (compression <= 0) continue;
    const kg = localGeometricStiffness(compression, element.L);
    const globalKg = multiply(transpose(element.transform), multiply(kg, element.transform));
    addBlock(out, globalKg, element.ids);
  }
  return out;
}

type ElementData = {
  frame: AnalyticalFrame;
  ids: number[];
  L: number;
  E: number;
  A: number;
  transform: number[][];
  localK: number[][];
  localLoad: number[];
  globalLoad: number[];
  Jt: number;
  releaseData: { released: number[]; retained: number[]; fullK: number[][]; fullF: number[] };
};

export function solveGlobal3D(model: AnalyticalModel, loadModel: BuildingLoadModel, combination: LoadCombination, program: LoadProgram, options: Spatial3DOptions = {}): Spatial3DPreparation {
  const gravity = buildGravityMemberLoads(model, loadModel, combination, program);
  const blockingGravityErrors = gravity.errors.filter(message => !message.startsWith("Poids propre non déterminable pour le poteau"));
  if (blockingGravityErrors.length) return { result: null, errors: blockingGravityErrors, warnings: gravity.warnings };
  const nodes = model.nodes;
  const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const nDof = nodes.length * 6;
  const baseK = zeros(nDof), F = Array(nDof).fill(0) as number[];
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const loadByElement = new Map<string, Array<{ qxKnM?: number; qyKnM?: number }>>();
  for (const load of gravity.memberLoads) loadByElement.set(load.elementId, [...(loadByElement.get(load.elementId) ?? []), load]);
  const elementData: ElementData[] = [];
  const warnings = [...gravity.warnings, ...gravity.errors.map(message => `Charge secondaire : ${message}`)];
  if (model.materials.some(m => m.provenance === "provisional-default")) warnings.push("Matériaux génériques provisoires détectés : confirmer E, ν et masse volumique avant tout dimensionnement réglementaire.");
  if (model.sections.some(s => s.provenance === "unresolved")) warnings.push("Sections non résolues détectées : le calcul réglementaire doit être bloqué tant que A, Iy, Iz et Jt ne sont pas définis.");

  for (const frame of model.frames) {
    const a = nodeMap.get(frame.startNodeId), b = nodeMap.get(frame.endNodeId);
    const section = model.sections.find(item => item.id === frame.sectionId), material = model.materials.find(item => item.id === frame.materialId);
    if (!a || !b) return { result: null, errors: [`Nœud absent pour ${frame.sourceElementId}.`], warnings };
    if (!section?.areaM2 || !section.inertiaY4M4 || !section.inertiaZ4M4 || !material?.elasticModulusKnM2) return { result: null, errors: [`Propriétés de section/matériau incomplètes pour ${frame.sourceElementId}.`], warnings };
    const E = material.elasticModulusKnM2, A = section.areaM2, Iy = section.inertiaY4M4, Iz = section.inertiaZ4M4, Jt = torsionConstant(section);
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz);
    if (L <= 1e-10) return { result: null, errors: [`Barre ${frame.sourceElementId} de longueur nulle.`], warnings };
    const r = localAxes(dx, dy, dz);
    const Taxis = transformation12(r);
    const B = blockDiagonal(offsetBlock(frame.eccentricityM.start), offsetBlock(frame.eccentricityM.end));
    const transform = multiply(Taxis, B);
    let localK = localStiffness3D(E, material.poissonRatio ?? 0.2, A, Iy, Iz, Jt, L);
    const memberLoads = loadByElement.get(frame.id) ?? loadByElement.get(frame.sourceElementId) ?? [];
    let localLoad = Array(12).fill(0) as number[];
    for (const load of memberLoads) {
      // qx is local axial; qy is the historical gravity convention = global Z.
      localLoad = localLoad.map((v, i) => v + equivalentUniformLoad([0, 0, finite(load.qyKnM)], L, r)[i]);
      if (Math.abs(finite(load.qxKnM)) > 0) localLoad[0] += finite(load.qxKnM) * L / 2, localLoad[6] += finite(load.qxKnM) * L / 2;
    }
    const released = applyLocalReleases(localK, localLoad, frame.releases);
    localK = released.k; localLoad = released.f;
    const globalK = multiply(transpose(transform), multiply(localK, transform));
    const globalLoad = matVec(transpose(transform), localLoad);
    const i = nodeIndex.get(frame.startNodeId)!, j = nodeIndex.get(frame.endNodeId)!;
    const ids = Array.from({ length: 6 }, (_, dof) => 6 * i + dof).concat(Array.from({ length: 6 }, (_, dof) => 6 * j + dof));
    addBlock(baseK, globalK, ids); addVector(F, globalLoad, ids);
    elementData.push({ frame, ids, L, E, A, transform, localK, localLoad, globalLoad, Jt, releaseData: { released: released.released, retained: released.retained, fullK: released.fullK, fullF: released.fullF } });
    if (frame.releases.start.length || frame.releases.end.length) warnings.push(`Releases appliquées à ${frame.sourceElementId} : ${[...frame.releases.start, ...frame.releases.end].join(", ")}.`);
    if (frame.eccentricityM.start.some(v => Math.abs(v) > 1e-9) || frame.eccentricityM.end.some(v => Math.abs(v) > 1e-9)) warnings.push(`Excentrements nodaux appliqués à ${frame.sourceElementId}.`);
  }

  if (options.rigidDiaphragm !== false) addRigidDiaphragmConstraints(baseK, model, nodeIndex, warnings);

  const zLevels = Array.from(new Set(nodes.map(node => Number(node.z.toFixed(6))))).sort((a, b) => a - b);
  const structuralByStory = new Map<number, number[]>();
  nodes.forEach((node, index) => { const zIndex = zLevels.indexOf(Number(node.z.toFixed(6))); if (zIndex > 0) structuralByStory.set(zIndex - 1, [...(structuralByStory.get(zIndex - 1) ?? []), index]); });
  for (const load of options.storyLateralLoads ?? []) {
    const candidates = structuralByStory.get(load.storyIndex) ?? [];
    if (!candidates.length) { warnings.push(`Charge latérale de l’étage ${load.storyIndex + 1} non appliquée : aucun nœud correspondant.`); continue; }
    candidates.forEach(index => { F[6 * index] += finite(load.fxKn) / candidates.length; F[6 * index + 1] += finite(load.fyKn) / candidates.length; });
  }

  const restrained = new Set<number>();
  const springK = new Map<number, number>();
  for (const support of model.supports) {
    const index = nodeIndex.get(support.nodeId); if (index === undefined) continue;
    if (support.kind === "contact") warnings.push(`Appui contact ${support.sourceElementId} linéarisé selon ses degrés bloqués ; aucun contact unilatéral non linéaire n'est résolu.`);
    const dofs: DegreeOfFreedom[] = ["ux", "uy", "uz", "rx", "ry", "rz"];
    dofs.forEach((dof, i) => {
      if (support.restrainedDofs.includes(dof)) restrained.add(6 * index + i);
      const k = finite(support.stiffness?.[dof]); if (k > 0) springK.set(6 * index + i, k);
    });
  }
  springK.forEach((value, dof) => { baseK[dof][dof] += value; });
  if (!restrained.size && !springK.size) return { result: null, errors: ["Le modèle 3D ne possède aucun degré de liberté bloqué ou ressort."], warnings };

  const solveWithK = (K: number[][]) => {
    const scale = Math.max(1, ...K.flat().map(value => Math.abs(value)));
    const rowTolerance = scale * 1e-14;
    const free = Array.from({ length: nDof }, (_, i) => i).filter(i => !restrained.has(i) && K[i].some(value => Math.abs(value) > rowTolerance));
    const inactive = Array.from({ length: nDof }, (_, i) => i).filter(i => !restrained.has(i) && !free.includes(i));
    if (inactive.length) warnings.push(`${inactive.length} degré(s) de liberté sans raideur active neutralisé(s) ; vérifier qu’il ne s’agit pas d’un mécanisme structurel.`);
    const displacement = Array(nDof).fill(0) as number[];
    if (free.length) {
      const uf = solveDenseSystem(free.map(i => free.map(j => K[i][j])), free.map(i => F[i]));
      free.forEach((i, p) => { displacement[i] = uf[p]; });
    }
    return displacement;
  };

  let displacement: number[];
  let analysisK = baseK;
  try { displacement = solveWithK(baseK); } catch (error) { return { result: null, errors: [error instanceof Error ? error.message : String(error)], warnings }; }

  const pDeltaEnabled = options.pDelta !== false;
  const maxIterations = Math.max(1, Math.min(options.pDeltaMaxIterations ?? 12, 50));
  const tolerance = options.pDeltaTolerance ?? 1e-4;
  const limit = options.pDeltaLimit ?? 0.90;
  let stabilityIndex = 0, converged = true, iterations = 1;
  if (pDeltaEnabled) {
    converged = false;
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      const Kt = assembleGeometric(baseK, elementData, displacement);
      analysisK = Kt;
      let next: number[];
      try { next = solveWithK(Kt); } catch { warnings.push("Analyse P-Δ interrompue : matrice tangentielle instable."); break; }
      let maxRel = 0;
      for (let i = 0; i < displacement.length; i++) maxRel = Math.max(maxRel, Math.abs(next[i] - displacement[i]) / Math.max(1e-9, Math.abs(next[i]), Math.abs(displacement[i])));
      displacement = next; iterations = iteration;
      stabilityIndex = 0;
      for (const element of elementData) {
        const d = expandReleasedDisplacement(matVec(element.transform, element.ids.map(id => displacement[id])), element.releaseData);
        const currentForces = matVec(element.releaseData.fullK, d).map((value, i) => value - element.releaseData.fullF[i]);
        const strain = (d[6] - d[0]) / Math.max(element.L, 1e-12);
        const compression = strain < 0 ? Math.max(Math.abs(currentForces[0]), Math.abs(currentForces[6])) : 0;
        const Imin = Math.min(model.sections.find(s => s.id === element.frame.sectionId)?.inertiaY4M4 ?? 0, model.sections.find(s => s.id === element.frame.sectionId)?.inertiaZ4M4 ?? 0);
        const pcr = Math.PI ** 2 * element.E * Math.max(Imin, 1e-12) / Math.max(element.L ** 2, 1e-12);
        stabilityIndex = Math.max(stabilityIndex, pcr > 0 ? compression / pcr : 0);
      }
      if (stabilityIndex >= limit) { converged = false; break; }
      if (maxRel < tolerance) { converged = true; break; }
      converged = false;
    }
    if (!converged) warnings.push(`Analyse P-Δ non convergée après ${iterations} itération(s) ; vérifier stabilité, élancement et modèle de contreventement.`);
    if (stabilityIndex >= limit) return { result: null, errors: [`Instabilité P-Δ : indice ${stabilityIndex.toFixed(3)} ≥ ${limit.toFixed(2)}.`], warnings };
    if (stabilityIndex > 0.10) warnings.push(`Analyse P-Δ itérative : indice ${stabilityIndex.toFixed(3)}, ${iterations} itération(s).`);
  }

  const reactionsVector = matVec(analysisK, displacement).map((value, index) => value - F[index]);
  // Spring reactions are internal forces Kspring*u and are already included in K*u-F.
  const reactions = nodes.map((node, i) => ({ nodeId: node.id, fxKn: reactionsVector[6 * i], fyKn: reactionsVector[6 * i + 1], fzKn: reactionsVector[6 * i + 2], mxKnM: reactionsVector[6 * i + 3], myKnM: reactionsVector[6 * i + 4], mzKnM: reactionsVector[6 * i + 5] }))
    .filter((item, i) => restrained.has(6 * i) || restrained.has(6 * i + 1) || restrained.has(6 * i + 2) || restrained.has(6 * i + 3) || restrained.has(6 * i + 4) || restrained.has(6 * i + 5) || Array.from(springK.keys()).some(dof => Math.floor(dof / 6) === i));

  const elements: Spatial3DElementResult[] = elementData.map(element => {
    const dLocal = expandReleasedDisplacement(matVec(element.transform, element.ids.map(id => displacement[id])), element.releaseData);
    const p = matVec(element.releaseData.fullK, dLocal).map((value, i) => value - element.releaseData.fullF[i]);
    const [start, end] = endForcesFromLocal(p);
    const startGlobal = globalEndForcesFromLocal(p, element.transform, 0);
    const endGlobal = globalEndForcesFromLocal(p, element.transform, 6);
    const strain = (dLocal[6] - dLocal[0]) / Math.max(element.L, 1e-12);
    const governingAxial = Math.max(Math.abs(start.axialKn), Math.abs(end.axialKn));
    const axialForceKn = strain < 0 ? -governingAxial : strain > 0 ? governingAxial : 0;
    const compressionKn = strain < 0 ? governingAxial : 0;
    const tensionKn = strain > 0 ? governingAxial : 0;
    return { elementId: element.frame.id, sourceElementId: element.frame.sourceElementId, lengthM: element.L, start, end, startGlobal, endGlobal, axialForceKn, maxAbsMomentKnM: Math.max(Math.abs(start.momentYKnM), Math.abs(start.momentZKnM), Math.abs(end.momentYKnM), Math.abs(end.momentZKnM)), maxAbsShearKn: Math.max(Math.abs(start.shearYKn), Math.abs(start.shearZKn), Math.abs(end.shearYKn), Math.abs(end.shearZKn)), maxAbsTorsionKnM: Math.max(Math.abs(start.torsionKnM), Math.abs(end.torsionKnM)), compressionKn, tensionKn, strain };
  });

  const nonlinearStates = elements.map(element => {
    const frame = model.frames.find(item => item.id === element.elementId);
    const material = frame ? model.materials.find(item => item.id === frame.materialId) : undefined;
    return { elementId: element.sourceElementId, axialStrain: element.strain, state: classifyFrameStrain(element.strain, material?.name ?? "Béton") };
  });
  const failed = nonlinearStates.filter(item => item.state.failed).length;
  if (failed) warnings.push(`${failed} élément(s) ont dépassé la déformation ultime selon la loi constitutive indicative ; cette loi ne remplace pas une analyse non linéaire réglementaire.`);
  const cracked = nonlinearStates.filter(item => item.state.regime === "cracked").length;
  if (cracked) warnings.push(`${cracked} élément(s) présentent une traction axiale classée fissurée ; ce diagnostic est indicatif.`);

  const forceMomentTotals = (vectors: Array<{ nodeId: string; fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>) => vectors.reduce((s, item) => {
    const node = nodeMap.get(item.nodeId)!;
    return {
      x: s.x + item.fx, y: s.y + item.fy, z: s.z + item.fz,
      mx: s.mx + item.mx + node.y * item.fz - node.z * item.fy,
      my: s.my + item.my + node.z * item.fx - node.x * item.fz,
      mz: s.mz + item.mz + node.x * item.fy - node.y * item.fx,
    };
  }, { x: 0, y: 0, z: 0, mx: 0, my: 0, mz: 0 });
  const appliedVectors = nodes.map((node, i) => ({ nodeId: node.id, fx: F[6 * i], fy: F[6 * i + 1], fz: F[6 * i + 2], mx: F[6 * i + 3], my: F[6 * i + 4], mz: F[6 * i + 5] }));
  const reactionVectors = reactions.map(item => ({ nodeId: item.nodeId, fx: item.fxKn, fy: item.fyKn, fz: item.fzKn, mx: item.mxKnM, my: item.myKnM, mz: item.mzKnM }));
  const applied = forceMomentTotals(appliedVectors);
  const reactionTotals = forceMomentTotals(reactionVectors);
  const residual = Math.hypot(applied.x + reactionTotals.x, applied.y + reactionTotals.y, applied.z + reactionTotals.z);
  const momentResidual = Math.hypot(applied.mx + reactionTotals.mx, applied.my + reactionTotals.my, applied.mz + reactionTotals.mz);
  const scale = Math.max(1, Math.hypot(applied.x, applied.y, applied.z), Math.hypot(applied.mx, applied.my, applied.mz));
  if (residual > 1e-7 * scale || momentResidual > 1e-7 * scale) warnings.push(`Équilibre spatial à contrôler : résidu forces ${residual.toExponential(2)} kN, moments ${momentResidual.toExponential(2)} kN·m.`);

  return { result: {
    nodeDisplacements: nodes.map((node, i) => ({ nodeId: node.id, uxM: displacement[6 * i], uyM: displacement[6 * i + 1], uzM: displacement[6 * i + 2], rxRad: displacement[6 * i + 3], ryRad: displacement[6 * i + 4], rzRad: displacement[6 * i + 5] })),
    reactions, elements,
    equilibrium: { appliedFxKn: applied.x, appliedFyKn: applied.y, appliedFzKn: applied.z, reactionFxKn: reactionTotals.x, reactionFyKn: reactionTotals.y, reactionFzKn: reactionTotals.z, appliedMxKnM: applied.mx, appliedMyKnM: applied.my, appliedMzKnM: applied.mz, reactionMxKnM: reactionTotals.mx, reactionMyKnM: reactionTotals.my, reactionMzKnM: reactionTotals.mz },
    elementCount: elementData.length, warnings,
    pDelta: { stabilityIndex, displacementAmplification: stabilityIndex > 0 ? 1 / Math.max(1 - stabilityIndex, 0.1) : 1, iterations, converged }, nonlinearStates,
  }, errors: [], warnings };
}
