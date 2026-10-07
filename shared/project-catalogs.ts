import { AFRICAN_COUNTRIES, getRegulatoryRule } from "./regulatory";
import {
  CONCRETE_MATERIAL_CATALOG,
  type ConcreteMaterialClass,
  type ConcreteMaterialProperties,
} from "./model-catalog";
import { DEFAULT_PROJECT_STANDARD, FRENCH_EUROCODE_DEFAULT_STANDARD, normalizeProjectStandard } from "./french-standard-profile";

export const PROJECT_COUNTRIES = AFRICAN_COUNTRIES;

export const PROJECT_STANDARD_CATALOG = [
  {
    id: "bael-91-99",
    norm: "BAEL 91 mod. 99",
    label: "BAEL 91 mod. 99 · référentiel français par défaut",
    shortLabel: "BAEL 91 mod. 99",
  },
  {
    id: "eurocode-2",
    norm: FRENCH_EUROCODE_DEFAULT_STANDARD,
    label: "Eurocodes français · NF EN et annexes nationales françaises",
    shortLabel: "Eurocodes français",
  },
] as const;

export type ProjectStandard = (typeof PROJECT_STANDARD_CATALOG)[number]["norm"];
export type ProjectStandardId = (typeof PROJECT_STANDARD_CATALOG)[number]["id"];

export function getProjectStandardId(norm: string): ProjectStandardId {
  const normalized = normalizeProjectStandard(norm);
  return PROJECT_STANDARD_CATALOG.find(item => item.norm === normalized)?.id ?? "bael-91-99";
}

export function getCountryProjectStandard(_country: string, _city = ""): ProjectStandard {
  return DEFAULT_PROJECT_STANDARD;
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
