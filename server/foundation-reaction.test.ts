import { describe, expect, it } from "vitest";
import { checkFoundationReaction, mapFoundationReactions } from "../shared/foundation-reaction";
import type { AnalyticalModel } from "../shared/analytical-model";
import type { PlaneFrameResult } from "../shared/frame-solver-2d";

const base = {
  verticalReactionKn: 100,
  horizontalReactionKn: 0,
  momentReactionKnM: 0,
  momentAxis: "x" as const,
  widthXM: 2,
  widthYM: 2,
  thicknessM: 0.4,
  columnWidthM: 0.3,
  columnDepthM: 0.3,
  allowableBearingKPa: 300,
  bearingSafetyFactor: 1.5,
  slidingSafetyFactor: 1.5,
  frictionAngleDeg: 30,
  provenance: "Rapport géotechnique fictif, essai unitaire",
};

describe("foundation checks from solver reactions", () => {
  it("computes reactions without inventing geotechnical capacity", () => {
    const result = checkFoundationReaction({ ...base, allowableBearingKPa: null, frictionAngleDeg: null });
    expect(result.maximumPressureKPa).toBeGreaterThan(0);
    expect(result.checks.find(check => check.id === "bearing")?.status).toBe("non vérifié");
    expect(result.checks.find(check => check.id === "bearing")?.resistance).toBeNull();
    expect(result.checks.find(check => check.id === "contact")?.status).toBe("satisfaisant");
    expect(result.status).toBe("pré-étude — incomplet");
  });

  it("checks a centered footing and leaves unavailable punching/settlement explicitly unverified", () => {
    const result = checkFoundationReaction(base);
    expect(result.eccentricityM).toBe(0);
    expect(result.minimumPressureKPa).toBeGreaterThan(0);
    expect(result.checks.find(check => check.id === "bearing")?.status).toBe("satisfaisant");
    expect(result.checks.find(check => check.id === "contact")?.status).toBe("satisfaisant");
    expect(result.checks.find(check => check.id === "punching")?.status).toBe("non vérifié");
    expect(result.checks.find(check => check.id === "settlement")?.status).toBe("non vérifié");
    expect(result.status).toBe("pré-étude — incomplet");
  });

  it("leaves sliding unverified without a geotechnically supplied friction angle", () => {
    const result = checkFoundationReaction({ ...base, frictionAngleDeg: null });
    const sliding = result.checks.find(check => check.id === "sliding");
    expect(sliding?.status).toBe("non vérifié");
    expect(sliding?.resistance).toBeNull();
    expect(sliding?.note).toMatch(/étude géotechnique/i);
    expect(result.checks.find(check => check.id === "bearing")?.status).toBe("satisfaisant");
  });

  it("compares qmax directly to qadm when no additional screening factor is applied", () => {
    const result = checkFoundationReaction({
      ...base,
      verticalReactionKn: 900,
      allowableBearingKPa: 200,
      bearingSafetyFactor: 1,
      frictionAngleDeg: null,
    });
    const bearing = result.checks.find(check => check.id === "bearing");
    expect(bearing?.resistance).toBe(200);
    expect(bearing?.status).toBe("insuffisant");
  });

  it("identifies partial contact when eccentricity exceeds the kern limit", () => {
    const result = checkFoundationReaction({ ...base, momentReactionKnM: 40 });
    expect(result.eccentricityM).toBeCloseTo(0.4, 8);
    expect(result.eccentricityRatio).toBeGreaterThan(1 / 6);
    expect(result.minimumPressureKPa).toBe(0);
    expect(result.checks.find(check => check.id === "contact")?.status).toBe("insuffisant");
  });

  it("retient le contact intégral après mobilisation d’une longrine de redressement", () => {
    const result = checkFoundationReaction({ ...base, momentReactionKnM: 40, redressingLongrineLengthM: 2, redressingMomentKnM: 30 });
    const contact = result.checks.find(check => check.id === "contact");
    expect(result.eccentricityM).toBeCloseTo(2 / 6);
    expect(contact?.status).toBe("satisfaisant");
    expect(contact?.note).toMatch(/B\/6/);
  });

  it("blocks a resultant outside the footing contact width", () => {
    const result = checkFoundationReaction({ ...base, momentReactionKnM: 120 });
    expect(result.eccentricityM).toBeGreaterThan(1);
    expect(result.maximumPressureKPa).toBe(Number.POSITIVE_INFINITY);
    expect(result.status).toBe("pré-étude — insuffisant");
  });

  it("checks sliding, punching capacity, and settlement when explicit inputs are provided", () => {
    const result = checkFoundationReaction({ ...base, horizontalReactionKn: 1000, concreteShearCapacityKPa: 100, subgradeModulusKnM3: 10000, allowableSettlementMm: 10 });
    expect(result.checks.find(check => check.id === "sliding")?.status).toBe("insuffisant");
    expect(result.checks.find(check => check.id === "punching")?.resistance).toBe(100);
    expect(result.checks.find(check => check.id === "settlement")?.status).toBe("satisfaisant");
    expect(result.status).toBe("pré-étude — insuffisant");
  });

  it("requires positive compression and geotechnical inputs", () => {
    expect(() => checkFoundationReaction({ ...base, verticalReactionKn: 0 })).toThrow(/compression/);
    expect(() => checkFoundationReaction({ ...base, allowableBearingKPa: 0 })).toThrow(/portance géotechnique/i);
  });

  it("maps real column-footing reactions and ignores internal stair contacts", () => {
    const model: AnalyticalModel = {
      schemaVersion: 1,
      units: { length: "m", force: "kN", stress: "kN/m²", moment: "kN·m" },
      nodeMergeToleranceM: 0.01,
      nodes: [
        { id: "base", x: 0, y: 0, z: 0, levelIds: ["foundation"], sourceElementIds: ["C1"] },
        { id: "stair-contact", x: 2, y: 0, z: 0, levelIds: ["rdc"], sourceElementIds: ["ES1"] },
        { id: "f1", x: -1, y: -1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
        { id: "f2", x: 1, y: -1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
        { id: "f3", x: 1, y: 1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
        { id: "f4", x: -1, y: 1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
      ],
      frames: [{ id: "F:C1", sourceElementId: "C1", sourceType: "Poteau", startNodeId: "base", endNodeId: "top", sectionId: "col", materialId: "concrete", levelId: "rdc", releases: { start: [], end: [] }, eccentricityM: { start: [0, 0, 0], end: [0, 0, 0] } }],
      surfaces: [{ id: "S:S1:1", sourceElementId: "S1", sourceType: "Semelle", kind: "footing", nodeIds: ["f1", "f2", "f3", "f4"], sectionId: "footing", materialId: "concrete", levelId: "foundation", openings: [] }],
      supports: [
        { id: "SUP:S1:C1", sourceElementId: "S1", nodeId: "base", kind: "fixed-base", role: "column-base", restrainedDofs: ["ux", "uy", "uz", "rx", "ry", "rz"], status: "inferred-from-footing" },
        { id: "SUP:ES1:dallage", sourceElementId: "ES1", nodeId: "stair-contact", kind: "contact", role: "stair-slab-contact", restrainedDofs: ["uz"], status: "declared" },
      ],
      materials: [],
      sections: [
        { id: "footing", name: "S1", shape: "rectangle", dimensionsM: [2, 2, 0.4], areaM2: 4, inertiaY4M4: 1, inertiaZ4M4: 1, provenance: "model-catalog" },
        { id: "col", name: "Pot_30", shape: "rectangle", dimensionsM: [0.3, 0.3], areaM2: 0.09, inertiaY4M4: 0.000675, inertiaZ4M4: 0.000675, provenance: "model-catalog" },
      ],
      mesh: { globalSizeM: 1, maxAspectRatio: 5, refinementRegions: [] },
      sourceElementIds: ["S1", "C1", "ES1"],
    };
    const result: PlaneFrameResult = {
      plane: "XZ",
      displacements: [],
      reactions: [{ nodeId: "base", fxKn: 4, fzKn: 100, momentKnM: 12 }, { nodeId: "stair-contact", fxKn: 0, fzKn: 0, momentKnM: 0 }],
      elements: [],
      equilibrium: { appliedFxKn: -4, appliedFzKn: -100, appliedMomentKnM: -12, reactionFxKn: 4, reactionFzKn: 100, reactionMomentKnM: 12 },
      warnings: [],
    };
    const mapped = mapFoundationReactions(model, result, "XZ");
    expect(mapped.records).toHaveLength(1);
    expect(mapped.records[0]).toMatchObject({ footingId: "S1", columnId: "C1", nodeId: "base", verticalReactionKn: 100, horizontalReactionKn: 4, momentReactionKnM: 12, momentAxis: "x", widthXM: 2, widthYM: 2, thicknessM: 0.4, columnWidthM: 0.3, columnDepthM: 0.3 });
    expect(mapped.records.some(record => record.footingId === "ES1")).toBe(false);
    expect(mapped.warnings.some(warning => warning.includes("Semelle analytique absente pour l’appui SUP:ES1:dallage"))).toBe(false);
    expect(mapped.warnings).toContain("Réactions projetées depuis le plan XZ uniquement.");
  });

  it("ajoute le moment géométrique résultant N·e pour une semelle excentrée en coin", () => {
    const model: AnalyticalModel = {
      schemaVersion: 1,
      units: { length: "m", force: "kN", stress: "kN/m²", moment: "kN·m" },
      nodeMergeToleranceM: 0.01,
      nodes: [
        { id: "base", x: 0, y: 0, z: 0, levelIds: ["foundation"], sourceElementIds: ["C1"] },
        { id: "f1", x: -4 / 3, y: -2 / 3, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
        { id: "f2", x: 2 / 3, y: -2 / 3, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
        { id: "f3", x: 2 / 3, y: 4 / 3, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
        { id: "f4", x: -4 / 3, y: 4 / 3, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
      ],
      frames: [{ id: "F:C1", sourceElementId: "C1", sourceType: "Poteau", startNodeId: "base", endNodeId: "top", sectionId: "col", materialId: "concrete", levelId: "rdc", releases: { start: [], end: [] }, eccentricityM: { start: [0, 0, 0], end: [0, 0, 0] } }],
      surfaces: [{ id: "S:S1:1", sourceElementId: "S1", sourceType: "Semelle", kind: "footing", nodeIds: ["f1", "f2", "f3", "f4"], sectionId: "footing", materialId: "concrete", levelId: "foundation", openings: [] }],
      supports: [{ id: "SUP:S1:C1", sourceElementId: "S1", nodeId: "base", kind: "fixed-base", role: "column-base", restrainedDofs: ["ux", "uy", "uz", "rx", "ry", "rz"], status: "inferred-from-footing" }],
      materials: [],
      sections: [
        { id: "footing", name: "S1", shape: "rectangle", dimensionsM: [2, 2, 0.4], areaM2: 4, inertiaY4M4: 1, inertiaZ4M4: 1, provenance: "model-catalog" },
        { id: "col", name: "Pot_30", shape: "rectangle", dimensionsM: [0.3, 0.3], areaM2: 0.09, inertiaY4M4: 0.000675, inertiaZ4M4: 0.000675, provenance: "model-catalog" },
      ],
      mesh: { globalSizeM: 1, maxAspectRatio: 5, refinementRegions: [] },
      sourceElementIds: ["S1", "C1"],
    };
    const result: PlaneFrameResult = {
      plane: "XZ", displacements: [], reactions: [{ nodeId: "base", fxKn: 0, fzKn: 100, momentKnM: 12 }], elements: [],
      equilibrium: { appliedFxKn: 0, appliedFzKn: -100, appliedMomentKnM: -12, reactionFxKn: 0, reactionFzKn: 100, reactionMomentKnM: 12 }, warnings: [],
    };
    const mapped = mapFoundationReactions(model, result, "XZ");
    expect(mapped.records[0].geometricEccentricityXM).toBeCloseTo(1 / 3);
    expect(mapped.records[0].geometricEccentricityYM).toBeCloseTo(-1 / 3);
    expect(mapped.records[0].momentReactionKnM).toBeCloseTo(12 + 100 * Math.sqrt(2) / 3);
    expect(mapped.records[0].redressingLongrineLengthM).toBe(0);
    expect(mapped.records[0].redressingMomentKnM).toBe(0);
    expect(mapped.warnings.some(warning => warning.includes("moment géométrique N·e"))).toBe(false);
    expect(mapped.warnings.some(warning => warning.includes("deux axes"))).toBe(true);
  });

  it("déduit le moment repris par une longrine reliée à deux appuis de semelles", () => {
    const model: AnalyticalModel = {
      schemaVersion: 1, units: { length: "m", force: "kN", stress: "kN/m²", moment: "kN·m" }, nodeMergeToleranceM: 0.01,
      nodes: [
        { id: "b1", x: 0, y: 0, z: 0, levelIds: ["foundation"], sourceElementIds: ["C1", "LR1"] },
        { id: "b2", x: 2, y: 0, z: 0, levelIds: ["foundation"], sourceElementIds: ["C2", "LR1"] },
        { id: "s1a", x: -1.5, y: -1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
        { id: "s1b", x: 0.5, y: -1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
        { id: "s1c", x: 0.5, y: 1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
        { id: "s1d", x: -1.5, y: 1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
        { id: "s2a", x: 1, y: -1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S2"] },
        { id: "s2b", x: 3, y: -1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S2"] },
        { id: "s2c", x: 3, y: 1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S2"] },
        { id: "s2d", x: 1, y: 1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S2"] },
      ],
      frames: [
        { id: "F:C1", sourceElementId: "C1", sourceType: "Poteau", startNodeId: "b1", endNodeId: "b1", sectionId: "col", materialId: "concrete", levelId: "foundation", releases: { start: [], end: [] }, eccentricityM: { start: [0, 0, 0], end: [0, 0, 0] } },
        { id: "F:C2", sourceElementId: "C2", sourceType: "Poteau", startNodeId: "b2", endNodeId: "b2", sectionId: "col", materialId: "concrete", levelId: "foundation", releases: { start: [], end: [] }, eccentricityM: { start: [0, 0, 0], end: [0, 0, 0] } },
        { id: "F:LR1", sourceElementId: "LR1", sourceType: "Longrine de redressement", startNodeId: "b1", endNodeId: "b2", sectionId: "tie", materialId: "concrete", levelId: "foundation", releases: { start: [], end: [] }, eccentricityM: { start: [0, 0, 0], end: [0, 0, 0] } },
      ],
      surfaces: [
        { id: "S:S1", sourceElementId: "S1", sourceType: "Semelle", kind: "footing", nodeIds: ["s1a", "s1b", "s1c", "s1d"], sectionId: "footing", materialId: "concrete", levelId: "foundation", openings: [] },
        { id: "S:S2", sourceElementId: "S2", sourceType: "Semelle", kind: "footing", nodeIds: ["s2a", "s2b", "s2c", "s2d"], sectionId: "footing", materialId: "concrete", levelId: "foundation", openings: [] },
      ],
      supports: [
        { id: "SUP:S1:C1", sourceElementId: "S1", nodeId: "b1", kind: "fixed-base", role: "column-base", restrainedDofs: ["ux", "uy", "uz", "rx", "ry", "rz"], status: "inferred-from-footing" },
        { id: "SUP:S2:C2", sourceElementId: "S2", nodeId: "b2", kind: "fixed-base", role: "column-base", restrainedDofs: ["ux", "uy", "uz", "rx", "ry", "rz"], status: "inferred-from-footing" },
      ],
      materials: [{ id: "concrete", name: "BA", elasticModulusKnM2: 30_000_000, poissonRatio: 0.2, densityKnM3: 25, provenance: "model-catalog" }],
      sections: [
        { id: "footing", name: "Semelle", shape: "rectangle", dimensionsM: [2, 2, 0.4], areaM2: 4, inertiaY4M4: 1, inertiaZ4M4: 1, provenance: "model-catalog" },
        { id: "col", name: "Poteau", shape: "rectangle", dimensionsM: [0.3, 0.3], areaM2: 0.09, inertiaY4M4: 0.000675, inertiaZ4M4: 0.000675, provenance: "model-catalog" },
        { id: "tie", name: "Longrine", shape: "rectangle", dimensionsM: [0.3, 0.5], areaM2: 0.15, inertiaY4M4: 0.003125, inertiaZ4M4: 0.001125, provenance: "model-catalog" },
      ],
      mesh: { globalSizeM: 1, maxAspectRatio: 5, refinementRegions: [] }, sourceElementIds: ["S1", "S2", "C1", "C2", "LR1"],
    };
    const result: PlaneFrameResult = { plane: "XZ", displacements: [], reactions: [{ nodeId: "b1", fxKn: 0, fzKn: 100, momentKnM: 0 }, { nodeId: "b2", fxKn: 0, fzKn: 100, momentKnM: 0 }], elements: [{ elementId: "F:LR1", lengthM: 2, localEndForces: { axialIKn: 10, axialJKn: -10, shearIKn: 0, shearJKn: 0, momentIKnM: 0, momentJKnM: 0 }}], equilibrium: { appliedFxKn: 0, appliedFzKn: -200, appliedMomentKnM: 0, reactionFxKn: 0, reactionFzKn: 200, reactionMomentKnM: 0 }, warnings: [] };
    const mapped = mapFoundationReactions(model, result, "XZ");
    expect(mapped.records[0].redressingLongrineLengthM).toBeCloseTo(2);
    expect(mapped.records[0].redressingLongrineAxialKn).toBeCloseTo(10);
    expect(mapped.records[0].redressingMomentKnM).toBeCloseTo(20);
    expect(mapped.records[0].momentReactionKnM).toBeCloseTo(30);
  });
});
