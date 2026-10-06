export type VerticalLevel = { id: string; label: string; elevation: string; height?: string };

export function levelElevation(level: VerticalLevel, index: number) {
  const value = Number.parseFloat(level.elevation);
  return Number.isFinite(value) ? value : index * 3.2;
}

export function levelHeight(level: VerticalLevel) {
  const value = Number.parseFloat(level.height ?? "3.2");
  return Number.isFinite(value) && value > 0 ? value : 3.2;
}

/** Décalage d’ordre appliqué lors de la translation d’un élément vers un niveau cible. */
export function levelIndexShift<T extends { id: string }>(levels: T[], sourceId: string, targetId: string) {
  const sourceIndex = levels.findIndex(level => level.id === sourceId);
  const targetIndex = levels.findIndex(level => level.id === targetId);
  return sourceIndex >= 0 && targetIndex >= 0 ? targetIndex - sourceIndex : 0;
}

export function isFoundationLevel(level: VerticalLevel) {
  return /fondation/i.test(level.label) || /fondation/i.test(level.id);
}

export function postTopElevation(level: VerticalLevel, index: number) {
  const base = levelElevation(level, index);
  const height = levelHeight(level);
  return base + (isFoundationLevel(level) ? Math.min(height, 0.85) : height);
}

/** Cote du plancher haut brut d’un niveau, sans l’ajustement de tête de poteau. */
export function floorTopElevation(level: VerticalLevel, index: number) {
  return levelElevation(level, index) + levelHeight(level);
}

const foundationColumnBaseElevation = (base: number) => base - 0.35 + 0.18;

export function columnBaseElevation(levels: VerticalLevel[], index: number) {
  const level = levels[index];
  if (!level) return 0;
  const base = levelElevation(level, index);
  if (isFoundationLevel(level)) return foundationColumnBaseElevation(base);
  const previous = levels[index - 1];
  return previous ? Math.min(base, postTopElevation(previous, index - 1)) : base;
}

export function elementElevation(level: VerticalLevel, index: number, type: string) {
  const base = levelElevation(level, index);
  const height = levelHeight(level);
  if (type === "Semelle") return base - 0.35;
  if (type === "Longrine de redressement") {
    // À la fondation, la longrine se raccorde au pied du poteau porté par la semelle.
    // La placer au-dessous au niveau base−0,35 m laissait ses extrémités flottantes.
    return isFoundationLevel(level) ? foundationColumnBaseElevation(base) : base - 0.35;
  }
  if (type === "Poteau") return base;
  if (type === "Poutre") return postTopElevation(level, index);
  // Les surfaces de dalle doivent partager les nœuds d’appui des poutres.
  // Un décalage de 2 cm les isolait du portique lorsque la tolérance de
  // fusion était de 1 cm, ce qui produisait une erreur par dalle importée.
  if (type === "Dalle" || type === "Balcon") return postTopElevation(level, index);
  return base;
}
