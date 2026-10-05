import type { FloorConfig } from "./floor-config";

export type OrthotropicPlateStiffness = { D11: number; D22: number; D12: number; D66: number };

const positive = (value: string | undefined, fallback: number) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Équivalent de plaque Kirchhoff-Love par mètre de largeur.
 * Les corps creux sont approchés par une section en T périodique (nervure + table de compression)
 * dans le sens de portée, et par la table seule en sens transversal. L’entraxe est un paramètre
 * explicite (60 cm par défaut) : la valeur du fabricant/projet reste préférable.
 */
export function resolveFloorPlateStiffness(config: Partial<FloorConfig>, elasticModulusKnM2: number, poissonRatio: number): OrthotropicPlateStiffness {
  const E = Math.max(elasticModulusKnM2, 1);
  const nu = Math.max(-0.45, Math.min(0.45, poissonRatio));
  if (config.type !== "Corps creux") {
    const t = Math.max(0.03, positive(config.thickness?.match(/\d+(?:[.,]\d+)?/)?.[0], 20) / 100);
    const D = (E * t ** 3) / (12 * (1 - nu ** 2));
    return { D11: D, D22: D, D12: nu * D, D66: ((1 - nu) * D) / 2 };
  }

  const hollow = positive(config.hollowBlockHeight, 16) / 100;
  const topping = Math.max(0.03, positive(config.compressionSlab, 4) / 100);
  const ribWidth = positive(config.ribWidth, 12) / 100;
  const ribSpacing = Math.max(ribWidth, positive(config.ribSpacing, 60) / 100);
  const ribAreaPerM = (ribWidth / ribSpacing) * hollow;
  const toppingAreaPerM = topping;
  const centroid = (toppingAreaPerM * (hollow + topping / 2) + ribAreaPerM * (hollow / 2)) / (toppingAreaPerM + ribAreaPerM);
  const inertiaPerM = (topping ** 3) / 12 + toppingAreaPerM * (hollow + topping / 2 - centroid) ** 2
    + (ribWidth / ribSpacing) * (hollow ** 3) / 12 + ribAreaPerM * (hollow / 2 - centroid) ** 2;
  const Dspan = Math.max(E * inertiaPerM, 1e-6);
  const Dtransverse = Math.max((E * topping ** 3) / (12 * (1 - nu ** 2)), 1e-6);
  const geometricMean = Math.sqrt(Dspan * Dtransverse);
  const alongX = config.direction !== "Y";
  return {
    D11: alongX ? Dspan : Dtransverse,
    D22: alongX ? Dtransverse : Dspan,
    D12: nu * geometricMean,
    D66: ((1 - nu) * geometricMean) / 2,
  };
}
