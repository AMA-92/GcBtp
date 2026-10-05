import type { BuildingLoadRow } from "./building-load-propagation";

export type LoadSynthesisGroup = {
  key: string;
  type: string;
  label: string;
  rows: BuildingLoadRow[];
  maximumNu: number;
  minimumNu: number;
  averageNu: number;
};

const FAMILY_ORDER = [
  "Poteau",
  "Semelle",
  "Poutre",
  "Dalle",
  "Balcon",
  "Escaliers",
  "Voile",
  "Longrine de redressement",
];

const FAMILY_LABEL: Record<string, string> = {
  Poteau: "Poteaux",
  Semelle: "Semelles",
  Poutre: "Poutres",
  Dalle: "Dalles",
  Balcon: "Balcons",
  Escaliers: "Escaliers",
  Voile: "Voiles",
  "Longrine de redressement": "Longrines de redressement",
};

const familyRank = (type: string) => {
  const rank = FAMILY_ORDER.indexOf(type);
  return rank < 0 ? FAMILY_ORDER.length : rank;
};

/**
 * Regroupe les éléments d'une même famille par proximité de sollicitation ELU.
 * La comparaison se fait avec le premier élément du groupe : un groupe à 15 %
 * représente donc une classe d'éléments dimensionnables avec une hypothèse proche.
 * Les éléments les plus sollicités sont toujours placés en premier.
 */
export function buildLoadSynthesis(
  rows: BuildingLoadRow[],
  similarity = 0.15,
): LoadSynthesisGroup[] {
  const groups: LoadSynthesisGroup[] = [];
  const byFamily = new Map<string, BuildingLoadRow[]>();

  for (const row of rows) {
    const family = byFamily.get(row.type) ?? [];
    family.push(row);
    byFamily.set(row.type, family);
  }

  Array.from(byFamily.entries()).forEach(([type, familyRows]) => {
    const ordered = [...familyRows].sort((a, b) => b.nu - a.nu || a.id.localeCompare(b.id));
    const familyGroups: LoadSynthesisGroup[] = [];

    for (const row of ordered) {
      const reference = familyGroups.find(group => {
        const referenceNu = group.maximumNu;
        const denominator = Math.max(Math.abs(referenceNu), 1);
        return Math.abs(referenceNu - row.nu) / denominator <= similarity;
      });

      if (reference) {
        reference.rows.push(row);
        reference.minimumNu = Math.min(reference.minimumNu, row.nu);
        reference.maximumNu = Math.max(reference.maximumNu, row.nu);
        reference.averageNu = reference.rows.reduce((sum, item) => sum + item.nu, 0) / reference.rows.length;
      } else {
        familyGroups.push({
          key: `${type}-${familyGroups.length + 1}`,
          type,
          label: FAMILY_LABEL[type] ?? type,
          rows: [row],
          maximumNu: row.nu,
          minimumNu: row.nu,
          averageNu: row.nu,
        });
      }
    }

    familyGroups.sort((a, b) => b.maximumNu - a.maximumNu);
    groups.push(...familyGroups);
  });

  return groups.sort((a, b) => familyRank(a.type) - familyRank(b.type) || b.maximumNu - a.maximumNu);
}

export function loadFamilyLabel(type: string) {
  return FAMILY_LABEL[type] ?? type;
}
