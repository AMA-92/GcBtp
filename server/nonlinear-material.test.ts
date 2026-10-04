import { describe, expect, it } from "vitest";
import { defaultConcreteLaw, defaultSteelLaw, evaluateConcrete, evaluateSteel } from "../shared/nonlinear-material";

describe("lois constitutives béton et acier", () => {
  it("détecte la fissuration en traction du béton", () => {
    const law = defaultConcreteLaw(25);
    expect(evaluateConcrete(law.tensileStrengthMpa / law.elasticModulusMpa * 2, law).regime).toBe("cracked");
  });
  it("détecte la plastification puis la rupture de l’acier", () => {
    const law = defaultSteelLaw(500);
    expect(evaluateSteel(0.01, law).regime).toBe("steel-yield");
    expect(evaluateSteel(0.06, law).failed).toBe(true);
  });
  it("détecte la déformation ultime en compression du béton", () => {
    expect(evaluateConcrete(-0.004).failed).toBe(true);
  });
});
