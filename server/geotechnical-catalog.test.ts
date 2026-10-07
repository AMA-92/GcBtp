import { describe, expect, it } from "vitest";
import { copyCatalogToProject, DEFAULT_GEOTECHNICAL_CATALOG_ID, GEOTECHNICAL_CATALOG, getGeotechnicalCatalogProfile, getGeotechnicalCatalogProfiles } from "../shared/geotechnical-catalog";

describe("catalogue géotechnique multi-pays", () => {
  it("fournit le profil Sénégal de Dakar par défaut", () => {
    const dakar = getGeotechnicalCatalogProfile(DEFAULT_GEOTECHNICAL_CATALOG_ID);
    expect(dakar.country).toBe("Sénégal");
    expect(dakar.city).toBe("Dakar");
    expect(dakar.bearingCapacityAdmissibleKPa).toBe(200);
    expect(dakar.frictionAngleDeg).toBe(30);
    expect(dakar.unitWeightKnM3).toBe(18);
    expect(dakar.confidence).toBe("moyenne");
  });

  it("contient des profils Sénégal, Mauritanie et autres pays", () => {
    expect(getGeotechnicalCatalogProfiles("Sénégal").length).toBeGreaterThanOrEqual(3);
    expect(getGeotechnicalCatalogProfiles("Mauritanie").length).toBeGreaterThan(0);
    expect(new Set(GEOTECHNICAL_CATALOG.map(item => item.country)).size).toBeGreaterThanOrEqual(5);
  });

  it("copie le catalogue dans un projet sans muter la fiche originale", () => {
    const original = getGeotechnicalCatalogProfile(DEFAULT_GEOTECHNICAL_CATALOG_ID);
    const project = copyCatalogToProject(original);
    project.bearingCapacityAdmissibleKPa = 150;
    project.sourceStatus = "modified";
    expect(original.bearingCapacityAdmissibleKPa).toBe(200);
    expect(project.catalogProfileId).toBe(original.id);
    expect(project.sourceStatus).toBe("modified");
  });
});
