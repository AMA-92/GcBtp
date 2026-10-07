import { describe, expect, it } from "vitest";
import { analyzeCantileverRectangularPlate, analyzeOneWayOrthotropicRectangularPlate, analyzeSimplySupportedRectangularPlate, checkRectangularSurfaceEdgeSupports, meshRectangularSurface, SURFACE_ANALYSIS_SCHEMA_VERSION, type SurfacePanelInput } from "@shared/surface-analysis";

const panel = (overrides: Partial<SurfacePanelInput> = {}): SurfacePanelInput => ({
  id: "slab-1",
  x1M: 0,
  y1M: 0,
  x2M: 4,
  y2M: 4,
  thicknessM: 0.2,
  elasticModulusKnM2: 30_000_000,
  poissonRatio: 0.2,
  uniformLoadKnM2: 7,
  meshSizeM: 0.5,
  ...overrides,
});

describe("priority 4 — surface mesh and plate analysis", () => {
  it("versions the output schema for the additional plate boundary models", () => {
    expect(SURFACE_ANALYSIS_SCHEMA_VERSION).toBe(2);
  });

  it("creates a triangular mesh that exactly conserves a plain rectangular panel area", () => {
    const result = meshRectangularSurface(panel());
    expect(result.errors).toEqual([]);
    expect(result.mesh).not.toBeNull();
    expect(result.mesh!.grossAreaM2).toBeCloseTo(16);
    expect(result.mesh!.netAreaM2).toBeCloseTo(16);
    expect(result.mesh!.triangles.reduce((sum, triangle) => sum + triangle.areaM2, 0)).toBeCloseTo(16);
    expect(result.mesh!.totalUniformLoadKn).toBeCloseTo(112);
    expect(result.mesh!.maximumAspectRatio).toBeLessThan(5);
  });

  it("cuts a rectangular opening out of mesh area and applied surface load exactly", () => {
    const result = meshRectangularSurface(panel({ openings: [{ x1M: 1, y1M: 1, x2M: 2, y2M: 3 }] }));
    expect(result.errors).toEqual([]);
    expect(result.mesh!.openingAreaM2).toBeCloseTo(2);
    expect(result.mesh!.netAreaM2).toBeCloseTo(14);
    expect(result.mesh!.totalUniformLoadKn).toBeCloseTo(98);
    expect(result.mesh!.triangles.reduce((sum, triangle) => sum + triangle.areaM2, 0)).toBeCloseTo(14);
  });

  it("rejects outside, zero-size, and overlapping rectangular openings", () => {
    expect(meshRectangularSurface(panel({ openings: [{ x1M: 3, y1M: 0, x2M: 5, y2M: 1 }] })).errors[0]).toMatch(/intérieur/);
    expect(meshRectangularSurface(panel({ openings: [{ x1M: 1, y1M: 1, x2M: 1, y2M: 2 }] })).errors[0]).toMatch(/dimensions nulles/);
    expect(meshRectangularSurface(panel({ openings: [
      { x1M: 0.5, y1M: 0.5, x2M: 2, y2M: 2 },
      { x1M: 1.5, y1M: 1.5, x2M: 3, y2M: 3 },
    ] })).errors[0]).toMatch(/chevaucher/);
  });

  it("requires four fully supported edges but accepts split beam segments", () => {
    const panelGrid = { x1: 0, y1: 0, x2: 4, y2: 3 };
    const members = [
      { type: "Poutre", x: 0, y: 0, x2: 2, y2: 0 },
      { type: "Poutre", x: 2, y: 0, x2: 4, y2: 0 },
      { type: "Poutre", x: 0, y: 3, x2: 4, y2: 3 },
      { type: "Voile", x: 0, y: 0, x2: 0, y2: 3 },
      { type: "Poutre", x: 4, y: 0, x2: 4, y2: 3 },
    ];
    expect(checkRectangularSurfaceEdgeSupports(panelGrid, members).supported).toBe(true);
    const missing = checkRectangularSurfaceEdgeSupports(panelGrid, members.slice(1));
    expect(missing.supported).toBe(false);
    expect(missing.missingEdges).toContain("bottom");
    expect(missing.supportedEdges).toEqual(["left", "right", "top"]);
  });

  it("solves a cantilever balcony with a fixed root edge and three free edges", () => {
    const nu = 0.2;
    const d = (30_000_000 * 0.2 ** 3) / (12 * (1 - nu ** 2));
    const result = analyzeCantileverRectangularPlate(panel({ meshSizeM: 0.4 }), { D11: d, D22: d, D12: nu * d, D66: ((1 - nu) * d) / 2 }, "left");
    expect(result.errors).toEqual([]);
    expect(result.plate?.boundary).toBe("cantilever-fixed-edge");
    expect(result.plate?.maximumDeflectionM).toBeGreaterThan(0);
    const fixedNodes = result.mesh!.nodes.filter(node => Math.abs(node.xM) < 1e-9);
    expect(fixedNodes.length).toBeGreaterThan(0);
    for (const node of fixedNodes) expect(result.plate!.nodeResults.find(item => item.nodeId === node.id)?.deflectionM).toBeCloseTo(0, 10);
    expect(result.plate!.edgeReactions.find(item => item.edge === "left")?.totalKn).toBeCloseTo(result.plate!.totalLoadKn);
    expect(result.plate!.edgeReactions.filter(item => item.edge !== "left").every(item => item.totalKn === 0)).toBe(true);
    expect(result.plate!.equilibriumResidualKn).toBeCloseTo(0, 10);
  });

  it("solves an orthotropic hollow-core slab on its two bearing edges and evaluates the triangular mesh nodes", () => {
    const stiffness = { D11: 8000, D22: 160, D12: 200, D66: 300 };
    const result = analyzeOneWayOrthotropicRectangularPlate(panel({ x2M: 5, y2M: 3, meshSizeM: 0.5 }), stiffness, "X");
    expect(result.errors).toEqual([]);
    expect(result.plate?.boundary).toBe("one-way-simply-supported");
    expect(result.plate?.maximumDeflectionM).toBeGreaterThan(0);
    expect(result.plate?.nodeResults).toHaveLength(result.mesh?.nodes.length);
    expect(result.plate?.edgeReactions.find(item => item.edge === "left")?.totalKn).toBeCloseTo(0.5 * result.plate!.totalLoadKn);
    expect(result.plate?.edgeReactions.find(item => item.edge === "right")?.totalKn).toBeCloseTo(0.5 * result.plate!.totalLoadKn);
    expect(result.plate?.edgeReactions.find(item => item.edge === "top")?.totalKn).toBe(0);
    expect(result.plate?.equilibriumResidualKn).toBeCloseTo(0, 10);
    expect(result.warnings).not.toContain(expect.stringContaining("Modèle orthotrope équivalent Rayleigh–Ritz"));
    expect(result.plate?.notes?.[0]).toContain("Hypothèse du modèle orthotrope équivalent Rayleigh–Ritz");

    const rotated = analyzeOneWayOrthotropicRectangularPlate(panel({ x2M: 3, y2M: 5, meshSizeM: 0.5 }), { D11: 160, D22: 8000, D12: 200, D66: 300 }, "Y");
    expect(rotated.errors).toEqual([]);
    expect(rotated.plate?.maximumDeflectionM).toBeCloseTo(result.plate!.maximumDeflectionM, 8);
    expect(rotated.plate?.maximumMxKnMPerM).toBeCloseTo(result.plate!.maximumMyKnMPerM, 8);
    expect(rotated.plate?.maximumMyKnMPerM).toBeCloseTo(result.plate!.maximumMxKnMPerM, 8);
    expect(rotated.plate?.edgeReactions.find(item => item.edge === "bottom")?.totalKn).toBeCloseTo(0.5 * rotated.plate!.totalLoadKn);
  });

  it("matches the simply-supported square-plate Navier deflection benchmark", () => {
    const result = analyzeSimplySupportedRectangularPlate(panel({ meshSizeM: 0.25 }), 31);
    expect(result.errors).toEqual([]);
    expect(result.plate).not.toBeNull();
    const rigidity = 30_000_000 * 0.2 ** 3 / (12 * (1 - 0.2 ** 2));
    const benchmark = 0.00406 * 7 * 4 ** 4 / rigidity;
    expect(result.plate!.maximumDeflectionM).toBeCloseTo(benchmark, 3);
    expect(result.plate!.maximumMxKnMPerM).toBeGreaterThan(0);
    expect(result.plate!.maximumMyKnMPerM).toBeGreaterThan(0);
  });

  it("conserves uniform-load resultants in normalized edge reactions", () => {
    const result = analyzeSimplySupportedRectangularPlate(panel({ x2M: 6, y2M: 3, meshSizeM: 0.3 }));
    expect(result.errors).toEqual([]);
    expect(result.plate!.totalLoadKn).toBeCloseTo(126);
    expect(result.plate!.edgeReactions.reduce((sum, edge) => sum + edge.totalKn, 0)).toBeCloseTo(126);
    expect(result.plate!.equilibriumResidualKn).toBeCloseTo(0, 10);
    expect(result.plate!.edgeReactions).toHaveLength(4);
  });

  it("meshes but blocks Navier results for panels with openings instead of inventing a solution", () => {
    const result = analyzeSimplySupportedRectangularPlate(panel({ openings: [{ x1M: 1, y1M: 1, x2M: 2, y2M: 2 }] }));
    expect(result.mesh?.netAreaM2).toBeCloseTo(15);
    expect(result.plate).toBeNull();
    expect(result.errors.join(" ")).toMatch(/ne résout pas encore une plaque avec ouverture/);
  });

  it("rejects invalid physical inputs and excessive mesh sizes", () => {
    expect(meshRectangularSurface(panel({ thicknessM: 0 })).errors).toContain("L’épaisseur de plaque doit être comprise entre 0,03 et 1,00 m.");
    expect(meshRectangularSurface(panel({ meshSizeM: 0.1, x2M: 200, y2M: 200 })).errors[0]).toMatch(/10 000 cellules/);
    expect(analyzeSimplySupportedRectangularPlate(panel({ uniformLoadKnM2: -2 })).errors[0]).toMatch(/charge uniforme doit être positive/);
  });
});
