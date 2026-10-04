import { describe, expect, it } from "vitest";
import { createDefaultLoadProgram, evaluateLoadProgram, normalizeLoadProgram, validateLoadProgram } from "@shared/load-case-program";

describe("priority 2 — load actions, cases, combinations and mass source", () => {
  it("defines one default nonzero self-weight multiplier", () => {
    const program = createDefaultLoadProgram();
    expect(program.patterns.filter(item=>item.selfWeightMultiplier>0).map(item=>item.id)).toEqual(["G"]);
    expect(program.cases.filter(item=>item.enabled).map(item=>item.id)).toEqual(["case:G", "case:Q"]);
    expect(program.combinations.filter(item=>item.enabled).map(item=>item.id)).toEqual(["comb:uls-gravity", "comb:sls-char", "comb:sls-frequent", "comb:sls-quasi"]);
    expect(validateLoadProgram(program).some(item=>item.severity==="error")).toBe(false);
  });

  it("selects the provisional Q catalogue value from the project usage", () => {
    expect(createDefaultLoadProgram(undefined, "habitation").patterns.find(item => item.id === "Q")?.value).toBe(2);
    expect(createDefaultLoadProgram(undefined, "bureau").patterns.find(item => item.id === "Q")?.value).toBe(2.5);
    expect(createDefaultLoadProgram(undefined, "commerce").patterns.find(item => item.id === "Q")?.value).toBe(5);
  });

  it("repairs imported programs with empty special actions", () => {
    const program = createDefaultLoadProgram();
    program.cases.forEach(item => { item.enabled = true; });
    program.combinations.forEach(item => { item.enabled = true; });
    const normalized = normalizeLoadProgram(program);
    expect(normalized.cases.filter(item=>item.enabled).map(item=>item.id)).toEqual(["case:G", "case:Q"]);
    expect(normalized.combinations.filter(item=>item.enabled).map(item=>item.id)).toEqual(["comb:uls-gravity", "comb:sls-char", "comb:sls-frequent", "comb:sls-quasi"]);
  });

  it("evaluates provisional ULS and service combinations from explicit G/Q cases", () => {
    const program = createDefaultLoadProgram();
    const result = evaluateLoadProgram(program,{G:100,Q:40});
    expect(result.caseValues["case:G"]).toBe(100);
    expect(result.caseValues["case:Q"]).toBe(40);
    expect(result.combinations.find(item=>item.id==="comb:uls-gravity")?.value).toBeCloseTo(195);
    expect(result.combinations.find(item=>item.id==="comb:sls-char")?.value).toBeCloseTo(140);
    expect(result.combinations.find(item=>item.id==="comb:sls-frequent")?.value).toBeCloseTo(120);
    expect(result.combinations.find(item=>item.id==="comb:sls-quasi")?.value).toBeCloseTo(112);
  });

  it("calculates the mass source with an explicit provisional variable-load fraction", () => {
    const result = evaluateLoadProgram(createDefaultLoadProgram(),{G:100,Q:40});
    expect(result.massEquivalentKN).toBeCloseTo(112);
    expect(result.massTonnes).toBeCloseTo(112/9.80665);
  });

  it("detects duplicate self-weight multipliers in one active combination", () => {
    const program = createDefaultLoadProgram();
    const addedPermanent=program.patterns.find(item=>item.id==="Gsup")!;
    addedPermanent.enabled=true;
    addedPermanent.selfWeightMultiplier=1;
    const diagnostics=validateLoadProgram(program);
    expect(diagnostics.filter(item=>item.code==="duplicate-self-weight").length).toBeGreaterThan(0);
  });

  it("detects broken action/case references and invalid mass coefficients", () => {
    const program = createDefaultLoadProgram();
    program.cases[0].patternFactors.missingPattern=1;
    program.combinations[0].caseFactors.missingCase=1;
    program.massSource.patternFactors.G=-1;
    const codes=validateLoadProgram(program).map(item=>item.code);
    expect(codes).toContain("missing-pattern-reference");
    expect(codes).toContain("missing-case-reference");
    expect(codes).toContain("invalid-mass-factor");
  });

  it("respects disabled patterns when calculating case and mass values", () => {
    const program=createDefaultLoadProgram();
    program.patterns.find(item=>item.id==="Q")!.enabled=false;
    const result=evaluateLoadProgram(program,{G:100,Q:40});
    expect(result.caseValues["case:Q"]).toBe(0);
    expect(result.combinations.find(item=>item.id==="comb:uls-gravity")?.value).toBeCloseTo(135);
    expect(result.massEquivalentKN).toBeCloseTo(100);
  });

  it("preserves manually-authored combinations through serialization", () => {
    const program=createDefaultLoadProgram();
    program.combinations.push({id:"manual:1",name:"Combinaison manuelle",category:"ULS",caseFactors:{"case:G":1.2,"case:Q":1.4},enabled:true,origin:"manual",status:"provisional",note:"Créée par l’utilisateur"});
    const restored=JSON.parse(JSON.stringify(program));
    expect(restored.combinations.find((item:any)=>item.id==="manual:1")).toMatchObject({origin:"manual",caseFactors:{"case:G":1.2,"case:Q":1.4}});
  });
});
