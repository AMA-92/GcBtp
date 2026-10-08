import { describe, expect, it } from "vitest";
import { createDefaultLoadProgram, evaluateLoadProgram, normalizeLoadProgram, validateLoadProgram } from "@shared/load-case-program";

describe("programme de charges — actions, cas, combinaisons et source de masse", () => {
  it("définit un seul multiplicateur de poids propre non nul et quatre combinaisons par défaut", () => {
    const program = createDefaultLoadProgram();
    expect(program.patterns.filter(item => item.selfWeightMultiplier > 0).map(item => item.id)).toEqual(["G"]);
    expect(program.cases.filter(item => item.enabled).map(item => item.id)).toEqual(["case:G", "case:Q"]);
    expect(program.combinations.filter(item => item.enabled).map(item => item.id)).toEqual(["comb:uls-gravity", "comb:sls-char", "comb:sls-frequent", "comb:sls-quasi"]);
    expect(validateLoadProgram(program).some(item => item.severity === "error")).toBe(false);
  });

  it("valide les combinaisons BAEL selon la base de coefficients du catalogue français retenue", () => {
    const program = createDefaultLoadProgram();
    expect(program.selectedStandard).toBe("BAEL 91 mod. 99");
    expect(program.combinations.filter(item => item.enabled).every(item => item.status === "ready")).toBe(true);
    expect(program.combinations.find(item => item.id === "comb:uls-gravity")?.reference).toContain("NF EN 1990/NA:2011");
    expect(program.combinations.find(item => item.id === "comb:uls-gravity")?.note).toContain("Base de calcul retenue et validée pour le projet");
    expect(program.patterns.find(item => item.id === "Q")?.status).toBe("calculated");
    expect(program.massSource.status).toBe("provisional");
  });

  it("garde les combinaisons Eurocode françaises distinguées et exige l’édition nationale applicable", () => {
    const program = createDefaultLoadProgram("Eurocode 2 — France");
    expect(program.combinations.filter(item => item.enabled).every(item => item.status === "catalogued")).toBe(true);
    expect(program.combinations.find(item => item.id === "comb:uls-gravity")?.reference).toContain("NF EN 1990/NA:2011");
    expect(program.combinations.find(item => item.id === "comb:uls-gravity")?.note).toContain("confirmer l’édition");
  });

  it("migre un ancien référentiel vers le profil français et recatalogue ses combinaisons automatiques", () => {
    const legacy = createDefaultLoadProgram("SANS 10100");
    legacy.combinations.filter(item => item.origin === "automatic").forEach(item => { item.status = "provisional"; });
    const normalized = normalizeLoadProgram(legacy, "SANS 10100");
    expect(normalized.selectedStandard).toBe("BAEL 91 mod. 99");
    expect(normalized.combinations.filter(item => item.enabled).every(item => item.status === "ready")).toBe(true);
  });

  it("lie les ψ et les intensités d’exploitation à la catégorie d’usage du projet", () => {
    const habitation = createDefaultLoadProgram(undefined, "habitation");
    const bureau = createDefaultLoadProgram(undefined, "bureau");
    const commerce = createDefaultLoadProgram(undefined, "commerce");
    expect(habitation.patterns.find(item => item.id === "Q")?.source).toContain("qk de référence 1,5 kN/m²");
    expect(habitation.combinations.find(item => item.id === "comb:sls-frequent")?.caseFactors["case:Q"]).toBe(0.5);
    expect(habitation.combinations.find(item => item.id === "comb:sls-quasi")?.caseFactors["case:Q"]).toBe(0.3);
    expect(bureau.projectUsage).toBe("bureau");
    expect(bureau.combinations.find(item => item.id === "comb:sls-frequent")?.caseFactors["case:Q"]).toBe(0.5);
    expect(commerce.combinations.find(item => item.id === "comb:sls-frequent")?.caseFactors["case:Q"]).toBe(0.7);
    expect(commerce.combinations.find(item => item.id === "comb:sls-quasi")?.caseFactors["case:Q"]).toBe(0.6);
    expect(commerce.combinations.find(item => item.id === "comb:uls-gravity")?.caseFactors["case:Q"]).toBe(1.5);
  });

  it("répare les programmes importés qui activent des actions spéciales sans données", () => {
    const program = createDefaultLoadProgram();
    program.cases.forEach(item => { item.enabled = true; });
    program.combinations.forEach(item => { item.enabled = true; });
    const normalized = normalizeLoadProgram(program);
    expect(normalized.cases.filter(item => item.enabled).map(item => item.id)).toEqual(["case:G", "case:Q"]);
    expect(normalized.combinations.filter(item => item.enabled).map(item => item.id)).toEqual(["comb:uls-gravity", "comb:sls-char", "comb:sls-frequent", "comb:sls-quasi"]);
  });

  it("évalue les combinaisons ULS et ELS depuis les facteurs du catalogue français", () => {
    const program = createDefaultLoadProgram();
    const result = evaluateLoadProgram(program, { G: 100, Q: 40 });
    expect(result.caseValues["case:G"]).toBe(100);
    expect(result.caseValues["case:Q"]).toBe(40);
    expect(result.combinations.find(item => item.id === "comb:uls-gravity")?.value).toBeCloseTo(195);
    expect(result.combinations.find(item => item.id === "comb:sls-char")?.value).toBeCloseTo(140);
    expect(result.combinations.find(item => item.id === "comb:sls-frequent")?.value).toBeCloseTo(120);
    expect(result.combinations.find(item => item.id === "comb:sls-quasi")?.value).toBeCloseTo(112);
    expect(result.combinations.find(item => item.id === "comb:uls-gravity")?.status).toBe("ready");
  });

  it("calcule la masse provisoire avec ψ2 issu de la catégorie d’usage", () => {
    const result = evaluateLoadProgram(createDefaultLoadProgram(), { G: 100, Q: 40 });
    expect(result.massEquivalentKN).toBeCloseTo(112);
    expect(result.massTonnes).toBeCloseTo(112 / 9.80665);
  });

  it("détecte plusieurs multiplicateurs de poids propre dans une combinaison active", () => {
    const program = createDefaultLoadProgram();
    const addedPermanent = program.patterns.find(item => item.id === "Gsup")!;
    addedPermanent.enabled = true;
    addedPermanent.selfWeightMultiplier = 1;
    const diagnostics = validateLoadProgram(program);
    expect(diagnostics.filter(item => item.code === "duplicate-self-weight").length).toBeGreaterThan(0);
  });

  it("détecte les références d’action/cas cassées et les coefficients de masse invalides", () => {
    const program = createDefaultLoadProgram();
    program.cases[0].patternFactors.missingPattern = 1;
    program.combinations[0].caseFactors.missingCase = 1;
    program.massSource.patternFactors.G = -1;
    const codes = validateLoadProgram(program).map(item => item.code);
    expect(codes).toContain("missing-pattern-reference");
    expect(codes).toContain("missing-case-reference");
    expect(codes).toContain("invalid-mass-factor");
  });

  it("respecte les patterns désactivés dans l’évaluation des cas et de la masse", () => {
    const program = createDefaultLoadProgram();
    program.patterns.find(item => item.id === "Q")!.enabled = false;
    const result = evaluateLoadProgram(program, { G: 100, Q: 40 });
    expect(result.caseValues["case:Q"]).toBe(0);
    expect(result.combinations.find(item => item.id === "comb:uls-gravity")?.value).toBeCloseTo(135);
    expect(result.massEquivalentKN).toBeCloseTo(100);
  });

  it("préserve les combinaisons manuelles et leur statut à vérifier", () => {
    const program = createDefaultLoadProgram();
    program.combinations.push({ id: "manual:1", name: "Combinaison manuelle", category: "ULS", caseFactors: { "case:G": 1.2, "case:Q": 1.4 }, enabled: true, origin: "manual", status: "provisional", note: "Créée par l’utilisateur" });
    const restored = normalizeLoadProgram(JSON.parse(JSON.stringify(program)));
    expect(restored.combinations.find(item => item.id === "manual:1")).toMatchObject({ origin: "manual", status: "provisional", caseFactors: { "case:G": 1.2, "case:Q": 1.4 } });
    expect(validateLoadProgram(restored).some(item => item.code === "non-catalogued-combinations")).toBe(true);
  });
});
