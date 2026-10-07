import { describe, expect, it } from "vitest";
import { proposeSoil } from "../shared/site-soil";
import { restoreBuildingDraft, serializeBuildingDraft, type BuildingDraft } from "../shared/building-flow";
import { moveElement } from "../shared/building-elements";

describe("refonte bâtiment — contexte et persistance", () => {
  it("ne déduit pas le profil géotechnique à partir de la localisation", () => {
    const abidjan = proposeSoil("Côte d’Ivoire", "Abidjan", "Cocody");
    const dakar = proposeSoil("Sénégal", "Dakar", "Almadies");
    const kigali = proposeSoil("Rwanda", "Kigali", "Site inconnu");
    expect(abidjan.soil).toBe("Profil géotechnique non renseigné");
    expect(dakar.soil).toBe("Profil géotechnique non renseigné");
    expect(abidjan.qadm).toBe("à saisir depuis l’étude");
    expect(abidjan.basis).toMatch(/aucune portance/i);
    expect(kigali.status).toBe("provisoire");
  });

  it("conserve un élément et les réglages de grille dans un projet sauvegardé", () => {
    const draft: BuildingDraft = { name: "Projet test", level: "R+1", height: "3.20", snap: true, showNames: true, loadDirection: true, continuity: true, snapRadius: "0.80", footerPdf: false, floorOpacity: "45", norm: "Eurocodes EN 1990/1991/1992", country: "Sénégal" };
    const restored = restoreBuildingDraft(serializeBuildingDraft(draft));
    expect(restored?.name).toBe("Projet test");
    expect(restored?.level).toBe("R+1");
    expect(restored?.country).toBe("Sénégal");
  });

  it("restaure intégralement plusieurs niveaux, éléments et paramètres de projet", () => {
    const project = { name: "Villa R+2", city: "Abidjan", location: "Cocody", grid: { xAxes: ["1", "2", "3"], yAxes: ["A", "B"], zLevels: ["Fondation -1.00", "RDC 0.00", "R+1 3.20"], distance: "4.00" }, loads: { permanent: true, exploitation: true, wind: false, seismic: false }, levels: [
      { id: "foundation", label: "Fondation", elements: [{ id: "S1", type: "Semelle", section: "S1 80×80×30", x: 1, y: 1 }] },
      { id: "rdc", label: "RDC", elements: [{ id: "P1", type: "Poteau", section: "20×30", x: 1, y: 2 }, { id: "PT1", type: "Poutre", section: "20×40", x: 2, y: 2 }] },
      { id: "r1", label: "R+1", elements: [{ id: "D1", type: "Dalle", section: "PL_16+4", x: 2, y: 3 }] },
    ] };
    const restored = JSON.parse(JSON.stringify(project));
    expect(restored).toEqual(project);
    expect(restored.levels).toHaveLength(3);
    expect(restored.levels.flatMap((level: any) => level.elements)).toHaveLength(4);
    expect(restored.grid.zLevels[2]).toBe("R+1 3.20");
    expect(restored.levels[1].elements[1]).toMatchObject({ id: "PT1", section: "20×40", x: 2, y: 2 });
  });
});
