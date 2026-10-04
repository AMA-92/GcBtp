type PlacementElement = { type: string; x: number; y: number; x2?: number; y2?: number };

export function hasPostAt(elements: PlacementElement[], x: number, y: number) {
  return elements.some(item => item.type === "Poteau" && item.x === x && item.y === y);
}

export function canPlaceBeamBetween(_elements: PlacementElement[], start: { x: number; y: number }, end: { x: number; y: number }) {
  return start.x !== end.x || start.y !== end.y;
}

export function canPlaceTieBeamBetween(elements: PlacementElement[], start: { x: number; y: number }, end: { x: number; y: number }) {
  if (start.x === end.x && start.y === end.y) return false;
  const hasSupportedPost = (point: { x: number; y: number }) => {
    const foundation = elements.some(item => item.type === "Semelle" && item.x === point.x && item.y === point.y);
    const post = elements.some(item => item.type === "Poteau" && item.x === point.x && item.y === point.y);
    return foundation && post;
  };
  return hasSupportedPost(start) && hasSupportedPost(end);
}

export function canCoLocate(type: string) {
  return type === "Poteau" || type === "Semelle";
}

const normalizedSegment = (item: PlacementElement) => {
  const start = `${item.x},${item.y}`;
  const end = `${item.x2 ?? item.x},${item.y2 ?? item.y}`;
  return [start, end].sort().join("|");
};

const normalizedRectangle = (item: PlacementElement) => {
  const x1 = Math.min(item.x, item.x2 ?? item.x);
  const x2 = Math.max(item.x, item.x2 ?? item.x);
  const y1 = Math.min(item.y, item.y2 ?? item.y);
  const y2 = Math.max(item.y, item.y2 ?? item.y);
  return { x1, x2, y1, y2 };
};

export function hasSimilarElementAt(elements: PlacementElement[], candidate: PlacementElement) {
  return elements.some(item => {
    if (item.type !== candidate.type) return false;
    if (candidate.type === "Poteau" || candidate.type === "Semelle") return item.x === candidate.x && item.y === candidate.y;
    if (candidate.type === "Poutre" || candidate.type === "Longrine de redressement") return normalizedSegment(item) === normalizedSegment(candidate);
    if (candidate.type === "Dalle") {
      const current = normalizedRectangle(item);
      const next = normalizedRectangle(candidate);
      return Math.max(current.x1, next.x1) < Math.min(current.x2, next.x2) && Math.max(current.y1, next.y1) < Math.min(current.y2, next.y2);
    }
    return false;
  });
}
