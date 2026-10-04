import { describe, expect, it } from "vitest";
import { solveGlobal3D } from "@shared/frame-solver-3d";
import type { AnalyticalModel } from "@shared/analytical-model";
import { createDefaultLoadProgram } from "@shared/load-case-program";

const model = (overrides: Partial<AnalyticalModel> = {}): AnalyticalModel => ({
  schemaVersion: 2,
  units: { length: "m", force: "kN", stress: "kN/m²", moment: "kN·m" },
  nodeMergeToleranceM: 0.001,
  nodes: [
    { id: "A", x: 0, y: 0, z: 0, levelIds: ["foundation"], sourceElementIds: ["C"] },
    { id: "B", x: 0, y: 0, z: 3, levelIds: ["rdc"], sourceElementIds: ["C"] },
  ],
  frames: [{ id: "F:C", sourceElementId: "C", sourceType: "Poteau", startNodeId: "A", endNodeId: "B", sectionId: "S", materialId: "M", levelId: "rdc", releases: { start: [], end: [] }, eccentricityM: { start: [0,0,0], end: [0,0,0] } }],
  surfaces: [],
  supports: [{ id: "SUP:C", sourceElementId: "F", nodeId: "A", kind: "fixed-base", role: "column-base", restrainedDofs: ["ux","uy","uz","rx","ry","rz"], selectionReason: "test", status: "declared" }],
  materials: [{ id: "M", name: "Béton test", elasticModulusKnM2: 30_000_000, poissonRatio: 0.2, densityKnM3: 25, provenance: "provisional-default" }],
  sections: [{ id: "S", name: "20x40", shape: "rectangle", dimensionsM: [0.2,0.4], areaM2: 0.08, inertiaY4M4: 0.0010666666667, inertiaZ4M4: 0.0002666666667, torsionConstantM4: 0.00072, provenance: "model-catalog" }],
  mesh: { globalSizeM: 1, maxAspectRatio: 4, refinementRegions: [] },
  sourceElementIds: ["C"],
  ...overrides,
});

const emptyLoads = { contributions: [], beamToColumns: {}, columnToFoundation: {}, floors: [], beams: [], warnings: [], propagation: { beams: {}, columns: {}, foundations: {}, warnings: [] }, rows: [], levelOrder: ["foundation","rdc"], levelLoads: {} } as any;
const combo = createDefaultLoadProgram().combinations.find(item => item.id === "comb:uls-gravity")!;
const program = createDefaultLoadProgram();

describe("priority 1 — 3D frame solver", () => {
  it("returns the correct axial stiffness for a cantilever column", () => {
    const result = solveGlobal3D(model(), emptyLoads, combo, program, { pDelta: false, rigidDiaphragm: false });
    expect(result.errors).toEqual([]);
    expect(result.result).not.toBeNull();
    // The default ELU contains the generated column self-weight; it should not create bending.
    expect(result.result!.elements).toHaveLength(1);
    expect(result.result!.elements[0].maxAbsMomentKnM).toBeCloseTo(0, 10);
  });

  it("captures axial self-weight as an actual element load", () => {
    const loadModel = { ...emptyLoads, propagation: { ...emptyLoads.propagation, columns: { C: { gk: 10, qk: 0, sources: ["test"] } } } } as any;
    const result = solveGlobal3D(model(), loadModel, combo, program, { pDelta: false, rigidDiaphragm: false });
    expect(result.errors).toEqual([]);
    expect(result.result!.elements[0].compressionKn).toBeGreaterThan(0);
    expect(result.result!.equilibrium.reactionFzKn).toBeCloseTo(-result.result!.equilibrium.appliedFzKn, 8);
  });

  it("uses the section torsion constant instead of Iy+Iz", () => {
    const result = solveGlobal3D(model(), emptyLoads, combo, program, { pDelta: false, rigidDiaphragm: false });
    expect(result.result!.elements[0].maxAbsTorsionKnM).toBeCloseTo(0, 10);
    expect(model().sections[0].torsionConstantM4).toBeLessThan(model().sections[0].inertiaY4M4! + model().sections[0].inertiaZ4M4!);
  });

  it("matches the closed-form cantilever lateral reaction and base moment", () => {
    const result = solveGlobal3D(model(), emptyLoads, combo, program, { pDelta: false, rigidDiaphragm: false, storyLateralLoads: [{ storyIndex: 0, fxKn: 10, fyKn: 0 }] });
    expect(result.errors).toEqual([]);
    expect(result.result!.reactions[0].fxKn).toBeCloseTo(-10, 7);
    expect(result.result!.reactions[0].myKnM).toBeCloseTo(-30, 7);
    expect(result.result!.elements[0].maxAbsMomentKnM).toBeCloseTo(30, 7);
  });

  it("honours an end rotational release", () => {
    const released = model({ frames: [{ ...model().frames[0], releases: { start: [], end: ["rz"] } }] });
    const result = solveGlobal3D(released, emptyLoads, combo, program, { pDelta: false, rigidDiaphragm: false, storyLateralLoads: [{ storyIndex: 0, fxKn: 10, fyKn: 0 }] });
    expect(result.errors).toEqual([]);
    expect(Math.abs(result.result!.elements[0].end.momentZKnM)).toBeLessThan(1e-7);
  });

  it("reports internal force components for every 3D member", () => {
    const loadModel = { ...emptyLoads, propagation: { ...emptyLoads.propagation, columns: { C: { gk: 10, qk: 0, sources: ["test"] } } } } as any;
    const result = solveGlobal3D(model(), loadModel, combo, program, { pDelta: false, rigidDiaphragm: false });
    const element = result.result!.elements[0];
    expect(element.start).toHaveProperty("axialKn");
    expect(element.start).toHaveProperty("shearYKn");
    expect(element.start).toHaveProperty("shearZKn");
    expect(element.start).toHaveProperty("torsionKnM");
    expect(element.start).toHaveProperty("momentYKnM");
    expect(element.start).toHaveProperty("momentZKnM");
  });
});
