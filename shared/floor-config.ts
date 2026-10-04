export type FloorType = "Corps creux" | "Dalle pleine";
export type FloorConfig = {
  type: FloorType;
  thickness: string;
  span: string;
  direction: "X" | "Y";
  hollowBlockHeight?: string;
  compressionSlab?: string;
  ribWidth?: string;
  concreteClass: string;
  finishLoad?: string;
  ceilingLoad?: string;
  partitionLoad?: string;
  equipmentLoad?: string;
  imposedLoad?: string;
  roofLoad?: string;
  characteristicPermanentLoad?: string;
  characteristicImposedLoad?: string;
  stairRiser?: string;
  stairTread?: string;
  stairRise?: string;
  stairRun?: string;
  stairFinishLoad?: string;
};

export const FLOOR_PRESETS: Record<FloorType, string[]> = {
  "Corps creux": ["16+4 cm", "20+5 cm", "25+5 cm", "30+5 cm"],
  "Dalle pleine": ["12 cm", "15 cm", "18 cm", "20 cm", "25 cm"],
};

export const defaultFloorConfig: FloorConfig = {
  type: "Corps creux",
  thickness: "16+4 cm",
  span: "4.00",
  direction: "X",
  hollowBlockHeight: "16",
  compressionSlab: "4",
  ribWidth: "12",
  concreteClass: "C25/30",
  finishLoad: "1.00",
  ceilingLoad: "0.30",
  partitionLoad: "1.00",
  equipmentLoad: "0.50",
  imposedLoad: "2.00",
  roofLoad: "0.80",
  characteristicPermanentLoad: "5.84",
  characteristicImposedLoad: "1.50",
};

export function normalizeFloorConfig(config: Partial<FloorConfig> = {}): FloorConfig {
  const type = config.type === "Dalle pleine" ? "Dalle pleine" : "Corps creux";
  return { ...defaultFloorConfig, ...config, type, thickness: config.thickness ?? FLOOR_PRESETS[type][0] };
}

export function serializeFloorConfig(config: FloorConfig): string { return JSON.stringify(normalizeFloorConfig(config)); }
export function restoreFloorConfig(raw: string | null): FloorConfig { try { return normalizeFloorConfig(raw ? JSON.parse(raw) : {}); } catch { return defaultFloorConfig; } }
