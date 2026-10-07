import { useEffect, useMemo } from "react";
import { mapFoundationReactions, checkFoundationReaction, type FoundationReactionInput, type FoundationReactionRecord, type FoundationReactionResult } from "@shared/foundation-reaction";
import type { AnalyticalModel } from "@shared/analytical-model";
import type { FramePlane, PlaneFrameResult } from "@shared/frame-solver-2d";
import type { ProjectGeotechnicalProfile } from "@shared/geotechnical-profile";
import { FRENCH_EUROCODE_PROFILE } from "@shared/french-standard-profile";

export type FoundationPanelEvaluation = {
  basis: { soilName: string; source: string; allowableBearingKPa: number | null; bearingSafetyFactor: number; slidingSafetyFactor: number; frictionAngleDeg: number | null; concreteShearCapacityKPa: number | null; subgradeModulusKnM3: number | null; allowableSettlementMm: number | null };
  rows: Array<{ footingId: string; columnId: string; reaction: FoundationReactionRecord; result: FoundationReactionResult | null; error?: string }>;
  warnings: string[];
};

type Props = {
  model: AnalyticalModel | null;
  result: PlaneFrameResult | null;
  gravityResult?: PlaneFrameResult | null;
  plane: FramePlane;
  soilProfile: ProjectGeotechnicalProfile;
  onResultChange?: (result: FoundationPanelEvaluation | null) => void;
};

const statusClass = (status: string) => status === "satisfaisant" ? "bg-emerald-50 text-emerald-800" : status === "insuffisant" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900";
const shown = (value: number | null, digits = 2) => value === null ? "non renseigné" : value.toFixed(digits);

export default function FoundationReactionPanel({ model, result, gravityResult, plane, soilProfile, onResultChange }: Props) {
  const effectiveResult = gravityResult ?? result;
  const mapped = useMemo(() => {
    if (!model || !effectiveResult) return { records: [], warnings: ["Le calcul gravitaire automatique n’a pas encore produit de réactions aux appuis."] };
    const mappedResult = mapFoundationReactions(model, effectiveResult, plane);
    return gravityResult ? { ...mappedResult, warnings: mappedResult.warnings.filter(message => !message.startsWith("Réactions projetées depuis le plan")) } : mappedResult;
  }, [model, effectiveResult, plane, gravityResult]);

  const source = [soilProfile.source, soilProfile.reportDate, soilProfile.reportPage ? `p. ${soilProfile.reportPage}` : ""].filter(Boolean).join(" · ") || "non renseignée";
  const soilName = soilProfile.soilDescription || "Profil géotechnique non renseigné";
  const bearingKPa = soilProfile.bearingCapacityAdmissibleKPa;
  const phiDeg = soilProfile.frictionAngleDeg;
  const modulus = soilProfile.subgradeModulusKnM3;
  const settlementLimit = soilProfile.allowableSettlementMm;
  const soilUnitWeight = soilProfile.unitWeightKnM3;
  const foundationDepth = soilProfile.foundationDepthM;
  const evaluation = useMemo<FoundationPanelEvaluation>(() => {
    const warnings = [...mapped.warnings];
    if (bearingKPa === null) warnings.push("qadm absent : le contrôle de portance reste non vérifié; les réactions et le dimensionnement BA par efforts restent disponibles.");
    if (!soilProfile.source.trim()) warnings.push("Provenance géotechnique non renseignée : compléter la référence du rapport dans Paramètres du projet.");
    if (soilUnitWeight === null || foundationDepth === null) warnings.push("Poids de terres de couverture non évalué : saisir le poids volumique du sol et la profondeur réelle d’assise pour l’inclure au screening.");
    const rows = mapped.records.map(record => {
      const footingSelfWeightKn = record.widthXM * record.widthYM * record.thicknessM * 25;
      const soilCoverLoadKn = soilUnitWeight !== null && foundationDepth !== null
        ? soilUnitWeight * record.widthXM * record.widthYM * Math.max(0, foundationDepth - record.thicknessM)
        : 0;
      const input: FoundationReactionInput = {
        ...record,
        allowableBearingKPa: bearingKPa,
        // qadm saisi depuis le rapport est comparé directement, sans facteur caché.
        bearingSafetyFactor: 1,
        slidingSafetyFactor: 1,
        frictionAngleDeg: phiDeg,
        footingSelfWeightKn,
        soilCoverLoadKn,
        concreteShearCapacityKPa: null,
        subgradeModulusKnM3: modulus,
        allowableSettlementMm: settlementLimit,
        provenance: source,
      };
      try { return { footingId: record.footingId, columnId: record.columnId, reaction: record, result: checkFoundationReaction(input) }; }
      catch (error) { return { footingId: record.footingId, columnId: record.columnId, reaction: record, result: null, error: error instanceof Error ? error.message : String(error) }; }
    });
    return {
      basis: { soilName, source, allowableBearingKPa: bearingKPa, bearingSafetyFactor: 1, slidingSafetyFactor: 1, frictionAngleDeg: phiDeg, concreteShearCapacityKPa: null, subgradeModulusKnM3: modulus, allowableSettlementMm: settlementLimit },
      rows,
      warnings,
    };
  }, [mapped, bearingKPa, phiDeg, modulus, settlementLimit, source, soilName, soilProfile.source, soilUnitWeight, foundationDepth]);
  useEffect(() => { onResultChange?.(evaluation); }, [evaluation, onResultChange]);

  return <section className="space-y-2 rounded-xl border border-[#bddbd8] bg-[#f5fbfa] p-3 text-[10px] text-[#36585b]">
    <div>
      <b className="text-[12px] text-[#087f7f]">Fondations · réactions du solveur et screening géotechnique</b>
      <div className="mt-1 rounded bg-amber-100 p-2 text-amber-900"><b>Pré-étude indicative — non certifiée.</b> Références françaises : {FRENCH_EUROCODE_PROFILE.geotechnicalReference}. Ce panneau ne choisit aucun sol et n’invente aucune portance. qadm, φ, nappe, tassement et paramètres de sol sont lus dans les données géotechniques saisies depuis le rapport réel, dans Paramètres du projet. Les valeurs manquantes restent « non vérifiées » et ne bloquent pas le calcul BA fondé sur les efforts et la géométrie.</div>
    </div>
    <div className="grid grid-cols-2 gap-2 rounded bg-white p-2">
      <div>Profil · <b>{soilName}</b></div>
      <div>Classe de sol EC8 · <b>{soilProfile.seismicSoilClass || "non renseignée"}</b></div>
      <div>Portance qadm · <b>{shown(bearingKPa)} {bearingKPa === null ? "" : "kPa"}</b></div>
      <div>φ · <b>{shown(phiDeg, 1)} {phiDeg === null ? "" : "°"}</b></div>
      <div>Module k · <b>{shown(modulus)} {modulus === null ? "" : "kN/m³"}</b></div>
      <div>Tassement admissible · <b>{shown(settlementLimit, 1)} {settlementLimit === null ? "" : "mm"}</b></div>
      <div>Poids volumique du sol · <b>{shown(soilUnitWeight)} {soilUnitWeight === null ? "" : "kN/m³"}</b></div>
      <div>Profondeur d’assise · <b>{shown(foundationDepth)} {foundationDepth === null ? "" : "m"}</b></div>
      <div>Source · <b>{source}</b></div>
      <div className="col-span-2">Les réactions affichées n’intègrent pas ici une vérification complète EC7, les interactions de groupe, les tassements différentiels ni les dispositions sismiques.</div>
    </div>
    {!effectiveResult && <div className="rounded bg-white p-2">Aucune réaction exploitable — relancez le calcul de la descente des charges.</div>}
    {evaluation.rows.map(row => <div key={`${row.footingId}:${row.columnId}`} className="space-y-1 rounded border bg-white p-2">
      <div className="font-bold">{row.footingId} · poteau {row.columnId}</div>
      <div>Appui {row.reaction.nodeId} · N {row.reaction.verticalReactionKn.toFixed(2)} kN · H {row.reaction.horizontalReactionKn.toFixed(2)} kN · M {row.reaction.momentReactionKnM.toFixed(2)} kN·m ({row.reaction.momentAxis.toUpperCase()})</div>
      <div>Semelle {row.reaction.widthXM.toFixed(2)} × {row.reaction.widthYM.toFixed(2)} × {row.reaction.thicknessM.toFixed(2)} m · poteau {row.reaction.columnWidthM.toFixed(2)} × {row.reaction.columnDepthM.toFixed(2)} m</div>
      {(Math.abs(row.reaction.geometricEccentricityXM) > 1e-6 || Math.abs(row.reaction.geometricEccentricityYM) > 1e-6) && <div>Décalage poteau–centre de semelle · ex {row.reaction.geometricEccentricityXM.toFixed(3)} m · ey {row.reaction.geometricEccentricityYM.toFixed(3)} m · moment géométrique N·e inclus dans le screening.</div>}
      {row.error && <div className="rounded bg-amber-50 p-2 text-amber-900">Screening indisponible · {row.error}</div>}
      {row.result && <><div className="font-bold">{row.result.status} · N effectif {row.result.effectiveAxialKn.toFixed(2)} kN · e {row.result.eccentricityM.toFixed(3)} m · qmax {Number.isFinite(row.result.maximumPressureKPa) ? row.result.maximumPressureKPa.toFixed(2) : "∞"} kPa</div>{row.result.checks.map(check => <div key={check.id} className={`grid grid-cols-[1.3fr_.75fr_.75fr_.8fr] gap-1 rounded p-1 ${statusClass(check.status)}`}><span>{check.label}<small className="block opacity-75">{check.note}</small></span><span>Ed {check.demand === null ? "—" : Number.isFinite(check.demand) ? check.demand.toFixed(2) : "∞"} {check.unit}</span><span>Rd {check.resistance === null ? "—" : Number.isFinite(check.resistance) ? check.resistance.toFixed(2) : "∞"} {check.unit}</span><b>{check.status}</b></div>)}{row.result.warnings.map((warning, index) => <div key={index} className="text-[9px] text-[#8a5a21]">Avertissement · {warning}</div>)}</>}
    </div>)}
    {evaluation.warnings.map((warning, index) => <div key={index} className="rounded bg-amber-50 p-2 text-amber-900">Avertissement · {warning}</div>)}
  </section>;
}
