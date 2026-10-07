export type ProjectGeotechnicalStatus = "not_provided" | "entered" | "geotechnical_confirmed";

/** Données retranscrites depuis le rapport géotechnique réel du site. */
export type ProjectGeotechnicalProfile = {
  catalogProfileId?: string;
  country?: string;
  region?: string;
  department?: string;
  city?: string;
  locality?: string;
  geologicalZone?: string;
  profileName?: string;
  soilType?: string;
  qUltimateKPa?: number | null;
  qNetKPa?: number | null;
  gammaSatKnM3?: number | null;
  oedometricModulusKPa?: number | null;
  sourceStatus?: "catalog" | "modified" | "study";
  confidence?: "moyenne" | "faible";
  soilDescription: string;
  seismicSoilClass: string;
  bearingCapacityAdmissibleKPa: number | null;
  frictionAngleDeg: number | null;
  cohesionKPa: number | null;
  unitWeightKnM3: number | null;
  youngModulusKPa: number | null;
  poissonRatio: number | null;
  subgradeModulusKnM3: number | null;
  foundationDepthM: number | null;
  groundwaterDepthM: number | null;
  allowableSettlementMm: number | null;
  source: string;
  reportDate: string;
  reportPage: string;
  unit: "kPa";
  status: ProjectGeotechnicalStatus;
  requiresGeotechnicalConfirmation: boolean;
};

export const EMPTY_PROJECT_GEOTECHNICAL_PROFILE: ProjectGeotechnicalProfile = {
  catalogProfileId: undefined,
  country: "",
  region: "",
  department: "",
  city: "",
  locality: "",
  geologicalZone: "",
  profileName: "",
  soilType: "",
  qUltimateKPa: null,
  qNetKPa: null,
  gammaSatKnM3: null,
  oedometricModulusKPa: null,
  sourceStatus: undefined,
  confidence: undefined,
  soilDescription: "",
  seismicSoilClass: "",
  bearingCapacityAdmissibleKPa: null,
  frictionAngleDeg: null,
  cohesionKPa: null,
  unitWeightKnM3: null,
  youngModulusKPa: null,
  poissonRatio: null,
  subgradeModulusKnM3: null,
  foundationDepthM: null,
  groundwaterDepthM: null,
  allowableSettlementMm: null,
  source: "",
  reportDate: "",
  reportPage: "",
  unit: "kPa",
  status: "not_provided",
  requiresGeotechnicalConfirmation: true,
};

const readText = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const readNumber = (value: unknown, valid: (number: number) => boolean): number | null => {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value.trim().replace(",", ".")) : Number.NaN;
  return Number.isFinite(parsed) && valid(parsed) ? parsed : null;
};

/**
 * Normalise les valeurs de projet. Les profils de catalogue sont copiés dans
 * le projet et restent indépendants de la fiche originale.
 */
export function normalizeProjectGeotechnicalProfile(value: unknown): ProjectGeotechnicalProfile {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (raw.status === "default_preliminary") return { ...EMPTY_PROJECT_GEOTECHNICAL_PROFILE };

  const profile: ProjectGeotechnicalProfile = {
    catalogProfileId: readText(raw.catalogProfileId) || undefined,
    country: readText(raw.country), region: readText(raw.region), department: readText(raw.department), city: readText(raw.city), locality: readText(raw.locality), geologicalZone: readText(raw.geologicalZone), profileName: readText(raw.profileName), soilType: readText(raw.soilType),
    qUltimateKPa: readNumber(raw.qUltimateKPa, number => number > 0), qNetKPa: readNumber(raw.qNetKPa, number => number >= 0), gammaSatKnM3: readNumber(raw.gammaSatKnM3, number => number > 0), oedometricModulusKPa: readNumber(raw.oedometricModulusKPa, number => number > 0),
    sourceStatus: raw.sourceStatus === "catalog" || raw.sourceStatus === "modified" || raw.sourceStatus === "study" ? raw.sourceStatus : undefined,
    confidence: raw.confidence === "moyenne" || raw.confidence === "faible" ? raw.confidence : undefined,
    soilDescription: readText(raw.soilDescription),
    seismicSoilClass: readText(raw.seismicSoilClass),
    bearingCapacityAdmissibleKPa: readNumber(raw.bearingCapacityAdmissibleKPa, number => number > 0),
    frictionAngleDeg: readNumber(raw.frictionAngleDeg, number => number >= 0 && number < 60),
    cohesionKPa: readNumber(raw.cohesionKPa, number => number >= 0),
    unitWeightKnM3: readNumber(raw.unitWeightKnM3, number => number > 0),
    youngModulusKPa: readNumber(raw.youngModulusKPa, number => number > 0),
    poissonRatio: readNumber(raw.poissonRatio, number => number >= 0 && number < 0.5),
    subgradeModulusKnM3: readNumber(raw.subgradeModulusKnM3, number => number > 0),
    foundationDepthM: readNumber(raw.foundationDepthM, number => number >= 0),
    groundwaterDepthM: readNumber(raw.groundwaterDepthM, number => number >= 0),
    allowableSettlementMm: readNumber(raw.allowableSettlementMm, number => number > 0),
    source: readText(raw.source),
    reportDate: readText(raw.reportDate),
    reportPage: readText(raw.reportPage),
    unit: "kPa",
    status: "not_provided",
    requiresGeotechnicalConfirmation: true,
  };
  const hasData = Boolean(profile.soilDescription || profile.seismicSoilClass || profile.source || profile.reportDate || profile.reportPage)
    || [profile.bearingCapacityAdmissibleKPa, profile.frictionAngleDeg, profile.cohesionKPa, profile.unitWeightKnM3, profile.youngModulusKPa, profile.poissonRatio, profile.subgradeModulusKnM3, profile.foundationDepthM, profile.groundwaterDepthM, profile.allowableSettlementMm].some(entry => entry !== null);
  const hasBearing = profile.bearingCapacityAdmissibleKPa !== null;
  const explicitlyConfirmed = raw.status === "geotechnical_confirmed" && hasBearing && Boolean(profile.source);
  profile.status = explicitlyConfirmed ? "geotechnical_confirmed" : hasData ? "entered" : "not_provided";
  profile.requiresGeotechnicalConfirmation = !explicitlyConfirmed;
  return profile;
}
