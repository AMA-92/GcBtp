export const FOOTING_2D_SIZE = 34;
export const FOOTING_3D_HALF_X = 0.28;
export const FOOTING_3D_HALF_Y = 0.22;
export const FOOTING_3D_HEIGHT = 0.18;

export type FootingLayoutMode = "centered" | "eccentric";
export type FootingEccentricDirection = "left" | "right" | "top" | "bottom";
export type FootingEccentricAxes = {
  x: "none" | "left" | "right";
  y: "none" | "top" | "bottom";
};
/** Accept old single-direction snapshots and the new two-axis selection. */
export type FootingDirectionSelection = FootingEccentricDirection | FootingEccentricAxes;

export function normalizeFootingEccentricAxes(direction: FootingDirectionSelection | undefined): FootingEccentricAxes {
  if (typeof direction === "string") {
    if (direction === "left" || direction === "right") return { x: direction, y: "none" };
    return { x: "none", y: direction };
  }
  return { x: direction?.x ?? "none", y: direction?.y ?? "none" };
}

/**
 * Offset du centre de la semelle par rapport au point de pose du poteau.
 * En excentré, chaque axe peut être décalé indépendamment. Sur chaque axe
 * sélectionné, l’axe du poteau est décalé de B/6 ou L/6 par rapport au
 * centre : la résultante reste sur la limite du noyau central (B/6).
 * Le poteau et son point de pose restent inchangés; seul le centre de la
 * semelle est déplacé d’un sixième de sa dimension sur l’axe choisi.
 * Les coordonnées de plan suivent l’écran : Y positif va vers le bas.
 */
export function footingCenterOffset(
  mode: FootingLayoutMode | undefined,
  direction: FootingDirectionSelection | undefined,
  widthM: number,
  depthM: number,
): { xM: number; yM: number } | null {
  if (mode !== "eccentric") return { xM: 0, yM: 0 };
  if (!direction || !Number.isFinite(widthM) || !Number.isFinite(depthM) || widthM <= 0 || depthM <= 0) return null;
  const axes = normalizeFootingEccentricAxes(direction);
  if (axes.x === "none" && axes.y === "none") return null;
  const xM = axes.x === "left" ? -widthM / 6 : axes.x === "right" ? widthM / 6 : 0;
  const yM = axes.y === "top" ? -depthM / 6 : axes.y === "bottom" ? depthM / 6 : 0;
  return { xM, yM };
}

export function footing2DBox(center: number) {
  return { start: center - FOOTING_2D_SIZE / 2, size: FOOTING_2D_SIZE };
}
