export const LOAD_PROGRAM_SCHEMA_VERSION = 1 as const;
export type LoadPatternCategory = "self-weight" | "permanent" | "variable" | "wind" | "snow" | "seismic" | "thermal" | "settlement" | "accidental";
export type LoadValueStatus = "user-input" | "calculated" | "default-provisional" | "to-confirm";
export type LoadPattern = { id: string; name: string; category: LoadPatternCategory; unit: "kN"; value: number; source: string; status: LoadValueStatus; direction: "vertical" | "x" | "y" | "none"; selfWeightMultiplier: number; enabled: boolean };
export type AnalysisCase = { id: string; name: string; type: "linear-static" | "modal" | "spectral"; patternFactors: Record<string, number>; enabled: boolean; provenance: "automatic" | "manual"; status: "provisional" | "ready" };
export type LoadCombination = { id: string; name: string; category: "ULS" | "SLS-characteristic" | "SLS-frequent" | "SLS-quasi-permanent" | "wind" | "seismic" | "accidental"; caseFactors: Record<string, number>; enabled: boolean; origin: "automatic" | "manual"; status: "provisional" | "ready"; note: string; formula?: string; reference?: string };
export type MassSource = { id: string; name: string; patternFactors: Record<string, number>; gravityMPerS2: number; status: "provisional" | "ready"; note: string };
export type LoadProgram = { schemaVersion: typeof LOAD_PROGRAM_SCHEMA_VERSION; selectedStandard: string; patterns: LoadPattern[]; cases: AnalysisCase[]; combinations: LoadCombination[]; massSource: MassSource };
export type LoadProgramDiagnostic = { severity: "error" | "warning"; code: string; message: string; relatedIds: string[] };
export type EvaluatedCombination = { id: string; name: string; category: LoadCombination["category"]; value: number; factors: Record<string, number>; enabled: boolean; status: LoadCombination["status"] };

const ACTIONS: Array<Omit<LoadPattern,"value"|"enabled"> & { value?: number; enabled?: boolean }> = [
  { id:"G", name:"Poids propre", category:"self-weight", unit:"kN", value:0, source:"Géométrie/sections — calcul à confirmer", status:"calculated", direction:"vertical", selfWeightMultiplier:1 },
  { id:"Gsup", name:"Charges permanentes ajoutées", category:"permanent", unit:"kN", value:0, source:"À saisir et associer à des éléments", status:"to-confirm", direction:"vertical", selfWeightMultiplier:0 },
  { id:"Q", name:"Exploitation", category:"variable", unit:"kN", value:0, source:"À saisir selon l’usage des locaux", status:"to-confirm", direction:"vertical", selfWeightMultiplier:0 },
  { id:"partitions", name:"Cloisons et murs", category:"permanent", unit:"kN", value:0, source:"À saisir et associer à des éléments", status:"to-confirm", direction:"vertical", selfWeightMultiplier:0 },
  { id:"roof", name:"Toiture", category:"variable", unit:"kN", value:0, source:"À confirmer selon le complexe et l’usage", status:"to-confirm", direction:"vertical", selfWeightMultiplier:0 },
  { id:"windX", name:"Vent X", category:"wind", unit:"kN", value:0, source:"Paramètres locaux requis", status:"to-confirm", direction:"x", selfWeightMultiplier:0 },
  { id:"windY", name:"Vent Y", category:"wind", unit:"kN", value:0, source:"Paramètres locaux requis", status:"to-confirm", direction:"y", selfWeightMultiplier:0 },
  { id:"snow", name:"Neige", category:"snow", unit:"kN", value:0, source:"Zone et altitude à confirmer", status:"to-confirm", direction:"vertical", selfWeightMultiplier:0 },
  { id:"seismicX", name:"Séisme X", category:"seismic", unit:"kN", value:0, source:"Zone, spectre et masse à confirmer", status:"to-confirm", direction:"x", selfWeightMultiplier:0 },
  { id:"seismicY", name:"Séisme Y", category:"seismic", unit:"kN", value:0, source:"Zone, spectre et masse à confirmer", status:"to-confirm", direction:"y", selfWeightMultiplier:0 },
  { id:"temperature", name:"Température", category:"thermal", unit:"kN", value:0, source:"Cas thermique non encore analysé", status:"to-confirm", direction:"none", selfWeightMultiplier:0 },
  { id:"settlement", name:"Tassement imposé", category:"settlement", unit:"kN", value:0, source:"Déplacement imposé à définir", status:"to-confirm", direction:"none", selfWeightMultiplier:0 },
  { id:"accidental", name:"Accidentel / incendie", category:"accidental", unit:"kN", value:0, source:"Scénario à définir selon le projet", status:"to-confirm", direction:"none", selfWeightMultiplier:0 },
];

const staticCase = (id: string, name: string, patternFactors: Record<string, number>, enabled = false): AnalysisCase => ({ id, name, type:"linear-static", patternFactors, enabled, provenance:"automatic", status:"provisional" });

export function createDefaultLoadProgram(selectedStandard = "EN 1990 + EN 1991 + EN 1998 — annexe nationale / prescriptions locales à confirmer"): LoadProgram {
  const patterns = ACTIONS.map(pattern=>({ ...pattern, value:pattern.value ?? 0, enabled:pattern.id === "G" || pattern.id === "Q" }));
  const cases: AnalysisCase[] = [
    staticCase("case:G","G — permanentes et poids propre",{G:1,Gsup:1,partitions:1}, true),
    staticCase("case:Q","Q — exploitation",{Q:1}, true),
    staticCase("case:roof","Toiture",{roof:1}),
    staticCase("case:windX+","Vent X +",{windX:1}),
    staticCase("case:windX-","Vent X −",{windX:-1}),
    staticCase("case:windY+","Vent Y +",{windY:1}),
    staticCase("case:windY-","Vent Y −",{windY:-1}),
    staticCase("case:snow","Neige",{snow:1}),
    staticCase("case:seismicX+","Séisme X +",{seismicX:1}),
    staticCase("case:seismicX-","Séisme X −",{seismicX:-1}),
    staticCase("case:seismicY+","Séisme Y +",{seismicY:1}),
    staticCase("case:seismicY-","Séisme Y −",{seismicY:-1}),
    staticCase("case:temperature","Température",{temperature:1}),
    staticCase("case:settlement","Tassement",{settlement:1}),
    staticCase("case:accidental","Accidentel",{accidental:1}),
  ];
  const combination = (id:string,name:string,category:LoadCombination["category"],caseFactors:Record<string,number>, enabled = false, formula = "Combinaison à confirmer selon l’annexe nationale"):LoadCombination => ({ id,name,category,caseFactors,enabled,origin:"automatic",status:"provisional",formula,reference:"EN 1990 · EN 1991 · EN 1998 · annexe nationale / prescriptions locales à confirmer",note:"Coefficient ou ψ provisoire : confirmer la catégorie d’usage, la situation de projet et l’annexe nationale applicable." });
  const combinations: LoadCombination[] = [
    combination("comb:uls-gravity","ELU gravitaire","ULS",{"case:G":1.35,"case:Q":1.5,"case:roof":1.5}, true, "1,35G + 1,50Q"),
    combination("comb:sls-char","ELS caractéristique","SLS-characteristic",{"case:G":1,"case:Q":1,"case:roof":1}, true, "G + Q"),
    combination("comb:sls-frequent","ELS fréquente","SLS-frequent",{"case:G":1,"case:Q":0.5,"case:roof":0.5}, true, "G + ψ1Q — ψ1 provisoire 0,50"),
    combination("comb:sls-quasi","ELS quasi-permanente","SLS-quasi-permanent",{"case:G":1,"case:Q":0.3,"case:roof":0.3}, true, "G + ψ2Q — ψ2 provisoire 0,30"),
    combination("comb:uls-wind-x+","ELU vent X +","wind",{"case:G":1.35,"case:Q":1.05,"case:windX+":1.5}, false, "1,35G + 1,50W + 1,50ψ0Q — ψ0 provisoire 0,70"),
    combination("comb:uls-wind-x-","ELU vent X −","wind",{"case:G":1.35,"case:Q":1.05,"case:windX-":1.5}, false, "1,35G + 1,50W + 1,50ψ0Q — ψ0 provisoire 0,70"),
    combination("comb:uls-wind-y+","ELU vent Y +","wind",{"case:G":1.35,"case:Q":1.05,"case:windY+":1.5}, false, "1,35G + 1,50W + 1,50ψ0Q — ψ0 provisoire 0,70"),
    combination("comb:uls-wind-y-","ELU vent Y −","wind",{"case:G":1.35,"case:Q":1.05,"case:windY-":1.5}, false, "1,35G + 1,50W + 1,50ψ0Q — ψ0 provisoire 0,70"),
    combination("comb:uls-snow","ELU neige","ULS",{"case:G":1.35,"case:Q":1.05,"case:snow":1.5}, false, "1,35G + 1,50S + 1,50ψ0Q — ψ0 provisoire 0,70"),
    combination("comb:seismic-x+","Sismique X +","seismic",{"case:G":1,"case:Q":0.3,"case:seismicX+":1}, false, "G + ψ2Q + E — ψ2 provisoire 0,30"),
    combination("comb:seismic-x-","Sismique X −","seismic",{"case:G":1,"case:Q":0.3,"case:seismicX-":1}, false, "G + ψ2Q − E — ψ2 provisoire 0,30"),
    combination("comb:seismic-y+","Sismique Y +","seismic",{"case:G":1,"case:Q":0.3,"case:seismicY+":1}, false, "G + ψ2Q + E — ψ2 provisoire 0,30"),
    combination("comb:seismic-y-","Sismique Y −","seismic",{"case:G":1,"case:Q":0.3,"case:seismicY-":1}, false, "G + ψ2Q − E — ψ2 provisoire 0,30"),
    combination("comb:accidental","Accidentelle","accidental",{"case:G":1,"case:Q":0.3,"case:accidental":1}, false, "G + ψ2Q + A — scénario à définir"),
  ];
  return {
    schemaVersion:LOAD_PROGRAM_SCHEMA_VERSION,
    selectedStandard,
    patterns,
    cases,
    combinations,
    massSource:{ id:"mass:default",name:"Source de masse préliminaire",patternFactors:{G:1,Gsup:1,partitions:1,roof:1,Q:0.3},gravityMPerS2:9.80665,status:"provisional",note:"Fraction de Q provisoire ; la masse effective doit suivre la norme et l’usage retenus." },
  };
}

export function normalizeLoadProgram(program: LoadProgram): LoadProgram {
  const enabledPatterns = new Set(program.patterns.filter(pattern => pattern.enabled).map(pattern => pattern.id));
  const cases = program.cases.map(item => {
    const isGravity = item.id === "case:G" || item.id === "case:Q";
    const hasEnabledPattern = Object.keys(item.patternFactors).some(patternId => enabledPatterns.has(patternId));
    return { ...item, enabled: item.enabled && (isGravity || hasEnabledPattern) };
  });
  const caseMap = new Map(cases.map(item => [item.id, item]));
  const patternsById = new Map(program.patterns.map(pattern => [pattern.id, pattern]));
  const explicitCategories = new Set<LoadPatternCategory>(["wind", "snow", "seismic", "thermal", "settlement", "accidental"]);
  const combinations = program.combinations.map(item => {
    const missingExplicitAction = Object.keys(item.caseFactors).some(caseId => {
      const analysisCase = caseMap.get(caseId);
      return Object.keys(analysisCase?.patternFactors ?? {}).some(patternId => {
        const pattern = patternsById.get(patternId);
        return Boolean(pattern && explicitCategories.has(pattern.category) && !enabledPatterns.has(patternId));
      });
    });
    return { ...item, enabled: item.enabled && !missingExplicitAction };
  });
  return { ...program, cases, combinations };
}

export function validateLoadProgram(program: LoadProgram): LoadProgramDiagnostic[] {
  const diagnostics: LoadProgramDiagnostic[] = [];
  const patternIds = new Set(program.patterns.map(pattern=>pattern.id));
  const caseIds = new Set(program.cases.map(item=>item.id));
  for (const pattern of program.patterns) {
    if (!Number.isFinite(pattern.value) || pattern.value < 0) diagnostics.push({severity:"error",code:"invalid-pattern-value",message:`La valeur de l’action ${pattern.name} doit être finie et positive ou nulle.`,relatedIds:[pattern.id]});
    if (!Number.isFinite(pattern.selfWeightMultiplier) || pattern.selfWeightMultiplier < 0) diagnostics.push({severity:"error",code:"invalid-self-weight-factor",message:`Le multiplicateur de poids propre de ${pattern.name} est invalide.`,relatedIds:[pattern.id]});
  }
  for (const analysisCase of program.cases) for (const patternId of Object.keys(analysisCase.patternFactors)) if (!patternIds.has(patternId)) diagnostics.push({severity:"error",code:"missing-pattern-reference",message:`Le cas ${analysisCase.name} référence l’action absente ${patternId}.`,relatedIds:[analysisCase.id,patternId]});
  for (const combination of program.combinations) {
    for (const caseId of Object.keys(combination.caseFactors)) if (!caseIds.has(caseId)) diagnostics.push({severity:"error",code:"missing-case-reference",message:`La combinaison ${combination.name} référence le cas absent ${caseId}.`,relatedIds:[combination.id,caseId]});
    const activePatternIds = new Set<string>();
    for (const [caseId,coefficient] of Object.entries(combination.caseFactors)) {
      if (!Number.isFinite(coefficient)) diagnostics.push({severity:"error",code:"invalid-combination-factor",message:`Coefficient non fini dans ${combination.name}.`,relatedIds:[combination.id,caseId]});
      const analysisCase = program.cases.find(item=>item.id===caseId);
      if (!combination.enabled || !analysisCase?.enabled || coefficient === 0) continue;
      for (const [patternId,caseFactor] of Object.entries(analysisCase.patternFactors)) if (caseFactor !== 0 && patternIds.has(patternId) && program.patterns.find(pattern=>pattern.id===patternId)?.enabled) activePatternIds.add(patternId);
    }
    const countedSelfWeight = Array.from(activePatternIds).filter(id=>(program.patterns.find(pattern=>pattern.id===id)?.selfWeightMultiplier ?? 0)>0);
    if (countedSelfWeight.length > 1) diagnostics.push({severity:"error",code:"duplicate-self-weight",message:`${combination.name} inclut plusieurs patterns avec un poids propre non nul : ${countedSelfWeight.join(", ")}.`,relatedIds:[combination.id,...countedSelfWeight]});
  }
  for (const [patternId,factor] of Object.entries(program.massSource.patternFactors)) {
    if (!patternIds.has(patternId)) diagnostics.push({severity:"error",code:"missing-mass-pattern",message:`La source de masse référence l’action absente ${patternId}.`,relatedIds:[program.massSource.id,patternId]});
    if (!Number.isFinite(factor) || factor < 0) diagnostics.push({severity:"error",code:"invalid-mass-factor",message:`Coefficient de masse invalide pour ${patternId}.`,relatedIds:[program.massSource.id,patternId]});
  }
  if (!Number.isFinite(program.massSource.gravityMPerS2) || program.massSource.gravityMPerS2 <= 0) diagnostics.push({severity:"error",code:"invalid-gravity",message:"L’accélération de la pesanteur de la source de masse doit être strictement positive.",relatedIds:[program.massSource.id]});
  if (program.patterns.some(pattern=>pattern.status==="to-confirm" && pattern.enabled && pattern.value!==0)) diagnostics.push({severity:"warning",code:"provisional-action",message:"Une action active possède une valeur non confirmée ; le rapport réglementaire doit rester bloqué.",relatedIds:program.patterns.filter(pattern=>pattern.status==="to-confirm" && pattern.enabled && pattern.value!==0).map(pattern=>pattern.id)});
  if (program.combinations.some(item=>item.enabled && item.status==="provisional")) diagnostics.push({severity:"warning",code:"provisional-combinations",message:"Les combinaisons actives utilisent des coefficients génériques provisoires ; confirmer la norme et l’annexe nationale.",relatedIds:program.combinations.filter(item=>item.enabled && item.status==="provisional").map(item=>item.id)});
  return diagnostics;
}

export function evaluateLoadProgram(program: LoadProgram, patternValues: Record<string,number>) {
  const patternMap = new Map(program.patterns.map(pattern=>[pattern.id,pattern]));
  const cases: Record<string,number> = {};
  for (const analysisCase of program.cases) {
    if (!analysisCase.enabled) { cases[analysisCase.id]=0; continue; }
    cases[analysisCase.id] = Object.entries(analysisCase.patternFactors).reduce((sum,[patternId,factor])=>{
      const pattern=patternMap.get(patternId);
      return sum + (pattern?.enabled ? (patternValues[patternId] ?? pattern.value) * factor : 0);
    },0);
  }
  const combinations: EvaluatedCombination[] = program.combinations.map(item=>({
    id:item.id,name:item.name,category:item.category,enabled:item.enabled,status:item.status,
    factors:item.caseFactors,
    value:item.enabled ? Object.entries(item.caseFactors).reduce((sum,[caseId,factor])=>sum+(cases[caseId] ?? 0)*factor,0) : 0,
  }));
  const enabled = combinations.filter(item=>item.enabled);
  const governing = enabled.slice().sort((a,b)=>Math.abs(b.value)-Math.abs(a.value))[0] ?? null;
  const massKips = Object.entries(program.massSource.patternFactors).reduce((sum,[patternId,factor])=>sum + (patternMap.get(patternId)?.enabled ? (patternValues[patternId] ?? patternMap.get(patternId)?.value ?? 0) * factor : 0),0);
  return { caseValues:cases, combinations, governing, massEquivalentKN:massKips, massTonnes:massKips/program.massSource.gravityMPerS2 };
}
