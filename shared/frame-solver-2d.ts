import type { AnalyticalModel } from "./analytical-model";
import type { BuildingLoadModel } from "./building-load-propagation";
import type { LoadCombination, LoadProgram } from "./load-case-program";

export type FramePlane = "XZ" | "YZ";
export type PlaneNode = { id: string; x: number; z: number };
export type PlaneFrameElement = { id: string; i: string; j: string; elasticModulusKnM2: number; areaM2: number; inertiaM4: number };
export type PlaneSupport = { nodeId: string; restrained: [boolean,boolean,boolean]; springs?: [number,number,number] };
export type PlaneNodalLoad = { nodeId: string; fxKn?: number; fzKn?: number; momentKnM?: number };
/** Uniform load components are expressed in the element's local x/y frame, in kN/m. */
export type PlaneMemberLoad = { elementId: string; qxKnM?: number; qyKnM?: number };
export type PlaneFrameProblem = { plane: FramePlane; nodes: PlaneNode[]; elements: PlaneFrameElement[]; supports: PlaneSupport[]; nodalLoads?: PlaneNodalLoad[]; memberLoads?: PlaneMemberLoad[]; pivotTolerance?: number };
export type PlaneElementResult = { elementId: string; lengthM: number; localEndForces: { axialIKn:number; shearIKn:number; momentIKnM:number; axialJKn:number; shearJKn:number; momentJKnM:number } };
export type PlaneFrameResult = { plane: FramePlane; displacements: Array<{ nodeId:string; uxM:number; uzM:number; rotationRad:number }>; reactions: Array<{ nodeId:string; fxKn:number; fzKn:number; momentKnM:number }>; elements: PlaneElementResult[]; equilibrium: { appliedFxKn:number; appliedFzKn:number; appliedMomentKnM:number; reactionFxKn:number; reactionFzKn:number; reactionMomentKnM:number }; warnings: string[] };
export type PlanePreparation = { problem: PlaneFrameProblem | null; errors: string[]; warnings: string[] };
export type GravityLoadPreparation = { memberLoads: PlaneMemberLoad[]; permanentFactor: number; variableFactor: number; errors: string[]; warnings: string[] };

const zeros = (rows:number,cols=rows) => Array.from({length:rows},()=>Array(cols).fill(0) as number[]);
const finite = (value:number|undefined) => Number.isFinite(value) ? value! : 0;
const dot = (a:number[],b:number[]) => a.reduce((sum,value,index)=>sum+value*b[index],0);
const transpose = (matrix:number[][]) => matrix[0].map((_,column)=>matrix.map(row=>row[column]));
const multiply = (a:number[][],b:number[][]) => a.map(row=>b[0].map((_,column)=>row.reduce((sum,value,index)=>sum+value*b[index][column],0)));
const matVec = (matrix:number[][],vector:number[]) => matrix.map(row=>dot(row,vector));
const addBlock = (target:number[][],block:number[][],indices:number[]) => block.forEach((row,i)=>row.forEach((value,j)=>{target[indices[i]][indices[j]]+=value;}));
const addVector = (target:number[],source:number[],indices:number[]) => source.forEach((value,index)=>{target[indices[index]]+=value;});

function localStiffness(E:number,A:number,I:number,L:number) {
  const matrix=zeros(6);
  const axial=E*A/L, b=12*E*I/(L**3), c=6*E*I/(L**2), d=4*E*I/L, e=2*E*I/L;
  const values=[
    [axial,0,0,-axial,0,0],
    [0,b,c,0,-b,c],
    [0,c,d,0,-c,e],
    [-axial,0,0,axial,0,0],
    [0,-b,-c,0,b,-c],
    [0,c,e,0,-c,d],
  ];
  return values.map(row=>row.slice());
}

function transform(c:number,s:number) {
  return [
    [c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],
    [0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1],
  ];
}

/** Partial-pivoting dense Gauss elimination; singular/free mechanisms are explicit errors. */
export function solveLinearSystem(matrix:number[][], rhs:number[], pivotTolerance=1e-12): number[] {
  const n=rhs.length;
  if (matrix.length!==n || matrix.some(row=>row.length!==n)) throw new Error("Matrice de rigidité non carrée.");
  const a=matrix.map((row,index)=>[...row,rhs[index]]);
  const scale=Math.max(1,...matrix.flat().map(value=>Math.abs(value)));
  for (let column=0;column<n;column++) {
    let pivot=column;
    for (let row=column+1;row<n;row++) if (Math.abs(a[row][column])>Math.abs(a[pivot][column])) pivot=row;
    if (Math.abs(a[pivot][column])<=pivotTolerance*scale) throw new Error(`Matrice singulière au degré de liberté ${column} (mécanisme ou appui insuffisant).`);
    [a[column],a[pivot]]=[a[pivot],a[column]];
    const diagonal=a[column][column];
    for (let j=column;j<=n;j++) a[column][j]/=diagonal;
    for (let row=0;row<n;row++) {
      if (row===column) continue;
      const factor=a[row][column];
      if (factor===0) continue;
      for (let j=column;j<=n;j++) a[row][j]-=factor*a[column][j];
    }
  }
  return a.map(row=>row[n]);
}

function consistentUniformLoad(qx:number,qy:number,L:number) {
  return [qx*L/2,qy*L/2,qy*L*L/12,qx*L/2,qy*L/2,-qy*L*L/12];
}

export function solvePlaneFrame(problem: PlaneFrameProblem): PlaneFrameResult {
  if (!problem.nodes.length) throw new Error("Le modèle plan ne contient aucun nœud.");
  if (!problem.elements.length) throw new Error("Le modèle plan ne contient aucune barre.");
  const nodeIndex=new Map(problem.nodes.map((node,index)=>[node.id,index]));
  if (nodeIndex.size!==problem.nodes.length) throw new Error("Identifiants de nœud dupliqués.");
  const nDof=problem.nodes.length*3;
  const K=zeros(nDof), F=Array(nDof).fill(0) as number[];
  const elementData:Array<{element:PlaneFrameElement;indices:number[];L:number;c:number;s:number;kLocal:number[][];T:number[][];fLocal:number[];dLocal:number[];globalK:number[][];globalLoad:number[]}> = [];
  const memberLoadMap=new Map<string,PlaneMemberLoad[]>();
  for (const load of problem.memberLoads ?? []) memberLoadMap.set(load.elementId,[...(memberLoadMap.get(load.elementId)??[]),load]);
  for (const element of problem.elements) {
    const i=nodeIndex.get(element.i),j=nodeIndex.get(element.j);
    if (i===undefined || j===undefined) throw new Error(`La barre ${element.id} référence un nœud absent.`);
    if (![element.elasticModulusKnM2,element.areaM2,element.inertiaM4].every(value=>Number.isFinite(value)&&value>0)) throw new Error(`Propriétés E/A/I invalides pour la barre ${element.id}.`);
    const a=problem.nodes[i],b=problem.nodes[j],dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz);
    if (L<=1e-12) throw new Error(`La barre ${element.id} a une longueur nulle.`);
    const c=dx/L,s=dz/L,T=transform(c,s),kLocal=localStiffness(element.elasticModulusKnM2,element.areaM2,element.inertiaM4,L);
    const globalK=multiply(transpose(T),multiply(kLocal,T));
    const localLoads=memberLoadMap.get(element.id)??[];
    const fLocal=localLoads.reduce((sum,load)=>sum.map((value,index)=>value+consistentUniformLoad(finite(load.qxKnM),finite(load.qyKnM),L)[index]),Array(6).fill(0) as number[]);
    const globalLoad=matVec(transpose(T),fLocal);
    const indices=[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2];
    addBlock(K,globalK,indices);
    addVector(F,globalLoad,indices);
    elementData.push({element,indices,L,c,s,kLocal,T,fLocal,dLocal:[],globalK,globalLoad});
  }
  for (const load of problem.nodalLoads??[]) {
    const index=nodeIndex.get(load.nodeId);
    if (index===undefined) throw new Error(`La charge nodale référence le nœud absent ${load.nodeId}.`);
    F[3*index]+=finite(load.fxKn);
    F[3*index+1]+=finite(load.fzKn);
    F[3*index+2]+=finite(load.momentKnM);
  }
  const restrained=new Set<number>();
  for (const support of problem.supports) {
    const index=nodeIndex.get(support.nodeId);
    if (index===undefined) throw new Error(`L’appui référence le nœud absent ${support.nodeId}.`);
    support.restrained.forEach((isFixed,dof)=>{if(isFixed)restrained.add(3*index+dof);});
    (support.springs ?? [0,0,0]).forEach((stiffness,dof)=>{
      if (Number.isFinite(stiffness) && stiffness > 0) K[3*index+dof][3*index+dof] += stiffness;
    });
  }
  const hasSpringSupport = problem.supports.some(support => (support.springs ?? []).some(stiffness => Number.isFinite(stiffness) && stiffness > 0));
  if (restrained.size===0 && !hasSpringSupport) throw new Error("Aucun degré de liberté n’est retenu ; le modèle est instable.");
  const free=Array.from({length:nDof},(_,index)=>index).filter(index=>!restrained.has(index));
  const Kff=free.map(row=>free.map(column=>K[row][column]));
  const Ff=free.map(index=>F[index]);
  const uf=solveLinearSystem(Kff,Ff,problem.pivotTolerance??1e-12);
  const displacement=Array(nDof).fill(0) as number[];
  free.forEach((index,position)=>{displacement[index]=uf[position];});
  const reactions=matVec(K,displacement).map((value,index)=>value-F[index]);
  const displacementByNode=problem.nodes.map((node,index)=>({nodeId:node.id,uxM:displacement[3*index],uzM:displacement[3*index+1],rotationRad:displacement[3*index+2]}));
  const supportByNode = new Map(problem.supports.map(support => [support.nodeId, support]));
  const reactionByNode=problem.nodes.map((node,index)=>{ const support = supportByNode.get(node.id); const springs = support?.springs ?? [0,0,0]; return { nodeId: node.id, fxKn: restrained.has(3*index) ? reactions[3*index] : springs[0] > 0 ? -springs[0] * displacement[3*index] : 0, fzKn: restrained.has(3*index+1) ? reactions[3*index+1] : springs[1] > 0 ? -springs[1] * displacement[3*index+1] : 0, momentKnM: restrained.has(3*index+2) ? reactions[3*index+2] : springs[2] > 0 ? -springs[2] * displacement[3*index+2] : 0 }; }).filter(item=>Math.abs(item.fxKn)+Math.abs(item.fzKn)+Math.abs(item.momentKnM)>1e-10);
  const elementResults:PlaneElementResult[] = elementData.map(data=>{
    const dGlobal=data.indices.map(index=>displacement[index]);
    const dLocal=matVec(data.T,dGlobal);
    const endForces=matVec(data.kLocal,dLocal).map((value,index)=>value-data.fLocal[index]);
    return {elementId:data.element.id,lengthM:data.L,localEndForces:{axialIKn:endForces[0],shearIKn:endForces[1],momentIKnM:endForces[2],axialJKn:endForces[3],shearJKn:endForces[4],momentJKnM:endForces[5]}};
  });
  const nodalApplied=problem.nodalLoads??[];
  const memberGlobalTotals=elementData.reduce((sum,data)=>({
    fx:sum.fx+data.globalLoad[0]+data.globalLoad[3],
    fz:sum.fz+data.globalLoad[1]+data.globalLoad[4],
    moment:sum.moment+data.globalLoad[2]+data.globalLoad[5]+problem.nodes[nodeIndex.get(data.element.i)!].x*data.globalLoad[1]-problem.nodes[nodeIndex.get(data.element.i)!].z*data.globalLoad[0]+problem.nodes[nodeIndex.get(data.element.j)!].x*data.globalLoad[4]-problem.nodes[nodeIndex.get(data.element.j)!].z*data.globalLoad[3],
  }),{fx:0,fz:0,moment:0});
  const appliedFxKn=nodalApplied.reduce((sum,item)=>sum+finite(item.fxKn),0)+memberGlobalTotals.fx;
  const appliedFzKn=nodalApplied.reduce((sum,item)=>sum+finite(item.fzKn),0)+memberGlobalTotals.fz;
  const appliedMomentKnM=nodalApplied.reduce((sum,item)=>{
    const node=problem.nodes[nodeIndex.get(item.nodeId)!];
    return sum+finite(item.momentKnM)+node.x*finite(item.fzKn)-node.z*finite(item.fxKn);
  },memberGlobalTotals.moment);
  const reactionFxKn=reactionByNode.reduce((sum,item)=>sum+item.fxKn,0);
  const reactionFzKn=reactionByNode.reduce((sum,item)=>sum+item.fzKn,0);
  const reactionMomentKnM=reactionByNode.reduce((sum,item)=>{
    const node=problem.nodes[nodeIndex.get(item.nodeId)!];
    return sum+item.momentKnM+node.x*item.fzKn-node.z*item.fxKn;
  },0);
  const warnings:string[]=[];
  const forceResidual=Math.hypot(appliedFxKn+reactionFxKn,appliedFzKn+reactionFzKn);
  const momentResidual=Math.abs(appliedMomentKnM+reactionMomentKnM);
  const loadScale=Math.max(1,Math.hypot(appliedFxKn,appliedFzKn),Math.abs(appliedMomentKnM));
  if (forceResidual>1e-7*loadScale || momentResidual>1e-7*loadScale) warnings.push(`Équilibre global à contrôler : résidu forces ${forceResidual.toExponential(2)} kN, moment ${momentResidual.toExponential(2)} kN·m.`);
  return {plane:problem.plane,displacements:displacementByNode,reactions:reactionByNode,elements:elementResults,equilibrium:{appliedFxKn,appliedFzKn,appliedMomentKnM,reactionFxKn,reactionFzKn,reactionMomentKnM},warnings};
}

/** Extrait un portique coplanaire depuis le modèle 3D ; les surfaces restent hors de ce solveur v1. */
export function prepareAnalyticalPlane(model:AnalyticalModel,plane:FramePlane,nodalLoads:PlaneNodalLoad[]=[],memberLoads:PlaneMemberLoad[]=[]):PlanePreparation {
  const errors:string[]=[],warnings:string[]=[];
  if (!model.frames.length) errors.push("Aucune barre exploitable par le solveur plan.");
  const tolerance=Math.max(model.nodeMergeToleranceM,1e-6);
  const transverse=(node:{x:number;y:number})=>plane==="XZ"?node.y:node.x;
  const planeCoordinate = (nodeId:string) => {
    const node=model.nodes.find(item=>item.id===nodeId);
    return node ? transverse(node) : null;
  };
  const candidates=Array.from(new Set(model.frames.flatMap(frame=>[planeCoordinate(frame.startNodeId),planeCoordinate(frame.endNodeId)]).filter((value):value is number=>value!==null)));
  const countAt=(coordinate:number) => model.frames.filter(frame=>{
    const start=planeCoordinate(frame.startNodeId),end=planeCoordinate(frame.endNodeId);
    return start!==null && end!==null && Math.abs(start-coordinate)<=tolerance && Math.abs(end-coordinate)<=tolerance;
  }).length;
  const selectedCoordinate=candidates.sort((a,b)=>countAt(b)-countAt(a))[0];
  const selectedFrames=selectedCoordinate===undefined ? [] : model.frames.filter(frame=>{
    const start=planeCoordinate(frame.startNodeId),end=planeCoordinate(frame.endNodeId);
    return start!==null && end!==null && Math.abs(start-selectedCoordinate)<=tolerance && Math.abs(end-selectedCoordinate)<=tolerance;
  });
  if (!selectedFrames.length) errors.push(`Aucune barre coplanaire exploitable dans le plan ${plane}.`);
  else if (candidates.length>1) warnings.push(`Le modèle 3D contient plusieurs travées ; le portique ${plane} retenu est celui qui comporte le plus de barres, à la coordonnée hors plan ${selectedCoordinate.toFixed(3)} m.`);
  const selectedFrameNodeIds=new Set(selectedFrames.flatMap(frame=>[frame.startNodeId,frame.endNodeId]));
  const selectedSupportNodeIds=new Set(model.supports.map(support=>support.nodeId).filter(nodeId=>selectedFrameNodeIds.has(nodeId)));
  const usedNodeIds=new Set<string>([
    ...Array.from(selectedFrameNodeIds),
    ...Array.from(selectedSupportNodeIds),
    ...nodalLoads.map(load=>load.nodeId).filter(nodeId=>selectedFrameNodeIds.has(nodeId)),
  ]);
  const unsupportedSurfaces=model.surfaces.filter(surface=>surface.kind!=="footing");
  if (unsupportedSurfaces.length) warnings.push(`${unsupportedSurfaces.length} surface(s) hors portique ne sont pas incluses dans le solveur 2D ; leurs charges restent traitées par la descente tributaire.`);
  const nodeMap=new Map<string,PlaneNode>();
  model.nodes.filter(node=>usedNodeIds.has(node.id)).forEach(node=>nodeMap.set(node.id,{id:node.id,x:plane==="XZ"?node.x:node.y,z:node.z}));
  const elements:PlaneFrameElement[]=[];
  for (const frame of selectedFrames) {
    const section=model.sections.find(item=>item.id===frame.sectionId);
    const material=model.materials.find(item=>item.id===frame.materialId);
    if (!section?.areaM2 || !section.inertiaY4M4 || !section.inertiaZ4M4) { errors.push(`Section ${frame.sectionId} sans aire/inertie résolue (${frame.sourceElementId}).`); continue; }
    if (!material?.elasticModulusKnM2 || material.elasticModulusKnM2<=0) { errors.push(`Module d’élasticité non défini pour ${frame.sourceElementId}.`); continue; }
    elements.push({id:frame.id,i:frame.startNodeId,j:frame.endNodeId,elasticModulusKnM2:material.elasticModulusKnM2,areaM2:section.areaM2,inertiaM4:plane==="XZ"?section.inertiaY4M4:section.inertiaZ4M4});
  }
  const supports:PlaneSupport[]=model.supports.filter(support=>selectedSupportNodeIds.has(support.nodeId)).map(support=>({nodeId:support.nodeId,restrained:[support.restrainedDofs.includes("ux"),support.restrainedDofs.includes("uz"),support.restrainedDofs.includes("ry")],springs:[support.stiffness?.ux ?? 0,support.stiffness?.uz ?? 0,support.stiffness?.ry ?? 0] }));
  if (model.materials.some(item=>item.provenance==="provisional-default")) warnings.push("Les propriétés de matériau proviennent de valeurs génériques provisoires ; confirmer les matériaux réels.");
  if (model.sections.some(item=>item.provenance==="unresolved")) warnings.push("Au moins une section analytique est non résolue ; renseigner ses propriétés avant interprétation.");
  if (errors.length) return {problem:null,errors,warnings};
  return {problem:{plane,nodes:Array.from(nodeMap.values()),elements,supports,nodalLoads,memberLoads},errors,warnings};
}

export function solveAnalyticalPlane(model:AnalyticalModel,plane:FramePlane,nodalLoads:PlaneNodalLoad[]=[],memberLoads:PlaneMemberLoad[]=[]) {
  const prepared=prepareAnalyticalPlane(model,plane,nodalLoads,memberLoads);
  if (!prepared.problem) return {result:null,errors:prepared.errors,warnings:prepared.warnings};
  try {
    return {result:solvePlaneFrame(prepared.problem),errors:[],warnings:prepared.warnings};
  } catch (error) {
    return {result:null,errors:[error instanceof Error?error.message:String(error)],warnings:prepared.warnings};
  }
}

/** Distribute existing tributary G/Q beam totals as uniform member loads and member self-weight as axial load. */
export function buildGravityMemberLoads(model:AnalyticalModel,loadModel:BuildingLoadModel,combination:LoadCombination,program:LoadProgram):GravityLoadPreparation {
  const errors:string[]=[],warnings:string[]=[];
  if (!combination.enabled) errors.push(`La combinaison ${combination.name} est désactivée.`);
  const unsupportedCases=Object.entries(combination.caseFactors).filter(([caseId,factor])=>{
    if (factor===0 || caseId==="case:G" || caseId==="case:Q") return false;
    const analysisCase=program.cases.find(item=>item.id===caseId);
    if (!analysisCase) return true;
    return analysisCase.enabled && Object.entries(analysisCase.patternFactors).some(([patternId,caseFactor])=>caseFactor!==0 && program.patterns.some(pattern=>pattern.id===patternId && pattern.enabled && pattern.value!==0));
  });
  if (unsupportedCases.length) errors.push(`Le solveur 2D de cette phase ne prend en charge que G et Q ; cas actif non réparti : ${unsupportedCases.map(([id])=>id).join(", ")}.`);
  const permanentCase=program.cases.find(item=>item.id==="case:G");
  const variableCase=program.cases.find(item=>item.id==="case:Q");
  const permanentEnabled=Boolean(permanentCase?.enabled && program.patterns.find(item=>item.id==="G")?.enabled);
  const variableEnabled=Boolean(variableCase?.enabled && program.patterns.find(item=>item.id==="Q")?.enabled);
  const permanentFactor=permanentEnabled ? (combination.caseFactors["case:G"]??0) : 0;
  const variableFactor=variableEnabled ? (combination.caseFactors["case:Q"]??0) : 0;
  if (!permanentCase || !variableCase) errors.push("Les cas de base G/Q sont absents du programme de charges.");
  for (const pattern of program.patterns) {
    if (pattern.enabled && pattern.value>0 && !["G","Q"].includes(pattern.id)) warnings.push(`L’action ${pattern.name} (${pattern.value.toFixed(2)} kN) n’est pas affectée spatialement et n’est pas appliquée au solveur 2D.`);
  }
  const nodeMap=new Map(model.nodes.map(node=>[node.id,node]));
  const materialById=new Map(model.materials.map(item=>[item.id,item]));
  const sectionById=new Map(model.sections.map(item=>[item.id,item]));
  const memberLoads:PlaneMemberLoad[]=[];
  for (const frame of model.frames) {
    const start=nodeMap.get(frame.startNodeId),end=nodeMap.get(frame.endNodeId);
    const length=start&&end?Math.hypot(end.x-start.x,end.y-start.y,end.z-start.z):0;
    if (length<=1e-12) continue;
    if (["Poutre","Longrine de redressement"].includes(frame.sourceType)) {
      const load=loadModel.propagation.beams[frame.sourceElementId];
      if (!load) continue;
      const total=permanentFactor*load.gk+variableFactor*load.qk;
      if (Math.abs(total)>0) memberLoads.push({elementId:frame.id,qyKnM:-total/length});
    } else if (frame.sourceType==="Poteau") {
      const section=sectionById.get(frame.sectionId),material=materialById.get(frame.materialId);
      if (!section?.areaM2 || !material?.densityKnM3) { errors.push(`Poids propre non déterminable pour le poteau ${frame.sourceElementId}.`); continue; }
      if (permanentFactor!==0) memberLoads.push({elementId:frame.id,qxKnM:-permanentFactor*section.areaM2*material.densityKnM3});
    }
  }
  if (!memberLoads.length) warnings.push("Aucune charge G/Q n’a été distribuée à une barre ; vérifier les charges tributaires et l’association des éléments.");
  return {memberLoads,permanentFactor,variableFactor,errors,warnings};
}
