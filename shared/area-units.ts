/** Conversion d'aire: 1 cm² = 100 mm². Les calculs du moteur restent en mm². */
export function mm2ToCm2(areaMm2: number): number {
  return areaMm2 / 100;
}

/** Présente une série d'aires dans les deux unités, avec séparateur décimal français. */
export function formatAreaValuesMm2AndCm2(areasMm2: readonly number[]): string {
  const format = (value: number) => Number.isFinite(value) ? value.toFixed(2).replace(".", ",") : "—";
  const mm2 = areasMm2.map(format).join(" / ");
  const cm2 = areasMm2.map(value => format(mm2ToCm2(value))).join(" / ");
  return `${mm2} mm² (${cm2} cm²)`;
}
