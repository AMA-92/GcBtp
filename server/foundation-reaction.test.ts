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

  it("identifies partial contact when eccentricity exceeds the kern limit", () => {
    const result = checkFoundationReaction({ ...base, momentReactionKnM: 40 });
    expect(result.eccentricityM).toBeCloseTo(0.4, 8);
    expect(result.eccentricityRatio).toBeGreaterThan(1 / 6);
    expect(result.minimumPressureKPa).toBe(0);
    expect(result.checks.find(check => check.id === "contact")?.status).toBe("insuffisant");
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

  it("maps reaction node IDs to the corresponding footing and section geometry", () => {
    const model: AnalyticalModel = {
      schemaVersion: 1,
      units: { length: "m", force: "kN", stress: "kN/m²", moment: "kN·m" },
      nodeMergeToleranceM: 0.01,
      nodes: [
        { id: "base", x: 0, y: 0, z: 0, levelIds: ["foundation"], sourceElementIds: ["C1"] },
        { id: "f1", x: -1, y: -1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
        { id: "f2", x: 1, y: -1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
        { id: "f3", x: 1, y: 1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
        { id: "f4", x: -1, y: 1, z: -1, levelIds: ["foundation"], sourceElementIds: ["S1"] },
      ],
      frames: [{ id: "F:C1", sourceElementId: "C1", sourceType: "Poteau", startNodeId: "base", endNodeId: "top", sectionId: "col", materialId: "concrete", levelId: "rdc", releases: { start: [], end: [] }, eccentricityM: { start: [0, 0, 0], end: [0, 0, 0] } }],
      surfaces: [{ id: "S:S1:1", sourceElementId: "S1", sourceType: "Semelle", kind: "footing", nodeIds: ["f1", "f2", "f3", "f4"], sectionId: "footing", materialId: "concrete", levelId: "foundation", openings: [] }],
      supports: [{ id: "SUP:S1:C1", sourceElementId: "S1", nodeId: "base", kind: "fixed-base", restrainedDofs: ["ux", "uy", "uz", "rx", "ry", "rz"], status: "inferred-from-footing" }],
      materials: [],
      sections: [
        { id: "footing", name: "S1", shape: "rectangle", dimensionsM: [2, 2, 0.4], areaM2: 4, inertiaY4M4: 1, inertiaZ4M4: 1, provenance: "model-catalog" },
        { id: "col", name: "Pot_30", shape: "rectangle", dimensionsM: [0.3, 0.3], areaM2: 0.09, inertiaY4M4: 0.000675, inertiaZ4M4: 0.000675, provenance: "model-catalog" },
      ],
      mesh: { globalSizeM: 1, maxAspectRatio: 5, refinementRegions: [] },
      sourceElementIds: ["S1", "C1"],
    };
    const result: PlaneFrameResult = {
      plane: "XZ",
      displacements: [],
      reactions: [{ nodeId: "base", fxKn: 4, fzKn: 100, momentKnM: 12 }],
      elements: [],
      equilibrium: { appliedFxKn: -4, appliedFzKn: -100, appliedMomentKnM: -12, reactionFxKn: 4, reactionFzKn: 100, reactionMomentKnM: 12 },
      warnings: [],
    };
    const mapped = mapFoundationReactions(model, result, "XZ");
    expect(mapped.records).toHaveLength(1);
    expect(mapped.records[0]).toMatchObject({ footingId: "S1", columnId: "C1", nodeId: "base", verticalReactionKn: 100, horizontalReactionKn: 4, momentReactionKnM: 12, momentAxis: "x", widthXM: 2, widthYM: 2, thicknessM: 0.4, columnWidthM: 0.3, columnDepthM: 0.3 });
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
      supports: [{ id: "SUP:S1:C1", sourceElementId: "S1", nodeId: "base", kind: "fixed-base", restrainedDofs: ["ux", "uy", "uz", "rx", "ry", "rz"], status: "inferred-from-footing" }],
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
    expect(mapped.warnings.some(warning => warning.includes("moment géométrique N·e"))).toBe(true);
    expect(mapped.warnings.some(warning => warning.includes("deux axes"))).toBe(true);
  });
});
