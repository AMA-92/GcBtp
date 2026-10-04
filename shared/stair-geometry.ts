export type StairPoint = { x: number; y: number };

/** Retourne l’autre coin du palier, à 1 m du point partagé sur sa ligne de départ. */
export function deriveOppositeLandingCorner(firstUpperA: StairPoint, sharedPoint: StairPoint): StairPoint {
  const dx = sharedPoint.x - firstUpperA.x;
  const dy = sharedPoint.y - firstUpperA.y;
  const length = Math.max(Math.hypot(dx, dy), 0.001);
  return {
    x: sharedPoint.x + dx / length,
    y: sharedPoint.y + dy / length,
  };
}
