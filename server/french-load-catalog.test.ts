import { describe, expect, it } from "vitest";
import { FRENCH_EUROCODE_ACTION_CATALOG, FRENCH_IMPOSED_LOAD_CATALOG, FRENCH_PROJECT_USAGE_CATALOG, getFrenchPsiFactors } from "../shared/french-load-catalog";

describe("catalogue français des actions Eurocode", () => {
  it("conserve les références des annexes nationales utilisées", () => {
    expect(FRENCH_EUROCODE_ACTION_CATALOG.combinationsReference).toBe("NF EN 1990:2003 + NF EN 1990/NA:2011");
    expect(FRENCH_EUROCODE_ACTION_CATALOG.imposedLoadsReference).toContain("NF P 06-111-2/A1:2009");
    expect(FRENCH_EUROCODE_ACTION_CATALOG.sources.eurocode0Annex).toContain("afnor.org");
    expect(FRENCH_EUROCODE_ACTION_CATALOG.sources.eurocode1LoadTable).toContain("icab.fr");
  });

  it("retourne les coefficients ψ du tableau national selon l’usage", () => {
    expect(getFrenchPsiFactors("A")).toEqual({ psi0: 0.7, psi1: 0.5, psi2: 0.3 });
    expect(getFrenchPsiFactors("D")).toEqual({ psi0: 0.7, psi1: 0.7, psi2: 0.6 });
    expect(getFrenchPsiFactors("wind")).toEqual({ psi0: 0.6, psi1: 0.2, psi2: 0.0 });
    expect(getFrenchPsiFactors("snow-high-altitude")).toEqual({ psi0: 0.7, psi1: 0.5, psi2: 0.2 });
  });

  it("utilise les charges françaises A/B/D1 au lieu des valeurs de présélection génériques", () => {
    expect(FRENCH_PROJECT_USAGE_CATALOG.habitation.load).toBe(1.5);
    expect(FRENCH_PROJECT_USAGE_CATALOG.habitation.stairLoad).toBe(2.5);
    expect(FRENCH_PROJECT_USAGE_CATALOG.habitation.balconyLoad).toBe(3.5);
    expect(FRENCH_PROJECT_USAGE_CATALOG.bureau.load).toBe(2.5);
    expect(FRENCH_PROJECT_USAGE_CATALOG.commerce.load).toBe(5.0);
    expect(FRENCH_IMPOSED_LOAD_CATALOG["A-floor"].QkKn).toBe(2.0);
    expect(FRENCH_IMPOSED_LOAD_CATALOG["B-floor"].QkKn).toBe(4.0);
    expect(FRENCH_IMPOSED_LOAD_CATALOG.D1.qkKnM2).toBe(5.0);
  });
});
