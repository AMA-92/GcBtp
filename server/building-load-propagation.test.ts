import { describe, expect, it } from "vitest";
import { buildBuildingLoadModel, summarizeBuildingLoads } from "../shared/building-load-propagation";
import { calculateLoadDescent } from "../shared/load-engine";

describe("building load propagation", () => {
  it("propagates a real slab through real beam, columns and footings", () => {
    const model = buildBuildingLoadModel([
      { id: "PL1", type: "Dalle", x: 0, y: 0, x2: 4, y2: 4, levelId: "rdc", floorConfig: { thickness: "16+4 cm", direction: "X" } },
      { id: "B1", type: "Poutre", x: 0, y: 0, x2: 4, y2: 0, levelId: "rdc" },
      { id: "P1", type: "Poteau", x: 0, y: 0, levelId: "rdc" },
      { id: "P2", type: "Poteau", x: 4, y: 0, levelId: "rdc" },
      { id: "S1", type: "Semelle", x: 0, y: 0, levelId: "foundation" },
      { id: "S2", type: "Semelle", x: 4, y: 0, levelId: "foundation" },
    ]);
    expect(model.contributions).toHaveLength(1);
    expect(model.beamToColumns.B1).toEqual(["P1", "P2"]);
    expect(model.columnToFoundation).toEqual({ P1: "S1", P2: "S2" });
    expect(Object.keys(model.propagation.foundations)).toEqual(["S1", "S2"]);
    expect(model.rows.find(row => row.id === "S1")?.nser).toBeGreaterThan(0);
    expect(model.rows.find(row => row.id === "B1")?.nu).toBeGreaterThan(0);
    expect(summarizeBuildingLoads(model).rows.length).toBe(6);
  });

  it("lists all four incident beams and the column self-weight as separate load origins", () => {
    const model = buildBuildingLoadModel([
      { id: "PT1", type: "Poutre", section: "20x40", x: 0, y: 0, x2: 1, y2: 0, levelId: "rdc" },
      { id: "PT2", type: "Poutre", section: "20x40", x: 0, y: 0, x2: -1, y2: 0, levelId: "rdc" },
      { id: "PT3", type: "Poutre", section: "20x40", x: 0, y: 0, x2: 0, y2: 1, levelId: "rdc" },
      { id: "PT4", type: "Poutre", section: "20x40", x: 0.003, y: 0.003, x2: 0, y2: -1, levelId: "rdc" },
      { id: "P6", type: "Poteau", section: "20x30", x: 0, y: 0, levelId: "rdc" },
    ], { levelOrder: ["rdc"], levelHeights: { rdc: 3.2 }, gridDistance: 4 });

    expect(model.columnBeamContributions.P6).toHaveLength(4);
    expect(model.columnBeamContributions.P6.map(item => item.beamId).sort()).toEqual(["PT1", "PT2", "PT3", "PT4"]);
    expect(model.columnSelfWeights.P6).toBeCloseTo(4.8, 8);
    const beamTotal = model.columnBeamContributions.P6.reduce((sum, item) => sum + item.gk, 0);
    expect(model.rows.find(row => row.id === "P6")?.gk).toBeCloseTo(beamTotal + model.columnSelfWeights.P6, 8);
  });

  it.each([2, 3])("shows %i connected beams plus the column self-weight", beamCount => {
    const endpoints = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const beams = endpoints.slice(0, beamCount).map(([x2, y2], index) => ({
      id: `PT${index + 1}`, type: "Poutre", section: "20x40",
      x: 0, y: 0, x2, y2, levelId: "rdc",
    }));
    const model = buildBuildingLoadModel([
      ...beams,
      { id: "P6", type: "Poteau", section: "20x30", x: 0, y: 0, levelId: "rdc" },
    ], { levelOrder: ["rdc"], levelHeights: { rdc: 3.2 }, gridDistance: 4 });

    expect(model.columnBeamContributions.P6).toHaveLength(beamCount);
    expect(model.columnSelfWeights.P6).toBeCloseTo(4.8, 8);
    expect(model.rows.find(row => row.id === "P6")?.gk).toBeCloseTo(
      model.columnBeamContributions.P6.reduce((sum, item) => sum + item.gk, 0) + model.columnSelfWeights.P6,
      8,
    );
  });

  it("includes a balcony as a full-slab surface with its own imposed load", () => {
    const model = buildBuildingLoadModel([
      { id: "BAL1", type: "Balcon", x: 0, y: 0, x2: 1, y2: 1, levelId: "rdc" },
    ]);
    expect(model.floors).toHaveLength(1);
    expect(model.floors[0]).toMatchObject({ gk: 96, qk: 56, distributionMode: "two-way" });
    expect(model.rows.find(row => row.id === "BAL1")).toMatchObject({ type: "Balcon", gk: 96, qk: 56 });
  });

  it("keeps solid and hollow-core slabs as separately named load assignments", () => {
    const model = buildBuildingLoadModel([
      { id: "PL-PLEINE", type: "Dalle", x: 0, y: 0, x2: 1, y2: 1, levelId: "rdc", floorConfig: { type: "Dalle pleine", thickness: "20 cm", characteristicPermanentLoad: "8.00", characteristicImposedLoad: "2.00" } },
      { id: "PL-CORPS", type: "Dalle", x: 2, y: 0, x2: 3, y2: 1, levelId: "rdc", floorConfig: { type: "Corps creux", thickness: "16+4 cm", characteristicPermanentLoad: "5.84", characteristicImposedLoad: "1.50" } },
    ], { levelOrder: ["rdc"], gridDistance: 1 });
    expect(model.surfaceAssignments.map(row => row.loadName)).toEqual(["Dalle pleine · PL-PLEINE", "Dalle à corps creux · PL-CORPS"]);
    expect(model.surfaceAssignments.map(row => row.gkKnM2)).toEqual([8, 5.84]);
    expect(model.surfaceAssignments.map(row => row.qkKnM2)).toEqual([2, 1.5]);
  });

  it("transfers a cantilever balcony load only to its selected fixed edge", () => {
    const model = buildBuildingLoadModel([
      { id: "BAL2", type: "Balcon", x: 0, y: 0, x2: 1, y2: 1, levelId: "rdc", floorConfig: { type: "Dalle pleine", thickness: "20 cm", characteristicPermanentLoad: "6.00", characteristicImposedLoad: "3.50", balconySupportEdge: "left" } },
      { id: "B-ROOT", type: "Poutre", x: 0, y: 0, x2: 0, y2: 1, levelId: "rdc" },
      { id: "B-FREE-1", type: "Poutre", x: 0, y: 0, x2: 1, y2: 0, levelId: "rdc" },
      { id: "B-FREE-2", type: "Poutre", x: 0, y: 1, x2: 1, y2: 1, levelId: "rdc" },
      { id: "B-FREE-3", type: "Poutre", x: 1, y: 0, x2: 1, y2: 1, levelId: "rdc" },
    ]);
    expect(model.contributions.map(item => item.beamId)).toEqual(["B-ROOT"]);
    expect(model.contributions[0]).toMatchObject({ gk: 96, qk: 56 });
    expect(model.contributions[0].source).toContain("porte-à-faux");
  });

  it("transfère un balcon de coin uniquement sur la rive droite explicitement choisie", () => {
    const model = buildBuildingLoadModel([
      { id: "BAL2", type: "Balcon", x: 0.5, y: 1, x2: 1, y2: 1.8, levelId: "rdc", floorConfig: { type: "Dalle pleine", thickness: "20 cm", characteristicPermanentLoad: "6.00", characteristicImposedLoad: "3.50", balconySupportEdge: "right" } },
      { id: "B18", type: "Poutre", x: 0, y: 1, x2: 1, y2: 1, levelId: "rdc" },
      { id: "B19", type: "Poutre", x: 1, y: 1, x2: 1, y2: 1.8, levelId: "rdc" },
    ], { levelOrder: ["rdc"], gridDistance: 4 });
    expect(model.contributions.map(item => item.beamId)).toEqual(["B19"]);
    expect(model.contributions[0].gk).toBeCloseTo(38.4, 8);
    expect(model.contributions[0].qk).toBeCloseTo(22.4, 8);
    expect(model.warnings.filter(warning => warning.includes("Balcon BAL2"))).toEqual([]);
  });

  it("uses physical axis positions for a balcony on a non-uniform grid", () => {
    const model = buildBuildingLoadModel([
      { id: "BAL2", type: "Balcon", x: 0.5, y: 1, x2: 1, y2: 1.8, levelId: "rdc", floorConfig: { type: "Dalle pleine", thickness: "20 cm", characteristicPermanentLoad: "6.00", characteristicImposedLoad: "3.50", balconySupportEdge: "right" } },
      { id: "B18", type: "Poutre", x: 0, y: 1, x2: 1, y2: 1, levelId: "rdc" },
      { id: "B19", type: "Poutre", x: 1, y: 1, x2: 1, y2: 1.8, levelId: "rdc" },
    ], {
      levelOrder: ["rdc"],
      gridDistance: 4,
      xAxisPositionsM: [0, 4, 8],
      yAxisPositionsM: [0, 4, 9],
    });

    expect(model.floors[0]).toMatchObject({ gk: 48, qk: 28 });
    expect(model.contributions.map(item => item.beamId)).toEqual(["B19"]);
    expect(model.contributions[0].gk).toBeCloseTo(48, 8);
    expect(model.contributions[0].qk).toBeCloseTo(28, 8);
  });

  it("does not distribute a balcony to free edges when its fixed edge is missing", () => {
    const model = buildBuildingLoadModel([
      { id: "BAL3", type: "Balcon", x: 0, y: 0, x2: 1, y2: 1, levelId: "rdc" },
      { id: "B-TOP", type: "Poutre", x: 0, y: 0, x2: 1, y2: 0, levelId: "rdc" },
      { id: "B-BOTTOM", type: "Poutre", x: 0, y: 1, x2: 1, y2: 1, levelId: "rdc" },
    ]);
    expect(model.contributions).toEqual([]);
    expect(model.warnings.some(warning => warning.includes("rive d’encastrement absente"))).toBe(true);
  });

  it("cumulates an upper-storey load through aligned lower columns to the footing", () => {
    const model = buildBuildingLoadModel([
      { id: "PL1", type: "Dalle", x: 0, y: 0, x2: 4, y2: 4, levelId: "r1", floorConfig: { thickness: "16+4 cm", direction: "X" } },
      { id: "B1", type: "Poutre", x: 0, y: 0, x2: 4, y2: 0, levelId: "r1" },
      { id: "P2", type: "Poteau", x: 0, y: 0, levelId: "r1" },
      { id: "P3", type: "Poteau", x: 4, y: 0, levelId: "r1" },
      { id: "P1", type: "Poteau", x: 0, y: 0, levelId: "rdc" },
      { id: "P4", type: "Poteau", x: 4, y: 0, levelId: "rdc" },
      { id: "S1", type: "Semelle", x: 0, y: 0, levelId: "foundation" },
      { id: "S2", type: "Semelle", x: 4, y: 0, levelId: "foundation" },
    ], { levelOrder: ["foundation", "rdc", "r1"] });
    const upper = model.propagation.columns.P2.gk;
    const lower = model.propagation.columns.P1.gk;
    expect(upper).toBeGreaterThan(0);
    expect(lower).toBeGreaterThan(upper);
    expect(model.propagation.foundations.S1.gk).toBeCloseTo(lower);
    expect(model.columnTransferredContributions.P1).toHaveLength(1);
    expect(model.columnTransferredContributions.P1[0]).toMatchObject({ sourceColumnId: "P2", gk: upper });
    expect(model.levelLoads.r1.totalGk).toBeGreaterThan(0);
  });

  it("applies intrinsic beam and column self-weight to a foundation-level frame without a slab", () => {
    const model = buildBuildingLoadModel([
      { id: "P1", type: "Poteau", section: "Pot_20x30", x: 0, y: 0, levelId: "foundation" },
      { id: "P2", type: "Poteau", section: "Pot_20x30", x: 1, y: 0, levelId: "foundation" },
      { id: "P3", type: "Poteau", section: "Pot_20x30", x: 1, y: 1, levelId: "foundation" },
      { id: "P4", type: "Poteau", section: "Pot_20x30", x: 0, y: 1, levelId: "foundation" },
      { id: "B1", type: "Poutre", section: "Poutre_20x40", x: 0, y: 0, x2: 1, y2: 0, levelId: "foundation" },
      { id: "B2", type: "Poutre", section: "Poutre_20x40", x: 1, y: 0, x2: 1, y2: 1, levelId: "foundation" },
      { id: "B3", type: "Poutre", section: "Poutre_20x40", x: 1, y: 1, x2: 0, y2: 1, levelId: "foundation" },
      { id: "B4", type: "Poutre", section: "Poutre_20x40", x: 0, y: 1, x2: 0, y2: 0, levelId: "foundation" },
      { id: "S1", type: "Semelle", section: "S1", x: 0, y: 0, levelId: "foundation" },
      { id: "S2", type: "Semelle", section: "S1", x: 1, y: 0, levelId: "foundation" },
      { id: "S3", type: "Semelle", section: "S1", x: 1, y: 1, levelId: "foundation" },
      { id: "S4", type: "Semelle", section: "S1", x: 0, y: 1, levelId: "foundation" },
    ], { levelOrder: ["foundation"], gridDistance: 4 });
    expect(model.propagation.beams.B1.gk).toBeCloseTo(8);
    expect(model.propagation.columns.P1.gk).toBeGreaterThan(0);
    expect(model.propagation.foundations.S1.gk).toBeGreaterThan(0);
    expect(model.rows.find(row => row.id === "B1")?.nser).toBeGreaterThan(0);
  });

  it("reports disconnected real elements instead of silently inventing supports", () => {
    const model = buildBuildingLoadModel([
      { id: "PL1", type: "Dalle", x: 0, y: 0, x2: 4, y2: 4, levelId: "rdc" },
      { id: "B1", type: "Poutre", x: 0, y: 0, x2: 4, y2: 0, levelId: "rdc" },
    ]);
    expect(model.warnings.some(warning => warning.includes("sans poteaux réels"))).toBe(true);
  });

  it("uses the two flights and landing surfaces of an RSA stair geometry", () => {
    const model = buildBuildingLoadModel([
      { id: "ESC1", type: "Escaliers", x: 0, y: 0, x2: 2, y2: 2, levelId: "rdc", stairGeometry: {
        baseA: { x: 0, y: 0 }, baseB: { x: 1, y: 1 }, midA: { x: 1, y: 1 }, midB: { x: 2, y: 2 }, topA: { x: 1, y: 2 }, topB: { x: 2, y: 3 }, landingZ: 1.6,
      }, floorConfig: { type: "Dalle pleine", thickness: "18 cm", characteristicPermanentLoad: "6.50", characteristicImposedLoad: "2.50" } },
      { id: "B1", type: "Poutre", x: 0, y: 0, x2: 2, y2: 0, levelId: "rdc" },
    ], { levelOrder: ["rdc"], gridDistance: 1 });
    expect(model.floors[0].gk).toBeCloseTo(19.5);
    expect(model.floors[0].qk).toBeCloseTo(7.5);
    expect(model.surfaceAssignments[0].loadName).toContain("Escalier · géométrie héritée/provisoire");
  });

  it("affecte quatre charges distinctes aux deux volées et aux deux paliers mesurés", () => {
    const flight1 = { lowerA: { x: 0, y: 0 }, lowerB: { x: 1, y: 0 }, upperA: { x: 0, y: 2 }, upperB: { x: 1, y: 2 }, lowerLevelId: "rdc", upperLevelId: "rdc" };
    const flight2 = { lowerA: { x: 1, y: 2 }, lowerB: { x: 2, y: 2 }, upperA: { x: 1, y: 0 }, upperB: { x: 2, y: 0 }, lowerLevelId: "rdc", upperLevelId: "rdc" };
    const model = buildBuildingLoadModel([
      { id: "ES1", type: "Escaliers", x: 0, y: 0, x2: 2, y2: 2, levelId: "rdc", stairGeometry: { flight1, flight2, landingZ: 2.1 }, absoluteStairGeometry: { flight1, flight2 }, floorConfig: { type: "Dalle pleine", thickness: "15 cm", characteristicImposedLoad: "3.00", stairLandingDepthM: "1.00", stairRise: "2.04", stairRiser: "0.17", stairTread: "0.30", stairFinishLoad: "0.00", stairLandingFinishLoad: "1.00", stairLandingImposedLoad: "3.00" } },
    ], { levelOrder: ["rdc"], gridDistance: 1 });
    expect(model.surfaceAssignments.map(row => row.id)).toEqual(["ES1:volée-1", "ES1:volée-2", "ES1:palier-intermediaire", "ES1:palier-arrivee"]);
    expect(model.surfaceAssignments.reduce((sum, row) => sum + row.areaM2, 0)).toBeCloseTo(7);
    expect(model.surfaceAssignments.slice(0, 2).map(row => row.areaM2)).toEqual([2, 2]);
    expect(model.surfaceAssignments.slice(2).map(row => row.areaM2)).toEqual([2, 1]);
    expect(model.surfaceAssignments.slice(2).map(row => row.gkKnM2)).toEqual([4.75, 4.75]);
    expect(model.surfaceAssignments.every(row => row.qkKnM2 === 3)).toBe(true);
    expect(model.surfaceAssignments.reduce((sum, row) => sum + row.gkKn, 0)).toBeCloseTo(model.floors[0].gk);
    expect(model.surfaceAssignments.reduce((sum, row) => sum + row.qkKn, 0)).toBeCloseTo(model.floors[0].qk);
  });

  it("includes landing area and support reactions in the stair load chain", () => {
    const result = calculateLoadDescent({
      country: "Côte d’Ivoire", city: "Abidjan", structure: "Béton armé", material: "béton armé", levels: 2,
      tributaryArea: 16, slabThickness: 0.2,
      selectedCases: { permanent: true, exploitation: true },
      stairs: { flights: 1, width: 1.2, horizontalRun: 3, rise: 2, slabThickness: 0.15, landingCount: 2, landingLength: 1.2, landingWidth: 1.2, landingThickness: 0.15, landingFinishLoad: 1, landingImposedLoad: 3, supportReactions: [{ id: "B-ESC-1", gk: 12, qk: 4 }] },
    });
    expect(result.assumptions.landingArea).toBeCloseTo(2.88);
    expect(result.assumptions.stairReactionGk).toBe(12);
    expect(result.assumptions.stairReactionQk).toBe(4);
    expect(result.chain.foundation).toBeGreaterThan(0);
  });
});

  it("counts the shared stair landing only once", () => {
    const model = buildBuildingLoadModel([
      { id: "ESC2", type: "Escaliers", x: 0, y: 0, x2: 3, y2: 3, levelId: "rdc", stairGeometry: {
        flight1: { lowerA: { x: 0, y: 0 }, lowerB: { x: 1, y: 1 }, upperA: { x: 1, y: 1 }, upperB: { x: 2, y: 2 }, lowerLevelId: "rdc", upperLevelId: "r1" },
        flight2: { lowerA: { x: 1, y: 1 }, lowerB: { x: 2, y: 2 }, upperA: { x: 2, y: 2 }, upperB: { x: 3, y: 3 }, lowerLevelId: "r1", upperLevelId: "r2" },
        landingZ: 1.6,
      }, floorConfig: { type: "Dalle pleine", thickness: "15 cm", characteristicPermanentLoad: "6.50", characteristicImposedLoad: "2.50" } },
    ], { levelOrder: ["rdc", "r1", "r2"], gridDistance: 1 });
    expect(model.surfaceAssignments.map(row => row.id)).toEqual(["ESC2:volée-1", "ESC2:volée-2", "ESC2:palier-intermediaire", "ESC2:palier-arrivee"]);
    expect(model.surfaceAssignments.filter(row => row.id === "ESC2:palier-intermediaire")).toHaveLength(1);
    expect(model.surfaceAssignments.reduce((sum, row) => sum + row.areaM2, 0)).toBeCloseTo(8);
    expect(model.surfaceAssignments.reduce((sum, row) => sum + row.gkKn, 0)).toBeCloseTo(model.floors[0].gk);
    expect(model.surfaceAssignments.reduce((sum, row) => sum + row.qkKn, 0)).toBeCloseTo(model.floors[0].qk);
  });

describe("longrines de redressement entre semelles", () => {
  it("transfère la moitié du poids propre vers chaque semelle", () => {
    const model = buildBuildingLoadModel([
      { id: "LR1", type: "Longrine de redressement", section: "Longrine_20x40", x: 0, y: 0, x2: 2, y2: 0, levelId: "foundation" },
      { id: "S1", type: "Semelle", x: 0, y: 0, levelId: "foundation" },
      { id: "S2", type: "Semelle", x: 2, y: 0, levelId: "foundation" },
    ], { levelOrder: ["foundation"], gridDistance: 1 });
    expect(model.beamToColumns.LR1).toEqual(["S1", "S2"]);
    expect(model.propagation.beams.LR1.gk).toBeCloseTo(4);
    expect(model.propagation.foundations.S1.gk).toBeCloseTo(2);
    expect(model.propagation.foundations.S2.gk).toBeCloseTo(2);
    expect(model.rows.find(row => row.id === "LR1")?.nser).toBeGreaterThan(0);
  });
});


describe("escalier monolithique sans poutre obligatoire", () => {
  it("transmet G et Q vers les poteaux géométriques sans avertissement de poutre", () => {
    const model = buildBuildingLoadModel([
      {
        id: "ES1",
        type: "Escaliers",
        section: "Escalier BA 15 cm",
        x: 0,
        y: 0,
        x2: 2,
        y2: 2,
        levelId: "rdc",
        stairGeometry: {
          flight1: { lowerA: { x: 0, y: 0 }, lowerB: { x: 1, y: 0 }, upperA: { x: 1, y: 0 }, upperB: { x: 1, y: 1 }, lowerLevelId: "rdc", upperLevelId: "r1" },
          flight2: { lowerA: { x: 1, y: 1 }, lowerB: { x: 2, y: 1 }, upperA: { x: 2, y: 1 }, upperB: { x: 2, y: 2 }, lowerLevelId: "r1", upperLevelId: "r2" },
          landingZ: 1.6,
        },
        floorConfig: { type: "Dalle pleine", thickness: "15 cm", characteristicPermanentLoad: "6.50", characteristicImposedLoad: "2.50" },
      },
      { id: "P1", type: "Poteau", section: "Pot_20x30", x: 0, y: 0, levelId: "rdc" },
      { id: "P2", type: "Poteau", section: "Pot_20x30", x: 2, y: 2, levelId: "r1" },
    ], { levelOrder: ["rdc", "r1", "r2"], gridDistance: 1 });
    expect(model.warnings.some(warning => warning.includes("sans poutre d’appui"))).toBe(false);
    expect(model.propagation.columns.P1.gk + model.propagation.columns.P2.gk).toBeGreaterThan(0);
    expect(model.rows.find(row => row.id === "ES1")?.gk).toBeGreaterThan(0);
  });
});

describe("appui à l’extrémité du palier", () => {
  it("reconnaît le poteau placé sur le coin de fin du palier d’arrivée", () => {
    const model = buildBuildingLoadModel([
      {
        id: "ES-PALIER",
        type: "Escaliers",
        section: "Escalier BA 15 cm",
        x: 0,
        y: 0,
        x2: 4,
        y2: 4,
        levelId: "rdc",
        stairGeometry: {
          flight1: { lowerA: { x: 0, y: 0 }, lowerB: { x: 1, y: 0 }, upperA: { x: 1, y: 1 }, upperB: { x: 2, y: 1 }, lowerLevelId: "rdc", upperLevelId: "r1" },
          flight2: { lowerA: { x: 2, y: 1 }, lowerB: { x: 2, y: 2 }, upperA: { x: 3, y: 2 }, upperB: { x: 3, y: 3 }, lowerLevelId: "r1", upperLevelId: "r2" },
          landingZ: 1.6,
        },
        floorConfig: { type: "Dalle pleine", thickness: "15 cm", characteristicPermanentLoad: "3.75", characteristicImposedLoad: "2.50" },
      },
      { id: "P-PALIER", type: "Poteau", section: "Pot_20x30", x: 3, y: 3, levelId: "r2" },
    ], { levelOrder: ["rdc", "r1", "r2"], gridDistance: 1 });
    expect(model.warnings.some(warning => warning.includes("sans poteau d’appui"))).toBe(false);
    expect(model.propagation.columns["P-PALIER"]?.gk).toBeGreaterThan(0);
  });
});
