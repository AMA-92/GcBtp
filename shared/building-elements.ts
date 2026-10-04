export type ElementRecord = { id: string; type: string; section: string; x: number; y: number };
export type LevelRecord = { id: string; label: string; elevation: string; elements: ElementRecord[] };

export function updateElement(levels: LevelRecord[], sourceLevelId: string, element: ElementRecord) {
  return levels.map(level => level.id === sourceLevelId ? { ...level, elements: level.elements.map(item => item.id === element.id ? element : item) } : level);
}

export function removeElement(levels: LevelRecord[], levelId: string, elementId: string) {
  return levels.map(level => level.id === levelId ? { ...level, elements: level.elements.filter(item => item.id !== elementId) } : level);
}

export function moveElement(levels: LevelRecord[], sourceLevelId: string, targetLevelId: string, elementId: string) {
  if (sourceLevelId === targetLevelId) return levels;
  const source = levels.find(level => level.id === sourceLevelId);
  const element = source?.elements.find(item => item.id === elementId);
  if (!element) return levels;
  return levels.map(level => level.id === sourceLevelId ? { ...level, elements: level.elements.filter(item => item.id !== elementId) } : level.id === targetLevelId ? { ...level, elements: [...level.elements, element] } : level);
}
