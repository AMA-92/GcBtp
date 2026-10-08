/** Aires nominales arrondies du tableau HA fourni par l’utilisateur, en cm² par barre. */
export const HA_BAR_DIAMETER_AREAS_CM2: Readonly<Record<number, number>> = {
  5: 0.19,
  6: 0.28,
  8: 0.50,
  10: 0.78,
  12: 1.13,
  14: 1.54,
  16: 2.01,
  20: 3.14,
  25: 4.91,
  32: 8.04,
  40: 12.56,
};

export const HA_BAR_DIAMETERS_MM = Object.keys(HA_BAR_DIAMETER_AREAS_CM2).map(Number);

export function haCatalogBarAreaMm2(diameterMm: number): number | null {
  const areaCm2 = HA_BAR_DIAMETER_AREAS_CM2[diameterMm];
  return areaCm2 === undefined ? null : areaCm2 * 100;
}

/** Aire tabulée en cm² pour un groupe de barres identiques; null si diamètre non catalogué. */
export function haCatalogAreaCm2(count: number, diameterMm: number): number | null {
  const singleBarArea = HA_BAR_DIAMETER_AREAS_CM2[diameterMm];
  return Number.isInteger(count) && count > 0 && singleBarArea !== undefined ? count * singleBarArea : null;
}

export function formatHACatalogArea(count: number, diameterMm: number): string {
  const area = haCatalogAreaCm2(count, diameterMm);
  return area === null ? "—" : area.toFixed(2).replace(".", ",");
}
