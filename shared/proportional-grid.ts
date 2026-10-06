export const GRID_UNITS_PER_METER = 30;

export function cumulativeGridPositions(distances: number[], count: number) {
  const positions = [0];
  for (let index = 0; index < Math.max(count - 1, 0); index += 1) {
    positions.push(positions[index] + Math.max(Number(distances[index] ?? distances.at(-1) ?? 0.01) || 0.01, 0.01));
  }
  return positions;
}

export function proportionalGridScale(positions: number[], targetSpan: number) {
  const total = positions.at(-1) || 1;
  return targetSpan / total;
}
