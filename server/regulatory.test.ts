import { describe, expect, it } from "vitest";
import { AFRICAN_COUNTRIES, getRegulatoryRule } from "../shared/regulatory";
import { FRENCH_EUROCODE_DEFAULT_STANDARD } from "../shared/french-standard-profile";

describe("GcBtp regulatory catalogue", () => {
  it("contains the 54 African countries without duplicate entries", () => {
    expect(AFRICAN_COUNTRIES).toHaveLength(54);
    expect(new Set(AFRICAN_COUNTRIES).size).toBe(54);
  });

  it("applies the French calculation reference to every African-country profile", () => {
    for (const country of AFRICAN_COUNTRIES) {
      const rule = getRegulatoryRule(country);
      expect(rule.code).toContain("NF EN 1990/NA:2011");
      expect(rule.status).toBe("adapted");
    }
    expect(getRegulatoryRule("Afrique du Sud").code).not.toContain("SANS");
    expect(getRegulatoryRule("Gambie").code).not.toContain("BS 8110");
    expect(FRENCH_EUROCODE_DEFAULT_STANDARD).toBe("Eurocode 2 — France");
  });

  it("keeps the French calculation default for unknown countries while warning about local obligations", () => {
    const rule = getRegulatoryRule("Pays non répertorié");
    expect(rule.code).toContain("NF EN 1990/NA:2011");
    expect(rule.note).toContain("obligations administratives locales");
  });
});

import { evaluateSenegalConstructionCode } from "../shared/senegal-construction-code";

describe("Code de la Construction Sénégal 2023-21", () => {
  it("classe RDC+3 comme soumis au contrôle technique obligatoire", () => {
    const result = evaluateSenegalConstructionCode({ country: "Sénégal", buildingFloorsAboveGround: 3, use: "habitation", technicalControlContract: true, geotechnicalStudyAvailable: true, excavationOpeningAuthorization: true });
    expect(result.checks.find(c => c.id === "technical-control")?.status).toBe("conforme");
  });
  it("bloque un projet assujetti sans contrôle technique", () => {
    const result = evaluateSenegalConstructionCode({ country: "Sénégal", buildingFloorsAboveGround: 3, use: "habitation" });
    expect(result.blockers.length).toBeGreaterThan(0);
  });
});

import { checkMitoyennete } from "../shared/mitoyennete";
describe("mitoyenneté Sénégal", () => {
  it("bloque une construction sur ligne séparative sans accord", () => {
    const result = checkMitoyennete({ country: "Sénégal", wallOnSeparativeLine: true, writtenNeighbourAgreement: false, isHousingProgram: false, wallIsCommon: false, hasOpeningInCommonWall: false, directViewToNeighbour: false });
    expect(result.blockers.length).toBe(1);
  });
  it("bloque une vue directe à moins d’un mètre", () => {
    const result = checkMitoyennete({ country: "Sénégal", wallOnSeparativeLine: false, writtenNeighbourAgreement: false, isHousingProgram: false, wallIsCommon: false, hasOpeningInCommonWall: false, directViewToNeighbour: true, openingDistanceToBoundaryM: 0.8 });
    expect(result.blockers.length).toBe(1);
  });
});
