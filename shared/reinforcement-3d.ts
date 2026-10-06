export type Reinforcement3DCategory =
  | "columns"
  | "beams"
  | "longrines"
  | "slabs"
  | "foundations"
  | "walls"
  | "balconies"
  | "stairs"
  | "others";

export const DEFAULT_REINFORCEMENT_3D_CATEGORIES: Record<Reinforcement3DCategory, boolean> = {
  columns: true,
  beams: true,
  longrines: true,
  slabs: true,
  foundations: true,
  walls: true,
  balconies: true,
  stairs: true,
  others: true,
};

export function reinforcement3DCategory(itemType: string, designType: string): Reinforcement3DCategory {
  if (itemType === "Poteau" || designType === "column") return "columns";
  if (itemType === "Poutre") return "beams";
  if (itemType === "Longrine de redressement" || designType === "tie-beam") return "longrines";
  if (itemType === "Escaliers" || designType === "stair") return "stairs";
  if (itemType === "Dalle" || designType === "slab") return itemType === "Balcon" ? "balconies" : "slabs";
  if (itemType === "Balcon") return "balconies";
  if (itemType === "Semelle" || designType === "footing") return "foundations";
  if (itemType === "Voile" || designType === "wall") return "walls";
  return "others";
}
