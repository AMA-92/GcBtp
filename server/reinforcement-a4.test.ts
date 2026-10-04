import { describe, expect, it } from "vitest";
import { buildReinforcementA4Pdf } from "../shared/local-pdf";
import type { RCDesignResult, RCElementDesign } from "../shared/rc-design";

function makeElement(id: string, bars = 12): RCElementDesign {
  return {
    elementId: id,
    type: "column",
    combinationId: "ULS1",
    combinationName: "ELU gravitaire",
    checks: [{ label: "Compression", demand: 100, resistance: 200, unit: "kN", utilization: 0.5, status: "satisfaisant" }],
    limitations: [],
    reinforcement: Array.from({ length: bars }, (_, i) => ({
      id: `${id}:bar:${i + 1}`,
      label: `Barre longitudinale ${i + 1}`,
      diameterMm: 12,
      count: 1,
      areaMm2: 113,
      requiredAreaMm2: 100,
      lengthPerBarM: 3,
      totalLengthM: 3,
      massKg: 2.664,
    })),
  };
}

const result = (element: RCElementDesign): RCDesignResult => ({
  schemaVersion: 1,
  status: "pré-étude — non réglementaire",
  standard: "EN 1992-1-1",
  nationalAnnex: "Sénégal — règles projet",
  sourceReference: "Projet",
  materialBasis: {
    standard: "EN 1992-1-1", nationalAnnex: "", sourceReference: "", fckMpa: 25, fykMpa: 500,
    gammaC: 1.5, gammaS: 1.15, alphaCC: 0.85, coverMm: 30, minReinforcementRatio: 0.0015,
    maxReinforcementRatio: 0.04, concreteShearStressLimitMpa: 0.6, bondStressMpa: 2.5,
    minClearSpacingMm: 20, maxLinkSpacingMm: 200, maxDeflectionRatio: 250, maxColumnSlenderness: 25,
    availableBarDiametersMm: [8,10,12,14,16,20,25,32], basisConfirmed: true,
  },
  regulatoryReady: false,
  elements: [element], schedule: [], errors: [], warnings: [], blockers: [],
});

describe("A4 de ferraillage représentatif", () => {
  it("ne dessine qu'un représentant et indique la quantité", () => {
    const e1 = makeElement("P1", 4);
    const e2 = { ...makeElement("P5", 4), reinforcement: e1.reinforcement.map(b => ({ ...b, id: b.id.replace("P1", "P5") })) };
    const r = result(e1); r.elements = [e1, e2];
    const pdf = new TextDecoder().decode(buildReinforcementA4Pdf(r, undefined, { P1: "Section : 150 × 150 mm", P5: "Section : 150 × 150 mm" }));
    expect(pdf).toContain("QUANTITE : 2");
    expect(pdf).toContain("ELEMENT REPRESENTATIF : P1");
    expect(pdf).toContain("P1");
    expect(pdf).toContain("P5");
  });

  it("génère une page A4 de suite lorsque la nomenclature dépasse dix lignes", () => {
    const e = makeElement("P1", 12);
    const pdf = new TextDecoder().decode(buildReinforcementA4Pdf(result(e), e));
    expect(pdf).toContain("Suite sur 1 page(s) A4 de nomenclature.");
    expect(pdf).toContain("/Count 2");
    expect(pdf).toContain("/MediaBox [0 0 842 595]");
  });

  it("respecte l'orientation portrait du gabarit", () => {
    const previous = (globalThis as any).window;
    (globalThis as any).window = { localStorage: { getItem: () => JSON.stringify({ orientation: "portrait" }), setItem: () => undefined } };
    try {
      const pdf = new TextDecoder().decode(buildReinforcementA4Pdf(result(makeElement("P1", 4)), undefined, { P1: "Section : 150 × 150 mm" }));
      expect(pdf).toContain("/MediaBox [0 0 595 842]");
    } finally {
      (globalThis as any).window = previous;
    }
  });
});

describe("A4 — représentation du ferraillage selon le type d'élément", () => {
  const make = (type: RCElementDesign["type"], reinforcement: RCElementDesign["reinforcement"], id = "E1"): RCElementDesign => ({
    elementId: id,
    type,
    combinationId: "ULS1",
    combinationName: "ELU gravitaire",
    checks: [{ label: "Vérification", demand: 10, resistance: 20, unit: "kN", utilization: 0.5, status: "satisfaisant" }],
    limitations: [],
    reinforcement,
  });
  const rebar = (id: string, label: string, diameterMm = 12, count = 4) => ({ id, label, diameterMm, count, areaMm2: count * Math.PI * diameterMm * diameterMm / 4, requiredAreaMm2: 100, lengthPerBarM: 3, totalLengthM: count * 3, massKg: count * 3 * diameterMm * diameterMm * 0.006165 });

  it("dessine le détail longitudinal + cadres d'une poutre à partir des armatures calculées", () => {
    const e = make("beam", [
      rebar("E1:bottom", "Longitudinal inférieur · HA 16 / 200 mm", 16, 3),
      rebar("E1:top", "Longitudinal supérieur · HA 12 / 200 mm", 12, 2),
      rebar("E1:links", "Cadres · HA 8 / 150 mm · crochets 2×100 mm", 8, 24),
    ], "B1");
    const pdf = new TextDecoder().decode(buildReinforcementA4Pdf(result(e), e, { B1: "Section : 200 × 400 mm · longueur 3500 mm" }));
    expect(pdf).toContain("COUPE DE FERRAILLAGE");
    expect(pdf).toContain("Longitudinal inférieur");
    expect(pdf).toContain("Cadres");
    expect(pdf).toContain("31");
  });

  it("dessine les nappes X/Y et les coupes d'une semelle", () => {
    const e = make("footing", [
      rebar("S1:x", "Armatures principales X · HA 12 / 150 mm", 12, 8),
      rebar("S1:y", "Armatures principales Y · HA 10 / 150 mm", 10, 8),
    ], "S1");
    const pdf = new TextDecoder().decode(buildReinforcementA4Pdf(result(e), e, { S1: "Semelle : 1.20 × 1.00 × 0.30 m · poteau 0.20 × 0.20 m" }));
    expect(pdf).toContain("VUE EN PLAN");
    expect(pdf).toContain("COUPES X-X / Y-Y");
    expect(pdf).toContain("Armatures principales X");
  });

  it("dessine les armatures verticales/horizontales d'un voile", () => {
    const e = make("wall", [
      rebar("V1:vertical", "Armatures verticales · HA 12 / 200 mm", 12, 12),
      rebar("V1:horizontal", "Armatures horizontales · HA 8 / 200 mm", 8, 15),
      rebar("V1:boundary", "Armatures de zones de rive · HA 12", 12, 4),
    ], "V1");
    const pdf = new TextDecoder().decode(buildReinforcementA4Pdf(result(e), e, { V1: "Voile : épaisseur 200 mm · longueur 3000 mm · hauteur 3000 mm" }));
    expect(pdf).toContain("ÉLÉVATION");
    expect(pdf).toContain("COUPE DU VOILE");
    expect(pdf).toContain("Armatures horizontales");
  });
});
