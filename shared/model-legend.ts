import { modelColor } from "./model-catalog";

type LegendElement = { type: string; section: string; color?: string };
export type ModelLegendItem = { type: string; section: string; color: string };

export function buildModelLegend(elements: LegendElement[]): ModelLegendItem[] {
  const seen = new Set<string>();
  return elements.flatMap(element => {
    const color = element.color ?? modelColor(element.type, element.section);
    const key = `${element.type}|${element.section}|${color}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ type: element.type, section: element.section, color }];
  });
}

export function modelLegendText(elements: LegendElement[]) {
  const legend = buildModelLegend(elements);
  return legend.length ? legend.map(item => `${item.type} — ${item.section} — couleur ${item.color}`).join("\n") : "Aucun modèle placé sur ce niveau.";
}
