import { describe, expect, it } from "vitest";
import { EMPTY_PROJECT_GEOTECHNICAL_PROFILE, normalizeProjectGeotechnicalProfile } from "../shared/geotechnical-profile";

describe("project geotechnical profile", () => {
  it("starts with no soil capacity or inferred parameters", () => {
    expect(normalizeProjectGeotechnicalProfile(null)).toEqual(EMPTY_PROJECT_GEOTECHNICAL_PROFILE);
  });

  it("migrates the old provisional 200 kPa default to blank fields", () => {
    const migrated = normalizeProjectGeotechnicalProfile({
      bearingCapacityAdmissibleKPa: 200,
      status: "default_preliminary",
      source: "Hypothèse provisoire — qadm = 200 kPa",
    });
    expect(migrated.bearingCapacityAdmissibleKPa).toBeNull();
    expect(migrated.source).toBe("");
    expect(migrated.status).toBe("not_provided");
  });

  it("preserves entered report values while validating their ranges", () => {
    const profile = normalizeProjectGeotechnicalProfile({
      soilDescription: "Sable limoneux",
      seismicSoilClass: "C",
      bearingCapacityAdmissibleKPa: "185,5",
      frictionAngleDeg: 31,
      cohesionKPa: 0,
      unitWeightKnM3: 19,
      youngModulusKPa: 18000,
      poissonRatio: 0.3,
      foundationDepthM: 1.4,
      groundwaterDepthM: 0,
      allowableSettlementMm: 25,
      source: "Rapport géotechnique G-2026-14",
      reportDate: "2026-09-18",
      reportPage: "42",
    });
    expect(profile).toMatchObject({
      soilDescription: "Sable limoneux",
      seismicSoilClass: "C",
      bearingCapacityAdmissibleKPa: 185.5,
      frictionAngleDeg: 31,
      cohesionKPa: 0,
      unitWeightKnM3: 19,
      youngModulusKPa: 18000,
      poissonRatio: 0.3,
      foundationDepthM: 1.4,
      groundwaterDepthM: 0,
      allowableSettlementMm: 25,
      status: "entered",
      requiresGeotechnicalConfirmation: true,
    });
  });

  it("does not consider a profile confirmed without a report source and positive qadm", () => {
    const profile = normalizeProjectGeotechnicalProfile({ status: "geotechnical_confirmed", bearingCapacityAdmissibleKPa: 150 });
    expect(profile.status).toBe("entered");
    expect(profile.requiresGeotechnicalConfirmation).toBe(true);
  });
});
