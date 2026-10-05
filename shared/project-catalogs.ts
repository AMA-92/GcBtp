import { AFRICAN_COUNTRIES, getRegulatoryRule, getRegulatorySiteProfile } from "./regulatory";
import {
  CONCRETE_MATERIAL_CATALOG,
  type ConcreteMaterialClass,
  type ConcreteMaterialProperties,
} from "./model-catalog";

export const PROJECT_COUNTRIES = AFRICAN_COUNTRIES;

export const PROJECT_STANDARD_CATALOG = [
  {
    id: "eurocode-2",
    norm: "Eurocode 2",
    label: "Eurocode 2 · EN 1992 (avec EN 1990/1991 selon le projet)",
    shortLabel: "Eurocode 2",
  },
  {
    id: "bael-91-99",
    norm: "BAEL 91 mod. 99",
    label: "BAEL 91 révisé 99 · béton armé",
    shortLabel: "BAEL 91 mod. 99",
  },
  {
    id: "bs-8110",
    norm: "BS 8110",
    label: "BS 8110 · béton armé",
    shortLabel: "BS 8110",
  },
  {
    id: "sans-10100",
    norm: "SANS 10100",
    label: "SANS 10100 · béton armé (Afrique du Sud)",
    shortLabel: "SANS 10100",
  },
  {
    id: "ecp-egypt",
    norm: "ECP · code égyptien (à confirmer)",
    label: "ECP · code égyptien de pratique (édition à confirmer)",
    shortLabel: "ECP · à confirmer",
  },
] as const;

export type ProjectStandard = (typeof PROJECT_STANDARD_CATALOG)[number]["norm"];
export type ProjectStandardId = (typeof PROJECT_STANDARD_CATALOG)[number]["id"];

export function getProjectStandardId(norm: string): ProjectStandardId {
  return PROJECT_STANDARD_CATALOG.find(item => item.norm === norm)?.id ?? "eurocode-2";
}

export function getCountryProjectStandard(country: string, city = ""): ProjectStandard {
  if (country === "Afrique du Sud") return "SANS 10100";
  if (country === "Égypte") return "ECP · code égyptien (à confirmer)";
  const proposed = getRegulatorySiteProfile(country, city).preferredNorm;
  return PROJECT_STANDARD_CATALOG.find(item => item.norm === proposed)?.norm ?? "Eurocode 2";
}

export function getProjectCountryGuidance(country: string) {
  return getRegulatoryRule(country);
}

export const CONCRETE_CLASSES = Object.values(CONCRETE_MATERIAL_CATALOG);
export type ProjectConcreteMaterial = ConcreteMaterialProperties;

export const REINFORCEMENT_STEEL_CATALOG = [
  { id: "B400", label: "Acier d’armature B400", fykMpa: 400, note: "Limite d’élasticité nominale indicative ; vérifier le certificat et la norme du projet." },
  { id: "B500", label: "Acier d’armature B500", fykMpa: 500, note: "Limite d’élasticité nominale indicative ; vérifier le certificat et la norme du projet." },
] as const;

export const STRUCTURAL_STEEL_CATALOG = [
  { id: "S235", label: "Acier de construction S235", fyMpa: 235 },
  { id: "S275", label: "Acier de construction S275", fyMpa: 275 },
  { id: "S355", label: "Acier de construction S355", fyMpa: 355 },
] as const;

export type ReinforcementSteelGrade = (typeof REINFORCEMENT_STEEL_CATALOG)[number]["id"];
export type StructuralSteelGrade = (typeof STRUCTURAL_STEEL_CATALOG)[number]["id"];

export type ProjectMaterialSelection = {
  concreteClass: ConcreteMaterialClass;
  reinforcementSteel: ReinforcementSteelGrade;
  structuralSteel: StructuralSteelGrade;
};

export const DEFAULT_PROJECT_MATERIALS: ProjectMaterialSelection = {
  concreteClass: "C25/30",
  reinforcementSteel: "B500",
  structuralSteel: "S275",
};

export function normalizeProjectMaterials(value: unknown): ProjectMaterialSelection {
  if (!value || typeof value !== "object") return { ...DEFAULT_PROJECT_MATERIALS };
  const saved = value as Partial<ProjectMaterialSelection>;
  return {
    concreteClass: saved.concreteClass && saved.concreteClass in CONCRETE_MATERIAL_CATALOG
      ? saved.concreteClass
      : DEFAULT_PROJECT_MATERIALS.concreteClass,
    reinforcementSteel: REINFORCEMENT_STEEL_CATALOG.some(item => item.id === saved.reinforcementSteel)
      ? saved.reinforcementSteel as ReinforcementSteelGrade
      : DEFAULT_PROJECT_MATERIALS.reinforcementSteel,
    structuralSteel: STRUCTURAL_STEEL_CATALOG.some(item => item.id === saved.structuralSteel)
      ? saved.structuralSteel as StructuralSteelGrade
      : DEFAULT_PROJECT_MATERIALS.structuralSteel,
  };
}

export function getProjectMaterialSummary(materials: ProjectMaterialSelection) {
  const concrete = CONCRETE_MATERIAL_CATALOG[materials.concreteClass];
  const rebar = REINFORCEMENT_STEEL_CATALOG.find(item => item.id === materials.reinforcementSteel)!;
  const steel = STRUCTURAL_STEEL_CATALOG.find(item => item.id === materials.structuralSteel)!;
  return { concrete, rebar, steel };
}
