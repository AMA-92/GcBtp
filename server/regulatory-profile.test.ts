import { describe, expect, it } from "vitest";
import { getRegulatorySiteProfile } from "../shared/regulatory";
import { DEFAULT_PROJECT_STANDARD } from "../shared/french-standard-profile";

describe("regulatory site profiles", () => {
  it("uses the French calculation basis in South Africa and keeps local site actions unconfirmed", () => {
    const profile = getRegulatorySiteProfile("Afrique du Sud", "Cape Town");
    expect(profile.preferredNorm).toBe(DEFAULT_PROJECT_STANDARD);
    expect(profile.rule.code).toContain("NF EN 1990/NA:2011");
    expect(profile.rule.note).toContain("Par choix du projet");
    expect(profile.rule.code).not.toContain("SANS");
    expect(profile.provenance.source).toContain("afnor.org");
    expect(profile.wind.zone).toContain("Référentiel français sélectionné");
    expect(profile.wind.status).toBe("to-confirm");
  });

  it("keeps the French reference editions marked for confirmation", () => {
    const profile = getRegulatorySiteProfile("France");
    expect(profile.preferredNorm).toBe(DEFAULT_PROJECT_STANDARD);
    expect(profile.rule.status).toBe("to-confirm");
    expect(profile.rule.note).toContain("Référentiel français de calcul");
  });

  it("does not invent local zones for an unconfirmed country or city", () => {
    const profile = getRegulatorySiteProfile("Gabon", "Ville non cataloguée");
    expect(profile.wind.zone).toContain("Référentiel français sélectionné");
    expect(profile.seismic.status).toBe("to-confirm");
    expect(profile.warnings.length).toBeGreaterThan(0);
    expect(profile.provenance.authority.toLocaleLowerCase("fr")).toContain("confirmer");
  });
});
