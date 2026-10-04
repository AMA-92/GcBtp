export type GridElement = { type: string; x: number; y: number };
export type ClosedFloorArea = { x: number; y: number; x2: number; y2: number; direction: "X" | "Y" };

export function findClosedFloorArea(elements: GridElement[], x: number, y: number): ClosedFloorArea | null {
  const posts = new Set(elements.filter(item => item.type === "Poteau").map(item => `${item.x}:${item.y}`));
  for (let x2 = x + 1; x2 < 100; x2 += 1) {
    for (let y2 = y + 1; y2 < 100; y2 += 1) {
      if (posts.has(`${x}:${y}`) && posts.has(`${x2}:${y}`) && posts.has(`${x}:${y2}`) && posts.has(`${x2}:${y2}`)) {
        const width = x2 - x;
        const height = y2 - y;
        return { x, y, x2, y2, direction: width <= height ? "X" : "Y" };
      }
    }
  }
  return null;
}
