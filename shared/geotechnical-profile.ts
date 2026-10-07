export type ProjectGeotechnicalStatus = "not_provided" | "entered" | "geotechnical_confirmed";

/** Données retranscrites depuis le rapport géotechnique réel du site. */
export type ProjectGeotechnicalProfile = {
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
 * Migre les projets historiques en supprimant explicitement qadm=200 kPa et
 * les autres défauts de démonstration. Seules des données saisies depuis une
 * étude géotechnique réelle sont conservées.
 */
export function normalizeProjectGeotechnicalProfile(value: unknown): ProjectGeotechnicalProfile {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (raw.status === "default_preliminary") return { ...EMPTY_PROJECT_GEOTECHNICAL_PROFILE };

  const profile: ProjectGeotechnicalProfile = {
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
