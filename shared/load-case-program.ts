import { FRENCH_EUROCODE_DEFAULT_STANDARD, isBaelStandard, normalizeProjectStandard } from "./french-standard-profile";
import { FRENCH_EUROCODE_ACTION_CATALOG, formatFrenchCoefficient, getFrenchProjectUsageProfile, getFrenchPsiFactors, type FrenchProjectUsage, type FrenchPsiCategory } from "./french-load-catalog";

export const LOAD_PROGRAM_SCHEMA_VERSION = 1 as const;
export type LoadPatternCategory = "self-weight" | "permanent" | "variable" | "wind" | "snow" | "seismic" | "thermal" | "settlement" | "accidental";
export type LoadValueStatus = "user-input" | "calculated" | "catalogued" | "default-provisional" | "to-confirm";
export type LoadPattern = { id: string; name: string; category: LoadPatternCategory; unit: "kN" | "kN/m²"; value: number; source: string; status: LoadValueStatus; direction: "vertical" | "x" | "y" | "none"; selfWeightMultiplier: number; enabled: boolean; psiCategory?: FrenchPsiCategory };
export type AnalysisCase = { id: string; name: string; type: "linear-static" | "modal" | "spectral"; patternFactors: Record<string, number>; enabled: boolean; provenance: "automatic" | "manual"; status: "provisional" | "ready" };
export type LoadCombination = { id: string; name: string; category: "ULS" | "SLS-characteristic" | "SLS-frequent" | "SLS-quasi-permanent" | "wind" | "seismic" | "accidental"; caseFactors: Record<string, number>; enabled: boolean; origin: "automatic" | "manual"; status: "catalogued" | "provisional" | "ready"; note: string; formula?: string; reference?: string };
export type MassSource = { id: string; name: string; patternFactors: Record<string, number>; gravityMPerS2: number; status: "provisional" | "ready"; note: string; provenance?: "catalogue" | "manual" };
export type LoadProgram = { schemaVersion: typeof LOAD_PROGRAM_SCHEMA_VERSION; selectedStandard: string; projectUsage?: FrenchProjectUsage; patterns: LoadPattern[]; cases: AnalysisCase[]; combinations: LoadCombination[]; massSource: MassSource };
export type LoadProgramDiagnostic = { severity: "error" | "warning"; code: string; message: string; relatedIds: string[] };
export type EvaluatedCombination = { id: string; name: string; category: LoadCombination["category"]; value: number; factors: Record<string, number>; enabled: boolean; status: LoadCombination["status"] };

const ACTIONS: Array<Omit<LoadPattern, "enabled"> & { enabled?: boolean }> = [
  { id: "G", name: "Poids propre", category: "self-weight", unit: "kN", value: 0, source: "Géométrie et sections du modèle · calcul automatique", status: "calculated", direction: "vertical", selfWeightMultiplier: 1 },
  { id: "Gsup", name: "Charges permanentes ajoutées", category: "permanent", unit: "kN", value: 0, source: "À saisir par élément selon les matériaux et équipements du projet", status: "to-confirm", direction: "vertical", selfWeightMultiplier: 0 },
  { id: "Q", name: "Exploitation", category: "variable", unit: "kN", value: 0, source: "Résultante de la descente tributaire · intensité surfacique issue du catalogue NF par catégorie", status: "calculated", direction: "vertical", selfWeightMultiplier: 0 },
  { id: "partitions", name: "Cloisons et murs", category: "permanent", unit: "kN", value: 0, source: "À saisir ou calculer selon les parois réelles et leurs appuis", status: "to-confirm", direction: "vertical", selfWeightMultiplier: 0 },
  { id: "roof", name: "Toiture · catégorie H", category: "variable", unit: "kN", value: 0, source: "NF P 06-111-2/A1:2009, tableau 6.10 (NF) · pente et configuration de toiture à renseigner", status: "to-confirm", direction: "vertical", selfWeightMultiplier: 0, psiCategory: "H" },
  { id: "windX", name: "Vent X", category: "wind", unit: "kN", value: 0, source: "NF EN 1991-1-4/NA · site, terrain, hauteur et géométrie requis", status: "to-confirm", direction: "x", selfWeightMultiplier: 0, psiCategory: "wind" },
  { id: "windY", name: "Vent Y", category: "wind", unit: "kN", value: 0, source: "NF EN 1991-1-4/NA · site, terrain, hauteur et géométrie requis", status: "to-confirm", direction: "y", selfWeightMultiplier: 0, psiCategory: "wind" },
  { id: "snow", name: "Neige", category: "snow", unit: "kN", value: 0, source: "NF EN 1991-1-3/NA · zone, altitude et forme de toiture requis", status: "to-confirm", direction: "vertical", selfWeightMultiplier: 0, psiCategory: "snow-low-altitude" },
  { id: "seismicX", name: "Séisme X", category: "seismic", unit: "kN", value: 0, source: "NF EN 1998/NA · zonage, classe de sol, spectre et masses requis", status: "to-confirm", direction: "x", selfWeightMultiplier: 0 },
  { id: "seismicY", name: "Séisme Y", category: "seismic", unit: "kN", value: 0, source: "NF EN 1998/NA · zonage, classe de sol, spectre et masses requis", status: "to-confirm", direction: "y", selfWeightMultiplier: 0 },
  { id: "temperature", name: "Température", category: "thermal", unit: "kN", value: 0, source: "NF EN 1991-1-5/NA · situation et conditions d’exposition requises", status: "to-confirm", direction: "none", selfWeightMultiplier: 0, psiCategory: "temperature" },
  { id: "settlement", name: "Tassement imposé", category: "settlement", unit: "kN", value: 0, source: "Déplacement imposé déterminé par l’étude géotechnique", status: "to-confirm", direction: "none", selfWeightMultiplier: 0 },
  { id: "accidental", name: "Accidentel / incendie", category: "accidental", unit: "kN", value: 0, source: "NF EN 1991-1-2 ou scénario accidentel propre au projet", status: "to-confirm", direction: "none", selfWeightMultiplier: 0 },
];

const staticCase = (id: string, name: string, patternFactors: Record<string, number>, enabled = false): AnalysisCase => ({ id, name, type: "linear-static", patternFactors, enabled, provenance: "automatic", status: "ready" });
const combinationReference = `${FRENCH_EUROCODE_ACTION_CATALOG.combinationsReference} · ${FRENCH_EUROCODE_ACTION_CATALOG.imposedLoadsReference}`;
const combinationNote = (isBael: boolean, detail: string) => isBael
  ? `${detail} Actions et combinaisons issues des Eurocodes français; BAEL 91 mod. 99 reste l’option historique de calcul du béton.`
  : `${detail} Coefficients issus du catalogue français NF EN/NA; les données d’action du projet restent à renseigner.`;

function createCombinations(projectUsage: FrenchProjectUsage, isBael: boolean): LoadCombination[] {
  const activity = getFrenchProjectUsageProfile(projectUsage);
  const usagePsi = getFrenchPsiFactors(activity.psiCategory);
  const windPsi = getFrenchPsiFactors("wind");
  const snowPsi = getFrenchPsiFactors("snow-low-altitude");
  const roofPsi = getFrenchPsiFactors("H");
  const gammaG = FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.permanentUnfavourable;
  const gammaQ = FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.variableUnfavourable;
  const gammaSls = FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.service;
  const make = (id: string, name: string, category: LoadCombination["category"], caseFactors: Record<string, number>, enabled: boolean, formula: string, detail: string): LoadCombination => ({
    id, name, category, caseFactors, enabled, origin: "automatic", status: "catalogued", formula,
    reference: combinationReference,
    note: combinationNote(isBael, `${detail} Usage : catégorie ${activity.category} (${activity.label}); ψ0=${formatFrenchCoefficient(usagePsi.psi0)}, ψ1=${formatFrenchCoefficient(usagePsi.psi1)}, ψ2=${formatFrenchCoefficient(usagePsi.psi2)}.`),
  });
  const psi0Q = gammaQ * usagePsi.psi0;
  const psi1Q = usagePsi.psi1;
  const psi2Q = usagePsi.psi2;
  const psi0Snow = gammaQ * snowPsi.psi0;
  return [
    make("comb:uls-gravity", "ELU fondamental · Q dominante", "ULS", { "case:G": gammaG, "case:Q": gammaQ }, true,
      `${formatFrenchCoefficient(gammaG)}G + ${formatFrenchCoefficient(gammaQ)}Q`,
      `Expression ${FRENCH_EUROCODE_ACTION_CATALOG.equation} · γG défavorable=${formatFrenchCoefficient(gammaG)} et γQ=${formatFrenchCoefficient(gammaQ)}.`),
    make("comb:sls-char", "ELS caractéristique · Q dominante", "SLS-characteristic", { "case:G": gammaSls, "case:Q": gammaSls }, true,
      `G + Q`, "Expression caractéristique · coefficients partiels ELS égaux à 1,00."),
    make("comb:sls-frequent", "ELS fréquente · Q dominante", "SLS-frequent", { "case:G": gammaSls, "case:Q": psi1Q }, true,
      `G + ψ1Q = G + ${formatFrenchCoefficient(psi1Q)}Q`, "Expression fréquente · ψ1 sélectionné dans le tableau A1.1/NA selon la catégorie d’usage."),
    make("comb:sls-quasi", "ELS quasi-permanente", "SLS-quasi-permanent", { "case:G": gammaSls, "case:Q": psi2Q }, true,
      `G + ψ2Q = G + ${formatFrenchCoefficient(psi2Q)}Q`, "Expression quasi-permanente · ψ2 sélectionné dans le tableau A1.1/NA selon la catégorie d’usage."),
    make("comb:uls-roof", "ELU toiture · catégorie H dominante", "ULS", { "case:G": gammaG, "case:roof": gammaQ }, false,
      `${formatFrenchCoefficient(gammaG)}G + ${formatFrenchCoefficient(gammaQ)}QH`, `Expression ${FRENCH_EUROCODE_ACTION_CATALOG.equation} · action H, ψ0=${formatFrenchCoefficient(roofPsi.psi0)}.`),
    make("comb:els-char-roof", "ELS caractéristique · toiture H", "SLS-characteristic", { "case:G": gammaSls, "case:roof": gammaSls }, false,
      `G + QH`, "Expression caractéristique avec action de toiture H."),
    make("comb:uls-wind-x+", "ELU vent X +", "wind", { "case:G": gammaG, "case:Q": psi0Q, "case:windX+": gammaQ }, false,
      `${formatFrenchCoefficient(gammaG)}G + ${formatFrenchCoefficient(gammaQ)}W + ${formatFrenchCoefficient(psi0Q)}Q`, `Expression ${FRENCH_EUROCODE_ACTION_CATALOG.equation} · ψ0,Q selon ${activity.category}.`),
    make("comb:uls-wind-x-", "ELU vent X −", "wind", { "case:G": gammaG, "case:Q": psi0Q, "case:windX-": gammaQ }, false,
      `${formatFrenchCoefficient(gammaG)}G + ${formatFrenchCoefficient(gammaQ)}W + ${formatFrenchCoefficient(psi0Q)}Q`, `Expression ${FRENCH_EUROCODE_ACTION_CATALOG.equation} · ψ0,Q selon ${activity.category}.`),
    make("comb:uls-wind-y+", "ELU vent Y +", "wind", { "case:G": gammaG, "case:Q": psi0Q, "case:windY+": gammaQ }, false,
      `${formatFrenchCoefficient(gammaG)}G + ${formatFrenchCoefficient(gammaQ)}W + ${formatFrenchCoefficient(psi0Q)}Q`, `Expression ${FRENCH_EUROCODE_ACTION_CATALOG.equation} · ψ0,Q selon ${activity.category}.`),
    make("comb:uls-wind-y-", "ELU vent Y −", "wind", { "case:G": gammaG, "case:Q": psi0Q, "case:windY-": gammaQ }, false,
      `${formatFrenchCoefficient(gammaG)}G + ${formatFrenchCoefficient(gammaQ)}W + ${formatFrenchCoefficient(psi0Q)}Q`, `Expression ${FRENCH_EUROCODE_ACTION_CATALOG.equation} · ψ0,Q selon ${activity.category}.`),
    make("comb:uls-snow", "ELU neige", "ULS", { "case:G": gammaG, "case:Q": psi0Q, "case:snow": gammaQ }, false,
      `${formatFrenchCoefficient(gammaG)}G + ${formatFrenchCoefficient(gammaQ)}S + ${formatFrenchCoefficient(psi0Q)}Q`, `Expression ${FRENCH_EUROCODE_ACTION_CATALOG.equation} · ψ0,Q selon ${activity.category}; ψ0,S=${formatFrenchCoefficient(snowPsi.psi0)} (profil d’altitude ≤ 1 000 m).`),
    make("comb:seismic-x+", "Sismique X +", "seismic", { "case:G": FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.seismicPermanent, "case:Q": psi2Q, "case:seismicX+": FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.seismicAction }, false,
      `G + E + ψ2Q = G + E + ${formatFrenchCoefficient(psi2Q)}Q`, `Expression sismique · ψ2 selon la catégorie ${activity.category}.`),
    make("comb:seismic-x-", "Sismique X −", "seismic", { "case:G": FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.seismicPermanent, "case:Q": psi2Q, "case:seismicX-": FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.seismicAction }, false,
      `G − E + ψ2Q = G − E + ${formatFrenchCoefficient(psi2Q)}Q`, `Expression sismique · ψ2 selon la catégorie ${activity.category}.`),
    make("comb:seismic-y+", "Sismique Y +", "seismic", { "case:G": FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.seismicPermanent, "case:Q": psi2Q, "case:seismicY+": FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.seismicAction }, false,
      `G + E + ψ2Q = G + E + ${formatFrenchCoefficient(psi2Q)}Q`, `Expression sismique · ψ2 selon la catégorie ${activity.category}.`),
    make("comb:seismic-y-", "Sismique Y −", "seismic", { "case:G": FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.seismicPermanent, "case:Q": psi2Q, "case:seismicY-": FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.seismicAction }, false,
      `G − E + ψ2Q = G − E + ${formatFrenchCoefficient(psi2Q)}Q`, `Expression sismique · ψ2 selon la catégorie ${activity.category}.`),
    make("comb:accidental", "Accidentelle", "accidental", { "case:G": FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.accidentalPermanent, "case:Q": psi2Q, "case:accidental": 1 }, false,
      `G + A + ψ2Q = G + A + ${formatFrenchCoefficient(psi2Q)}Q`, `Expression accidentelle hors incendie · ψ2 selon la catégorie ${activity.category}.`),
  ];
}

export function createDefaultLoadProgram(selectedStandard: string = FRENCH_EUROCODE_DEFAULT_STANDARD, projectUsage: FrenchProjectUsage = "habitation"): LoadProgram {
  const normalizedStandard = normalizeProjectStandard(selectedStandard);
  const isBael = isBaelStandard(selectedStandard);
  const activity = getFrenchProjectUsageProfile(projectUsage);
  const patterns: LoadPattern[] = ACTIONS.map(pattern => ({
    ...pattern,
    enabled: pattern.enabled ?? (pattern.id === "G" || pattern.id === "Q"),
    ...(pattern.id === "Q" ? { name: `Exploitation · catégorie ${activity.category}`, source: `${activity.source} · qk de référence ${formatFrenchCoefficient(activity.load)} kN/m² · résultante totale issue des surfaces`, status: "calculated" as const, psiCategory: activity.psiCategory } : {}),
  }));
  const cases: AnalysisCase[] = [
    staticCase("case:G", "G — permanentes et poids propre", { G: 1, Gsup: 1, partitions: 1 }, true),
    staticCase("case:Q", `Q — exploitation · catégorie ${activity.category}`, { Q: 1 }, true),
    staticCase("case:roof", "Toiture H", { roof: 1 }),
    staticCase("case:windX+", "Vent X +", { windX: 1 }),
    staticCase("case:windX-", "Vent X −", { windX: -1 }),
    staticCase("case:windY+", "Vent Y +", { windY: 1 }),
    staticCase("case:windY-", "Vent Y −", { windY: -1 }),
    staticCase("case:snow", "Neige", { snow: 1 }),
    staticCase("case:seismicX+", "Séisme X +", { seismicX: 1 }),
    staticCase("case:seismicX-", "Séisme X −", { seismicX: -1 }),
    staticCase("case:seismicY+", "Séisme Y +", { seismicY: 1 }),
    staticCase("case:seismicY-", "Séisme Y −", { seismicY: -1 }),
    staticCase("case:temperature", "Température", { temperature: 1 }),
    staticCase("case:settlement", "Tassement", { settlement: 1 }),
    staticCase("case:accidental", "Accidentel", { accidental: 1 }),
  ];
  const psi2Q = getFrenchPsiFactors(activity.psiCategory).psi2;
  return {
    schemaVersion: LOAD_PROGRAM_SCHEMA_VERSION,
    selectedStandard: normalizedStandard,
    projectUsage,
    patterns,
    cases,
    combinations: createCombinations(projectUsage, isBael),
    massSource: {
      id: "mass:default",
      name: "Source de masse sismique · pré-étude",
      patternFactors: { G: 1, Gsup: 1, partitions: 1, roof: 0, Q: psi2Q, snow: 0 },
      gravityMPerS2: 9.80665,
      status: "provisional",
      provenance: "catalogue",
      note: `ψ2(Q)=${formatFrenchCoefficient(psi2Q)} issu de la catégorie ${activity.category}; la masse sismique EC8 exige ψE=φ·ψ2 par niveau et le traitement des actions climatiques.`,
    },
  };
}

export function normalizeLoadProgram(program: LoadProgram, projectStandard = program.selectedStandard, requestedUsage?: FrenchProjectUsage): LoadProgram {
  const isBael = isBaelStandard(projectStandard);
  const selectedStandard = normalizeProjectStandard(projectStandard);
  const projectUsage = requestedUsage ?? program.projectUsage ?? "habitation";
  const defaults = createDefaultLoadProgram(selectedStandard, projectUsage);
  const defaultPatternIds = new Set(defaults.patterns.map(pattern => pattern.id));
  const patterns: LoadPattern[] = defaults.patterns.map(defaultPattern => {
    const saved = program.patterns.find(pattern => pattern.id === defaultPattern.id);
    return {
      ...defaultPattern,
      ...(saved ?? {}),
      source: defaultPattern.source,
      status: defaultPattern.status,
      psiCategory: defaultPattern.psiCategory,
      ...(defaultPattern.id === "Q" ? { name: defaultPattern.name, value: 0, enabled: true } : {}),
    };
  });
  patterns.push(...program.patterns.filter(pattern => !defaultPatternIds.has(pattern.id)));
  const defaultCaseIds = new Set(defaults.cases.map(item => item.id));
  const cases: AnalysisCase[] = defaults.cases.map(defaultCase => {
    const saved = program.cases.find(item => item.id === defaultCase.id);
    const casePatterns = Object.keys(defaultCase.patternFactors).filter(patternId => defaultCase.patternFactors[patternId] !== 0);
    const enabledFromConfiguredAction = Boolean(saved?.enabled && casePatterns.some(patternId => patterns.find(pattern => pattern.id === patternId)?.enabled));
    return { ...defaultCase, ...(saved ?? {}), enabled: defaultCase.enabled || enabledFromConfiguredAction, status: "ready" as const };
  });
  cases.push(...program.cases.filter(item => !defaultCaseIds.has(item.id)));
  const defaultCombinationIds = new Set(defaults.combinations.map(item => item.id));
  const combinations: LoadCombination[] = defaults.combinations.map(defaultCombination => {
    const saved = program.combinations.find(item => item.id === defaultCombination.id);
    if (saved?.origin === "manual") return { ...defaultCombination, ...saved, caseFactors: saved.caseFactors, status: "provisional" as const };
    return { ...defaultCombination, ...(saved ? { enabled: saved.enabled } : {}), caseFactors: defaultCombination.caseFactors, status: "catalogued" as const, origin: "automatic" as const };
  });
  combinations.push(...program.combinations.filter(item => !defaultCombinationIds.has(item.id)));
  const enabledPatterns = new Set(patterns.filter(pattern => pattern.enabled).map(pattern => pattern.id));
  const caseMap = new Map(cases.map(item => [item.id, item]));
  const patternsById = new Map(patterns.map(pattern => [pattern.id, pattern]));
  const explicitCategories = new Set<LoadPatternCategory>(["wind", "snow", "seismic", "thermal", "settlement", "accidental"]);
  const normalizedCombinations = combinations.map(item => {
    const missingExplicitAction = Object.keys(item.caseFactors).some(caseId => {
      const analysisCase = caseMap.get(caseId);
      if (caseId !== "case:G" && caseId !== "case:Q" && item.caseFactors[caseId] !== 0 && analysisCase && !analysisCase.enabled) return true;
      return Object.keys(analysisCase?.patternFactors ?? {}).some(patternId => {
        const pattern = patternsById.get(patternId);
        return Boolean(pattern && patternId !== "Q" && (explicitCategories.has(pattern.category) || pattern.category === "variable") && !enabledPatterns.has(patternId));
      });
    });
    return { ...item, enabled: item.enabled && !missingExplicitAction };
  });
  const savedMassSource = program.massSource;
  const massSource = savedMassSource?.provenance === "manual"
    ? { ...defaults.massSource, ...savedMassSource, status: "provisional" as const }
    : defaults.massSource;
  return { ...defaults, ...program, selectedStandard, projectUsage, patterns, cases, combinations: normalizedCombinations, massSource };
}

export function validateLoadProgram(program: LoadProgram): LoadProgramDiagnostic[] {
  const diagnostics: LoadProgramDiagnostic[] = [];
  const patternIds = new Set(program.patterns.map(pattern => pattern.id));
  const caseIds = new Set(program.cases.map(item => item.id));
  for (const pattern of program.patterns) {
    if (!Number.isFinite(pattern.value) || pattern.value < 0) diagnostics.push({ severity: "error", code: "invalid-pattern-value", message: `La valeur de l’action ${pattern.name} doit être finie et positive ou nulle.`, relatedIds: [pattern.id] });
    if (!Number.isFinite(pattern.selfWeightMultiplier) || pattern.selfWeightMultiplier < 0) diagnostics.push({ severity: "error", code: "invalid-self-weight-factor", message: `Le multiplicateur de poids propre de ${pattern.name} est invalide.`, relatedIds: [pattern.id] });
  }
  for (const analysisCase of program.cases) for (const patternId of Object.keys(analysisCase.patternFactors)) if (!patternIds.has(patternId)) diagnostics.push({ severity: "error", code: "missing-pattern-reference", message: `Le cas ${analysisCase.name} référence l’action absente ${patternId}.`, relatedIds: [analysisCase.id, patternId] });
  for (const combination of program.combinations) {
    for (const caseId of Object.keys(combination.caseFactors)) if (!caseIds.has(caseId)) diagnostics.push({ severity: "error", code: "missing-case-reference", message: `La combinaison ${combination.name} référence le cas absent ${caseId}.`, relatedIds: [combination.id, caseId] });
    const activePatternIds = new Set<string>();
    for (const [caseId, coefficient] of Object.entries(combination.caseFactors)) {
      if (!Number.isFinite(coefficient)) diagnostics.push({ severity: "error", code: "invalid-combination-factor", message: `Coefficient non fini dans ${combination.name}.`, relatedIds: [combination.id, caseId] });
      const analysisCase = program.cases.find(item => item.id === caseId);
      if (!combination.enabled || !analysisCase?.enabled || coefficient === 0) continue;
      for (const [patternId, caseFactor] of Object.entries(analysisCase.patternFactors)) if (caseFactor !== 0 && patternIds.has(patternId) && program.patterns.find(pattern => pattern.id === patternId)?.enabled) activePatternIds.add(patternId);
    }
    const countedSelfWeight = Array.from(activePatternIds).filter(id => (program.patterns.find(pattern => pattern.id === id)?.selfWeightMultiplier ?? 0) > 0);
    if (countedSelfWeight.length > 1) diagnostics.push({ severity: "error", code: "duplicate-self-weight", message: `${combination.name} inclut plusieurs patterns avec un poids propre non nul : ${countedSelfWeight.join(", ")}.`, relatedIds: [combination.id, ...countedSelfWeight] });
  }
  for (const [patternId, factor] of Object.entries(program.massSource.patternFactors)) {
    if (!patternIds.has(patternId)) diagnostics.push({ severity: "error", code: "missing-mass-pattern", message: `La source de masse référence l’action absente ${patternId}.`, relatedIds: [program.massSource.id, patternId] });
    if (!Number.isFinite(factor) || factor < 0) diagnostics.push({ severity: "error", code: "invalid-mass-factor", message: `Coefficient de masse invalide pour ${patternId}.`, relatedIds: [program.massSource.id, patternId] });
  }
  if (!Number.isFinite(program.massSource.gravityMPerS2) || program.massSource.gravityMPerS2 <= 0) diagnostics.push({ severity: "error", code: "invalid-gravity", message: "L’accélération de la pesanteur de la source de masse doit être strictement positive.", relatedIds: [program.massSource.id] });
  if (program.patterns.some(pattern => pattern.status === "to-confirm" && pattern.enabled && pattern.value !== 0)) diagnostics.push({ severity: "warning", code: "provisional-action", message: "Une action active possède une valeur non confirmée ; le rapport réglementaire doit rester bloqué.", relatedIds: program.patterns.filter(pattern => pattern.status === "to-confirm" && pattern.enabled && pattern.value !== 0).map(pattern => pattern.id) });
  const nonCatalogued = program.combinations.filter(item => item.enabled && item.status === "provisional");
  if (nonCatalogued.length) diagnostics.push({ severity: "warning", code: "non-catalogued-combinations", message: `Une ou plusieurs combinaisons actives ont été modifiées ou ne proviennent pas du catalogue NF EN/NA; leurs coefficients doivent être vérifiés avant usage réglementaire.`, relatedIds: nonCatalogued.map(item => item.id) });
  return diagnostics;
}

export function evaluateLoadProgram(program: LoadProgram, patternValues: Record<string, number>) {
  const patternMap = new Map(program.patterns.map(pattern => [pattern.id, pattern]));
  const cases: Record<string, number> = {};
  for (const analysisCase of program.cases) {
    if (!analysisCase.enabled) { cases[analysisCase.id] = 0; continue; }
    cases[analysisCase.id] = Object.entries(analysisCase.patternFactors).reduce((sum, [patternId, factor]) => {
      const pattern = patternMap.get(patternId);
      return sum + (pattern?.enabled ? (patternValues[patternId] ?? pattern.value) * factor : 0);
    }, 0);
  }
  const combinations: EvaluatedCombination[] = program.combinations.map(item => ({
    id: item.id, name: item.name, category: item.category, enabled: item.enabled, status: item.status,
    factors: item.caseFactors,
    value: item.enabled ? Object.entries(item.caseFactors).reduce((sum, [caseId, factor]) => sum + (cases[caseId] ?? 0) * factor, 0) : 0,
  }));
  const enabled = combinations.filter(item => item.enabled);
  const governing = enabled.slice().sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0] ?? null;
  const massKips = Object.entries(program.massSource.patternFactors).reduce((sum, [patternId, factor]) => sum + (patternMap.get(patternId)?.enabled ? (patternValues[patternId] ?? patternMap.get(patternId)?.value ?? 0) * factor : 0), 0);
  return { caseValues: cases, combinations, governing, massEquivalentKN: massKips, massTonnes: massKips / program.massSource.gravityMPerS2 };
}
