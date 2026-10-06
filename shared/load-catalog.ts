import type { FloorConfig } from "./floor-config";
import { FRENCH_EUROCODE_ACTION_CATALOG, FRENCH_IMPOSED_LOAD_CATALOG, FRENCH_PROJECT_USAGE_CATALOG } from "./french-load-catalog";

export type LoadCategory = "permanent" | "variable" | "climatic" | "accidental";
export type LoadCatalogEntry = { id: string; label: string; category: LoadCategory; unit: "kN/m²" | "kN/m" | "kN"; defaultValue: number; source: string; editable: boolean };
export type ConcreteClass = { id: string; label: string; fckCylinderMpa: number; fckCubeMpa: number; elasticModulusMpa: number; densityKnM3: number };
export type MaterialCatalogEntry = { id: string; label: string; densityKgM3: number; unitWeightKnM3: number; poisson: number; thermalExpansionPerC: number; elasticModulusMpa?: number; grade?: string; source: string };
export type StructuralLoadProfile = { id: string; label: string; elementTypes: string[]; unit: "kN" | "kN/m" | "kN/m²"; formula: string; defaultValue?: number; notes: string };
export const STRUCTURAL_SUPPORT_CATALOG = [
  { id: "fixed-base", label: "Encastrement", restraints: "ux · uy · uz · rx · ry · rz", use: "Semelle solidaire d’un poteau", note: "Transmet forces et moments." },
  { id: "articulated", label: "Articulation", restraints: "ux · uy · uz", use: "Liaison articulée", note: "Ne bloque pas les rotations." },
  { id: "sliding", label: "Appui glissant", restraints: "uy · uz", use: "Joint ou appui permettant le glissement longitudinal", note: "Libère ux et les rotations." },
  { id: "elastic", label: "Appui élastique", restraints: "ressorts kx · ky · kz · kr", use: "Sol modélisé par raideurs", note: "Réaction proportionnelle au déplacement." },
  { id: "contact", label: "Contact unilatéral", restraints: "uz en compression", use: "Semelle avec risque de décollement", note: "Le contact traction n’est pas admis dans le screening." },
] as const;

export const CONCRETE_CLASSES: ConcreteClass[] = [
  { id: "C20/25", label: "C20/25", fckCylinderMpa: 20, fckCubeMpa: 25, elasticModulusMpa: 30000, densityKnM3: 25 },
  { id: "C25/30", label: "C25/30 · recommandé par défaut", fckCylinderMpa: 25, fckCubeMpa: 30, elasticModulusMpa: 31000, densityKnM3: 25 },
  { id: "C30/37", label: "C30/37", fckCylinderMpa: 30, fckCubeMpa: 37, elasticModulusMpa: 33000, densityKnM3: 25 },
  { id: "C35/45", label: "C35/45", fckCylinderMpa: 35, fckCubeMpa: 45, elasticModulusMpa: 34000, densityKnM3: 25 },
  { id: "C40/50", label: "C40/50", fckCylinderMpa: 40, fckCubeMpa: 50, elasticModulusMpa: 35000, densityKnM3: 25 },
  { id: "C45/55", label: "C45/55", fckCylinderMpa: 45, fckCubeMpa: 55, elasticModulusMpa: 36000, densityKnM3: 25 },
  { id: "C50/60", label: "C50/60", fckCylinderMpa: 50, fckCubeMpa: 60, elasticModulusMpa: 37000, densityKnM3: 25 },
];

export const MATERIAL_CATALOG: MaterialCatalogEntry[] = [
  { id: "beton-arme", label: "Béton armé", densityKgM3: 2500, unitWeightKnM3: 25, poisson: 0.2, thermalExpansionPerC: 10e-6, grade: "C25/30", source: "NF EN 1991-1-1 / NF EN 1992-1-1" },
  { id: "acier-ha400", label: "Acier HA400", densityKgM3: 7850, unitWeightKnM3: 78.5, poisson: 0.3, thermalExpansionPerC: 12e-6, elasticModulusMpa: 200000, grade: "HA400", source: "Catalogue projet" },
  { id: "acier-ha500", label: "Acier HA500", densityKgM3: 7850, unitWeightKnM3: 78.5, poisson: 0.3, thermalExpansionPerC: 12e-6, elasticModulusMpa: 200000, grade: "HA500", source: "Catalogue projet" },
];

export const STRUCTURAL_LOAD_PROFILES: StructuralLoadProfile[] = [
  { id: "footing-self-weight", label: "Semelle · poids propre", elementTypes: ["Semelle"], unit: "kN", formula: "L × B × h × 25", notes: "Calculé automatiquement à partir de la géométrie." },
  { id: "column-self-weight", label: "Poteau · poids propre", elementTypes: ["Poteau"], unit: "kN", formula: "Ac × H × 25", notes: "Section et hauteur du niveau." },
  { id: "beam-self-weight", label: "Poutre · poids propre", elementTypes: ["Poutre"], unit: "kN/m", formula: "b × h × 25", notes: "Charge linéique, puis intégration sur la portée." },
  { id: "tie-beam-self-weight", label: "Longrine · poids propre", elementTypes: ["Longrine de redressement"], unit: "kN/m", formula: "b × h × 25", notes: "Même règle que la poutre." },
  { id: "wall-self-weight", label: "Voile · poids propre", elementTypes: ["Voile"], unit: "kN/m", formula: "t × H × 25", notes: "Épaisseur et hauteur du voile." },
  { id: "solid-slab-self-weight", label: "Dalle pleine · poids propre", elementTypes: ["Dalle"], unit: "kN/m²", formula: "25 × e", notes: "À distinguer d’un plancher à corps creux." },
  { id: "hollow-slab-self-weight", label: "Dalle corps creux · poids propre", elementTypes: ["Dalle"], unit: "kN/m²", formula: "catalogue système poutrelles + entrevous + compression", defaultValue: 3.15, notes: "Demander le système/fabricant pour la valeur finale." },
  { id: "stair-self-weight", label: "Escalier BA · paillasse inclinée et marches", elementTypes: ["Escaliers"], unit: "kN/m²", formula: "25 × e / cos(θ) + 25 × h / 2 + finitions", defaultValue: 6.43, notes: "Valeur indicative pour e=15 cm, h=17 cm et giron=30 cm ; calcul automatique sur projection horizontale selon la géométrie." },
  { id: "balcony-self-weight", label: "Balcon · poids propre", elementTypes: ["Balcon"], unit: "kN/m²", formula: "25 × e + finitions", notes: "Vérifier la rive, les garde-corps et les charges ponctuelles." },
];

export const ADDITIONAL_PERMANENT_LOADS = [
  { id: "screed", label: "Chape ciment 5 cm", value: 1, unit: "kN/m²", source: "20 kN/m³ × 0,05 m" },
  { id: "tiles", label: "Carrelage + colle", value: 0.5, unit: "kN/m²", source: "Valeur indicative" },
  { id: "ceiling-plaster", label: "Enduit plafond", value: 0.25, unit: "kN/m²", source: "Plage indicative 0,20–0,30" },
  { id: "false-ceiling", label: "Faux plafond", value: 0.25, unit: "kN/m²", source: "Valeur indicative" },
  { id: "waterproofing", label: "Étanchéité", value: 0.2, unit: "kN/m²", source: "Plage indicative 0,15–0,25" },
  { id: "insulation", label: "Isolation", value: 0.15, unit: "kN/m²", source: "Plage indicative 0,10–0,25" },
];

export const IMPOSED_LOAD_PROFILES = [
  { id: "housing", label: "Habitation · catégorie A", range: "1,50", defaultValue: FRENCH_PROJECT_USAGE_CATALOG.habitation.load, unit: "kN/m²" },
  { id: "logement", label: "Logement collectif · catégorie A", range: "1,50", defaultValue: FRENCH_PROJECT_USAGE_CATALOG.logement.load, unit: "kN/m²" },
  { id: "office", label: "Bureaux · catégorie B", range: "2,50", defaultValue: FRENCH_PROJECT_USAGE_CATALOG.bureau.load, unit: "kN/m²" },
  { id: "stair-housing", label: "Escalier habitation · catégorie A", range: "2,50", defaultValue: FRENCH_PROJECT_USAGE_CATALOG.habitation.stairLoad, unit: "kN/m²" },
  { id: "balcony", label: "Balcon habitation · catégorie A", range: "3,50", defaultValue: FRENCH_PROJECT_USAGE_CATALOG.habitation.balconyLoad, unit: "kN/m²" },
  { id: "commerce", label: "Commerce de détail · catégorie D1", range: "5,00", defaultValue: FRENCH_PROJECT_USAGE_CATALOG.commerce.load, unit: "kN/m²" },
];

export const LOAD_CATALOG: LoadCatalogEntry[] = [
  { id: "slab-self-weight", label: "Poids propre du plancher", category: "permanent", unit: "kN/m²", defaultValue: 0, source: "Géométrie × densité du matériau", editable: false },
  { id: "finishes", label: "Revêtements et chape", category: "permanent", unit: "kN/m²", defaultValue: 1.0, source: "Valeur de projet à confirmer", editable: true },
  { id: "ceiling", label: "Plafonds et réseaux", category: "permanent", unit: "kN/m²", defaultValue: 0.3, source: "Valeur de projet à confirmer", editable: true },
  { id: "partitions", label: "Cloisons réparties", category: "permanent", unit: "kN/m²", defaultValue: 1.0, source: "NF EN 1991-1-1 · poids des cloisons à déterminer selon le projet", editable: true },
  { id: "equipment", label: "Équipements fixes", category: "permanent", unit: "kN/m²", defaultValue: 0.5, source: "Valeur de projet à confirmer", editable: true },
  { id: "walls", label: "Murs sur poutres", category: "permanent", unit: "kN/m", defaultValue: 0, source: "Épaisseur × hauteur × densité", editable: true },
  { id: "occupancy", label: "Exploitation selon usage", category: "variable", unit: "kN/m²", defaultValue: FRENCH_PROJECT_USAGE_CATALOG.habitation.load, source: `${FRENCH_EUROCODE_ACTION_CATALOG.imposedLoadsReference} · catégorie A, tableau 6.2 (NF)`, editable: true },
  { id: "roof", label: "Toiture · catégorie H", category: "variable", unit: "kN/m²", defaultValue: FRENCH_IMPOSED_LOAD_CATALOG["H-low-slope"].qkKnM2, source: `${FRENCH_IMPOSED_LOAD_CATALOG["H-low-slope"].source} · pente < 15 % avec étanchéité; sinon appliquer le cas H-other`, editable: true },
  { id: "wind", label: "Vent", category: "climatic", unit: "kN/m²", defaultValue: 0, source: "NF EN 1991-1-4/NA · calcul selon site, terrain, hauteur et géométrie", editable: true },
  { id: "snow", label: "Neige", category: "climatic", unit: "kN/m²", defaultValue: 0, source: "NF EN 1991-1-3/NA · calcul selon zone, altitude et forme de toiture", editable: true },
  { id: "seismic", label: "Action sismique", category: "climatic", unit: "kN", defaultValue: 0, source: "NF EN 1998/NA · calcul selon zone, sol, spectre et masses", editable: true },
  { id: "fire", label: "Action accidentelle / incendie", category: "accidental", unit: "kN", defaultValue: 0, source: "NF EN 1991-1-2/NA · scénario à définir", editable: true },
];

export const DEFAULT_LOAD_VALUES = Object.fromEntries(LOAD_CATALOG.map(entry => [entry.id, entry.defaultValue])) as Record<string, number>;
const formatFactor = (value: number) => String(Number(value.toFixed(2))).replace(".", ",");
export const DESIGN_COMBINATIONS = {
  eluFundamental: `${formatFactor(FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.permanentUnfavourable)}·Gk + ${formatFactor(FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.variableUnfavourable)}·Qk,1 + Σ${formatFactor(FRENCH_EUROCODE_ACTION_CATALOG.partialFactors.variableUnfavourable)}·ψ0,i·Qk,i`,
  elsCharacteristic: "Gk + Qk,1 + Σψ0,i·Qk,i",
  elsFrequent: "Gk + ψ1,1·Qk,1 + Σψ2,i·Qk,i",
  elsQuasiPermanent: "Gk + Σψ2,i·Qk,i",
} as const;

export function loadCatalogByCategory(category: LoadCategory) { return LOAD_CATALOG.filter(entry => entry.category === category); }

/** Catalogue ajusté au profil de plancher affiché dans la note. */
export function loadCatalogForFloor(config: FloorConfig): LoadCatalogEntry[] {
  const parts = (config.thickness ?? "16+4 cm").match(/\d+(?:[.,]\d+)?/g)?.map(value => Number(value.replace(",", "."))) ?? [20];
  const thicknessM = Math.max(0.05, parts.reduce((sum, value) => sum + value, 0) / 100);
  const hollow = Number(String(config.hollowBlockHeight ?? "16").replace(",", "."));
  const compression = Number(String(config.compressionSlab ?? "4").replace(",", "."));
  const selfWeight = config.type === "Dalle pleine"
    ? 25 * thicknessM
    : 25 * (compression / 100 + 0.08 + Math.max(0, compression - 4) * 0.01) + 0.5 + Math.max(0, hollow - 16) * 0.03;
  return LOAD_CATALOG.map(entry => entry.id === "slab-self-weight"
    ? { ...entry, defaultValue: Number.isFinite(selfWeight) ? selfWeight : entry.defaultValue }
    : entry);
}
