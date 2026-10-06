import { describe, expect, it } from "vitest";
import { getCityClimateProfile } from "../shared/city-climate";

describe("city climate lookup", () => {
  it("matches a catalogued city without regard to case", () => {
    expect(getCityClimateProfile("Sénégal", "dAkAr")?.city).toBe("Dakar");
  });

  it("does not transfer another city's climate to an unknown project location", () => {
    expect(getCityClimateProfile("Sénégal", "Mbour")).toBeUndefined();
  });

  it("does not assign a city climate when no location was provided", () => {
    expect(getCityClimateProfile("Sénégal")).toBeUndefined();
  });

  it("keeps the snow action unconfirmed until site data are supplied", () => {
    expect(getCityClimateProfile("Sénégal", "Dakar")?.snow.status).toBe("to-confirm");
  });
});
