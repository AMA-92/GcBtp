export type FoundationType = "semelle isolée" | "semelle filante" | "radier" | "pieux";

export const FOUNDATIONS: Record<FoundationType, { label: string; note: string }> = {
  "semelle isolée": { label: "Semelle isolée", note: "Prédimensionnement surfacique sous poteau, à partir d’une donnée géotechnique fournie." },
  "semelle filante": { label: "Semelle filante", note: "Prédimensionnement surfacique simplifié; modèle de mur et vérifications détaillées à établir." },
  radier: { label: "Radier général", note: "Prédimensionnement global non différentiel; interaction sol-structure à vérifier." },
  pieux: { label: "Pieux", note: "Capacité, frottement négatif et tassements nécessitent une étude géotechnique spécifique." },
};

export type FoundationInput = {
  axialLoad: number;
  foundation: FoundationType;
  /** Valeur de comparaison de portance provenant du rapport géotechnique réel, en kPa. */
  allowableBearingOverride?: number | null;
  width?: number;
  length?: number;
};

export function calculateFoundation(input: FoundationInput) {
  const bearing = input.allowableBearingOverride;
  const hasBearing = typeof bearing === "number" && Number.isFinite(bearing) && bearing > 0;
  const validLoad = Number.isFinite(input.axialLoad) && input.axialLoad > 0;
  const canPredimension = input.foundation !== "pieux" && hasBearing && validLoad;
  const requiredArea = canPredimension ? input.axialLoad / (bearing as number) : null;
  const proposedSide = requiredArea === null ? null : Math.max(0.6, Math.sqrt(requiredArea));
  const width = input.width && input.width > 0 ? input.width : proposedSide;
  const length = input.length && input.length > 0 ? input.length : proposedSide;
  const effectiveArea = width !== null && length !== null ? width * length : null;
  const pressure = effectiveArea !== null && effectiveArea > 0 && validLoad ? input.axialLoad / effectiveArea : null;
  const utilization = hasBearing && pressure !== null ? pressure / (bearing as number) : null;
  const status = input.foundation === "pieux"
    ? "étude géotechnique spécifique requise"
    : !hasBearing
      ? "données géotechniques requises"
      : !validLoad
        ? "effort vertical non disponible"
        : utilization !== null && utilization <= 1 ? "satisfaisant" : "à redimensionner";
  return {
    foundation: FOUNDATIONS[input.foundation],
    soilDescription: "À renseigner depuis le rapport géotechnique",
    allowableBearingKPa: hasBearing ? bearing as number : null,
    requiredArea,
    width,
    length,
    effectiveArea,
    pressure,
    utilization,
    status,
  } as const;
}
