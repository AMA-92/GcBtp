export type ConcreteMaterialLaw = {
  fckMpa: number;
  elasticModulusMpa: number;
  tensileStrengthMpa: number;
  fractureStrain: number;
  ultimateCompressionStrain: number;
};
export type SteelMaterialLaw = {
  fykMpa: number;
  elasticModulusMpa: number;
  hardeningRatio: number;
  ultimateStrain: number;
};
export type ConstitutiveState = {
  stressMpa: number;
  tangentMpa: number;
  regime: "elastic" | "cracked" | "concrete-compression" | "steel-yield" | "steel-rupture";
  failed: boolean;
};

const finitePositive = (value: number, fallback: number) => Number.isFinite(value) && value > 0 ? value : fallback;

export function defaultConcreteLaw(fckMpa = 25): ConcreteMaterialLaw {
  const fck = finitePositive(fckMpa, 25);
  return { fckMpa: fck, elasticModulusMpa: 22_000 * ((fck + 8) / 10) ** 0.3, tensileStrengthMpa: 0.3 * fck ** (2 / 3), fractureStrain: 0.00015, ultimateCompressionStrain: 0.0035 };
}
export function defaultSteelLaw(fykMpa = 500): SteelMaterialLaw {
  return { fykMpa: finitePositive(fykMpa, 500), elasticModulusMpa: 200_000, hardeningRatio: 0.01, ultimateStrain: 0.05 };
}

export function evaluateConcrete(strain: number, law = defaultConcreteLaw()): ConstitutiveState {
  const e = law.elasticModulusMpa;
  if (!Number.isFinite(strain)) return { stressMpa: 0, tangentMpa: 0, regime: "cracked", failed: true };
  if (strain >= 0) {
    if (strain <= law.tensileStrengthMpa / e) return { stressMpa: e * strain, tangentMpa: e, regime: "elastic", failed: false };
    return { stressMpa: 0, tangentMpa: 1e-6 * e, regime: "cracked", failed: false };
  }
  const compression = -strain;
  const epsC2 = Math.min(0.002, law.fckMpa / e);
  if (compression <= epsC2) {
    const ratio = compression / Math.max(epsC2, 1e-12);
    const stress = -law.fckMpa * (2 * ratio - ratio * ratio);
    const tangent = e * Math.max(0.02, 2 - 2 * ratio);
    return { stressMpa: stress, tangentMpa: tangent, regime: "concrete-compression", failed: false };
  }
  if (compression <= law.ultimateCompressionStrain) return { stressMpa: -law.fckMpa, tangentMpa: 1e-6 * e, regime: "concrete-compression", failed: false };
  return { stressMpa: -law.fckMpa, tangentMpa: 0, regime: "concrete-compression", failed: true };
}

export function evaluateSteel(strain: number, law = defaultSteelLaw()): ConstitutiveState {
  if (!Number.isFinite(strain)) return { stressMpa: 0, tangentMpa: 0, regime: "steel-rupture", failed: true };
  const yieldStrain = law.fykMpa / law.elasticModulusMpa;
  const absolute = Math.abs(strain);
  if (absolute <= yieldStrain) return { stressMpa: law.elasticModulusMpa * strain, tangentMpa: law.elasticModulusMpa, regime: "elastic", failed: false };
  if (absolute <= law.ultimateStrain) {
    const sign = strain < 0 ? -1 : 1;
    const stress = sign * (law.fykMpa + law.elasticModulusMpa * law.hardeningRatio * (absolute - yieldStrain));
    return { stressMpa: stress, tangentMpa: law.elasticModulusMpa * law.hardeningRatio, regime: "steel-yield", failed: false };
  }
  return { stressMpa: Math.sign(strain) * law.fykMpa, tangentMpa: 0, regime: "steel-rupture", failed: true };
}

export function classifyFrameStrain(strain: number, materialName: string) {
  const steel = /acier|steel/i.test(materialName);
  return steel ? evaluateSteel(strain) : evaluateConcrete(strain);
}
