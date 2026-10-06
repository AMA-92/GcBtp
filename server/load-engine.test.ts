import { describe, expect, it } from "vitest";
import { buildLoadDescentNote, calculateLoadDescent } from "../shared/load-engine";
import { calculateFoundation } from "../shared/foundation-engine";

describe("load descent engine", () => {
  const base = {
    country: "Côte d’Ivoire",
    city: "Abidjan",
    structure: "Béton armé — bâtiment courant",
    material: "béton armé" as const,
    levels: 3,
    tributaryArea: 20,
    slabThickness: 0.15,
    selectedCases: { permanent: true, exploitation: true, partitions: true, roof: true, wind: false, snow: false, seismic: false },
  };

  it("returns transparent intermediate values and a load chain", () => {
    const result = calculateLoadDescent(base);
    expect(result.assumptions.gk).toBeGreaterThan(0);
    expect(result.assumptions.qk).toBeGreaterThan(0);
    expect(result.chain.floor).toBeGreaterThan(0);
    expect(result.chain.foundation).toBeGreaterThan(result.chain.column);
    expect(result.combination).toContain("Gk");
    expect(result.assumptions.usageCategory).toBe("A");
  });

  it("uses explicit site actions and reports zero when they are missing", () => {
    const selected = { ...base.selectedCases, wind: true, seismic: true };
    const withoutSiteData = calculateLoadDescent({ ...base, selectedCases: selected });
    expect(withoutSiteData.components.wind).toBe(0);
    expect(withoutSiteData.components.seismic).toBe(0);
    expect(withoutSiteData.warnings.some(warning => warning.includes("pression de site confirmée"))).toBe(true);
    const withSiteData = calculateLoadDescent({ ...base, selectedCases: selected, actions: { windPressure: 1.2, seismicCoefficient: 0.25 } });
    expect(withSiteData.components.wind).toBeGreaterThan(0);
    expect(withSiteData.components.seismic).toBeGreaterThan(0);
    expect(withSiteData.components.windDesign).toBeGreaterThan(0);
    expect(withSiteData.components.seismicDesign).toBeGreaterThan(0);
  });

  it("uses the French category and partial-factor catalog", () => {
    const housing = calculateLoadDescent(base);
    const office = calculateLoadDescent({ ...base, usage: "bureau" });
    expect(housing.assumptions.qkFloorKnM2).toBe(1.5);
    expect(office.assumptions.qkFloorKnM2).toBe(2.5);
    expect(office.assumptions.usageCategory).toBe("B");
    expect(housing.assumptions.gammaG).toBe(1.35);
    expect(housing.assumptions.gammaQ).toBe(1.5);
    expect(office.assumptions.psi0).toBe(housing.assumptions.psi0);
    expect(office.assumptions.qk).toBeGreaterThan(housing.assumptions.qk);
  });

  it("does not infer climate action factors from a country or city name", () => {
    const active = { ...base.selectedCases, wind: true, seismic: true };
    const abidjan = calculateLoadDescent({ ...base, selectedCases: active });
    const dakar = calculateLoadDescent({ ...base, country: "Sénégal", city: "Dakar", selectedCases: active });
    expect(dakar.components.wind).toBe(abidjan.components.wind);
    expect(dakar.components.seismic).toBe(abidjan.components.seismic);
    expect(dakar.context.city).toBe("Dakar");
    expect(dakar.context.country).toBe("Sénégal");
  });

  it("uses the selected material density", () => {
    const concrete = calculateLoadDescent(base);
    const masonry = calculateLoadDescent({ ...base, material: "maçonnerie" });
    expect(concrete.assumptions.gk).toBeGreaterThan(masonry.assumptions.gk);
  });

  it("builds a dedicated pre-study note with assumptions and no generic fields", () => {
    const result = calculateLoadDescent(base);
    const foundation = calculateFoundation({ axialLoad: result.chain.foundation, soil: "argile", foundation: "semelle isolée", safetyFactor: 2.5, depth: 1.2, groundwaterDepth: 3 });
    const note = buildLoadDescentNote(result, foundation);
    expect(note).toContain("Gk :");
    expect(note).toContain("Qk :");
    expect(note).toContain("ψ0/ψ1/ψ2");
    expect(note).toContain("NF EN 1990/NA:2011");
    expect(note).toContain("pré-étude non certifiée");
    expect(note).toContain("Surface tributaire :");
    expect(note).toContain("Épaisseur dalle :");
    expect(note).toContain("Matériau :");
    expect(note).toContain("Sol :");
    expect(note).toContain("Fondation :");
    expect(note).toContain("Pression moyenne :");
    expect(note).not.toContain("Volume :");
    expect(note).not.toContain("Moment :");
    expect(note).not.toContain("Acier indicatif");
  });

  it("changes permanent actions when the selected material changes, without a hidden system multiplier", () => {
    const concrete = calculateLoadDescent(base);
    const masonry = calculateLoadDescent({ ...base, structure: "Maçonnerie porteuse", material: "maçonnerie" });
    expect(masonry.context.structureFactor).toBe(1);
    expect(masonry.assumptions.gk).toBeLessThan(concrete.assumptions.gk);
    expect(masonry.chain.foundation).not.toBe(concrete.chain.foundation);
  });

  it("intègre le poids propre et la charge d’exploitation d’un escalier", () => {
    const withoutStairs = calculateLoadDescent(base);
    const withStairs = calculateLoadDescent({
      ...base,
      stairs: { flights: 2, width: 1.2, horizontalRun: 3, rise: 2, slabThickness: 0.15, finishLoad: 1 },
    });
    expect(withStairs.assumptions.stairArea).toBeGreaterThan(0);
    expect(withStairs.assumptions.stairsPermanent).toBeGreaterThan(0);
    expect(withStairs.assumptions.stairsExploitation).toBeGreaterThan(0);
    expect(withStairs.chain.foundation).toBeGreaterThan(withoutStairs.chain.foundation);
  });

  it("calcule la paillasse inclinée et les marches selon la projection horizontale", () => {
    const result = calculateLoadDescent({
      ...base,
      stairs: { flights: 1, width: 1.2, horizontalRun: 1, rise: 0.17 / 0.30, slabThickness: 0.15, stepHeight: 0.17, tread: 0.30, imposedLoad: 2.5 },
    });
    expect(result.assumptions.stairsPermanent / result.assumptions.stairArea).toBeCloseTo(6.43, 1);
  });

  it("applique une charge de neige explicite seulement lorsque le cas est activé", () => {
    const inactive = calculateLoadDescent({ ...base, actions: { snowPressure: 1.2 } });
    const active = calculateLoadDescent({ ...base, selectedCases: { ...base.selectedCases, snow: true }, actions: { snowPressure: 1.2 } });
    expect(active.assumptions.snow).toBeCloseTo(24);
    expect(active.components.snowDesign).toBeGreaterThan(0);
    expect(active.chain.foundation).toBe(inactive.chain.foundation);
  });

  it("conserve la traçabilité du site, du sol et du référentiel", () => {
    const result = calculateLoadDescent({
      ...base,
      location: { altitude: 420, zone: "Côte" },
      soil: { profile: "sable dense", allowableBearing: 220, foundationDepth: 1.5, groundwaterDepth: 8, seismicClass: "C" },
      reference: { code: "NF EN 1990/NA:2011", status: "adapted", source: "Annexe nationale française" },
    });
    expect(result.context.location.altitude).toBe(420);
    expect(result.context.soil.allowableBearing).toBe(220);
    expect(result.context.reference.source).toContain("Annexe");
  });
});
