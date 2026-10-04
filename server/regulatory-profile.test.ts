import { describe, expect, it } from "vitest";
import { getRegulatorySiteProfile } from "../shared/regulatory";

describe("regulatory site profiles", () => {
  it("keeps South African wind provenance explicit", () => {
    const profile = getRegulatorySiteProfile("Afrique du Sud", "Cape Town");
    expect(profile.wind.zone).toContain("SANS 10160-3");
    expect(profile.provenance.source).toContain("scielo.org.za");
    expect(profile.wind.status).toBe("to-confirm");
  });

  it("does not invent local zones for an unconfirmed country", () => {
    const profile = getRegulatorySiteProfile("Gabon", "Libreville");
    expect(profile.wind.zone).toBeUndefined();
    expect(profile.seismic.status).toBe("to-confirm");
    expect(profile.warnings.length).toBeGreaterThan(0);
    expect(profile.provenance.authority).toContain("confirmer");
  });
});
