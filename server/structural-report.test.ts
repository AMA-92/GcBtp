import { describe, expect, it } from "vitest";
import { createStructuralPassport, createStructuralReport, renderStructuralPassport, renderStructuralReport } from "../shared/structural-report";

const passport = createStructuralPassport({
  elementId: "P1",
  label: "Poteau P1",
  elementType: "Poteau",
  levelLabel: "RDC",
  section: "Pot_20x30",
  gkKn: 12,
  qkKn: 3,
  nuKn: 20,
  nserKn: 15,
  momentKnM: 4.5,
  supports: ["S1"],
  sources: ["Charge dalle D1"],
});

describe("unified Structural Passport / report", () => {
  it("renders identical passport fields from the shared item used by the report", () => {
    const lines = renderStructuralPassport(passport);
    const document = createStructuralReport({
      title: "Note de calcul — Villa",
      generatedAt: "2026-10-02T00:00:00.000Z",
      project: { id: "p1", name: "Villa", country: "Sénégal", city: "Dakar", location: "Site test", structure: "Béton armé", norm: "Référentiel provisoire" },
      body: "Analyse globale indicative.",
      passports: [passport],
      sections: [{ title: "Fondations", lines: ["S1 · réaction 12 kN"] }],
    });
    const rendered = renderStructuralReport(document);
    for (const line of lines) expect(rendered).toContain(line);
    expect(rendered).toContain("FONDATIONS\nS1 · réaction 12 kN");
    expect(document.status).toBe("pré-étude — non certifié");
    expect(rendered).toContain("Aucune validation par un ingénieur habilité");
  });

  it("records multiple Passport items, their sources, and all report sections without truncation", () => {
    const second = createStructuralPassport({ ...passport, elementId: "P2", label: "Poteau P2", sources: ["Charge poutre B3"] });
    const document = createStructuralReport({
      title: "Rapport multi-niveaux",
      generatedAt: "2026-10-02T00:00:00.000Z",
      project: { id: "p2", name: "Immeuble", country: "Côte d’Ivoire", city: "Abidjan", location: "Cocody", structure: "Béton armé", norm: "Pré-étude" },
      body: "Fin de la synthèse principale.",
      passports: [passport, second],
      sections: [{ title: "Avertissements", lines: ["Donnée provisoire", "Deuxième avertissement"] }],
    });
    const text = renderStructuralReport(document);
    expect(text).toContain("Poteau P1");
    expect(text).toContain("Poteau P2");
    expect(text).toContain("Charge poutre B3");
    expect(text).toContain("Deuxième avertissement");
  });
});
