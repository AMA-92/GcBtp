import { describe, expect, it } from "vitest";
import { deriveRCMemberDemandsFromPlane, deriveRCMemberDemandsFromSpatial, designReinforcedConcrete, proposeColumnSectionIncreases, proposeOptimizedRCSections, validateRCDesignBasis, type RCDesignBasis } from "@shared/rc-design";
import { solvePlaneFrame } from "@shared/frame-solver-2d";
import { designStairV2 } from "@shared/stair-design-v2";
import type { AnalyticalModel } from "@shared/analytical-model";

const basis = (): RCDesignBasis => ({
  schemaVersion: 1,
  standard: "Eurocode 2 — saisie de pré-étude",
  nationalAnnex: "Annexe nationale à confirmer",
  sourceReference: "Paramètres explicitement saisis pour le benchmark",
  basisConfirmed: false,
  fckMpa: 30,
  fykMpa: 500,
  gammaC: 1.5,
  gammaS: 1.15,
  alphaCC: 1,
  coverMm: 30,
  minReinforcementRatio: 0.0013,
  maxReinforcementRatio: 0.04,
  concreteShearStressLimitMpa: 0.4,
  minClearSpacingMm: 20,
  maxLinkSpacingMm: 300,
  maxDeflectionRatio: 250,
  maxColumnSlenderness: 100,
  availableBarDiametersMm: [8, 10, 12, 16, 20, 25],
});

const beam = { id: "B1", type: "beam" as const, combinationId: "comb:uls", combinationName: "ELU benchmark", sectionWidthMm: 250, sectionDepthMm: 500, lengthMm: 5000, axialKn: 0, shearKn: 100, momentKnM: 100, positiveMomentKnM: 100, negativeMomentKnM: 60, serviceMomentKnM: 70, serviceDeflectionMm: 15 };

describe("priority 6 — reinforced concrete pre-design and detailing proposals", () => {
  it("computes a transparent simply-supported stair-flight predesign and blocks missing execution checks", () => {
    const calculated = designStairV2({ spanM: 2.4, riseM: 1.0, widthM: 1.2, thicknessM: 0.15, permanentKnM2: 6, imposedKnM2: 3, gammaG: 1.35, gammaQ: 1.5, fykMpa: 500, gammaS: 1.15, coverMm: 30, mainBarDiameterMm: 25, minReinforcementRatio: 0.0013, maxReinforcementRatio: 0.04 });
    expect(calculated.qULSKnM2).toBeCloseTo(12.6, 8);
    expect(calculated.MEdKnMPerM).toBeCloseTo(9.072, 8);
    expect(calculated.VEdKnPerM).toBeCloseTo(15.12, 8);
    const result = designReinforcedConcrete({
      basis: basis(), members: [], slabs: [],
      stairs: [{ id: "S1", combinationId: "comb:uls", combinationName: "ELU benchmark", flights: [{ id: "S1:flight-1", spanM: 2.4, riseM: 1, widthM: 1.2, thicknessMm: 150, permanentKnM2: 6, imposedKnM2: 3, gammaG: 1.35, gammaQ: 1.5 }] }],
    });
    const design = result.elements[0];
    expect(design.type).toBe("stair");
    expect(design.reinforcement.map(item => item.id)).toEqual(["S1:flight-1:main", "S1:flight-1:distribution"]);
    expect(design.reinforcement.every(item => item.count > 0 && item.totalLengthM > 0)).toBe(true);
    expect(design.checks.find(item => item.id === "S1:flight-1:anchorage")?.status).toBe("bloqué");
    expect(design.checks.find(item => item.id === "S1:flight-1:shear")?.status).toBe("bloqué");
    expect(result.numericalSummary.stairCount).toBe(1);
    expect(result.regulatoryReady).toBe(false);
  });

  it("does not invent stair bars when a flight has invalid geometry", () => {
    const result = designReinforcedConcrete({
      basis: basis(), members: [], slabs: [],
      stairs: [{ id: "S-invalid", combinationId: "comb:uls", combinationName: "ELU benchmark", flights: [{ id: "flight", spanM: 0, riseM: 1, widthM: 1.2, thicknessMm: 150, permanentKnM2: 6, imposedKnM2: 3, gammaG: 1.35, gammaQ: 1.5 }] }],
    });
    expect(result.elements[0].reinforcement).toEqual([]);
    expect(result.elements[0].checks.some(item => item.status === "bloqué")).toBe(true);
  });

  it("blocks reinforcement and optimization when the project selects an unsupported standard", () => {
    const unsupportedBasis = { ...basis(), standard: "SANS 10100" };
    const result = designReinforcedConcrete({ basis: unsupportedBasis, members: [beam], slabs: [] });
    expect(result.standard).toBe("SANS 10100");
    expect(result.errors.some(error => error.includes("ne le prend pas en charge"))).toBe(true);
    expect(result.elements).toEqual([]);
    expect(proposeOptimizedRCSections({ basis: unsupportedBasis, members: [beam], slabs: [] })).toEqual([]);
  });

  it("blocks missing material, annex, provenance, and detailing inputs", () => {
    const incomplete = basis();
    incomplete.nationalAnnex = "";
    incomplete.sourceReference = "";
    incomplete.fckMpa = 0;
    incomplete.maxDeflectionRatio = 0;
    const errors = validateRCDesignBasis(incomplete);
    expect(errors.some(item => item.includes("annexe"))).toBe(true);
    expect(errors.some(item => item.includes("référence"))).toBe(true);
    expect(errors.some(item => item.includes("fck"))).toBe(true);
    expect(errors.some(item => item.includes("limite de flèche"))).toBe(true);
  });

  it("sizes top and bottom beam bars from separate governing moment signs and preserves combination provenance", () => {
    const result = designReinforcedConcrete({ basis: basis(), members: [beam], slabs: [] });
    expect(result.errors).toEqual([]);
    expect(result.regulatoryReady).toBe(false);
    const design = result.elements[0];
    const bottom = design.reinforcement.find(item => item.id === "B1:bottom")!;
    const top = design.reinforcement.find(item => item.id === "B1:top")!;
    expect(bottom.requiredAreaMm2).toBeGreaterThan(top.requiredAreaMm2);
    expect(bottom.diameterMm).toBeGreaterThan(0);
    expect(bottom.count).toBeGreaterThanOrEqual(2);
    expect(design.checks.find(item => item.id === "bottom-flexure")?.status).toBe("satisfaisant");
    expect(design.checks.find(item => item.id === "shear-total")?.status).toBe("satisfaisant");
    expect(design.checks.every(item => item.combinationId === "comb:uls" && item.combinationName === "ELU benchmark")).toBe(true);
  });

  it("reruns checks against edited reinforcement and catches insufficient bar area", () => {
    const result = designReinforcedConcrete({ basis: basis(), members: [beam], slabs: [], overrides: { "B1:bottom": { diameterMm: 8, count: 2 } } });
    const design = result.elements[0];
    expect(design.reinforcement.find(item => item.id === "B1:bottom")?.areaMm2).toBeCloseTo(100.531, 2);
    expect(design.checks.find(item => item.id === "bottom-flexure")?.status).toBe("non satisfaisant");
  });

  it("checks column axial/bending demand, longitudinal bounds, slenderness, and rebar schedule", () => {
    const result = designReinforcedConcrete({
      basis: basis(),
      members: [{ id: "P1", type: "column", combinationId: "comb:uls", combinationName: "ELU poteau", sectionWidthMm: 300, sectionDepthMm: 300, lengthMm: 3200, axialKn: 700, shearKn: 15, momentKnM: 25, momentXKnM: 20, momentYKnM: 10 }],
      slabs: [],
    });
    const design = result.elements[0];
    expect(design.checks.map(item => item.id)).toContain("column-interaction");
    expect(design.checks.map(item => item.id)).toContain("column-slenderness");
    expect(design.checks.find(item => item.id === "column-tie-spacing")?.status).toBe("satisfaisant");
    expect(design.checks.find(item => item.id === "column-bar-layout-count")?.status).toBe("satisfaisant");
    expect(design.checks.some(item => item.id === "column-anchorage-length")).toBe(false);
    expect(design.reinforcement.some(item => item.id.endsWith(":anchorage"))).toBe(false);
    expect(design.checks.find(item => item.id === "column-bael-detailing")?.status).toBe("bloqué");
    expect(design.reinforcement.map(item => item.id)).toContain("P1:ties");
    const longitudinal = design.reinforcement.find(item => item.id === "P1:longitudinal")!;
    const ties = design.reinforcement.find(item => item.id === "P1:ties")!;
    expect(longitudinal.diameterMm).toBeGreaterThanOrEqual(10);
    expect(basis().availableBarDiametersMm).toContain(longitudinal.diameterMm);
    expect(ties.diameterMm).toBe(8);
    expect(result.schedule.length).toBeGreaterThan(0);
    expect(result.schedule.every(item => item.massKg > 0)).toBe(true);
  });

  it("does not propose EC2 column dimensions as compliant while detailing remains blocked", () => {
    const eurocodeBasis = { ...basis(), availableBarDiametersMm: [14] };
    const member = { id: "P-EC2", type: "column" as const, combinationId: "ELU", combinationName: "ELU EC2", sectionWidthMm: 200, sectionDepthMm: 300, lengthMm: 1000, axialKn: 776, shearKn: 0, momentKnM: 0.48, momentXKnM: 0.39, momentYKnM: 0.48 };
    const proposals = proposeColumnSectionIncreases({
      basis: eurocodeBasis,
      member,
      overrides: { "P-EC2:longitudinal": { diameterMm: 14, count: 18 } },
      selfWeightIncluded: true,
      permanentLoadFactor: 1.35,
    });
    expect(proposals).toHaveLength(0);
  });

  it("classifies a modeled corner column, records connected members, and exposes its calculation sheet", () => {
    const frames = [
      { id: "F:P1", sourceElementId: "P1", sourceType: "Poteau", startNodeId: "A0", endNodeId: "A1", sectionId: "S1", levelId: "rdc" },
      { id: "F:P1U", sourceElementId: "P1U", sourceType: "Poteau", startNodeId: "A1", endNodeId: "A2", sectionId: "S1", levelId: "r1" },
      { id: "F:P2", sourceElementId: "P2", sourceType: "Poteau", startNodeId: "B0", endNodeId: "B1", sectionId: "S1", levelId: "rdc" },
      { id: "F:P3", sourceElementId: "P3", sourceType: "Poteau", startNodeId: "C0", endNodeId: "C1", sectionId: "S1", levelId: "rdc" },
      { id: "F:P4", sourceElementId: "P4", sourceType: "Poteau", startNodeId: "D0", endNodeId: "D1", sectionId: "S1", levelId: "rdc" },
      { id: "F:B1", sourceElementId: "B1", sourceType: "Poutre", startNodeId: "A1", endNodeId: "BE", sectionId: "S1", levelId: "rdc" },
    ];
    const model = {
      frames,
      sections: [{ id: "S1", dimensionsM: [0.3, 0.3] }],
      nodes: [
        { id: "A0", x: 0, y: 0, z: 0 }, { id: "A1", x: 0, y: 0, z: 3 }, { id: "A2", x: 0, y: 0, z: 6 },
        { id: "B0", x: 4, y: 0, z: 0 }, { id: "B1", x: 4, y: 0, z: 3 },
        { id: "C0", x: 0, y: 3, z: 0 }, { id: "C1", x: 0, y: 3, z: 3 },
        { id: "D0", x: 4, y: 3, z: 0 }, { id: "D1", x: 4, y: 3, z: 3 }, { id: "BE", x: 4, y: 0, z: 3 },
      ],
      surfaces: [],
      supports: [{ id: "SUP:P1", sourceElementId: "S1", nodeId: "A0", kind: "fixed-base", role: "foundation-contact", restrainedDofs: ["ux", "uy", "uz"], selectionReason: "Appui sur semelle", status: "declared" }],
      nodeMergeToleranceM: 0.01,
    } as unknown as AnalyticalModel;
    const extracted = deriveRCMemberDemandsFromSpatial({
      model,
      result: { elements: [{ elementId: "F:P1", sourceElementId: "P1", lengthM: 3, start: { axialKn: 500 }, end: { axialKn: 480 }, momentYEnvelope: { minKnM: -8, maxKnM: 20 }, momentZEnvelope: { minKnM: -3, maxKnM: 5 }, maxAbsShearKn: 12, maxAbsTorsionKnM: 1 }] } as any,
      combinationId: "comb:uls", combinationName: "ELU enveloppe",
    });
    const context = extracted.demands[0].columnContext!;
    expect(context.position).toBe("angle");
    expect(context.classification).toBe("RDC");
    expect(context.connectedAtBase.some(item => item.role === "support" && item.elementId === "S1")).toBe(true);
    expect(context.connectedAtTop.map(item => item.elementId)).toEqual(expect.arrayContaining(["B1", "P1U"]));
    const design = designReinforcedConcrete({ basis: basis(), members: extracted.demands, slabs: [] }).elements[0];
    expect(design.columnReport?.position).toBe("angle");
    expect(design.columnReport?.combinationName).toBe("ELU enveloppe");
    expect(design.columnReport?.NEdKn).toBe(500);
    expect(design.columnReport?.TEdKnM).toBe(1);
    expect(design.columnReport?.AsProvidedMm2).toBeGreaterThanOrEqual(design.columnReport?.AsMinimumMm2 ?? Infinity);
    expect(design.columnReport?.AsProvidedMm2).toBeGreaterThanOrEqual(design.columnReport?.AsRequiredMm2 ?? Infinity);
    expect(design.checks.find(item => item.id === "column-steel-axial")?.status).toBe("satisfaisant");
  });

  it("reports the configured slenderness limit and does not mark zero first-order moment as a second-order failure", () => {
    const result = designReinforcedConcrete({
      basis: { ...basis(), maxColumnSlenderness: 15 },
      members: [{ id: "P6", type: "column", combinationId: "comb:uls", combinationName: "ELU poteau", sectionWidthMm: 200, sectionDepthMm: 300, lengthMm: 1000, axialKn: 145.2, shearKn: 0, momentKnM: 0, momentXKnM: 0, momentYKnM: 0 }],
      slabs: [],
    });
    const checks = result.elements[0].checks;
    const slenderness = checks.find(item => item.id === "column-slenderness")!;
    expect(slenderness.demand).toBeCloseTo(17.32, 1);
    expect(slenderness.resistance).toBe(15);
    expect(slenderness.status).toBe("non satisfaisant");
    const secondOrder = checks.find(item => item.id === "column-second-order")!;
    expect(secondOrder.status).toBe("à vérifier");
    expect(secondOrder.blocking).toBe(false);
    expect(secondOrder.demand).toBeGreaterThan(0);
  });

  it("selects a catalog bar arrangement that also satisfies the column moment interaction", () => {
    const result = designReinforcedConcrete({
      basis: basis(),
      members: [{ id: "P2", type: "column", combinationId: "comb:uls", combinationName: "ELU poteau", sectionWidthMm: 300, sectionDepthMm: 300, lengthMm: 3200, axialKn: 700, shearKn: 0, momentKnM: 30, momentXKnM: 30, momentYKnM: 0 }],
      slabs: [],
    });
    const design = result.elements[0];
    const longitudinal = design.reinforcement.filter(item => item.id === "P2:longitudinal" || item.id.startsWith("P2:longitudinal:"));
    expect(longitudinal.reduce((sum, item) => sum + item.count, 0)).toBeGreaterThan(4);
    expect(longitudinal.every(item => (item.barPositionsMm?.length ?? 0) === item.count)).toBe(true);
    expect(design.checks.find(item => item.id === "column-interaction")?.status).toBe("satisfaisant");
    expect(design.checks.find(item => item.id === "column-second-order")?.label).toContain("amplification biaxiale");
    expect(design.checks.find(item => item.id === "column-second-order")?.formula).toContain("L0=3200 mm");
    expect(design.columnReport?.MEdXKnM).toBeGreaterThan(30);
    expect(design.checks.find(item => item.id === "column-steel-axial")?.status).toBe("satisfaisant");
    expect(design.columnReport?.AsProvidedMm2).toBeGreaterThanOrEqual(design.columnReport?.AsRequiredMm2 ?? Infinity);
  });

  it("chooses symmetric mixed HA groups when they satisfy a biaxial column check", () => {
    const result = designReinforcedConcrete({
      basis: { ...basis(), availableBarDiametersMm: [10, 12, 16, 20] },
      members: [{ id: "P-MIX", type: "column", combinationId: "comb:uls", combinationName: "ELU poteau", sectionWidthMm: 300, sectionDepthMm: 300, lengthMm: 3200, axialKn: 300, shearKn: 0, momentKnM: 20, momentXKnM: 20, momentYKnM: 0 }],
      slabs: [],
      columnBarCountOverrides: { "P-MIX": 8 },
    });
    const design = result.elements[0];
    const longitudinal = design.reinforcement.filter(item => item.id === "P-MIX:longitudinal" || item.id.startsWith("P-MIX:longitudinal:"));
    expect(longitudinal.length).toBeGreaterThan(1);
    expect(longitudinal.reduce((sum, item) => sum + item.count, 0)).toBe(8);
    expect(new Set(longitudinal.map(item => item.diameterMm)).size).toBeGreaterThan(1);
    expect(longitudinal.every(item => item.barPositionsMm?.length === item.count)).toBe(true);
    expect(design.checks.find(item => item.id === "column-interaction")?.status).toBe("satisfaisant");
    expect(design.checks.find(item => item.id === "column-steel-axial")?.status).toBe("satisfaisant");
    expect(design.columnReport?.AsProvidedMm2).toBeGreaterThanOrEqual(design.columnReport?.AsRequiredMm2 ?? Infinity);
    expect(design.reinforcement.some(item => item.id === "P-MIX:cross-ties" && !!item.tieSegmentsMm?.length)).toBe(true);
  });

  it("respects a selected HA diameter and sizes only the number of bars for that diameter", () => {
    const selectedBasis = { ...basis(), availableBarDiametersMm: [12] };
    const result = designReinforcedConcrete({
      basis: selectedBasis,
      members: [{ id: "P3", type: "column", combinationId: "comb:uls", combinationName: "ELU poteau", sectionWidthMm: 300, sectionDepthMm: 300, lengthMm: 3200, axialKn: 300, shearKn: 0, momentKnM: 20, momentXKnM: 20, momentYKnM: 0 }],
      slabs: [],
    });
    const longitudinal = result.elements[0].reinforcement.find(item => item.id === "P3:longitudinal")!;
    expect(longitudinal.diameterMm).toBe(12);
    expect(longitudinal.count).toBeGreaterThanOrEqual(4);
    expect(result.elements[0].checks.find(item => item.id === "column-interaction")?.status).toBe("satisfaisant");
  });

  it("ignores and blocks a longitudinal HA8 override while proposing an admissible catalog diameter", () => {
    const result = designReinforcedConcrete({
      basis: basis(),
      members: [{ id: "P1", type: "column", combinationId: "comb:uls", combinationName: "ELU poteau", sectionWidthMm: 300, sectionDepthMm: 300, lengthMm: 3200, axialKn: 700, shearKn: 15, momentKnM: 25 }],
      slabs: [],
      overrides: { "P1:longitudinal": { diameterMm: 8, count: 8 } },
    });
    const design = result.elements[0];
    const longitudinal = design.reinforcement.find(item => item.id === "P1:longitudinal")!;
    expect(longitudinal.diameterMm).toBeGreaterThanOrEqual(10);
    expect(basis().availableBarDiametersMm).toContain(longitudinal.diameterMm);
    expect(design.checks.find(item => item.id === "column-longitudinal-override")?.status).toBe("bloqué");
    expect(design.checks.find(item => item.id === "column-longitudinal-override")?.formula).toContain("Override ignoré");
  });

  it("blocks column design without an available longitudinal diameter of at least 10 mm", () => {
    const restrictedBasis = basis();
    restrictedBasis.availableBarDiametersMm = [8];
    const result = designReinforcedConcrete({
      basis: restrictedBasis,
      members: [{ id: "P1", type: "column", combinationId: "comb:uls", combinationName: "ELU poteau", sectionWidthMm: 300, sectionDepthMm: 300, lengthMm: 3200, axialKn: 700, shearKn: 15, momentKnM: 25 }],
      slabs: [],
    });
    const design = result.elements[0];
    expect(design.reinforcement.some(item => item.id === "P1:longitudinal")).toBe(false);
    expect(design.reinforcement.find(item => item.id === "P1:ties")?.diameterMm).toBe(8);
    expect(design.checks.find(item => item.id === "column-longitudinal-diameter")?.status).toBe("bloqué");
    expect(design.checks.find(item => item.id === "column-longitudinal-diameter")?.formula).toContain("dimensionnement du poteau est bloqué");
    expect(result.status).toBe("bloqué — calcul numérique incomplet");
  });

  it("sizes slab X/Y strips separately and applies an explicit punching assumption", () => {
    const result = designReinforcedConcrete({
      basis: basis(), members: [],
      slabs: [{ id: "D1", combinationId: "comb:uls", combinationName: "ELU dalle", spanXM: 4, spanYM: 3, thicknessMm: 200, mxKnMPerM: 25, myKnMPerM: 10, serviceDeflectionMm: 8 }],
    });
    const design = result.elements[0];
    expect(design.reinforcement.find(item => item.id === "D1:x")?.requiredAreaMm2).toBeGreaterThan(design.reinforcement.find(item => item.id === "D1:y")?.requiredAreaMm2 ?? 0);
    expect(design.checks.find(item => item.id === "slab-punching")?.status).toBe("satisfaisant");
    expect(design.checks.find(item => item.id === "slab-deflection")?.status).toBe("satisfaisant");
  });

  it("does not treat a cantilever balcony edge reaction as a point column reaction", () => {
    const result = designReinforcedConcrete({
      basis: basis(), members: [],
      slabs: [{ id: "BAL1", combinationId: "comb:uls", combinationName: "ELU balcon", spanXM: 3, spanYM: 1.5, spanDirection: "X", boundaryMode: "cantilever-fixed-edge", thicknessMm: 200, mxKnMPerM: 30, myKnMPerM: 8, negativeMxKnMPerM: 30, negativeMyKnMPerM: 4, serviceDeflectionMm: 12, uniformLoadKnM2: 8, floorType: "Dalle pleine" }],
    });
    const design = result.elements[0];
    expect(design.checks.find(item => item.id === "slab-punching")?.status).not.toBe("satisfaisant");
    expect(design.limitations.some(item => item.includes("réaction calculée est linéique"))).toBe(true);
  });

  it("documents the orthotropic equivalent assumptions for a solved hollow-core slab", () => {
    const result = designReinforcedConcrete({
      basis: basis(), members: [],
      slabs: [{ id: "HC1", combinationId: "comb:uls", combinationName: "ELU plancher", spanXM: 5, spanYM: 3, spanDirection: "X", boundaryMode: "one-way-simply-supported", floorType: "Corps creux", thicknessMm: 200, mxKnMPerM: 20, myKnMPerM: 3, negativeMxKnMPerM: 0, negativeMyKnMPerM: 0, serviceDeflectionMm: 15, uniformLoadKnM2: 7 }],
    });
    expect(result.elements[0].limitations.some(item => item.includes("plaque orthotrope"))).toBe(true);
    expect(result.elements[0].checks.find(item => item.id === "slab-punching")?.status).not.toBe("satisfaisant");
  });

  it("refuses to design from missing solver demands and incomplete material data", () => {
    const result = designReinforcedConcrete({ basis: basis(), members: [], slabs: [] });
    expect(result.elements).toEqual([]);
    expect(result.errors).toContain("Aucun effort calculé par le solveur/maillage n’est disponible pour dimensionner le béton armé.");
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("derives the interior positive moment from a solved uniformly loaded member and preserves the combination", () => {
    const frameId = "F:B1";
    const solved = solvePlaneFrame({
      plane: "XZ",
      nodes: [{ id: "A", x: 0, z: 0 }, { id: "B", x: 5, z: 0 }],
      elements: [{ id: frameId, i: "A", j: "B", elasticModulusKnM2: 30_000_000, areaM2: 0.05, inertiaM4: 0.001 }],
      supports: [{ nodeId: "A", restrained: [true, true, false] }, { nodeId: "B", restrained: [false, true, false] }],
      memberLoads: [{ elementId: frameId, qyKnM: -10 }],
    });
    const model = {
      frames: [{ id: frameId, sourceElementId: "B1", sourceType: "Poutre", startNodeId: "A", endNodeId: "B", sectionId: "S1" }],
      sections: [{ id: "S1", dimensionsM: [0.25, 0.5] }],
      nodes: [{ id: "A", x: 0, y: 0, z: 0 }, { id: "B", x: 5, y: 0, z: 0 }],
    } as unknown as AnalyticalModel;
    const extracted = deriveRCMemberDemandsFromPlane({ model, result: solved, combinationId: "comb:uls", combinationName: "ELU 1,35G+1,5Q", memberLoads: [{ elementId: frameId, qyKnM: -10 }] });
    expect(extracted.warnings).toEqual([]);
    expect(extracted.demands[0].positiveMomentKnM).toBeCloseTo(31.25, 7);
    expect(extracted.demands[0].combinationName).toBe("ELU 1,35G+1,5Q");
    expect(extracted.demands[0].sectionWidthMm).toBe(250);
  });
});


it("ferraille une longrine de redressement avec le même calcul BA après résolution", () => {
  const result = designReinforcedConcrete({
    basis: basis(),
    members: [{ id: "LR1", type: "beam", memberSubtype: "tie-beam", combinationId: "comb:uls", combinationName: "ELU longrine", sectionWidthMm: 300, sectionDepthMm: 500, lengthMm: 4000, axialKn: 80, shearKn: 60, momentKnM: 70, positiveMomentKnM: 70, negativeMomentKnM: 40 }],
    slabs: [],
  });
  expect(result.elements[0].type).toBe("tie-beam");
  expect(result.elements[0].reinforcement.some(item => item.id === "LR1:bottom")).toBe(true);
  expect(result.elements[0].reinforcement.some(item => item.id === "LR1:links")).toBe(true);
});

it("ferraille une semelle à partir de la réaction et produit le métré acier", () => {
  const result = designReinforcedConcrete({
    basis: basis(), members: [], slabs: [],
    foundations: [{ id: "S1", combinationId: "comb:uls", combinationName: "ELU fondation", widthM: 2, lengthM: 2, thicknessM: 0.45, columnWidthM: 0.30, columnDepthM: 0.30, axialKn: 500, shearKn: 20, momentXKnM: 20, momentYKnM: 15, soilBearingKPa: 180 }],
  });
  expect(result.errors).toEqual([]);
  expect(result.elements[0].type).toBe("footing");
  expect(result.elements[0].reinforcement.map(item => item.id)).toEqual(expect.arrayContaining(["S1:x", "S1:y"]));
  expect(result.schedule.length).toBeGreaterThan(0);
  expect(result.elements[0].checks.map(item => item.id)).toEqual(expect.arrayContaining(["bearing-screen", "flexion-x", "flexion-y", "punching"]));
  expect(result.elements[0].checks.map(item => item.id)).toEqual(expect.arrayContaining(["one-way-shear-x", "one-way-shear-y"]));
  expect(result.numericalSummary.footingCount).toBe(1);
  expect(result.numericalSummary.checkCount).toBeGreaterThan(0);
  expect(result.status).toBe("calculé numériquement — non certifié");
});

it("dimensionne les armatures de la semelle par les efforts sans qadm et laisse le sol non vérifié", () => {
  const result = designReinforcedConcrete({
    basis: basis(), members: [], slabs: [],
    foundations: [{ id: "S2", combinationId: "comb:uls", combinationName: "ELU fondation", widthM: 2, lengthM: 2, thicknessM: 0.45, columnWidthM: 0.30, columnDepthM: 0.30, axialKn: 500, shearKn: 20, momentXKnM: 20, momentYKnM: 15, soilBearingKPa: null }],
  });
  const footing = result.elements[0];
  const bearing = footing.checks.find(item => item.id === "bearing-screen");
  expect(footing.reinforcement.map(item => item.id)).toEqual(expect.arrayContaining(["S2:x", "S2:y"]));
  expect(bearing?.status).toBe("à vérifier");
  expect(bearing?.blocking).toBe(false);
  expect(result.numericalSummary.blockedCheckCount).not.toBeGreaterThan(footing.checks.filter(item => item.status === "bloqué").length);
  expect(result.status).toBe("calculé numériquement — non certifié");
});

describe("RC section optimization", () => {
  it("finds a smaller footing when the available checks pass", () => {
    const basis = { schemaVersion: 1 as const, standard: "Eurocode 2 — test", nationalAnnex: "test", sourceReference: "test", basisConfirmed: true, fckMpa: 25, fykMpa: 500, gammaC: 1.5, gammaS: 1.15, alphaCC: 0.85, coverMm: 50, minReinforcementRatio: 0.0015, maxReinforcementRatio: 0.04, concreteShearStressLimitMpa: 0.8, minClearSpacingMm: 20, maxLinkSpacingMm: 250, maxDeflectionRatio: 250, maxColumnSlenderness: 30, availableBarDiametersMm: [8,10,12,16,20,25] };
    const proposals = proposeOptimizedRCSections({ basis, members: [], slabs: [], foundations: [{ id: "S1", levelLabel: "Fondation", combinationId: "ELU", combinationName: "ELU", widthM: 1, lengthM: 1, thicknessM: 0.2, columnWidthM: 0.2, columnDepthM: 0.2, axialKn: 20, shearKn: 0, momentXKnM: 0, momentYKnM: 0, soilBearingKPa: 300 }] });
    expect(proposals.some(item => item.elementId === "S1" && item.proposedSection.dimensions[0] < 1)).toBe(true);
  });
});

it("preserves distinct signed 3D span and support moment envelopes for beam reinforcement", () => {
  const analyticalModel = {
    frames: [{ id: "F:B1", sourceElementId: "B1", sourceType: "Poutre", startNodeId: "A", endNodeId: "B", sectionId: "S1" }],
    sections: [{ id: "S1", dimensionsM: [0.25, 0.50] }],
    nodes: [{ id: "A", x: 0, y: 0, z: 3 }, { id: "B", x: 5, y: 0, z: 3 }],
  } as unknown as AnalyticalModel;
  const spatialResult = {
    elements: [{
      elementId: "F:B1", sourceElementId: "B1", lengthM: 5,
      start: { axialKn: 0 }, end: { axialKn: 0 },
      momentYEnvelope: { minKnM: -8, maxKnM: 30 }, momentZEnvelope: { minKnM: -2, maxKnM: 2 },
      maxAbsShearKn: 25,
    }],
  } as any;
  const extracted = deriveRCMemberDemandsFromSpatial({ model: analyticalModel, result: spatialResult, combinationId: "comb:uls", combinationName: "ELU 3D" });
  expect(extracted.warnings).toEqual([]);
  expect(extracted.demands[0].positiveMomentKnM).toBe(30);
  expect(extracted.demands[0].negativeMomentKnM).toBe(8);
  expect(extracted.demands[0].momentKnM).toBe(30);
});
