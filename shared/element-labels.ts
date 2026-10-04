export type LabelableElement = { id: string; type: string };

const prefixByType: Record<string, string> = { Poteau: "P", Poutre: "B", Semelle: "S", Dalle: "PL" };
const compactType = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s_\-]+/g, "");
export function normalizeStructuralElementType(type: string) {
  const key = compactType(type);
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
  return levels.map(level => ({
    ...level,
    elements: level.elements.map(element => {
      const type = normalizeStructuralElementType(element.type);
      const prefix = prefixByType[type] ?? type.slice(0, 2).toUpperCase();
      const number = (counters.get(type) ?? 0) + 1;
      counters.set(type, number);
      return { ...element, type, id: `${prefix}${number}` };
    }),
  }));
}
