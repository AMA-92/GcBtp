import { describe, expect, it } from "vitest";
import { FLOOR_PRESETS, defaultBalconyFloorConfig, defaultFloorConfig, normalizeFloorConfig, restoreFloorConfig, serializeFloorConfig } from "../shared/floor-config";
import { floorNoteSummary, validateFloorConfig } from "../shared/floor-validation";
import { summarizeFloorLoads } from "../shared/floor-load";
import { elementLoadSummary } from "../shared/element-loads";
import { buildLoadDescentReport } from "../shared/load-report";
import { IMPOSED_LOAD_PROFILES } from "../shared/load-catalog";

describe("configuration des planchers", () => {
  it("propose les variantes corps creux et dalle pleine", () => {
    expect(FLOOR_PRESETS["Corps creux"]).toContain("16+4 cm");
    expect(FLOOR_PRESETS["Dalle pleine"]).toContain("20 cm");
  });

  it("conserve les paramètres spécifiques des corps creux", () => {
    const config = normalizeFloorConfig({ type: "Corps creux", thickness: "20+5 cm", hollowBlockHeight: "20", compressionSlab: "5", ribWidth: "12", span: "5.50" });
    expect(config).toMatchObject({ type: "Corps creux", thickness: "20+5 cm", hollowBlockHeight: "20", compressionSlab: "5", ribWidth: "12", span: "5.50" });
  });

  it("conserve une dalle pleine avec épaisseur personnalisée", () => {
    const config = normalizeFloorConfig({ type: "Dalle pleine", thickness: "22 cm", span: "5.50", direction: "Y" });
    expect(config).toMatchObject({ type: "Dalle pleine", thickness: "22 cm", span: "5.50", direction: "Y" });
  });

  it("restaure floorConfig depuis une chaîne de session", () => {
    const saved = normalizeFloorConfig({ type: "Corps creux", thickness: "25+5 cm", compressionSlab: "5", span: "6.00" });
    const restored = restoreFloorConfig(serializeFloorConfig(saved));
    expect(restored).toEqual(saved);
  });

  it("rejette une épaisseur personnalisée vide ou hors bornes", () => {
    const invalid = normalizeFloorConfig({ type: "Dalle pleine", thickness: "", span: "5" });
    expect(validateFloorConfig(invalid).length).toBeGreaterThan(0);
    const tooLarge = normalizeFloorConfig({ type: "Dalle pleine", thickness: "80 cm", span: "5" });
    expect(validateFloorConfig(tooLarge).some(error => error.includes("3 et 60"))).toBe(true);
    expect(validateFloorConfig(normalizeFloorConfig({ type: "Corps creux", ribWidth: "12", ribSpacing: "10" })).some(error => error.includes("entraxe des nervures"))).toBe(true);
  });

  it("produit un résumé traçable pour la note", () => {
    const config = normalizeFloorConfig({ type: "Dalle pleine", thickness: "22 cm", span: "5.50", direction: "Y" });
    expect(floorNoteSummary(config)).toContain("Dalle pleine 22 cm");
    expect(floorNoteSummary(config)).toContain("portée 5.50 m suivant Y");
  });

  it("relie une dalle à sa portée et à la charge de calcul", () => {
    const config = normalizeFloorConfig({ type: "Dalle pleine", thickness: "20 cm", span: "5.50" });
    const loads = summarizeFloorLoads([{ type: "Dalle", section: "Dalle pleine 20 cm", x: 0, y: 0, x2: 2, y2: 1, floorConfig: config }], "4", config);
    expect(loads.slabCount).toBe(1);
    expect(loads.maxSpan).toBe(5.5);
    expect(loads.designLoad).toBeGreaterThan(loads.permanent);
  });

  it("compte la surface et les charges d’un balcon dans le bilan des planchers", () => {
    const config = defaultBalconyFloorConfig();
    const loads = summarizeFloorLoads([{ type: "Balcon", section: "Balcon BA 20 cm", x: 0, y: 0, x2: 2, y2: 1 }], "4", defaultFloorConfig);
    const catalogLoad = IMPOSED_LOAD_PROFILES.find(profile => profile.id === "balcony")!.defaultValue;
    expect(config).toMatchObject({ type: "Dalle pleine", characteristicPermanentLoad: "6.00", characteristicImposedLoad: catalogLoad.toFixed(2) });
    expect(loads).toMatchObject({ slabCount: 0, balconyCount: 1, floorCount: 1, surface: 32, permanent: 192, live: 112 });
  });

  it("calcule un détail de charge pour chaque famille d’élément", () => {
    const config = normalizeFloorConfig({ type: "Dalle pleine", thickness: "20 cm", span: "5.50" });
    expect(elementLoadSummary({ type: "Poteau", section: "Pot_20×30" }, "4", config).design).toBeCloseTo(2.025);
    expect(elementLoadSummary({ type: "Poutre", section: "Poutre_20×40", x: 0, y: 0, x2: 1, y2: 0 }, "4", config).gk).toBeCloseTo(8);
    expect(elementLoadSummary({ type: "Poutre", section: "Poutre_20×40", x: 0, y: 0, x2: 1, y2: 0 }, "4", config).label).toContain("Poids propre");
    expect(elementLoadSummary({ type: "Dalle", section: "Dalle pleine 20 cm", x: 0, y: 0, x2: 2, y2: 1, floorConfig: config }, "4", config).gk).toBeGreaterThan(0);
  });

  it("génère un contenu de rapport PDF détaillé", () => {
    const config = normalizeFloorConfig({ type: "Dalle pleine", thickness: "20 cm", span: "5.50" });
    const report = buildLoadDescentReport({ projectName: "Villa Abidjan", levelLabel: "RDC", country: "Côte d’Ivoire", city: "Abidjan", location: "Cocody", structure: "Béton armé", norm: "Eurocode 2", gridDistance: "4", elements: [{ id: "D1", type: "Dalle", section: "Dalle pleine 20 cm", x: 0, y: 0, x2: 2, y2: 1, floorConfig: config }], floorConfig: config });
    expect(report).toContain("Villa Abidjan");
    expect(report).toContain("Gk");
    expect(report).toContain("Qk");
    expect(report).toContain("ELU");
    expect(report).toContain("ingénieur habilité");
  });

  it("restaure les valeurs par défaut lorsqu’une configuration est partielle", () => {
    const restored = normalizeFloorConfig({ type: "Corps creux", hollowBlockHeight: "20" });
    expect(restored.type).toBe("Corps creux");
    expect(restored.hollowBlockHeight).toBe("20");
    expect(restored.thickness).toBe(defaultFloorConfig.thickness);
    expect(restored.concreteClass).toBe("C25/30");
  });
});
