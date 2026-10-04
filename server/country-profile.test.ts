import { describe, expect, it } from "vitest";
import { DSRCAD_COUNTRIES } from "../shared/dsrcad";
import { getRegulatorySiteProfile } from "../shared/regulatory";

describe("profils pays du projet", () => {
  it("exposes the requested countries with Senegal first", () => {
    expect(DSRCAD_COUNTRIES).toEqual(["Sénégal", "Mauritanie", "Mali", "Gambie"]);
  });

  it("activates a construction context and proposed norm for every country", () => {
    for (const country of DSRCAD_COUNTRIES) {
      const profile = getRegulatorySiteProfile(country, "Ville test");
      expect(profile.country).toBe(country);
      expect(profile.preferredNorm).toBeTruthy();
      expect(profile.constructionContext).toContain("Béton");
      expect(profile.rule.note.length).toBeGreaterThan(20);
      expect(profile.wind.status).toBe("to-confirm");
    }
    expect(getRegulatorySiteProfile("Gambie").preferredNorm).toBe("BS 8110");
  });
});
