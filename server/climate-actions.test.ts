import { describe, expect, it } from "vitest";
import { deriveStoryMassesFromCumulativeLoads, generateClimateActions, parseClimateSpectrum, type ClimateActionInput } from "@shared/climate-actions";

const fixture = (): ClimateActionInput => ({
  metadata: { country: "Test", city: "Testville", location: "QA", altitudeM: 100, terrainCategory: "III", seismicZone: "Z2", soilClass: "C", importanceClass: "II", designLifeYears: 50 },
  geometry: { storyHeightsM: [3, 3], projectedWidthXM: 10, projectedWidthYM: 8, roofAreaM2: 80, storyMassTonnes: [100, 80] },
  wind: { basicSpeedMPerS: 30, exposureFactor: 1, orographyFactor: 1, topographyFactor: 1, netPressureCoefficientX: 1.2, netPressureCoefficientY: 0.8, airDensityKgM3: 1.225 },
  snow: { groundLoadKnM2: 1, shapeCoefficient: 0.8, exposureCoefficient: 1, thermalCoefficient: 1, asymmetryRatio: 0.25 },
  seismic: { referenceAccelerationG: 0.15, importanceFactor: 1, behaviourFactor: 1, dampingFactor: 1, spectrum: [{ periodS: 0, accelerationG: 0.4 }, { periodS: 10, accelerationG: 0.2 }], storyStiffnessKnPerM: [30_000, 20_000] },
});

describe("priority 5 — climate actions, mass source and seismic story response", () => {
  it("parses a documented response spectrum and blocks malformed rows", () => {
    expect(parseClimateSpectrum("0;0.4\n0,5;0,8\n2;0.2").points).toEqual([
      { periodS: 0, accelerationG: 0.4 }, { periodS: 0.5, accelerationG: 0.8 }, { periodS: 2, accelerationG: 0.2 },
    ]);
    expect(parseClimateSpectrum("0;0.4\n0;0.3\n-1;0.2").errors.length).toBeGreaterThan(0);
    expect(parseClimateSpectrum("0;0.4\n1").errors.some(message => message.includes("deux nombres"))).toBe(true);
  });

  it("differences bottom-to-top cumulative G/Q support totals so upper stories are not counted twice", () => {
    const result = deriveStoryMassesFromCumulativeLoads([
      { id: "RDC", totalGk: 180, totalQk: 60 },
      { id: "R+1", totalGk: 120, totalQk: 40 },
      { id: "Toiture", totalGk: 40, totalQk: 10 },
    ], 1, 0.5, 10);
    expect(result.errors).toEqual([]);
    expect(result.massesTonnes).toEqual([7, 9.5, 4.5]);
    expect(result.totalTonnes).toBe(21);
  });

  it("blocks story mass distribution when cumulative loads increase upward", () => {
    const result = deriveStoryMassesFromCumulativeLoads([
      { id: "RDC", totalGk: 100, totalQk: 20 },
      { id: "R+1", totalGk: 120, totalQk: 25 },
    ], 1, 0.5);
    expect(result.errors.some(message => message.includes("augmentent en montant"))).toBe(true);
  });

  it("generates distinct X/Y wind loads per story and equal opposite-sign cases", () => {
    const result = generateClimateActions(fixture());
    expect(result.wind.errors).toEqual([]);
    expect(result.wind.stories).toHaveLength(2);
    expect(result.wind.referencePressureKnM2).toBeCloseTo(0.55125);
    expect(result.wind.totalsKn.xPlus).toBeCloseTo(31.752);
    expect(result.wind.totalsKn.yPlus).toBeCloseTo(26.46);
    expect(result.wind.totalsKn.xMinus).toBe(result.wind.totalsKn.xPlus);
    expect(result.wind.totalsKn.yMinus).toBe(result.wind.totalsKn.yPlus);
  });

  it("blocks wind when speed, terrain factors, or direction coefficients are missing", () => {
    const input = fixture();
    input.wind.basicSpeedMPerS = null;
    input.wind.netPressureCoefficientY = null;
    const result = generateClimateActions(input);
    expect(result.wind.errors.join(" ")).toContain("Vitesse de vent");
    expect(result.wind.errors.join(" ")).toContain("Coefficients nets");
    expect(result.wind.stories).toEqual([]);
  });

  it("applies snow only to the actual roof area and conserves load in asymmetric halves", () => {
    const result = generateClimateActions(fixture());
    expect(result.snow.errors).toEqual([]);
    expect(result.snow.roofPressureKnM2).toBeCloseTo(0.8);
    expect(result.snow.totalKn).toBeCloseTo(64);
    expect(result.snow.asymmetricX.highHalfKn + result.snow.asymmetricX.lowHalfKn).toBeCloseTo(64);
    expect(result.snow.asymmetricY.highHalfKn + result.snow.asymmetricY.lowHalfKn).toBeCloseTo(64);
  });

  it("requires the entered snow ground action and never silently treats missing snow as zero", () => {
    const input = fixture();
    input.snow.groundLoadKnM2 = null;
    const result = generateClimateActions(input);
    expect(result.snow.errors.join(" ")).toContain("Charge de neige au sol requise");
    expect(result.snow.totalKn).toBe(0);
  });

  it("uses the documented story masses to compute modes, cumulative participation, SRSS base shear, and interstory drifts", () => {
    const result = generateClimateActions(fixture());
    expect(result.seismic.errors).toEqual([]);
    expect(result.seismic.totalMassTonnes).toBe(180);
    expect(result.seismic.modes).toHaveLength(2);
    expect(result.seismic.modes[0].periodS).toBeLessThan(result.seismic.modes[1].periodS);
    expect(result.seismic.modes[1].cumulativeMassParticipation).toBeCloseTo(1, 5);
    expect(result.seismic.baseShearKn).toBeGreaterThan(0);
    expect(result.seismic.stories.every(story => story.interstoryDriftM > 0 && story.driftRatio > 0)).toBe(true);
    expect(result.seismic.stories[0].storyShearKn).toBeGreaterThan(result.seismic.stories[1].storyShearKn);
  });

  it("blocks modal and drift results when mass, stiffness, or spectrum coverage is incomplete", () => {
    const input = fixture();
    input.geometry.storyMassTonnes = [180];
    input.seismic.storyStiffnessKnPerM = [30_000];
    input.seismic.spectrum = [{ periodS: 0, accelerationG: 0.4 }, { periodS: 0.01, accelerationG: 0.2 }];
    const result = generateClimateActions(input);
    expect(result.seismic.errors.some(message => message.includes("masse sismique par étage"))).toBe(true);
    expect(result.seismic.errors.some(message => message.includes("raideur latérale"))).toBe(true);
  });

  it("blocks extrapolation when a valid spectrum does not cover a natural period", () => {
    const input = fixture();
    input.seismic.spectrum = [{ periodS: 0, accelerationG: 0.4 }, { periodS: 0.01, accelerationG: 0.2 }];
    const result = generateClimateActions(input);
    expect(result.seismic.errors.some(message => message.includes("ne couvre pas T="))).toBe(true);
  });

  it("scales calculated base shear linearly with a documented importance factor", () => {
    const base = generateClimateActions(fixture()).seismic.baseShearKn;
    const input = fixture();
    input.seismic.importanceFactor = 1.5;
    const elevated = generateClimateActions(input).seismic.baseShearKn;
    expect(elevated / base).toBeCloseTo(1.5);
  });

  it("does not silently change the user spectrum when site soil metadata changes", () => {
    const first = generateClimateActions(fixture());
    const changed = fixture();
    changed.metadata.soilClass = "D";
    const second = generateClimateActions(changed);
    expect(second.seismic.modes.map(item => item.periodS)).toEqual(first.seismic.modes.map(item => item.periodS));
    expect(second.seismic.stories.map(item => item.driftRatio)).toEqual(first.seismic.stories.map(item => item.driftRatio));
  });
});
