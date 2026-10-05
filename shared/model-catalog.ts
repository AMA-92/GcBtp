export type ModelFamily = "Poteau (Rect)" | "Poteau (Cir)" | "Poutre" | "Semelle" | "Voile" | "Longrine de redressement" | "Plancher (Corps Creux)" | "Plancher (Dalle BA)" | "Balcon" | "Escaliers";
export type ModelSpec = { family: ModelFamily; type: string; name: string; dimensions: string; color: string };
export type ConcreteMaterialProperties = { concreteClass: "C25/30" | "C30/37" | "C35/45"; fck: number; fcd: number; fctm: number; Ecm: number; poissonRatio: number; density: number; cover: number };
export type ConcreteMaterialClass = ConcreteMaterialProperties["concreteClass"];
export const CONCRETE_MATERIAL_CATALOG: Record<ConcreteMaterialClass, ConcreteMaterialProperties> = {
  "C25/30": { concreteClass: "C25/30", fck: 25, fcd: 14.17, fctm: 2.56, Ecm: 31_476_000, poissonRatio: 0.20, density: 25, cover: 30 },
  "C30/37": { concreteClass: "C30/37", fck: 30, fcd: 17.00, fctm: 2.90, Ecm: 32_837_000, poissonRatio: 0.20, density: 25, cover: 30 },
  "C35/45": { concreteClass: "C35/45", fck: 35, fcd: 19.83, fctm: 3.21, Ecm: 34_077_000, poissonRatio: 0.20, density: 25, cover: 35 },
};
export function resolveConcreteMaterial(concreteClass = "C25/30"): ConcreteMaterialProperties {
  return { ...(CONCRETE_MATERIAL_CATALOG[concreteClass as ConcreteMaterialClass] ?? CONCRETE_MATERIAL_CATALOG["C25/30"]) };
}

export const MODEL_CATALOG: ModelSpec[] = [
  { family: "Poteau (Rect)", type: "Poteau", name: "Pot_20x30", dimensions: "0.20 × 0.30 m", color: "#27358f" },
  { family: "Poteau (Rect)", type: "Poteau", name: "Pot_25x25", dimensions: "0.25 × 0.25 m", color: "#604239" },
  { family: "Poteau (Cir)", type: "Poteau", name: "Pot_D25", dimensions: "0.25 m", color: "#ed5b00" },
  { family: "Poutre", type: "Poutre", name: "Poutre_20x40", dimensions: "0.20 × 0.40 m", color: "#2f8735" },
  { family: "Voile", type: "Voile", name: "Voile_20cm", dimensions: "0.20 × 3.20 m", color: "#7556b3" },
  { family: "Voile", type: "Voile", name: "Voile_25cm", dimensions: "0.25 × 3.20 m", color: "#5d4194" },
  { family: "Longrine de redressement", type: "Longrine de redressement", name: "Longrine_20x40", dimensions: "0.20 × 0.40 m", color: "#d47b16" },
  { family: "Semelle", type: "Semelle", name: "S1", dimensions: "1.00 × 1.00 × 0.30 m", color: "#7620a8" },
  { family: "Plancher (Corps Creux)", type: "Dalle", name: "Pl_16+4", dimensions: "0.16 × 0.04 × 3.00 × 1.50 m", color: "#0e8d96" },
  { family: "Plancher (Dalle BA)", type: "Dalle", name: "Pl_E20", dimensions: "0.20 × 3.00 × 1.50 m", color: "#d92b2b" },
  { family: "Balcon", type: "Balcon", name: "Balcon BA 20 cm", dimensions: "0.20 × 3.00 × 1.50 m", color: "#148477" },
  { family: "Escaliers", type: "Escaliers", name: "Escalier BA 15 cm", dimensions: "0.15 × 3.00 × 1.20 m", color: "#e87538" },
];

export function modelSpec(type: string, name: string) { return MODEL_CATALOG.find(item => item.type === type && item.name === name); }
export function modelColor(type: string, name: string) { return modelSpec(type, name)?.color ?? "#27358f"; }
export function modelFamilies() { return Array.from(new Set(MODEL_CATALOG.map(item => item.family))); }

export function mergeModelCatalog(customModels: ModelSpec[] = []) {
  const customByKey = new Map(customModels.map(model => [`${model.type}:${model.name}`, model]));
  return MODEL_CATALOG.map(model => customByKey.get(`${model.type}:${model.name}`) ?? model)
    .concat(customModels.filter(model => !MODEL_CATALOG.some(item => item.type === model.type && item.name === model.name)));
}
