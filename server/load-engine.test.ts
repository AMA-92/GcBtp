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
    selectedCases: { permanent: true, exploitation: true, partitions: true, roof: true, wind: false, seismic: false },
  };

  it("returns transparent intermediate values and a load chain", () => {
    const result = calculateLoadDescent(base);
    expect(result.assumptions.gk).toBeGreaterThan(0);
    expect(result.assumptions.qk).toBeGreaterThan(0);
    expect(result.chain.floor).toBeGreaterThan(0);
    expect(result.chain.foundation).toBeGreaterThan(result.chain.column);
    expect(result.combination).toContain("Gk");
  });

  it("responds to selected wind and seismic cases", () => {
    const without = calculateLoadDescent(base);
    const withActions = calculateLoadDescent({ ...base, selectedCases: { ...base.selectedCases, wind: true, seismic: true } });
    expect(withActions.assumptions.qk).toBe(without.assumptions.qk);
    expect(withActions.components.windDesign + withActions.components.seismicDesign).toBeGreaterThan(0);
    expect(withActions.chain.foundation).toBe(without.chain.foundation);
  });

  it("uses the selected material density", () => {
    const concrete = calculateLoadDescent(base);
    const masonry = calculateLoadDescent({ ...base, material: "maçonnerie" });
    expect(concrete.assumptions.gk).toBeGreaterThan(masonry.assumptions.gk);
  });

  it("changes outputs when country and mapped city context change", () => {
    const abidjan = calculateLoadDescent({ ...base, selectedCases: { ...base.selectedCases, wind: true, seismic: true } });
    const dakar = calculateLoadDescent({ ...base, country: "Sénégal", city: "Dakar", selectedCases: { ...base.selectedCases, wind: true, seismic: true } });
    expect(dakar.context.cityFactor.siteFactor).not.toBe(abidjan.context.cityFactor.siteFactor);
    expect(dakar.components.seismicDesign).not.toBe(abidjan.components.seismicDesign);
  });

  it("builds a dedicated note with assumptions and no generic fields", () => {
    const result = calculateLoadDescent(base);
    const foundation = calculateFoundation({ axialLoad: result.chain.foundation, soil: "argile", foundation: "semelle isolée", safetyFactor: 2.5, depth: 1.2, groundwaterDepth: 3 });
    const note = buildLoadDescentNote(result, foundation);
    expect(note).toContain("Gk :");
    expect(note).toContain("Qk :");
    expect(note).toContain("γG :");
    expect(note).toContain("γQ :");
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

  it("changes permanent actions when the structural system changes", () => {
    const concrete = calculateLoadDescent(base);
    const masonry = calculateLoadDescent({ ...base, structure: "Maçonnerie porteuse", material: "maçonnerie" });
    expect(masonry.context.structureFactor).toBeGreaterThan(concrete.context.structureFactor);
    expect(masonry.chain.foundation).not.toBe(concrete.chain.foundation);
  });


  it("intègre le poids propre et la charge d’exploitation d’un escalier", () => {
    const withoutStairs = calculateLoadDescent(base);
    const withStairs = calculateLoadDescent({
      ...base,
      stairs: { flights: 2, width: 1.2, horizontalRun: 3, rise: 2, slabThickness: 0.15, finishLoad: 1, imposedLoad: 3 },
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
      reference: { code: "EN 1990/1991", status: "à confirmer", source: "Annexe nationale à renseigner" },
    });
    expect(result.context.location.altitude).toBe(420);
    expect(result.context.soil.allowableBearing).toBe(220);
    expect(result.context.reference.source).toContain("Annexe");
  });
});
