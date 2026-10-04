import type { FloorConfig } from "./floor-config";
import { elementLoadSummary } from "./element-loads";
import { modelLegendText } from "./model-legend";

type ReportElement = { id: string; type: string; section: string; color?: string; x: number; y: number; x2?: number; y2?: number; floorConfig?: FloorConfig };

type LoadReportInput = { projectName: string; levelLabel: string; country: string; city: string; location: string; structure: string; norm: string; gridDistance: string; elements: ReportElement[]; floorConfig: FloorConfig };

export function buildLoadDescentReport(input: LoadReportInput): string {
  const rows = input.elements.map(element => {
    const load = elementLoadSummary(element, input.gridDistance, input.floorConfig);
    return `${element.id} | ${element.type} | ${element.section} | ${load.label} | Gk ${load.gk.toFixed(2)} kN | Qk ${load.qk.toFixed(2)} kN | ELU ${load.design.toFixed(2)} kN`;
  });
  const total = input.elements.reduce((sum, element) => sum + elementLoadSummary(element, input.gridDistance, input.floorConfig).design, 0);
  return [
    "NOTE DE DESCENTE DE CHARGES — RAPPORT DÉTAILLÉ",
    `Projet : ${input.projectName}`,
    `Niveau étudié : ${input.levelLabel}`,
    `Pays : ${input.country} | Ville : ${input.city || "Non renseignée"}`,
    `Emplacement : ${input.location || "Non renseigné"}`,
    `Structure : ${input.structure} | Référentiel : ${input.norm}`,
    `Distance de trame : ${input.gridDistance} m | Éléments : ${input.elements.length}`,
    "",
    "LÉGENDE DES COULEURS DES MODÈLES",
    modelLegendText(input.elements),
    "",
    "ÉLÉMENTS ET CHARGES",
    ...rows,
    "",
    `Total ELU indicatif du niveau : ${total.toFixed(2)} kN`,
    `Hypothèses : γG = 1.35 ; γQ = 1.50 ; charges en kN ; calcul indicatif selon les paramètres saisis.`,
    "Avertissement : les résultats doivent être vérifiés, complétés et validés par un ingénieur habilité avant toute exécution.",
  ].join("\n");
}
