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
import { FRENCH_EUROCODE_DEFAULT_STANDARD, normalizeProjectStandard } from "../shared/french-standard-profile";

describe("catalogues des paramètres de projet", () => {
  it("applique le profil Eurocodes français quel que soit le pays ou la ville", () => {
    for (const country of PROJECT_COUNTRIES) {
      expect(getCountryProjectStandard(country, "Ville test")).toBe(FRENCH_EUROCODE_DEFAULT_STANDARD);
    }
    expect(getCountryProjectStandard("Sénégal", "Dakar")).toBe(FRENCH_EUROCODE_DEFAULT_STANDARD);
    expect(normalizeProjectStandard("BS 8110")).toBe(FRENCH_EUROCODE_DEFAULT_STANDARD);
    expect(normalizeProjectStandard("SANS 10100")).toBe(FRENCH_EUROCODE_DEFAULT_STANDARD);
    expect(normalizeProjectStandard("BAEL 91 mod. 99")).toBe("BAEL 91 mod. 99");
    expect(getProjectStandardId("BAEL 91 mod. 99")).toBe("bael-91-99");
  });

  it("n’expose que les deux choix français de calcul du projet", () => {
    expect(PROJECT_STANDARD_CATALOG.map(item => item.norm)).toEqual([
      FRENCH_EUROCODE_DEFAULT_STANDARD, "BAEL 91 mod. 99",
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
