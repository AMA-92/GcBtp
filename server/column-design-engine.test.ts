import { describe, expect, it } from "vitest";
import { designColumn, predesignColumn, type ColumnDesignInput, type ColumnPredesignInput } from "@shared/column-design-engine";

const p6 = (overrides: Partial<ColumnDesignInput> = {}): ColumnDesignInput => ({
  id: "P6",
  standard: "bael-91-mod-99",
  section: { widthMm: 200, depthMm: 300 },
  clearHeightMm: 1000,
  bucklingLengthMm: { x: 1000, y: 1000 },
  concrete: { fckMpa: 25 },
  steel: { fykMpa: 500 },
  coverMm: 30,
  actions: { GkKn: 457.58, QkKn: 105.5, M0xKnM: 0.39, M0yKnM: 0.477, source: "Fiche P6 — combinaison fondamentale provisoire" },
  longitudinalBars: [
    { id: "1", diameterMm: 16, xMm: -65, yMm: -115 },
    { id: "2", diameterMm: 16, xMm: 65, yMm: -115 },
    { id: "3", diameterMm: 16, xMm: 65, yMm: 115 },
    { id: "4", diameterMm: 16, xMm: -65, yMm: 115 },
  ],
  ties: { diameterMm: 8, spacingMm: 150 },
  ...overrides,
});

describe("nouveau moteur autonome des poteaux", () => {
  it("démarre le prédimensionnement sans barres ni longueur d'ancrage définitives", () => {
    const input: ColumnPredesignInput = {
      id: "P6", standard: "bael-91-mod-99", initialSection: { widthMm: 200, depthMm: 300 }, clearHeightMm: 1000,
      concrete: { fckMpa: 25 }, steel: { fykMpa: 500 }, coverMm: 30,
      actions: { GkKn: 457.58, QkKn: 105.5, M0xKnM: 0.39, M0yKnM: 0.477 }, ties: { diameterMm: 8, spacingMm: 150 },
    };
    const result = predesignColumn(input);
    expect(result.status).toBe("propositions disponibles");
    expect(result.initialSection).toEqual({ widthMm: 200, depthMm: 300, provisional: true });
    expect(result.candidates.length).toBeGreaterThan(1);
    expect(result.notes.join(" ")).toContain("provisoire");
    expect(result.warnings.join(" ")).toContain("préliminaires");
  });

  it("ne transforme pas un taux indicatif en conformité finale", () => {
    const result = predesignColumn({
      id: "P6", standard: "eurocode-2", initialSection: { widthMm: 200, depthMm: 300 }, clearHeightMm: 1000,
      concrete: { fckMpa: 25 }, steel: { fykMpa: 500 }, coverMm: 30,
      actions: { NEdKn: 775.983, MEdxKnM: 0.39, MEdyKnM: 0.477 }, ties: { diameterMm: 8, spacingMm: 150 },
    });
    expect(result.candidates.every(candidate => candidate.status !== "conforme")).toBe(true);
    expect(result.warnings[0]).toContain("aucune conformité réglementaire finale");
  });

  it("bloque précisément le prédimensionnement si la combinaison d'efforts manque", () => {
    const result = predesignColumn({
      id: "P6", standard: "bael-91-mod-99", initialSection: { widthMm: 200, depthMm: 300 }, clearHeightMm: 1000,
      concrete: { fckMpa: 25 }, steel: { fykMpa: 500 }, coverMm: 30,
      actions: {}, ties: { diameterMm: 8, spacingMm: 150 },
    });
    expect(result.status).toBe("calcul incomplet");
    expect(result.warnings[0]).toContain("efforts d'une même combinaison");
  });

  it("recalcule les efforts et la géométrie P6 sur les deux axes", () => {
    const result = designColumn(p6());
    expect(result.actions.NEdKn).toBeCloseTo(775.983, 3);
    expect(result.geometry.areaMm2).toBe(60000);
    expect(result.geometry.inertiaXmm4).toBe(450000000);
    expect(result.geometry.inertiaYmm4).toBe(200000000);
    expect(result.geometry.radiusXmm).toBeCloseTo(86.6025, 3);
    expect(result.geometry.radiusYmm).toBeCloseTo(57.735, 3);
    expect(result.slenderness.x).toBeCloseTo(11.547, 3);
    expect(result.slenderness.y).toBeCloseTo(17.321, 3);
  });

  it("ne certifie jamais un poteau lorsque les longueurs de flambement manquent", () => {
    const result = designColumn(p6({ bucklingLengthMm: undefined }));
    expect(result.status).toBe("calcul incomplet");
    expect(result.checks.find(check => check.id === "stability")?.status).toBe("bloqué");
    expect(result.warnings.some(message => message.includes("Calcul incomplet"))).toBe(true);
  });

  it("vérifie exactement les barres fournies sans les remplacer", () => {
    const bars = [{ id: "A", diameterMm: 8, xMm: -65, yMm: -115 }, { id: "B", diameterMm: 8, xMm: 65, yMm: -115 }, { id: "C", diameterMm: 8, xMm: 65, yMm: 115 }, { id: "D", diameterMm: 8, xMm: -65, yMm: 115 }];
    const result = designColumn(p6({ longitudinalBars: bars }));
    expect(result.reinforcement.providedAreaMm2).toBeCloseTo(201.0619, 3);
    expect(result.reinforcement.minimumAreaMm2).toBe(400);
    expect(result.checks.find(check => check.id === "steel-min")?.status).toBe("non satisfaisant");
    expect(result.notes.join(" ")).toContain("aucune modification automatique");
  });

  it("émet une cause de disposition plutôt qu'une recommandation automatique de section", () => {
    const result = designColumn(p6({ ties: { diameterMm: 6, spacingMm: 350 } }));
    expect(result.checks.find(check => check.id === "ties")?.status).toBe("non satisfaisant");
    expect(result.warnings.some(message => message.includes("Armatures transversales non conformes"))).toBe(true);
  });

  it("applique le minimum longitudinal EC2 séparément du BAEL", () => {
    const result = designColumn(p6({ standard: "eurocode-2", actions: { NEdKn: 775.983, MEdxKnM: 0.39, MEdyKnM: 0.477 } }));
    expect(result.reinforcement.minimumAreaMm2).toBeCloseTo(178.476, 2);
    expect(result.checks.find(check => check.id === "steel-min")?.formula).toContain("0,2 %·Ac");
  });

  it("attend le ferraillage avant de calculer l'ancrage", () => {
    const result = designColumn(p6({ longitudinalBars: [] }));
    expect(result.checks.find(check => check.id === "anchorage")?.status).toBe("en attente du ferraillage");
    expect(result.status).toBe("calcul incomplet");
  });

  it("calcule l'ancrage après sélection des barres et bloque si la longueur manque", () => {
    const missing = designColumn(p6());
    expect(missing.checks.find(check => check.id === "anchorage")?.status).toBe("à renseigner");
    const checked = designColumn(p6({ anchorage: { availableTopMm: 600, availableBottomMm: 600, type: "droit" } }));
    const anchorage = checked.checks.find(check => check.id === "anchorage");
    expect(anchorage?.status).toBe("non satisfaisant");
    expect(anchorage?.formula).toContain("BAEL A.6.1,221");
    expect(anchorage?.demand).toBeGreaterThan(600);
  });
});
