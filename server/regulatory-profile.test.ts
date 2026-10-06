import { describe, expect, it } from "vitest";
import { getRegulatorySiteProfile } from "../shared/regulatory";
import { FRENCH_EUROCODE_DEFAULT_STANDARD } from "../shared/french-standard-profile";

describe("regulatory site profiles", () => {
  it("applies the French calculation basis but leaves South African site actions unconfirmed", () => {
    const profile = getRegulatorySiteProfile("Afrique du Sud", "Cape Town");
    expect(profile.preferredNorm).toBe(FRENCH_EUROCODE_DEFAULT_STANDARD);
    expect(profile.rule.code).toContain("NF EN 1990/NA:2011");
    expect(profile.rule.code).not.toContain("SANS");
    expect(profile.provenance.source).toContain("afnor.org");
    expect(profile.wind.zone).toContain("NF EN 1991-1-4/NA");
    expect(profile.wind.status).toBe("to-confirm");
  });

  it("does not invent local zones for an unconfirmed country or city", () => {
    const profile = getRegulatorySiteProfile("Gabon", "Ville non cataloguée");
    expect(profile.wind.zone).toContain("NF EN 1991-1-4/NA");
    expect(profile.seismic.status).toBe("to-confirm");
    expect(profile.warnings.length).toBeGreaterThan(0);
    expect(profile.provenance.authority).toContain("confirmer");
  });
});
