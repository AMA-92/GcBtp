export type GridPoint = { x: number; y: number };

export function isGridIntersection(point: GridPoint, xCount: number, yCount: number): boolean {
  return Number.isInteger(point.x) && Number.isInteger(point.y) && point.x >= 0 && point.x < xCount && point.y >= 0 && point.y < yCount;
}

/** Returns the nearest valid grid point only when the touch is close enough. */
export function snapToGridPoint(
  localX: number,
  localY: number,
  xPositions: number[],
  yPositions: number[],
  tolerance: number
): GridPoint | null {
  if (!xPositions.length || !yPositions.length) return null;
  const nearestIndex = (value: number, positions: number[]) =>
    positions.reduce((best, position, index) =>
      Math.abs(position - value) < Math.abs(positions[best] - value) ? index : best, 0);
  const point = { x: nearestIndex(localX, xPositions), y: nearestIndex(localY, yPositions) };
  return Math.hypot(xPositions[point.x] - localX, yPositions[point.y] - localY) <= tolerance ? point : null;
}

export function normalizeGridSegment(start: GridPoint, end: GridPoint) {
  return { x: start.x, y: start.y, x2: end.x, y2: end.y };
}

export function gridRectangle(start: GridPoint, end: GridPoint) {
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}
