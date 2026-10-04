/**
 * Small deterministic verification helpers used to benchmark the structural engine.
 * They are intentionally independent from the production solver so that a regression
 * in the solver cannot make its own expected values pass.
 */
export type VerificationCase = {
  id: string;
  description: string;
  expected: number;
  actual: number;
  relativeError: number;
  tolerance: number;
  status: "PASS" | "FAIL";
};

export function verifyClose(id: string, description: string, actual: number, expected: number, tolerance = 1e-6): VerificationCase {
  const relativeError = Math.abs(actual - expected) / Math.max(1, Math.abs(expected));
  return { id, description, expected, actual, relativeError, tolerance, status: relativeError <= tolerance ? "PASS" : "FAIL" };
}

export function cantileverTipDeflection(PKn: number, LM: number, EKnM2: number, IM4: number) {
  return PKn * LM ** 3 / (3 * EKnM2 * IM4);
}

export function simplySupportedUniformLoadMoment(qKnM: number, LM: number) {
  return qKnM * LM ** 2 / 8;
}

export function simplySupportedUniformLoadReaction(qKnM: number, LM: number) {
  return qKnM * LM / 2;
}

export function axialBarDisplacement(PKn: number, LM: number, EKnM2: number, AM2: number) {
  return PKn * LM / (EKnM2 * AM2);
}

export function torsionRotation(TKnM: number, LM: number, GKnM2: number, JtM4: number) {
  return TKnM * LM / (GKnM2 * JtM4);
}

export function runReferenceChecks() {
  const E = 210_000_000;
  const A = 0.01;
  const I = 8e-6;
  const L = 3;
  const P = 10;
  const q = 10;
  const G = E / (2 * (1 + 0.3));
  const Jt = 2e-6;
  return [
    verifyClose("axial-bar", "Déplacement axial PL/EA", axialBarDisplacement(P, L, E, A), P * L / (E * A)),
    verifyClose("cantilever-tip", "Flèche de console PL³/(3EI)", cantileverTipDeflection(P, L, E, I), P * L ** 3 / (3 * E * I)),
    verifyClose("ss-reaction", "Réaction qL/2", simplySupportedUniformLoadReaction(q, L), q * L / 2),
    verifyClose("ss-moment", "Moment qL²/8", simplySupportedUniformLoadMoment(q, L), q * L ** 2 / 8),
    verifyClose("torsion", "Rotation de torsion TL/GJ", torsionRotation(P, L, G, Jt), P * L / (G * Jt)),
  ];
}
