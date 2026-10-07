import type { ProjectGeotechnicalProfile } from "./geotechnical-profile";

export type GeotechnicalCatalogProfile = Omit<ProjectGeotechnicalProfile, "status" | "requiresGeotechnicalConfirmation"> & {
  id: string;
  country: string;
  region: string;
  department: string;
  city: string;
  locality: string;
  geologicalZone: string;
  profileName: string;
  soilType: string;
  source: string;
  confidence: "moyenne" | "faible";
  indicative: true;
};

type CatalogProfileInput = Omit<GeotechnicalCatalogProfile, "unit" | "status" | "requiresGeotechnicalConfirmation" | "indicative" | "poissonRatio"> & { poissonRatio?: number | null };
const profile = (value: CatalogProfileInput): GeotechnicalCatalogProfile => ({
  poissonRatio: 0.30,
  ...value,
  unit: "kPa",
  indicative: true,
});

export const GEOTECHNICAL_CATALOG: GeotechnicalCatalogProfile[] = [
  profile({ id: "sn-dakar-sable", country: "Sénégal", region: "Dakar", department: "Dakar", city: "Dakar", locality: "Dakar", geologicalZone: "Zone côtière", profileName: "Sable fin à moyen", soilType: "Sable", soilDescription: "Sable fin à moyen — valeur indicative de catalogue", seismicSoilClass: "C", bearingCapacityAdmissibleKPa: 200, qUltimateKPa: 600, qNetKPa: 400, frictionAngleDeg: 30, cohesionKPa: 0, unitWeightKnM3: 18, gammaSatKnM3: 20, youngModulusKPa: 25000, oedometricModulusKPa: 30000, subgradeModulusKnM3: 30000, foundationDepthM: 1.5, groundwaterDepthM: 3, allowableSettlementMm: 25, source: "Catalogue géotechnique indicatif GcBtp · à confirmer par SGNS/Géo Sénégal et étude de site", reportDate: "", reportPage: "", confidence: "moyenne" }),
  profile({ id: "sn-thies-sable-argile", country: "Sénégal", region: "Thiès", department: "Thiès", city: "Thiès", locality: "Thiès", geologicalZone: "Plateau de Thiès", profileName: "Sable argileux", soilType: "Sable argileux", soilDescription: "Sable argileux — valeur indicative de catalogue", seismicSoilClass: "C", bearingCapacityAdmissibleKPa: 180, frictionAngleDeg: 27, cohesionKPa: 10, unitWeightKnM3: 19, gammaSatKnM3: 20, youngModulusKPa: 18000, oedometricModulusKPa: 22000, subgradeModulusKnM3: 22000, foundationDepthM: 1.5, groundwaterDepthM: 4, allowableSettlementMm: 25, source: "Catalogue géotechnique indicatif GcBtp · Thiès · à confirmer par étude", reportDate: "", reportPage: "", confidence: "faible" }),
  profile({ id: "sn-saint-louis-sable", country: "Sénégal", region: "Saint-Louis", department: "Saint-Louis", city: "Saint-Louis", locality: "Saint-Louis", geologicalZone: "Delta / littoral", profileName: "Sable limoneux", soilType: "Sable limoneux", soilDescription: "Sable limoneux — valeur indicative de catalogue", seismicSoilClass: "D", bearingCapacityAdmissibleKPa: 150, frictionAngleDeg: 28, cohesionKPa: 5, unitWeightKnM3: 18, gammaSatKnM3: 20, youngModulusKPa: 15000, oedometricModulusKPa: 18000, subgradeModulusKnM3: 18000, foundationDepthM: 1.5, groundwaterDepthM: 2, allowableSettlementMm: 25, source: "Catalogue géotechnique indicatif GcBtp · Saint-Louis · à confirmer par étude", reportDate: "", reportPage: "", confidence: "faible" }),
  profile({ id: "mr-nouakchott-sable", country: "Mauritanie", region: "Nouakchott", department: "Nouakchott", city: "Nouakchott", locality: "Nouakchott", geologicalZone: "Dunes / plaine côtière", profileName: "Sable éolien", soilType: "Sable", soilDescription: "Sable éolien — valeur indicative de catalogue", seismicSoilClass: "C", bearingCapacityAdmissibleKPa: 150, frictionAngleDeg: 30, cohesionKPa: 0, unitWeightKnM3: 17, gammaSatKnM3: 20, youngModulusKPa: 18000, oedometricModulusKPa: 22000, subgradeModulusKnM3: 20000, foundationDepthM: 1.5, groundwaterDepthM: 4, allowableSettlementMm: 25, source: "Catalogue géotechnique indicatif GcBtp · Mauritanie · à confirmer par étude", reportDate: "", reportPage: "", confidence: "faible" }),
  profile({ id: "gm-banjul-sable", country: "Gambie", region: "West Coast", department: "Kanifing", city: "Banjul", locality: "Banjul", geologicalZone: "Littoral", profileName: "Sable littoral", soilType: "Sable", soilDescription: "Sable littoral — valeur indicative de catalogue", seismicSoilClass: "C", bearingCapacityAdmissibleKPa: 150, frictionAngleDeg: 29, cohesionKPa: 0, unitWeightKnM3: 18, gammaSatKnM3: 20, youngModulusKPa: 18000, oedometricModulusKPa: 22000, subgradeModulusKnM3: 20000, foundationDepthM: 1.5, groundwaterDepthM: 3, allowableSettlementMm: 25, source: "Catalogue géotechnique indicatif GcBtp · Gambie · à confirmer par étude", reportDate: "", reportPage: "", confidence: "faible" }),
  profile({ id: "ml-bamako-laterite", country: "Mali", region: "Bamako", department: "Bamako", city: "Bamako", locality: "Bamako", geologicalZone: "Socle / altérites", profileName: "Latérite sableuse", soilType: "Latérite", soilDescription: "Latérite sableuse — valeur indicative de catalogue", seismicSoilClass: "C", bearingCapacityAdmissibleKPa: 200, frictionAngleDeg: 28, cohesionKPa: 15, unitWeightKnM3: 19, gammaSatKnM3: 21, youngModulusKPa: 25000, oedometricModulusKPa: 30000, subgradeModulusKnM3: 30000, foundationDepthM: 1.5, groundwaterDepthM: 8, allowableSettlementMm: 25, source: "Catalogue géotechnique indicatif GcBtp · Mali · à confirmer par étude", reportDate: "", reportPage: "", confidence: "faible" }),
  profile({ id: "ci-abidjan-argile", country: "Côte d’Ivoire", region: "Abidjan", department: "Abidjan", city: "Abidjan", locality: "Abidjan", geologicalZone: "Bassin sédimentaire", profileName: "Sable argileux", soilType: "Sable argileux", soilDescription: "Sable argileux — valeur indicative de catalogue", seismicSoilClass: "D", bearingCapacityAdmissibleKPa: 150, frictionAngleDeg: 25, cohesionKPa: 15, unitWeightKnM3: 18, gammaSatKnM3: 20, youngModulusKPa: 12000, oedometricModulusKPa: 16000, subgradeModulusKnM3: 16000, foundationDepthM: 1.5, groundwaterDepthM: 2, allowableSettlementMm: 25, source: "Catalogue géotechnique indicatif GcBtp · Côte d’Ivoire · à confirmer par étude", reportDate: "", reportPage: "", confidence: "faible" }),
];

export const GEOTECHNICAL_CATALOG_COUNTRIES = Array.from(new Set(GEOTECHNICAL_CATALOG.map(item => item.country)));
export const DEFAULT_GEOTECHNICAL_CATALOG_ID = "sn-dakar-sable";
export function getGeotechnicalCatalogProfile(id: string | null | undefined) { return GEOTECHNICAL_CATALOG.find(item => item.id === id) ?? GEOTECHNICAL_CATALOG.find(item => item.id === DEFAULT_GEOTECHNICAL_CATALOG_ID)!; }
export function getGeotechnicalCatalogProfiles(country: string) { return GEOTECHNICAL_CATALOG.filter(item => item.country === country); }
export function copyCatalogToProject(profile: GeotechnicalCatalogProfile): ProjectGeotechnicalProfile & { catalogProfileId: string; country: string; region: string; city: string; locality: string; geologicalZone: string; profileName: string; soilType: string; sourceStatus: "catalog" } {
  const { id, confidence: _confidence, indicative: _indicative, ...values } = profile;
  return { ...values, catalogProfileId: id, sourceStatus: "catalog", status: "entered", requiresGeotechnicalConfirmation: true };
}
