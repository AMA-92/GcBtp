import { useEffect, useMemo, useState } from "react";
import { mapFoundationReactions, checkFoundationReaction, type FoundationReactionInput, type FoundationReactionRecord, type FoundationReactionResult } from "@shared/foundation-reaction";
import type { AnalyticalModel } from "@shared/analytical-model";
import type { FramePlane, PlaneFrameResult } from "@shared/frame-solver-2d";
import { DEFAULT_PROJECT_ALLOWABLE_BEARING_KPA, DEFAULT_PROJECT_ALLOWABLE_BEARING_SOURCE } from "@shared/foundation-engine";

export type FoundationPanelEvaluation = {
  basis: { soilName: string; source: string; allowableBearingKPa: number | null; bearingSafetyFactor: number; slidingSafetyFactor: number; frictionAngleDeg: number; concreteShearCapacityKPa: number | null; subgradeModulusKnM3: number | null; allowableSettlementMm: number | null };
  rows: Array<{ footingId: string; columnId: string; reaction: FoundationReactionRecord; result: FoundationReactionResult | null; error?: string }>;
  warnings: string[];
};

type Props = {
  model: AnalyticalModel | null;
  result: PlaneFrameResult | null;
  gravityResult?: PlaneFrameResult | null;
  plane: FramePlane;
  soilName: string;
  suggestedBearingKPa: number | null;
  suggestedSource: string;
  onResultChange?: (result: FoundationPanelEvaluation | null) => void;
};

const parseOptional = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const statusClass = (status: string) => status === "satisfaisant" ? "bg-emerald-50 text-emerald-800" : status === "insuffisant" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900";

export default function FoundationReactionPanel({ model, result, gravityResult, plane, soilName, suggestedBearingKPa, suggestedSource, onResultChange }: Props) {
  const [bearing, setBearing] = useState(String(DEFAULT_PROJECT_ALLOWABLE_BEARING_KPA));
  const [source, setSource] = useState(DEFAULT_PROJECT_ALLOWABLE_BEARING_SOURCE);
  const [bearingSafetyFactor, setBearingSafetyFactor] = useState("1.5");
  const [slidingSafetyFactor, setSlidingSafetyFactor] = useState("1.5");
  const [frictionAngle, setFrictionAngle] = useState("30");
  const [concreteShearCapacity, setConcreteShearCapacity] = useState("");
  const [subgradeModulus, setSubgradeModulus] = useState("");
  const [allowableSettlement, setAllowableSettlement] = useState("");

  const effectiveResult = gravityResult ?? result;
  const mapped = useMemo(() => {
    if (!model || !effectiveResult) return { records: [], warnings: ["Le calcul gravitaire automatique n’a pas encore produit de réactions aux appuis."] };
    const mappedResult = mapFoundationReactions(model, effectiveResult, plane);
    return gravityResult ? { ...mappedResult, warnings: mappedResult.warnings.filter(message => !message.startsWith("Réactions projetées depuis le plan")) } : mappedResult;
  }, [model, effectiveResult, plane, gravityResult]);
  const bearingKPa = parseOptional(bearing);
  const phiDeg = parseOptional(frictionAngle);
  const punchingKPa = parseOptional(concreteShearCapacity);
  const modulus = parseOptional(subgradeModulus);
  const settlementLimit = parseOptional(allowableSettlement);
  const evaluation = useMemo<FoundationPanelEvaluation>(() => {
    const warnings = [...mapped.warnings];
    if (!bearingKPa) warnings.push("qadm géotechnique absent : aucune vérification de portance ne peut être interprétée.");
    if (!source.trim()) warnings.push("Provenance géotechnique non renseignée.");
    const rows = mapped.records.map(record => {
      if (!bearingKPa || phiDeg === null) return { footingId: record.footingId, columnId: record.columnId, reaction: record, result: null, error: "Renseignez qadm et l’angle de frottement issus d’une étude géotechnique." };
      const footingSelfWeightKn = record.widthXM * record.widthYM * record.thicknessM * 25;
      const input: FoundationReactionInput = {
        ...record,
        allowableBearingKPa: bearingKPa,
        bearingSafetyFactor: Number(bearingSafetyFactor),
        slidingSafetyFactor: Number(slidingSafetyFactor),
        frictionAngleDeg: phiDeg,
        footingSelfWeightKn,
        soilCoverLoadKn: 0,
        concreteShearCapacityKPa: punchingKPa,
        subgradeModulusKnM3: modulus,
        allowableSettlementMm: settlementLimit,
        provenance: source,
      };
      try { return { footingId: record.footingId, columnId: record.columnId, reaction: record, result: checkFoundationReaction(input) }; }
      catch (error) { return { footingId: record.footingId, columnId: record.columnId, reaction: record, result: null, error: error instanceof Error ? error.message : String(error) }; }
    });
    return { basis: { soilName, source, allowableBearingKPa: bearingKPa, bearingSafetyFactor: Number(bearingSafetyFactor), slidingSafetyFactor: Number(slidingSafetyFactor), frictionAngleDeg: phiDeg ?? 0, concreteShearCapacityKPa: punchingKPa, subgradeModulusKnM3: modulus, allowableSettlementMm: settlementLimit }, rows, warnings };
  }, [mapped, bearingKPa, phiDeg, bearingSafetyFactor, slidingSafetyFactor, punchingKPa, modulus, settlementLimit, source, soilName]);
  useEffect(() => { onResultChange?.(evaluation); }, [evaluation, onResultChange]);

  return <section className="space-y-2 rounded-xl border border-[#bddbd8] bg-[#f5fbfa] p-3 text-[10px] text-[#36585b]">
    <div><b className="text-[12px] text-[#087f7f]">Fondations · réactions du solveur global 3D</b><div className="mt-1 rounded bg-amber-100 p-2 text-amber-900"><b>Pré-étude indicative — non certifiée.</b> Les réactions sont issues du portique spatial 3D (axial, flexion biaxiale et torsion) pour la combinaison gravitaire G/Q. Les diaphragmes, le second ordre et les non-linéarités restent exclus.</div></div>
    <div className="grid grid-cols-2 gap-2">
      <label>Sol proposé — à confirmer<input className="mt-1 h-8 w-full rounded border bg-white px-2" value={soilName} readOnly /></label>
      <label>qadm déclaré · kPa (défaut projet : 200 kPa)<input type="number" min="1" step="any" className="mt-1 h-8 w-full rounded border bg-white px-2" value={bearing} onChange={event => setBearing(event.target.value)} placeholder="Rapport géotechnique" /></label>
      <label>φ · degrés<input type="number" min="0" max="60" step="any" className="mt-1 h-8 w-full rounded border bg-white px-2" value={frictionAngle} onChange={event => setFrictionAngle(event.target.value)} /></label>
      <label>γ portance<input type="number" min="1" step="any" className="mt-1 h-8 w-full rounded border bg-white px-2" value={bearingSafetyFactor} onChange={event => setBearingSafetyFactor(event.target.value)} /></label>
      <label>γ glissement<input type="number" min="1" step="any" className="mt-1 h-8 w-full rounded border bg-white px-2" value={slidingSafetyFactor} onChange={event => setSlidingSafetyFactor(event.target.value)} /></label>
      <label>Provenance géotechnique<input className="mt-1 h-8 w-full rounded border bg-white px-2" value={source} onChange={event => setSource(event.target.value)} placeholder="Étude, page, date" /></label>
      <label>Capacité de poinçonnement vérifiée · kPa<input type="number" min="1" step="any" className="mt-1 h-8 w-full rounded border bg-white px-2" value={concreteShearCapacity} onChange={event => setConcreteShearCapacity(event.target.value)} placeholder="Sans détail BA : non vérifié" /></label>
      <label>Module de réaction k · kN/m³<input type="number" min="1" step="any" className="mt-1 h-8 w-full rounded border bg-white px-2" value={subgradeModulus} onChange={event => setSubgradeModulus(event.target.value)} placeholder="Étude géotechnique" /></label>
      <label className="col-span-2">Tassement admissible · mm<input type="number" min="1" step="any" className="mt-1 h-8 w-full rounded border bg-white px-2" value={allowableSettlement} onChange={event => setAllowableSettlement(event.target.value)} placeholder="À confirmer selon projet et géotechnique" /></label>
    </div>
    {!effectiveResult && <div className="rounded bg-white p-2">Aucune réaction exploitable — relancez le calcul de la descente des charges.</div>}
    {evaluation.rows.map(row => <div key={`${row.footingId}:${row.columnId}`} className="space-y-1 rounded border bg-white p-2">
      <div className="font-bold">{row.footingId} · poteau {row.columnId}</div>
      <div>Appui {row.reaction.nodeId} · N {row.reaction.verticalReactionKn.toFixed(2)} kN · H {row.reaction.horizontalReactionKn.toFixed(2)} kN · M {row.reaction.momentReactionKnM.toFixed(2)} kN·m ({row.reaction.momentAxis.toUpperCase()})</div>
      <div>Semelle {row.reaction.widthXM.toFixed(2)} × {row.reaction.widthYM.toFixed(2)} × {row.reaction.thicknessM.toFixed(2)} m · poteau {row.reaction.columnWidthM.toFixed(2)} × {row.reaction.columnDepthM.toFixed(2)} m</div>
      {(Math.abs(row.reaction.geometricEccentricityXM) > 1e-6 || Math.abs(row.reaction.geometricEccentricityYM) > 1e-6) && <div>Décalage poteau–centre de semelle · ex {row.reaction.geometricEccentricityXM.toFixed(3)} m · ey {row.reaction.geometricEccentricityYM.toFixed(3)} m · moment N·e inclus dans le screening</div>}
      {row.error && <div className="rounded bg-amber-50 p-2 text-amber-900">Vérification bloquée · {row.error}</div>}
      {row.result && <><div className="font-bold">{row.result.status} · N effectif {row.result.effectiveAxialKn.toFixed(2)} kN · e {row.result.eccentricityM.toFixed(3)} m · qmax {Number.isFinite(row.result.maximumPressureKPa) ? row.result.maximumPressureKPa.toFixed(2) : "∞"} kPa</div>{row.result.checks.map(check => <div key={check.id} className={`grid grid-cols-[1.3fr_.75fr_.75fr_.8fr] gap-1 rounded p-1 ${statusClass(check.status)}`}><span>{check.label}<small className="block opacity-75">{check.note}</small></span><span>Ed {check.demand === null ? "—" : Number.isFinite(check.demand) ? check.demand.toFixed(2) : "∞"} {check.unit}</span><span>Rd {check.resistance === null ? "—" : Number.isFinite(check.resistance) ? check.resistance.toFixed(2) : "∞"} {check.unit}</span><b>{check.status}</b></div>)}{row.result.warnings.map((warning, index) => <div key={index} className="text-[9px] text-[#8a5a21]">⚠ {warning}</div>)}</>}
    </div>)}
    {evaluation.warnings.map((warning, index) => <div key={index} className="rounded bg-amber-50 p-2 text-amber-900">⚠ {warning}</div>)}
  </section>;
}
