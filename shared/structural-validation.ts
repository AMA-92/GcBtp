export type StructuralValidationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  levelId?: string;
  elementId?: string;
};

export type StructuralValidationResult = {
  status: "conforme" | "a_verifier" | "non_conforme";
  issues: StructuralValidationIssue[];
  checkedLevels: number;
  checkedElements: number;
};

type ValidationLevel = {
  id: string;
  label: string;
  elevation: string;
  elements: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    x2?: number;
    y2?: number;
    xM?: number;
    yM?: number;
    x2M?: number;
    y2M?: number;
    foundationMode?: string;
  }>;
};

const isColumn = (element: ValidationLevel["elements"][number]) => element.type === "Poteau";
const isFoundation = (element: ValidationLevel["elements"][number]) => element.type === "Semelle";
const isBeam = (element: ValidationLevel["elements"][number]) => element.type === "Poutre" || element.type === "Longrine de redressement";
const metric = (element: ValidationLevel["elements"][number]) => ({ x: element.xM ?? element.x, y: element.yM ?? element.y });
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Vérifications de cohérence avant calcul : elles ne déplacent ni ne corrigent la géométrie. */
export function validateStructuralModel(levels: ValidationLevel[], toleranceM = 0.25): StructuralValidationResult {
  const issues: StructuralValidationIssue[] = [];
  const ordered = [...levels].sort((a, b) => Number(a.elevation) - Number(b.elevation));
  const foundation = ordered.find(level => level.id === "foundation" || /fondation/i.test(level.label));
  const structuralLevels = ordered.filter(level => level !== foundation);
  const allElements = ordered.flatMap(level => level.elements.map(element => ({ level, element })));

  for (const { level, element } of allElements) {
    if (!["Poteau", "Poutre", "Longrine de redressement", "Semelle", "Dalle", "Balcon", "Escaliers", "Voile"].includes(element.type)) continue;
    if (![element.x, element.y].every(Number.isFinite)) issues.push({ severity: "error", code: "invalid-coordinate", message: `${element.id} possède une coordonnée non numérique.`, levelId: level.id, elementId: element.id });
    if ((element.type === "Poutre" || element.type === "Longrine de redressement") && (element.x2 === undefined || element.y2 === undefined) && (element.x2M === undefined || element.y2M === undefined)) {
      issues.push({ severity: "error", code: "beam-missing-end", message: `${element.type} ${element.id} sans extrémité complète.`, levelId: level.id, elementId: element.id });
    }
  }

  for (let index = 0; index < structuralLevels.length; index++) {
    const level = structuralLevels[index];
    const lower = index === 0 ? foundation : structuralLevels[index - 1];
    if (!lower) continue;
    for (const column of level.elements.filter(isColumn)) {
      const point = metric(column);
      const supports = lower.elements.filter(element => isColumn(element) || isBeam(element) || isFoundation(element));
      const nearest = supports.reduce<{ element: typeof supports[number] | null; distance: number }>((best, candidate) => {
        const d = distance(point, metric(candidate));
        return d < best.distance ? { element: candidate, distance: d } : best;
      }, { element: null, distance: Infinity });
      if (!nearest.element) {
        issues.push({ severity: "error", code: "vertical-discontinuity", message: `DESCENTE DE CHARGE DISCONTINUE : ${column.id} (${level.label}) ne repose sur aucun élément porteur de ${lower.label}. Prévoir une poutre de transfert ou corriger le modèle.`, levelId: level.id, elementId: column.id });
      } else if (nearest.distance > toleranceM) {
        issues.push({ severity: "warning", code: "vertical-offset", message: `Décalage vertical de ${nearest.distance.toFixed(2)} m entre ${column.id} (${level.label}) et ${nearest.element.id} (${lower.label}) ; vérifier une poutre de transfert.`, levelId: level.id, elementId: column.id });
      }
    }
  }

  if (foundation) {
    for (const footing of foundation.elements.filter(isFoundation)) {
      const point = metric(footing);
      const column = foundation.elements.filter(isColumn).find(candidate => distance(point, metric(candidate)) <= toleranceM);
      if (!column) issues.push({ severity: "error", code: "foundation-without-column", message: `Semelle ${footing.id} sans poteau associé dans la tolérance de ${toleranceM.toFixed(2)} m.`, levelId: foundation.id, elementId: footing.id });
    }
    for (const column of foundation.elements.filter(isColumn)) {
      const hasFooting = foundation.elements.filter(isFoundation).some(candidate => distance(metric(column), metric(candidate)) <= toleranceM);
      if (!hasFooting) issues.push({ severity: "error", code: "column-without-foundation", message: `Poteau ${column.id} sans semelle associée.`, levelId: foundation.id, elementId: column.id });
    }
  }

  const duplicateKeys = new Map<string, string[]>();
  for (const { level, element } of allElements) {
    // Deux poutres peuvent légitimement partir du même nœud ; un doublon
    // n’est contrôlé ici que pour les éléments ponctuels et les surfaces.
    if (!["Poteau", "Semelle", "Dalle", "Balcon", "Voile"].includes(element.type)) continue;
    const point = metric(element);
    const key = `${level.id}:${element.type}:${point.x.toFixed(3)}:${point.y.toFixed(3)}`;
    duplicateKeys.set(key, [...(duplicateKeys.get(key) ?? []), element.id]);
  }
  for (const [key, ids] of duplicateKeys) if (ids.length > 1) issues.push({ severity: "warning", code: "duplicate-elements", message: `Éléments potentiellement dupliqués : ${ids.join(", ")} (${key}).` });

  return {
    status: issues.some(issue => issue.severity === "error") ? "non_conforme" : issues.length ? "a_verifier" : "conforme",
    issues,
    checkedLevels: ordered.length,
    checkedElements: allElements.length,
  };
}
