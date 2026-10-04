import { describe, expect, it } from "vitest";
import { buildAnalyticalModel } from "@shared/analytical-model";
import { buildBuildingLoadModel, summarizeBuildingLoads } from "@shared/building-load-propagation";
import { MODEL_CATALOG } from "@shared/model-catalog";
import { buildGravityMemberLoads, prepareAnalyticalPlane, solveAnalyticalPlane, solveLinearSystem, solvePlaneFrame, type PlaneFrameProblem } from "@shared/frame-solver-2d";
import { createDefaultLoadProgram } from "@shared/load-case-program";

const E=210_000_000;
const A=0.01;
const I=8e-6;
const cantilever:PlaneFrameProblem={
  plane:"XZ",
  nodes:[{id:"A",x:0,z:0},{id:"B",x:3,z:0}],
  elements:[{id:"AB",i:"A",j:"B",elasticModulusKnM2:E,areaM2:A,inertiaM4:I}],
  supports:[{nodeId:"A",restrained:[true,true,true]}],
  nodalLoads:[{nodeId:"B",fzKn:-10}],
};

describe("priority 3 — 2D linear static frame solver",()=>{
  it("matches closed-form cantilever tip displacement and base reaction",()=>{
    const result=solvePlaneFrame(cantilever);
    const tip=result.displacements.find(item=>item.nodeId==="B")!;
    const expected=-10*3**3/(3*E*I);
    expect(tip.uzM).toBeCloseTo(expected,8);
    expect(result.reactions.find(item=>item.nodeId==="A")?.fzKn).toBeCloseTo(10,8);
    expect(result.reactions.find(item=>item.nodeId==="A")?.momentKnM).toBeCloseTo(30,8);
    expect(result.warnings).toEqual([]);
  });

  it("balances reactions for a simply supported beam under uniform load",()=>{
    const problem:PlaneFrameProblem={
      plane:"XZ",nodes:[{id:"A",x:0,z:0},{id:"B",x:6,z:0}],
      elements:[{id:"AB",i:"A",j:"B",elasticModulusKnM2:30_000_000,areaM2:0.1,inertiaM4:0.001}],
      supports:[{nodeId:"A",restrained:[true,true,false]},{nodeId:"B",restrained:[false,true,false]}],
      memberLoads:[{elementId:"AB",qyKnM:-10}],
    };
    const result=solvePlaneFrame(problem);
    expect(result.reactions.find(item=>item.nodeId==="A")?.fzKn).toBeCloseTo(30,7);
    expect(result.reactions.find(item=>item.nodeId==="B")?.fzKn).toBeCloseTo(30,7);
    expect(result.equilibrium.appliedFzKn+result.equilibrium.reactionFzKn).toBeCloseTo(0,8);
    expect(result.equilibrium.appliedMomentKnM+result.equilibrium.reactionMomentKnM).toBeCloseTo(0,8);
  });

  it("solves partial-pivoting systems and detects a singular stiffness matrix",()=>{
    expect(solveLinearSystem([[0,2],[1,3]],[4,7])).toEqual([1,2]);
    expect(()=>solveLinearSystem([[1,1],[1,1]],[1,1])).toThrow(/singulière/);
  });

  it("rejects an unsupported rigid-body mechanism",()=>{
    expect(()=>solvePlaneFrame({...cantilever,supports:[]})).toThrow(/Aucun degré de liberté/);
  });

  it("applique les raideurs d’un appui élastique",()=>{
    const result=solvePlaneFrame({...cantilever,supports:[{nodeId:"A",restrained:[false,false,false],springs:[1e9,1e9,1e9]}]});
    expect(result.reactions.find(item=>item.nodeId==="A")?.fzKn).toBeCloseTo(10,5);
    expect(result.warnings).toEqual([]);
  });

  it("rejects a member referencing a missing node",()=>{
    expect(()=>solvePlaneFrame({...cantilever,elements:[{...cantilever.elements[0],j:"missing"}]})).toThrow(/nœud absent/);
  });

  it("prepares a single-plane portal while omitting non-structural footing mesh vertices",()=>{
    const levels=[
      {id:"foundation",label:"Fondation",elevation:"-1",height:"1",elements:[{id:"F1",type:"Semelle",section:"S1",x:0,y:0},{id:"F2",type:"Semelle",section:"S1",x:1,y:0}]},
      {id:"rdc",label:"RDC",elevation:"0",height:"3.2",elements:[{id:"C1",type:"Poteau",section:"Pot_20x30",x:0,y:0},{id:"C2",type:"Poteau",section:"Pot_20x30",x:1,y:0},{id:"B1",type:"Poutre",section:"Poutre_20x40",x:0,y:0,x2:1,y2:0}]},
    ];
    const {model}=buildAnalyticalModel({levels,xDistancesM:[4,4],yDistancesM:[4,4],structure:"Béton armé",modelCatalog:MODEL_CATALOG});
    const prepared=prepareAnalyticalPlane(model,"XZ");
    expect(prepared.errors).toEqual([]);
    expect(prepared.problem?.elements).toHaveLength(3);
    expect(prepared.problem?.nodes).toHaveLength(4);
    expect(prepared.warnings.join(" ")).toMatch(/provisoires/);
    const result=solveAnalyticalPlane(model,"XZ",[{nodeId:model.frames.find(frame=>frame.sourceElementId==="B1")!.endNodeId,fzKn:-2}]);
    expect(result.errors).toEqual([]);
    expect(result.result?.elements).toHaveLength(3);
  });

  it("extrait un portique depuis un modèle avec dalle et signale la surface hors solveur",()=>{
    const levels=[
      {id:"foundation",label:"Fondation",elevation:"-1",height:"1",elements:[{id:"F1",type:"Semelle",section:"S1",x:0,y:0},{id:"F2",type:"Semelle",section:"S1",x:1,y:0}]},
      {id:"rdc",label:"RDC",elevation:"0",height:"3.2",elements:[{id:"C1",type:"Poteau",section:"Pot_20x30",x:0,y:0},{id:"C2",type:"Poteau",section:"Pot_20x30",x:1,y:0},{id:"B1",type:"Poutre",section:"Poutre_20x40",x:0,y:0,x2:1,y2:0},{id:"D1",type:"Dalle",section:"Pl_E20",x:0,y:0,x2:1,y2:1}]},
    ];
    const {model}=buildAnalyticalModel({levels,xDistancesM:[4,4],yDistancesM:[4,4],structure:"Béton armé",modelCatalog:MODEL_CATALOG});
    const prepared=prepareAnalyticalPlane(model,"XZ");
    expect(prepared.errors).toEqual([]);
    expect(prepared.problem?.elements).toHaveLength(3);
    expect(prepared.warnings.some(message=>message.includes("surface(s)"))).toBe(true);
  });

  it("maps tributary beam loads and column self-weight into ELU member loads",()=>{
    const levels=[
      {id:"foundation",label:"Fondation",elevation:"-1",height:"1",elements:[{id:"F1",type:"Semelle",section:"S1",x:0,y:0},{id:"F2",type:"Semelle",section:"S1",x:1,y:0}]},
      {id:"rdc",label:"RDC",elevation:"0",height:"3.2",elements:[{id:"C1",type:"Poteau",section:"Pot_20x30",x:0,y:0},{id:"C2",type:"Poteau",section:"Pot_20x30",x:1,y:0},{id:"B1",type:"Poutre",section:"Poutre_20x40",x:0,y:0,x2:1,y2:0}]},
    ];
    const {model}=buildAnalyticalModel({levels,xDistancesM:[4,4],yDistancesM:[4,4],structure:"Béton armé",modelCatalog:MODEL_CATALOG});
    const loadModel=buildBuildingLoadModel(levels.flatMap(level=>level.elements.map(element=>({...element,levelId:level.id}))),{levelOrder:levels.map(level=>level.id),levelHeights:{foundation:1,rdc:3.2},gridDistance:4});
    const program=createDefaultLoadProgram();
    const combo=program.combinations.find(item=>item.id==="comb:uls-gravity")!;
    const prepared=buildGravityMemberLoads(model,loadModel,combo,program);
    expect(prepared.errors).toEqual([]);
    expect(prepared.memberLoads.find(item=>item.elementId==="F:B1")?.qyKnM).toBeCloseTo(-2.7);
    expect(prepared.memberLoads.filter(item=>item.elementId.startsWith("F:C")).every(item=>item.qxKnM===-2.025)).toBe(true);
    const solved=solveAnalyticalPlane(model,"XZ",[],prepared.memberLoads);
    const summary=summarizeBuildingLoads(loadModel);
    const expected=prepared.permanentFactor*summary.totalGk+prepared.variableFactor*summary.totalQk;
    expect(solved.result?.equilibrium.reactionFzKn).toBeGreaterThan(0);
    expect(Math.abs(solved.result!.equilibrium.reactionFzKn-expected)/expected*100).toBeLessThan(3);
  });
});
