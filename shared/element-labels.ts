export type LabelableElement = { id: string; type: string };

const prefixByType: Record<string, string> = { Poteau: "P", Poutre: "B", Semelle: "S", Dalle: "PL", Balcon: "BAL" };
const compactType = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s_\-]+/g, "");
export function normalizeStructuralElementType(type: string) {
  const key = compactType(type);
  if (["balcon", "balcony", "balconterrasse"].includes(key)) return "Balcon";
  if (["dalle", "plancher", "slab", "floor", "floorpanel", "plancherbacorpscreux", "planchercorpscreux"].includes(key)) return "Dalle";
  if (["poutre", "beam", "girder", "poutreba", "poutrebetonarme"].includes(key)) return "Poutre";
  if (["poteau", "column", "colonne", "pilier"].includes(key)) return "Poteau";
  if (["semelle", "footing", "spreadfooting"].includes(key)) return "Semelle";
  if (["voile", "wall", "shearwall"].includes(key)) return "Voile";
  if (["longrine", "tiebeam", "longrinderedressement"].includes(key)) return "Longrine de redressement";
  if (["escalier", "escaliers", "stair", "staircase"].includes(key)) return "Escaliers";
  return type;
}

export function elementLabel(elements: LabelableElement[], type: string) {
  const normalizedType = normalizeStructuralElementType(type);
  const prefix = prefixByType[normalizedType] ?? normalizedType.slice(0, 2).toUpperCase();
  const count = elements.filter(element => normalizeStructuralElementType(element.type) === normalizedType).length + 1;
  return `${prefix}${count}`;
}

export function renumberElements<T extends LabelableElement>(elements: T[]) {
  const counters = new Map<string, number>();
  return elements.map(element => {
    const type = normalizeStructuralElementType(element.type);
    const prefix = prefixByType[type] ?? type.slice(0, 2).toUpperCase();
    const number = (counters.get(type) ?? 0) + 1;
    counters.set(type, number);
    return { ...element, type, id: `${prefix}${number}` };
  });
}

export function renumberBuildingElements<T extends LabelableElement, L extends { elements: T[] }>(levels: L[]) {
  const counters = new Map<string, number>();
  const renumbered = levels.map(level => ({
    ...level,
    elements: level.elements.map(element => {
      const type = normalizeStructuralElementType(element.type);
      const prefix = prefixByType[type] ?? type.slice(0, 2).toUpperCase();
      const number = (counters.get(type) ?? 0) + 1;
      counters.set(type, number);
      return { ...element, type, id: `${prefix}${number}` };
    }),
  }));
  const allElements = renumbered.flatMap(level => level.elements);
  const columns = allElements.filter(element => normalizeStructuralElementType(element.type) === "Poteau");
  const footings = allElements.filter(element => normalizeStructuralElementType(element.type) === "Semelle");
  const samePoint = (a: T, b: T) => {
    const pointA = a as T & { x?: number; y?: number };
    const pointB = b as T & { x?: number; y?: number };
    return Number.isFinite(pointA.x) && Number.isFinite(pointA.y) && Number.isFinite(pointB.x) && Number.isFinite(pointB.y)
      && Math.abs((pointA.x as number) - (pointB.x as number)) <= 1e-6
      && Math.abs((pointA.y as number) - (pointB.y as number)) <= 1e-6;
  };
  const matchedColumns = new Set<string>();
  const footingSuffixes = new Map<T, string>();
  const reservedSuffixes = new Set<string>();
  for (const footing of footings) {
    const column = columns.find(candidate => !matchedColumns.has(candidate.id) && samePoint(candidate, footing));
    const suffix = column?.id.match(/(\d+)$/)?.[1];
    if (column && suffix) {
      matchedColumns.add(column.id);
      footingSuffixes.set(footing, suffix);
      reservedSuffixes.add(suffix);
    }
  }
  let nextFallback = 1;
  for (const footing of footings) {
    if (footingSuffixes.has(footing)) continue;
    while (reservedSuffixes.has(String(nextFallback))) nextFallback++;
    const suffix = String(nextFallback++);
    footingSuffixes.set(footing, suffix);
    reservedSuffixes.add(suffix);
  }
  return renumbered.map(level => ({
    ...level,
    elements: level.elements.map(element => normalizeStructuralElementType(element.type) === "Semelle"
      ? { ...element, id: `S${footingSuffixes.get(element) ?? element.id.replace(/^S/, "")}` }
      : element),
  }));
}
