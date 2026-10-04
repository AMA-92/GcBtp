import { describe, expect, it } from "vitest";
import { buildAnalyticalModel, validateAnalyticalModel, type AnalyticalGraphicLevel } from "@shared/analytical-model";
import { MODEL_CATALOG } from "@shared/model-catalog";

const footing = (id: string, x: number) => ({ id, type: "Semelle", section: "S1", x, y: 0 });
const column = (id: string, x: number) => ({ id, type: "Poteau", section: "Pot_20x30", x, y: 0 });
const supportedPortal = (): AnalyticalGraphicLevel[] => [
  { id: "foundation", label: "Fondation", elevation: "-1.00", height: "1.00", elements: [footing("F1",0),footing("F2",1)] },
  { id: "rdc", label: "RDC", elevation: "0.00", height: "3.20", elements: [column("C1",0),column("C2",1),{id:"B1",type:"Poutre",section:"Poutre_20x40",x:0,y:0,x2:1,y2:0}] },
];
const input = (levels: AnalyticalGraphicLevel[]) => ({ levels, xDistancesM:[4,4,4], yDistancesM:[4,4,4], nodeMergeToleranceM:0.01, structure:"Béton armé", modelCatalog:MODEL_CATALOG });

describe("priority 1 — analytical model", () => {
  it("builds a versioned SI model and connects a beam between supported columns", () => {
    const { model, precheck } = buildAnalyticalModel(input(supportedPortal()));
    expect(model.schemaVersion).toBe(2);
    expect(model.units.length).toBe("m");
    expect(model.nodes.length).toBe(12);
    expect(model.frames).toHaveLength(3);
    expect(model.supports).toHaveLength(2);
    expect(precheck.ok).toBe(true);
    expect(precheck.errors).toEqual([]);
    expect(model.sections.find(section => section.name === "Pot_20x30")?.areaM2).toBeCloseTo(0.06);
  });

  it("preserves the configured node tolerance instead of forcing 0.25 m", () => {
    const { model } = buildAnalyticalModel(input(supportedPortal()));
    expect(model.nodeMergeToleranceM).toBeCloseTo(0.01);
  });

  it("reports an unsupported floating beam instead of treating it as a valid model", () => {
    const levels: AnalyticalGraphicLevel[] = [
      { id:"rdc", label:"RDC", elevation:"0", height:"3.2", elements:[{id:"B1",type:"Poutre",section:"Poutre_20x40",x:0,y:0,x2:1,y2:0}] },
    ];
    const { precheck } = buildAnalyticalModel(input(levels));
    expect(precheck.ok).toBe(false);
    expect(precheck.errors.map(item=>item.code)).toContain("beam-floating-end");
    expect(precheck.errors.map(item=>item.code)).toContain("unsupported-frame-component");
  });

  it("requires a real footing under each column before inferring a fixed support", () => {
    const levels = supportedPortal().map(level => ({ ...level, elements: level.elements.filter(element => element.type !== "Semelle") }));
    const { model, precheck } = buildAnalyticalModel(input(levels));
    expect(model.supports).toHaveLength(0);
    expect(precheck.ok).toBe(false);
    expect(precheck.errors.filter(item=>item.code === "column-without-footing")).toHaveLength(2);
  });

  it("merges coincident 3D member endpoints within the configured tolerance", () => {
    const { model } = buildAnalyticalModel(input(supportedPortal()));
    const beam = model.frames.find(frame=>frame.sourceElementId === "B1")!;
    const leftColumn = model.frames.find(frame=>frame.sourceElementId === "C1")!;
    const rightColumn = model.frames.find(frame=>frame.sourceElementId === "C2")!;
    expect(beam.startNodeId).toBe(leftColumn.endNodeId);
    expect(beam.endNodeId).toBe(rightColumn.endNodeId);
  });

  it("connecte une dalle au niveau des poutres sans erreur de composante flottante", () => {
    const levels = supportedPortal().map(level => level.id === "rdc"
      ? { ...level, elements: [...level.elements, { id: "PL1", type: "Dalle", section: "Pl_16+4", x: 0, y: 0, x2: 1, y2: 1 }] }
      : level);
    const { model, precheck } = buildAnalyticalModel(input(levels));
    const slab = model.surfaces.find(surface => surface.sourceElementId === "PL1")!;
    const beam = model.frames.find(frame => frame.sourceElementId === "B1")!;
    expect(precheck.ok).toBe(true);
    expect(precheck.errors).toEqual([]);
    expect(slab.nodeIds).toContain(beam.startNodeId);
    expect(slab.nodeIds).toContain(beam.endNodeId);
  });

  it("ne répète pas un sommet dans les surfaces de paliers d’escalier", () => {
    const levels: AnalyticalGraphicLevel[] = [
      { id: "foundation", label: "Fondation", elevation: "-1", height: "1", elements: [] },
      { id: "rdc", label: "RDC", elevation: "0", height: "3.2", elements: [{
        id: "ES1", type: "Escaliers", section: "Escalier BA 15 cm", x: 0, y: 0,
        stairGeometry: {
          flight1: { lowerA: { x: 0, y: 0 }, lowerB: { x: 1, y: 0 }, upperA: { x: 1, y: 1 }, upperB: { x: 2, y: 1 }, lowerLevelId: "rdc", upperLevelId: "r1" },
          flight2: { lowerA: { x: 2, y: 1 }, lowerB: { x: 2, y: 2 }, upperA: { x: 3, y: 2 }, upperB: { x: 3, y: 3 }, lowerLevelId: "r1", upperLevelId: "r2" },
        },
      }] },
      { id: "r1", label: "R+1", elevation: "3.2", height: "3.2", elements: [] },
      { id: "r2", label: "R+2", elevation: "6.4", height: "3.2", elements: [] },
    ];
    const { model } = buildAnalyticalModel(input(levels));
    expect(model.surfaces.filter(surface => surface.kind === "stair-flight").every(surface => new Set(surface.nodeIds).size === surface.nodeIds.length)).toBe(true);
  });

  it("validates references and refuses a model with missing frame nodes", () => {
    const { model } = buildAnalyticalModel(input(supportedPortal()));
    const broken = { ...model, frames: model.frames.map((frame,index)=>index===0 ? { ...frame, startNodeId:"missing-node" } : frame) };
    const precheck = validateAnalyticalModel(broken);
    expect(precheck.ok).toBe(false);
    expect(precheck.errors.map(item=>item.code)).toContain("frame-node-missing");
  });
});
