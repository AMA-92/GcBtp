import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { designReinforcedConcrete, proposeOptimizedRCSections, validateRCDesignBasis, type RCDesignBasis, type RCDesignOverrides, type RCElementDesign, type RCDesignResult, type RCMemberDemand, type RCSlabDemand, type RCFootingDemand, type RCStairDemand, type RebarOverride, type RCOptimizationProposal } from "@shared/rc-design";
import { designWall, type WallDemand } from "@shared/wall-design";
import { downloadReinforcementA4Pdf, downloadReinforcementGroupA4Pdf } from "@shared/local-pdf";
import { groupReinforcementElements, loadReinforcementTemplate } from "@shared/reinforcement-report";
import { CONCRETE_MATERIAL_CATALOG } from "@shared/model-catalog";
import { resolveRCStandardProfile, sameRCStandardFamily } from "@shared/rc-standard-profile";

type Draft = {
  standard: string;
  nationalAnnex: string;
  sourceReference: string;
  basisConfirmed: boolean;
  fckMpa: string;
  fykMpa: string;
  gammaC: string;
  gammaS: string;
  alphaCC: string;
  coverMm: string;
  minReinforcementPercent: string;
  maxReinforcementPercent: string;
  concreteShearStressLimitMpa: string;
  bondStressMpa: string;
  minClearSpacingMm: string;
  maxLinkSpacingMm: string;
  maxDeflectionRatio: string;
  maxColumnSlenderness: string;
  availableBarDiametersMm: string;
};

const createDraft = (standard: string, projectConcreteFckMpa?: number, projectRebarFykMpa?: number): Draft => {
  const normalizedStandard = standard || "Eurocode 2";
  const standardProfile = resolveRCStandardProfile(normalizedStandard);
  const isBael = standardProfile.family === "bael-91-99";
  const isEurocode = standardProfile.family === "eurocode-2";
  const concrete = Object.values(CONCRETE_MATERIAL_CATALOG).find(item => item.fck === projectConcreteFckMpa) ?? CONCRETE_MATERIAL_CATALOG["C25/30"];
  return {
  standard: normalizedStandard,
  nationalAnnex: isBael
    ? "BAEL 91 mod. 99 · règles locales et prescriptions du projet à confirmer"
    : isEurocode
      ? "France · NF EN 1990/1991/1992/1997/1998 · annexes nationales, éditions à confirmer"
      : `${normalizedStandard} · édition et règles d’application à confirmer`,
  sourceReference: isBael
    ? `Catalogue GcBtp · ${concrete.concreteClass} · BAEL 91 mod. 99 · paramètres du projet à vérifier`
    : isEurocode
      ? `Dossier projet France · ${concrete.concreteClass} · NF EN 1990/1991/1992/1997/1998 · annexes nationales et éditions à confirmer`
      : `Catalogue GcBtp · ${concrete.concreteClass} · référentiel sélectionné : ${normalizedStandard}`,
  basisConfirmed: false,
  fckMpa: String(projectConcreteFckMpa ?? concrete.fck),
  fykMpa: String(projectRebarFykMpa ?? 500),
  // Valeurs de pré-étude issues du profil Eurocode/BAEL ; elles restent à confirmer.
  gammaC: "1.50",
  gammaS: "1.15",
  alphaCC: String(standardProfile.suggestedAlphaCC ?? 0.85),
  coverMm: String(concrete.cover),
  minReinforcementPercent: "0.13",
  maxReinforcementPercent: "4.00",
  concreteShearStressLimitMpa: "0.55",
  bondStressMpa: "2.25",
  minClearSpacingMm: "20",
  maxLinkSpacingMm: "300",
  maxDeflectionRatio: "250",
  maxColumnSlenderness: "15",
  availableBarDiametersMm: "8, 10, 12, 16, 20, 25",
  };
};

const numeric = (value: string) => value.trim() ? Number(value.trim().replace(",", ".")) : Number.NaN;
const statusStyle = (status: string) => status === "satisfaisant" ? "text-emerald-800 bg-emerald-50" : status === "non satisfaisant" ? "text-red-800 bg-red-50" : status === "bloqué" ? "text-slate-700 bg-slate-100" : "text-amber-800 bg-amber-50";

type Props = {
  projectId: string;
  projectNorm: string;
  projectConcreteFckMpa?: number;
  projectRebarFykMpa?: number;
  members: RCMemberDemand[];
  slabs: RCSlabDemand[];
  foundations?: RCFootingDemand[];
  stairs?: RCStairDemand[];
  walls?: WallDemand[];
  sourceWarnings: string[];
  onResultChange: (result: RCDesignResult | null) => void;
  onApplySection?: (elementId: string, type: string, sectionName: string, dimensions: string) => void;
  optimizedElementIds?: Set<string>;
};

export default function ReinforcedConcretePanel({ projectId, projectNorm, projectConcreteFckMpa, projectRebarFykMpa, members, slabs, foundations = [], stairs = [], walls = [], sourceWarnings, onResultChange, onApplySection, optimizedElementIds = new Set() }: Props) {
  const [draft, setDraft] = useState<Draft>(() => createDraft(projectNorm, projectConcreteFckMpa, projectRebarFykMpa));
  const [overrides, setOverrides] = useState<RCDesignOverrides>({});
  const [result, setResult] = useState<RCDesignResult | null>(null);
  const [optimizationProposals, setOptimizationProposals] = useState<RCOptimizationProposal[]>([]);
  const [templateCompany, setTemplateCompany] = useState("");
  const [dirty, setDirty] = useState(false);
  const sourceSignature = useMemo(() => JSON.stringify({ members, slabs, foundations, stairs, walls, sourceWarnings }), [members, slabs, foundations, stairs, walls, sourceWarnings]);

  useEffect(() => {
    setResult(null);
    setDirty(false);
    setTemplateCompany(loadReinforcementTemplate().companyName);
    onResultChange(null);
    const base = createDraft(projectNorm, projectConcreteFckMpa, projectRebarFykMpa);
    try {
      const saved = sessionStorage.getItem(`gcbtp-rc-design:${projectId}`);
      const parsed = saved ? JSON.parse(saved) as { draft?: Partial<Draft>; overrides?: RCDesignOverrides } : {};
      const savedDraft = parsed.draft ?? {};
      const merged: Draft = { ...base, ...savedDraft, standard: base.standard };
      if (savedDraft.standard && !sameRCStandardFamily(savedDraft.standard, base.standard)) {
        (['nationalAnnex', 'sourceReference', 'basisConfirmed', 'gammaC', 'gammaS', 'alphaCC', 'coverMm', 'minReinforcementPercent', 'maxReinforcementPercent', 'concreteShearStressLimitMpa', 'bondStressMpa', 'minClearSpacingMm', 'maxLinkSpacingMm', 'maxDeflectionRatio', 'maxColumnSlenderness'] as const).forEach(key => { merged[key] = base[key] as never; });
      }
      // Les anciennes sessions contenaient des champs vides : reprendre le catalogue
      // plutôt que conserver silencieusement une base de calcul incomplète.
      (Object.keys(base) as Array<keyof Draft>).forEach(key => {
        if (key !== "basisConfirmed" && typeof merged[key] === "string" && !String(merged[key]).trim()) merged[key] = base[key] as never;
      });
      // Migration ciblée des libellés génériques de la première version ; une saisie
      // utilisateur différente est conservée.
      if (merged.nationalAnnex === "Annexes nationales françaises — édition applicable à confirmer") merged.nationalAnnex = base.nationalAnnex;
      if (merged.sourceReference === "EN 1990 · EN 1991 · EN 1992 · EN 1998 — édition, annexe nationale et projet à confirmer") merged.sourceReference = base.sourceReference;
      const concreteForLegacySource = Object.values(CONCRETE_MATERIAL_CATALOG).find(item => item.fck === numeric(merged.fckMpa)) ?? CONCRETE_MATERIAL_CATALOG["C25/30"];
      const legacyEurocodeSource = `Catalogue GcBtp · ${concreteForLegacySource.concreteClass} · EN 1990/1991/1992 · paramètres nominaux à vérifier sur le dossier du projet`;
      if (resolveRCStandardProfile(base.standard).family === "bael-91-99" && merged.sourceReference === legacyEurocodeSource) merged.sourceReference = base.sourceReference;
      setDraft(merged);
      setOverrides(parsed.overrides ?? {});
    } catch {
      setDraft(base);
      setOverrides({});
    }
  }, [projectId, projectNorm, projectConcreteFckMpa, projectRebarFykMpa, onResultChange]);

  useEffect(() => {
    if (projectId) sessionStorage.setItem(`gcbtp-rc-design:${projectId}`, JSON.stringify({ schemaVersion: 1, draft, overrides }));
  }, [projectId, draft, overrides]);

  useEffect(() => {
    setResult(null);
    setOptimizationProposals([]);
    setDirty(false);
    onResultChange(null);
  }, [sourceSignature, onResultChange]);

  const basis: RCDesignBasis = useMemo(() => ({
    schemaVersion: 1,
    standard: draft.standard,
    nationalAnnex: draft.nationalAnnex,
    sourceReference: draft.sourceReference,
    basisConfirmed: draft.basisConfirmed,
    fckMpa: numeric(draft.fckMpa),
    fykMpa: numeric(draft.fykMpa),
    gammaC: numeric(draft.gammaC),
    gammaS: numeric(draft.gammaS),
    alphaCC: numeric(draft.alphaCC),
    coverMm: numeric(draft.coverMm),
    minReinforcementRatio: numeric(draft.minReinforcementPercent) / 100,
    maxReinforcementRatio: numeric(draft.maxReinforcementPercent) / 100,
    concreteShearStressLimitMpa: numeric(draft.concreteShearStressLimitMpa),
    bondStressMpa: numeric(draft.bondStressMpa),
    minClearSpacingMm: numeric(draft.minClearSpacingMm),
    maxLinkSpacingMm: numeric(draft.maxLinkSpacingMm),
    maxDeflectionRatio: numeric(draft.maxDeflectionRatio),
    maxColumnSlenderness: numeric(draft.maxColumnSlenderness),
    availableBarDiametersMm: draft.availableBarDiametersMm.split(/[;,\s]+/).map(numeric).filter(Number.isFinite),
  }), [draft]);

  const update = (key: keyof Draft, value: string | boolean) => {
    setDraft(current => ({ ...current, [key]: value }));
    setDirty(true);
    onResultChange(null);
  };
  const updateOverride = (id: string, patch: Partial<RebarOverride>, current: RebarOverride) => {
    setOverrides(value => ({ ...value, [id]: { ...current, ...patch } }));
    setDirty(true);
    onResultChange(null);
  };
  const run = () => {
    const next = designReinforcedConcrete({ basis, members, slabs, foundations, stairs, overrides });
    if (!validateRCDesignBasis(basis).length) {
      const wallDesigns = walls.map(wall => designWall(wall, basis, overrides));
      next.elements.push(...wallDesigns);
      for (const element of wallDesigns) for (const bar of element.reinforcement) {
        const current = next.schedule.find(item => item.diameterMm === bar.diameterMm);
        if (current) { current.totalLengthM += bar.totalLengthM; current.massKg += bar.massKg; }
        else next.schedule.push({ diameterMm: bar.diameterMm, totalLengthM: bar.totalLengthM, massKg: bar.massKg });
      }
    }
    if (sourceWarnings.length) next.warnings.push(...sourceWarnings);
    setResult(next);
    setOptimizationProposals([]);
    setDirty(false);
    onResultChange(next);
  };
  const runOptimization = () => {
    if (!resolveRCStandardProfile(projectNorm).supportedForPreDesign) {
      toast.error("Optimisation bloquée : le référentiel du projet n’est pas pris en charge par le moteur BA.");
      return;
    }
    const proposals = proposeOptimizedRCSections({ basis, members, slabs, foundations, overrides, lockedElementIds: optimizedElementIds })
      .filter(proposal => !optimizedElementIds.has(proposal.elementId));
    // Voiles : recherche de la plus petite épaisseur conservant les contrôles disponibles.
    for (const wall of walls) {
      if (optimizedElementIds.has(wall.id)) continue;
      const current = wall.thicknessMm;
      const candidates = [120, 150, 160, 180, 200, 220, 250, 300].filter(v => v < current).sort((a,b) => a-b);
      for (const thickness of candidates) {
        const candidate = { ...wall, thicknessMm: thickness };
        const designed = designWall(candidate, basis, overrides);
        const blocked = designed.checks.some(item => item.status === "non satisfaisant" || item.status === "bloqué");
        if (!blocked && designed.checks.length) {
          const utilization = Math.max(...designed.checks.map(item => item.utilization ?? 0));
          const currentDesign = designWall(wall, basis, overrides);
          const currentUtil = Math.max(...currentDesign.checks.map(item => item.utilization ?? 0));
          proposals.push({ elementId: wall.id, levelLabel: (wall as WallDemand & { levelLabel?: string }).levelLabel, type: "wall", currentSection: { dimensions: [current], unit: "mm" }, proposedSection: { dimensions: [thickness], unit: "mm" }, utilization, currentUtilization: currentUtil, reason: `Épaisseur minimale testée satisfaisant les contrôles disponibles (${thickness} mm).`, estimatedMaterialRatio: thickness / current });
          break;
        }
      }
    }
    setOptimizationProposals(proposals);
    if (proposals.length) toast.success(`${proposals.length} proposition(s) d’optimisation trouvée(s).`);
    else toast.info("Aucune réduction de section n’a été démontrée par les contrôles disponibles.");
  };
  const formatProposalSection = (proposal: RCOptimizationProposal) => proposal.proposedSection.dimensions.map(v => v < 10 ? v.toFixed(2) : String(Math.round(v))).join(" × ") + (proposal.proposedSection.unit === "m" ? " m" : " mm");
  const catalogDimensions = (proposal: RCOptimizationProposal) => proposal.proposedSection.dimensions.map(v => (proposal.proposedSection.unit === "mm" ? v / 1000 : v).toFixed(3)).join(" × ") + " m";
  const proposalModelName = (proposal: RCOptimizationProposal) => {
    const suffix = proposal.proposedSection.dimensions.map(v => v < 10 ? v.toFixed(2).replace(".", "_") : Math.round(v)).join("x");
    const family = proposal.type === "column" ? "POTEAU" : proposal.type === "beam" ? "POUTRE" : proposal.type === "tie-beam" ? "LONGRINE" : proposal.type === "slab" ? "DALLE" : proposal.type === "wall" ? "VOILE" : "SEMELLE";
    // Une section validée doit devenir un modèle réutilisable par tous les éléments
    // qui recevront exactement la même géométrie. L'identifiant de l'élément n'est
    // donc volontairement pas inclus dans le nom du modèle.
    return `OPT_${family}_${suffix}`.replace(/[^a-zA-Z0-9_]/g, "_");
  };

  const downloadResult = () => {
    if (!result || dirty) return;
    const blob = new Blob([JSON.stringify({ schemaVersion: result.schemaVersion, units: { length: "mm/m", force: "kN", moment: "kN·m", stress: "MPa", mass: "kg" }, result }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gcbtp-ferraillage-pre-etude-v${result.schemaVersion}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const reinforcementGeometry = useMemo(() => {
    const map: Record<string, string> = {};
    for (const demand of members) map[demand.id] = `Section : ${demand.sectionWidthMm.toFixed(0)} × ${demand.sectionDepthMm.toFixed(0)} mm · longueur ${demand.lengthMm.toFixed(0)} mm`;
    for (const demand of slabs) map[demand.id] = `Dalle : e = ${demand.thicknessMm.toFixed(0)} mm · portée ${demand.spanXM.toFixed(2)} × ${demand.spanYM.toFixed(2)} m`;
    for (const demand of foundations) map[demand.id] = `Semelle : ${demand.widthM.toFixed(2)} × ${demand.lengthM.toFixed(2)} × ${demand.thicknessM.toFixed(2)} m · poteau ${demand.columnWidthM.toFixed(2)} × ${demand.columnDepthM.toFixed(2)} m`;
    for (const demand of walls) map[demand.id] = `Voile : épaisseur ${demand.thicknessMm.toFixed(0)} mm · longueur ${demand.lengthMm.toFixed(0)} mm · hauteur ${demand.heightMm.toFixed(0)} mm`;
    return map;
  }, [members, slabs, foundations, walls]);

  const reinforcementGroups = useMemo(() => result ? groupReinforcementElements(result.elements, reinforcementGeometry) : [], [result, reinforcementGeometry]);

  const downloadReinforcementPdf = (element?: RCElementDesign) => {
    if (!result || dirty) return;
    downloadReinforcementA4Pdf(result, element, reinforcementGeometry);
    if (element) toast.success(`Fiche A4 ${element.elementId} générée.`);
    else toast.success(`${reinforcementGroups.length} plan(s) A4 généré(s) après regroupement des éléments de même type et section.`);
  };

  const fields: Array<[keyof Draft, string, string]> = [
    ["fckMpa", "fck béton", "MPa"], ["fykMpa", "fyk acier", "MPa"],
    ["gammaC", "γc", "—"], ["gammaS", "γs", "—"], ["alphaCC", resolveRCStandardProfile(projectNorm).family === "bael-91-99" ? "Facteur béton d’étude" : "αcc", "—"],
    ["coverMm", "Enrobage nominal", "mm"], ["minReinforcementPercent", "ρ armatures min.", "%"], ["maxReinforcementPercent", "ρ armatures max.", "%"],
    ["concreteShearStressLimitMpa", "τRd,c déclaré", "MPa"], ["bondStressMpa", "Adhérence τbd déclarée", "MPa"],
    ["minClearSpacingMm", "Espacement libre min.", "mm"], ["maxLinkSpacingMm", "Espacement cadres max.", "mm"],
    ["maxDeflectionRatio", "Limite de flèche L/", "—"], ["maxColumnSlenderness", "Limite d’élancement λ", "—"],
  ];
  const selectedStandardProfile = resolveRCStandardProfile(projectNorm);

  return <section className="space-y-3 rounded-lg border border-[#e7c58d] bg-[#fffaf0] p-3 text-[10px] text-[#554223]">
    <div className="flex items-start justify-between gap-2">
      <div><b className="text-[12px]">Béton armé · dimensionnement et ferraillage</b><p className="mt-1 text-[9px] text-[#765f36]">Dalles, poutres, poteaux, longrines, voiles, semelles et volées d’escalier sont traités après résolution des efforts ou de leur pré-étude dédiée. Les sorties ne sont pas une note réglementaire ni une autorisation d’exécution.</p></div>
      <span className="shrink-0 rounded bg-[#f9e7c4] px-2 py-1 font-semibold">Non réglementaire</span>
    </div>
    <div className="rounded border border-[#edd7b0] bg-white p-2 text-[9px]">fck et fyk sont proposés depuis les catalogues matériaux du projet ; vérifiez les certificats et la norme contractuelle. Coefficients code, annexes, enrobage, adhérence et détails restent à renseigner/valider ; les valeurs nominales catalogue ne constituent pas une vérification normative.</div>
    {sourceWarnings.map((warning, index) => <div key={`source-${index}`} className="rounded bg-amber-50 p-2 text-amber-900">Source / périmètre · {warning}</div>)}
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded border bg-[#f8fafb] p-2"><b>Norme sélectionnée dans les paramètres du projet :</b> {projectNorm || "non renseignée"}<div className="mt-1 text-[8px]">Pour changer de norme, modifiez les paramètres du projet. {selectedStandardProfile.note}</div></div>
      <label>Annexe nationale / règles locales<input className="mt-1 h-8 w-full rounded border bg-white px-2" value={draft.nationalAnnex} onChange={event => update("nationalAnnex", event.target.value)} placeholder="Édition, NA, prescriptions locales" /></label>
      <label className="col-span-2">Source des propriétés / détails<input className="mt-1 h-8 w-full rounded border bg-white px-2" value={draft.sourceReference} onChange={event => update("sourceReference", event.target.value)} placeholder="Document, édition, page, spécification projet" /></label>
    </div>
    <div className="grid grid-cols-2 gap-2">
      {fields.map(([key, label, unit]) => <label key={key}>{label} <span className="text-[#93856d]">{unit}</span><input type="number" step="any" className="mt-1 h-8 w-full rounded border bg-white px-2" value={draft[key] as string} onChange={event => update(key, event.target.value)} /></label>)}
      <label className="col-span-2">Diamètres d’acier disponibles · mm<input className="mt-1 h-8 w-full rounded border bg-white px-2" value={draft.availableBarDiametersMm} onChange={event => update("availableBarDiametersMm", event.target.value)} /><span className="text-[8px]">Séparer par virgule, espace ou point-virgule.</span></label>
    </div>
    <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[9px] text-amber-950">Règle de projet : <b>HA8 est interdit comme armature longitudinale principale d’un poteau</b> (il peut rester admissible en cadre/étrier). La norme est reprise des paramètres du projet et conservée dans le résultat. Le moteur utilise des coefficients de pré-étude déclarés, mais ne réalise pas toutes les clauses BAEL/Eurocode, annexes, effets du second ordre, ancrages ou dispositions sismiques.</div>
    <label className="flex items-start gap-2 rounded bg-white p-2"><input type="checkbox" checked={draft.basisConfirmed} onChange={event => update("basisConfirmed", event.target.checked)} /><span>J’ai vérifié ces paramètres contre les documents du projet. Cette attestation de saisie ne transforme pas le calcul générique en vérification normative.</span></label>
    <button type="button" className="h-9 w-full rounded bg-[#8a5b16] px-3 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={!selectedStandardProfile.supportedForPreDesign || (!members.length && !slabs.length && !foundations.length && !stairs.length)} onClick={run}>Calculer / recalculer les armatures proposées</button>
    {!selectedStandardProfile.supportedForPreDesign && <div className="rounded bg-red-50 p-2 text-red-900">Le calcul est bloqué : le moteur ne prend en charge que les pré-études génériques Eurocode 2 et BAEL 91 mod. 99. Aucun résultat d’armature ne sera présenté sous une autre norme.</div>}
    {!members.length && !slabs.length && !foundations.length && !stairs.length && <div className="rounded bg-white p-2">Aucune demande de calcul disponible : lancez d’abord les solveurs ou renseignez la géométrie et les charges des escaliers.</div>}
    <button type="button" onClick={runOptimization} disabled={!selectedStandardProfile.supportedForPreDesign || !result || dirty} className="h-9 w-full rounded border border-[#2d7a5d] bg-[#effaf4] px-3 text-[10px] font-bold text-[#236348] disabled:opacity-40">Analyser les sections et proposer l’optimisation — une seule fois par élément</button>
    {optimizedElementIds.size > 0 && <div className="rounded bg-[#eef8f1] p-2 text-[9px] text-[#35644b]">Optimisation déjà validée pour : {Array.from(optimizedElementIds).join(", ")}. Ces éléments sont verrouillés et ne seront plus ré-optimisés.</div>}
    {optimizationProposals.length > 0 && <div className="space-y-2 rounded border border-[#b9dfc9] bg-[#f5fcf8] p-2">
      <div className="font-bold text-[#236348]">Optimisation proposée · validation manuelle obligatoire</div>
      <div className="text-[9px] text-[#4b6358]">Le moteur teste des sections plus petites avec les mêmes efforts gouvernants. Il ne modifie jamais la maquette sans validation.</div>
      {optimizationProposals.map(proposal => <div key={`${proposal.type}:${proposal.elementId}`} className="rounded border bg-white p-2">
        <div className="flex items-center justify-between gap-2"><div><b>{proposal.elementId}</b> · {proposal.levelLabel ?? "Niveau non renseigné"}</div><span className="rounded bg-[#e9f7ee] px-1.5 py-0.5 text-[8px] font-bold text-[#236348]">{Math.round(proposal.estimatedMaterialRatio * 100)} % du volume actuel</span></div>
        <div className="mt-1">Actuel : <b>{proposal.currentSection.dimensions.map(v => v < 10 ? v.toFixed(2) : Math.round(v)).join(" × ")} {proposal.currentSection.unit}</b> → proposé : <b>{formatProposalSection(proposal)}</b></div>
        <div className="text-[8px] text-[#5e6e65]">{proposal.reason} · utilisation proposée {Math.round(proposal.utilization * 100)} %{proposal.currentUtilization !== null ? ` · actuelle ${Math.round(proposal.currentUtilization * 100)} %` : ""}</div>
        <button type="button" className="mt-1 h-8 rounded bg-[#236348] px-3 text-[9px] font-bold text-white disabled:opacity-40" disabled={!onApplySection} onClick={() => onApplySection?.(proposal.elementId, proposal.type, proposalModelName(proposal), catalogDimensions(proposal))}>Valider et appliquer à la 3D</button>
      </div>)}
    </div>}
    {result && <div className="space-y-2 rounded border border-[#ead3a8] bg-white p-2">
      <div className="font-bold">Résultat numérique · {result.status} · référentiel déclaré : {result.standard || "non renseigné"} · annexe : {result.nationalAnnex || "non renseignée"}</div>
      <div className="rounded bg-[#eef8f7] p-2">Couverture numérique : {result.numericalSummary.memberCount} membre(s), {result.numericalSummary.slabCount} dalle(s), {result.numericalSummary.footingCount} semelle(s), {result.numericalSummary.stairCount} escalier(s) · {result.numericalSummary.passedCheckCount}/{result.numericalSummary.checkCount} contrôles satisfaisants · {result.numericalSummary.failedCheckCount} non satisfaisant(s) · {result.numericalSummary.blockedCheckCount} bloqué(s)/à vérifier.</div>
      {dirty && <div className="rounded bg-amber-100 p-2 font-bold text-amber-900">Saisie ou proposition modifiée — les résultats affichés sont périmés. Recalculez avant de les exporter.</div>}
      {result.errors.map((error, index) => <div key={`rc-error-${index}`} className="rounded bg-red-50 p-2 text-red-800">Bloqué · {error}</div>)}
      {result.blockers.map((blocker, index) => <div key={`rc-blocker-${index}`} className="rounded bg-amber-50 p-2 text-amber-900">Limite réglementaire · {blocker}</div>)}
      {result.warnings.map((warning, index) => <div key={`rc-warning-${index}`} className="rounded bg-amber-50 p-2 text-amber-900">Avertissement · {warning}</div>)}
      <div className="rounded border border-[#b9d7e1] bg-[#f6fbfd] p-2">
        <div className="font-bold text-[#173b4c]">Plans A4 regroupés automatiquement</div>
        <div className="mt-1 text-[9px] text-[#60747d]">Une fiche A4 représente un seul élément type. Le moteur regroupe uniquement les éléments ayant le même type, la même section/géométrie et exactement le même ferraillage. Le plan montre le représentant, puis indique la quantité et les repères associés.</div>
        <div className="mt-2 space-y-1">
          {reinforcementGroups.map((group, index) => <div key={group.key} className="flex flex-wrap items-center gap-2 rounded bg-white p-2">
            <b>Plan F-{String(index + 1).padStart(3, "0")}</b>
            <span>{group.representative.type === "column" ? "Poteau" : group.representative.type === "footing" ? "Semelle" : group.representative.type === "beam" ? "Poutre" : group.representative.type === "tie-beam" ? "Longrine" : group.representative.type === "wall" ? "Voile" : "Dalle"}</span>
            <span className="rounded bg-[#e9f3f6] px-1.5 py-0.5">{group.elements.length} élément(s)</span>
            <span className="text-[#596d75]">{group.elements.map(item => item.elementId).join(", ")}</span>
            <span className="text-emerald-700">élément type représentatif</span>
            <button type="button" onClick={() => downloadReinforcementGroupA4Pdf(result, group, reinforcementGeometry)} className="ml-auto rounded bg-[#102f45] px-2 py-1 text-[8px] font-bold text-white">PDF A4 de ce type</button>
          </div>)}
        </div>
      </div>
      {result.elements.map(element => <div key={`${element.type}:${element.elementId}`} className="space-y-2 rounded border p-2">
        <div className="flex items-start justify-between gap-2">
          <div className="font-bold">{element.type === "beam" ? "Poutre" : element.type === "tie-beam" ? "Longrine de redressement" : element.type === "column" ? "Poteau" : element.type === "footing" ? "Semelle" : element.type === "wall" ? "Voile" : "Dalle"} {element.elementId} · combinaison gouvernante déclarée : {element.combinationName} ({element.combinationId})</div>
          <button type="button" onClick={() => downloadReinforcementPdf(element)} disabled={dirty} className="shrink-0 rounded bg-[#e9f1f3] px-2 py-1 text-[8px] font-bold text-[#173b4c] disabled:opacity-40">A4 / PDF</button>
        </div>
        <ReinforcementSketch element={element} />
        {element.reinforcement.map(bar => {
          const override = overrides[bar.id] ?? { diameterMm: bar.diameterMm, count: bar.count };
          return <div key={bar.id} className="grid grid-cols-[1.4fr_.65fr_.65fr_1.1fr] items-center gap-1 rounded bg-[#fbfaf6] p-1">
            <span>{bar.label}</span>
            <label>ϕ mm<input type="number" min="1" className="mt-1 h-7 w-full rounded border bg-white px-1" value={override.diameterMm} onChange={event => updateOverride(bar.id, { diameterMm: Number(event.target.value) }, override)} /></label>
            <label>Qté<input type="number" min="1" step="1" className="mt-1 h-7 w-full rounded border bg-white px-1" value={override.count} onChange={event => updateOverride(bar.id, { count: Number(event.target.value) }, override)} /></label>
            <span>{bar.areaMm2.toFixed(0)} mm² · {bar.totalLengthM.toFixed(1)} m · {bar.massKg.toFixed(1)} kg</span>
          </div>;
        })}
        <div className="space-y-1">
          {element.checks.map(item => <div key={item.id} className={`grid grid-cols-[1.4fr_.8fr_.8fr_.75fr] gap-1 rounded p-1 ${statusStyle(item.status)}`}><span>{item.label}<small className="block opacity-75">{item.formula}</small></span><span>Ed {item.demand === null ? "—" : `${item.demand.toFixed(2)} ${item.unit}`}</span><span>Rd {item.resistance === null ? "—" : `${item.resistance.toFixed(2)} ${item.unit}`}</span><b>{item.status}{item.utilization === null ? "" : ` · ${Math.round(item.utilization * 100)} %`}</b></div>)}
        </div>
        {element.limitations.map((limitation, index) => <div key={`lim-${index}`} className="text-[8px] text-[#76674c]">Périmètre limité · {limitation}</div>)}
      </div>)}
      {result.schedule.length > 0 && <div className="rounded bg-[#f7f2e8] p-2"><b>Nomenclature provisoire</b>{result.schedule.map(item => <div key={item.diameterMm}>HA ϕ{item.diameterMm} · {item.totalLengthM.toFixed(1)} m · {item.massKg.toFixed(1)} kg</div>)}</div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => downloadReinforcementPdf()} disabled={dirty || !reinforcementGroups.length} className="h-9 rounded bg-[#102f45] px-3 font-bold text-white disabled:opacity-40">Générer les plans A4 regroupés type Robot ({reinforcementGroups.length})</button>
        <button type="button" onClick={downloadResult} disabled={dirty} className="h-9 rounded border bg-white px-3 font-semibold disabled:opacity-40">Exporter les résultats JSON</button>
      </div>
      <div className="text-[8px] text-[#6f6553]">Gabarit actif : {templateCompany || "entreprise non renseignée"} · les informations du cartouche sont enregistrées dans Paramètres.</div>
      <div className="font-bold text-red-800">Aucune validation réglementaire : revoir les hypothèses, contrôles bloqués et détails avec un ingénieur structure habilité.</div>
    </div>}
  </section>;
}

function ReinforcementSketch({ element }: { element: RCElementDesign }) {
  const find = (suffix: string) => element.reinforcement.find(item => item.id.endsWith(suffix));
  if (element.type === "slab") return <div className="rounded bg-[#fafafa] p-1"><span>Schéma d’intention · nappes orthogonales non cotées</span><svg viewBox="0 0 140 58" className="h-14 w-full"><rect x="12" y="5" width="116" height="48" fill="#fff" stroke="#59656a" strokeWidth="2" />{Array.from({ length: 7 }, (_, index) => <line key={`x-${index}`} x1={20 + index * 16} y1="8" x2={20 + index * 16} y2="50" stroke="#2b7880" strokeWidth="1.5" />)}{Array.from({ length: 4 }, (_, index) => <line key={`y-${index}`} x1="15" y1={14 + index * 12} x2="125" y2={14 + index * 12} stroke="#8b5c15" strokeWidth="1.5" />)}</svg></div>;
  const top = find(":top"), bottom = find(":bottom"), longitudinal = find(":longitudinal");
  const drawRows = (count: number, y: number, key: string) => Array.from({ length: Math.min(count, 10) }, (_, index) => <circle key={`${key}-${index}`} cx={32 + (index * 56) / Math.max(1, Math.min(count, 10) - 1)} cy={y} r="3" fill="#b74736" />);
  return <div className="rounded bg-[#fafafa] p-1"><span>Schéma d’intention · détails, enrobage et ancrages à vérifier</span><svg viewBox="0 0 120 66" className="h-16 w-full"><rect x="24" y="6" width="72" height="54" fill="#fff" stroke="#59656a" strokeWidth="2" /><rect x="31" y="13" width="58" height="40" fill="none" stroke="#2b7880" strokeWidth="1.5" />{element.type === "column" ? drawRows(longitudinal?.count ?? 4, 19, "column") : <>{drawRows(top?.count ?? 0, 19, "top")}{drawRows(bottom?.count ?? 0, 47, "bottom")}</>}</svg></div>;
}
