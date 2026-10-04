import type { RCDesignResult, RCElementDesign } from "./rc-design";

export const REINFORCEMENT_TEMPLATE_STORAGE_KEY = "gcbtp-reinforcement-template-v1";

export type ReinforcementTemplate = {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  officeReference: string;
  engineerName: string;
  drafterName: string;
  clientName: string;
  projectName: string;
  projectAddress: string;
  projectReference: string;
  drawingPrefix: string;
  logoText: string;
  footerNote: string;
  paperFormat: "A4";
  orientation: "portrait" | "landscape";
  scaleLabel: string;
};

export const DEFAULT_REINFORCEMENT_TEMPLATE: ReinforcementTemplate = {
  companyName: "",
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  companyWebsite: "",
  officeReference: "",
  engineerName: "",
  drafterName: "",
  clientName: "",
  projectName: "",
  projectAddress: "",
  projectReference: "",
  drawingPrefix: "GCBTP",
  logoText: "GCBTP",
  footerNote: "Document de pré-étude — à vérifier et valider par un ingénieur structure habilité.",
  paperFormat: "A4",
  orientation: "landscape",
  scaleLabel: "Schéma non à l'échelle",
};

export function loadReinforcementTemplate(): ReinforcementTemplate {
  if (typeof window === "undefined") return DEFAULT_REINFORCEMENT_TEMPLATE;
  try {
    const raw = window.localStorage.getItem(REINFORCEMENT_TEMPLATE_STORAGE_KEY);
    return { ...DEFAULT_REINFORCEMENT_TEMPLATE, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_REINFORCEMENT_TEMPLATE;
  }
}

export function saveReinforcementTemplate(template: ReinforcementTemplate) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REINFORCEMENT_TEMPLATE_STORAGE_KEY, JSON.stringify(template));
}

export function reinforcementElementTitle(element: RCElementDesign) {
  const labels: Record<RCElementDesign["type"], string> = {
    beam: "POUTRE",
    "tie-beam": "LONGRINE DE REDRESSEMENT",
    column: "POTEAU",
    slab: "DALLE",
    wall: "VOILE",
    footing: "SEMELLE",
  };
  return labels[element.type] ?? element.type.toUpperCase();
}

export function reinforcementDrawingNumber(template: ReinforcementTemplate, element: RCElementDesign, index = 1) {
  return `${template.drawingPrefix || "GCBTP"}-F-${String(index).padStart(3, "0")}-${element.elementId}`;
}


export type ReinforcementA4Group = {
  key: string;
  type: RCElementDesign["type"];
  elements: RCElementDesign[];
  representative: RCElementDesign;
  identicalReinforcement: boolean;
};

function reinforcementFingerprint(element: RCElementDesign) {
  return element.reinforcement
    .map(bar => [bar.id.split(":").slice(-1)[0], bar.label, bar.diameterMm, bar.count, Math.round(bar.lengthPerBarM * 1000)].join("|"))
    .sort()
    .join(";");
}

export function reinforcementGroupingKey(element: RCElementDesign, geometryLabel = "") {
  // Le regroupement de base identifie le type + la section/géométrie.
  // Le fingerprint de ferraillage est ajouté ensuite pour qu’une fiche A4 reste toujours représentative.
  let section = geometryLabel.replace(/\s+/g, " ").trim().toLowerCase();
  // On ignore les dimensions qui décrivent la portée/hauteur/longueur de l'élément
  // lorsque le regroupement porte sur une même section constructive.
  section = section
    .replace(/\s*[·|]\s*longueur[^·|]*/i, "")
    .replace(/\s*[·|]\s*portée[^·|]*/i, "")
    .replace(/\s*[·|]\s*hauteur[^·|]*/i, "")
    .replace(/\s*[·|]\s*poteau[^·|]*/i, "")
    .replace(/^dalle:\s*e\s*=\s*([^·|]+).*$/i, "dalle: e=$1")
    .replace(/^voile:\s*épaisseur\s*([^·|]+).*$/i, "voile: épaisseur $1")
    .trim();
  return `${element.type}::${section || "section-non-renseignee"}`;
}

export function groupReinforcementElements(elements: RCElementDesign[], geometryById: Record<string, string> = {}) {
  const map = new Map<string, RCElementDesign[]>();
  for (const element of elements) {
    // Une fiche A4 représente UN TYPE de ferraillage. Deux éléments ne sont
    // donc regroupés que s'ils ont le même type, la même section constructive
    // et exactement le même ferraillage. La fiche montre ensuite uniquement
    // le représentant, avec la quantité et la liste des repères associés.
    const sectionKey = reinforcementGroupingKey(element, geometryById[element.elementId]);
    const key = `${sectionKey}::${reinforcementFingerprint(element)}`;
    const list = map.get(key) ?? [];
    list.push(element);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([key, group]) => ({
    key,
    type: group[0].type,
    elements: group,
    representative: group[0],
    identicalReinforcement: true,
  } satisfies ReinforcementA4Group));
}

export function reinforcementElementSummary(element: RCElementDesign) {
  const utilization = element.checks.reduce((max, check) => Math.max(max, check.utilization ?? 0), 0);
  const status = element.checks.some(check => check.status === "non satisfaisant") ? "NON SATISFAISANT" : element.checks.some(check => check.status === "bloqué") ? "A VERIFIER" : "SATISFAISANT";
  return { utilization, status };
}
