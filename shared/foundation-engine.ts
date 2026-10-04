export type SoilType = "roche" | "gravier" | "sable" | "argile" | "remblai";
export type FoundationType = "semelle isolée" | "semelle filante" | "radier" | "pieux";

export const SOILS: Record<SoilType, { label: string; allowableBearing: number; frictionAngle: number; note: string }> = {
  roche: { label: "Roche saine — 500 kPa", allowableBearing: 500, frictionAngle: 38, note: "Valeur indicative à confirmer par reconnaissance et essais." },
  gravier: { label: "Gravier compact — 300 kPa", allowableBearing: 300, frictionAngle: 34, note: "Valeur indicative à confirmer par étude géotechnique." },
  sable: { label: "Sable compact — 200 kPa", allowableBearing: 200, frictionAngle: 30, note: "Valeur indicative sensible à la compacité et à la nappe." },
  argile: { label: "Argile ferme — 150 kPa", allowableBearing: 150, frictionAngle: 22, note: "Valeur indicative : vérifier tassements et retrait-gonflement." },
  remblai: { label: "Remblai — 100 kPa", allowableBearing: 100, frictionAngle: 18, note: "Ne pas retenir sans caractérisation géotechnique." },
};

export const FOUNDATIONS: Record<FoundationType, { label: string; factor: number; note: string }> = {
  "semelle isolée": { label: "Semelle isolée", factor: 1, note: "Dimensionnement préliminaire sous poteau." },
  "semelle filante": { label: "Semelle filante", factor: 1.1, note: "Dimensionnement préliminaire sous mur ou ligne de poteaux." },
  radier: { label: "Radier général", factor: 1.25, note: "Répartition globale des charges ; vérifier tassements différentiels." },
  pieux: { label: "Pieux", factor: 1.5, note: "La capacité portante des pieux exige une étude géotechnique dédiée." },
};

export type FoundationInput = {
  axialLoad: number;
  soil: SoilType;
  foundation: FoundationType;
  safetyFactor: number;
  depth: number;
  groundwaterDepth: number;
  allowableBearingOverride?: number;
  width?: number;
  length?: number;
};

export function calculateFoundation(input: FoundationInput) {
  const soil = SOILS[input.soil];
  const foundation = FOUNDATIONS[input.foundation];
  const safetyFactor = Math.max(1, input.safetyFactor || 2.5);
  const allowableBearing = input.allowableBearingOverride && input.allowableBearingOverride > 0 ? input.allowableBearingOverride : soil.allowableBearing;
  const designBearing = allowableBearing / safetyFactor;
  const requiredArea = (input.axialLoad * foundation.factor) / designBearing;
  const side = Math.max(0.6, Math.sqrt(requiredArea));
  const width = input.width && input.width > 0 ? input.width : side;
  const length = input.length && input.length > 0 ? input.length : side;
  const effectiveArea = width * length;
  const pressure = (input.axialLoad * foundation.factor) / effectiveArea;
  const utilization = pressure / designBearing;
  return {
    soil: { ...soil, allowableBearing },
    foundation,
    safetyFactor,
    designBearing,
    requiredArea,
    width,
    length,
    effectiveArea,
    pressure,
    utilization,
    status: utilization <= 1 ? "satisfaisant" : "à redimensionner",
    assumptions: { depth: input.depth, groundwaterDepth: input.groundwaterDepth },
  } as const;
}
