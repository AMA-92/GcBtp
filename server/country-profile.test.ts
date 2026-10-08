import { describe, expect, it } from "vitest";
import { DSRCAD_COUNTRIES } from "../shared/dsrcad";
import { getRegulatorySiteProfile } from "../shared/regulatory";
import { DEFAULT_PROJECT_STANDARD } from "../shared/french-standard-profile";

describe("profils pays du projet", () => {
  it("exposes the requested countries with Senegal first", () => {
    expect(DSRCAD_COUNTRIES).toEqual(["Sénégal", "Mauritanie", "Mali", "Gambie"]);
  });

  it("uses the French reference basis for West African projects without claiming local-code status", () => {
    for (const country of DSRCAD_COUNTRIES) {
      const profile = getRegulatorySiteProfile(country, "Ville test");
      expect(profile.country).toBe(country);
      expect(profile.preferredNorm).toBe(DEFAULT_PROJECT_STANDARD);
      expect(profile.rule.code).toContain("NF EN 1990/NA:2011");
      expect(profile.rule.status).toBe("to-confirm");
      expect(profile.rule.note).toContain("Par choix du projet");
      expect(profile.warnings[0]).toContain("utilisé par choix du projet");
      expect(profile.constructionContext).toContain("Béton");
      expect(profile.wind.status).toBe("to-confirm");
    }
    expect(getRegulatorySiteProfile("Gambie").rule.note).toContain("ne signifie pas que ces textes sont les normes nationales");
    expect(getRegulatorySiteProfile("France").preferredNorm).toBe(DEFAULT_PROJECT_STANDARD);
  });
});
