import type { FloorConfig } from "./floor-config";

export function validateFloorConfig(config: FloorConfig): string[] {
  const errors: string[] = [];
  const thickness = config.thickness.trim();
  if (!thickness) errors.push("L’épaisseur est obligatoire.");
  if (thickness && !/^\d+(?:[.,]\d+)?(?:\+\d+(?:[.,]\d+)?)?\s*cm$/.test(thickness)) errors.push("Utilisez un format comme 20 cm ou 16+4 cm.");
  const numbers = thickness.match(/\d+(?:[.,]\d+)?/g)?.map(Number) ?? [];
  if (numbers.some(value => value < 3 || value > 60)) errors.push("Chaque épaisseur doit être comprise entre 3 et 60 cm.");
  const span = Number(config.span.replace(",", "."));
  if (!Number.isFinite(span) || span <= 0 || span > 20) errors.push("La portée doit être comprise entre 0 et 20 m.");
  if (config.type === "Corps creux") {
    const ribWidth = Number(String(config.ribWidth ?? "").replace(",", "."));
    const ribSpacing = Number(String(config.ribSpacing ?? "60").replace(",", "."));
    if (!Number.isFinite(ribWidth) || ribWidth <= 0) errors.push("La largeur de nervure doit être positive.");
    if (!Number.isFinite(ribSpacing) || ribSpacing <= 0 || ribSpacing > 150 || (Number.isFinite(ribWidth) && ribSpacing < ribWidth)) errors.push("L’entraxe des nervures doit être supérieur à leur largeur et ne pas dépasser 150 cm.");
  }
  return errors;
}

export function floorNoteSummary(config: FloorConfig): string {
  return config.type === "Corps creux"
    ? `Plancher corps creux ${config.thickness}, entrevous ${config.hollowBlockHeight} cm, dalle de compression ${config.compressionSlab} cm, nervures ${config.ribWidth} cm à entraxe ${config.ribSpacing ?? "60"} cm, portée ${config.span} m suivant ${config.direction}, béton ${config.concreteClass}.`
    : config.balconySupportEdge !== undefined
      ? `Balcon en dalle pleine ${config.thickness}, encastrement ${config.balconySupportEdge}, portée ${config.span} m, béton ${config.concreteClass}.`
      : `Dalle pleine ${config.thickness}, portée ${config.span} m suivant ${config.direction}, sans nervures, répartition bidirectionnelle, béton ${config.concreteClass}.`;
}
