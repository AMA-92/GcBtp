import { describe, expect, it } from "vitest";
import { AFRICAN_COUNTRIES, getRegulatoryRule } from "../shared/regulatory";

describe("GcBtp regulatory catalogue", () => {
  it("contains the 54 African countries without duplicate entries", () => {
    expect(AFRICAN_COUNTRIES).toHaveLength(54);
    expect(new Set(AFRICAN_COUNTRIES).size).toBe(54);
  });

  it("proposes a South African national reference", () => {
    const rule = getRegulatoryRule("Afrique du Sud");
    expect(rule.code).toContain("SANS 10160");
    expect(rule.status).toBe("national");
  });

  it("keeps unconfirmed countries explicitly marked for local validation", () => {
    const rule = getRegulatoryRule("Gabon");
    expect(rule.status).toBe("to-confirm");
    expect(rule.note).toContain("validation");
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
    const r = checkMitoyennete({country:"Sénégal",wallOnSeparativeLine:true,writtenNeighbourAgreement:false,isHousingProgram:false,wallIsCommon:false,hasOpeningInCommonWall:false,directViewToNeighbour:false});
    expect(r.blockers.length).toBe(1);
  });
  it("bloque une vue directe à moins d'un mètre", () => {
    const r = checkMitoyennete({country:"Sénégal",wallOnSeparativeLine:false,writtenNeighbourAgreement:false,isHousingProgram:false,wallIsCommon:false,hasOpeningInCommonWall:false,directViewToNeighbour:true,openingDistanceToBoundaryM:.8});
    expect(r.blockers.length).toBe(1);
  });
});
