import { describe, expect, it } from "vitest";
import { DSRCAD_COUNTRIES } from "../shared/dsrcad";
import { getRegulatorySiteProfile } from "../shared/regulatory";
import { FRENCH_EUROCODE_DEFAULT_STANDARD } from "../shared/french-standard-profile";

describe("profils pays du projet", () => {
  it("exposes the requested countries with Senegal first", () => {
    expect(DSRCAD_COUNTRIES).toEqual(["Sénégal", "Mauritanie", "Mali", "Gambie"]);
  });

  it("keeps one French calculation basis and does not invent site actions for every country", () => {
    for (const country of DSRCAD_COUNTRIES) {
      const profile = getRegulatorySiteProfile(country, "Ville test");
      expect(profile.country).toBe(country);
      expect(profile.preferredNorm).toBe(FRENCH_EUROCODE_DEFAULT_STANDARD);
      expect(profile.rule.code).toContain("NF EN 1990/NA:2011");
      expect(profile.rule.status).toBe("adapted");
      expect(profile.constructionContext).toContain("Béton");
      expect(profile.wind.status).toBe("to-confirm");
    }
    expect(getRegulatorySiteProfile("Gambie").rule.note).toContain("obligations administratives locales");
  });
});
