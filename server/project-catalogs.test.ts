import { describe, expect, it } from "vitest";
import {
  CONCRETE_CLASSES,
  DEFAULT_PROJECT_MATERIALS,
  getCountryProjectStandard,
  getProjectMaterialSummary,
  getProjectStandardId,
  normalizeProjectMaterials,
  PROJECT_COUNTRIES,
  PROJECT_STANDARD_CATALOG,
} from "../shared/project-catalogs";

describe("catalogues des paramètres de projet", () => {
  it("propose une norme issue du profil réglementaire du pays", () => {
    expect(getCountryProjectStandard("Sénégal")).toBe("Eurocode 2");
    expect(getCountryProjectStandard("Gambie")).toBe("BS 8110");
    expect(getCountryProjectStandard("Afrique du Sud")).toBe("SANS 10100");
    expect(getCountryProjectStandard("Égypte")).toBe("ECP · code égyptien (à confirmer)");
    expect(getProjectStandardId("BAEL 91 mod. 99")).toBe("bael-91-99");
  });

  it("expose les référentiels existants et les pays du catalogue réglementaire", () => {
    expect(PROJECT_STANDARD_CATALOG.map(item => item.norm)).toEqual([
      "Eurocode 2", "BAEL 91 mod. 99", "BS 8110", "SANS 10100", "ECP · code égyptien (à confirmer)",
    ]);
    expect(PROJECT_COUNTRIES).toContain("Sénégal");
    expect(PROJECT_COUNTRIES).toContain("Afrique du Sud");
  });

  it("réutilise les classes béton existantes et normalise les projets anciens", () => {
    expect(CONCRETE_CLASSES.map(item => item.concreteClass)).toEqual(["C25/30", "C30/37", "C35/45"]);
    expect(getProjectMaterialSummary(DEFAULT_PROJECT_MATERIALS).concrete.fck).toBe(25);
    expect(getProjectMaterialSummary(DEFAULT_PROJECT_MATERIALS).rebar.fykMpa).toBe(500);
    expect(normalizeProjectMaterials(undefined)).toEqual(DEFAULT_PROJECT_MATERIALS);
    expect(normalizeProjectMaterials({ concreteClass: "missing" }).concreteClass).toBe("C25/30");
  });
});
