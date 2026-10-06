import { describe, expect, it } from "vitest";
import { resolveRCNormProfile, validateRCNormSelection } from "@shared/rc-norms";
import { designStairV2 } from "@shared/stair-design-v2";

describe("référentiels béton armé", () => {
  it("sépare Eurocode 2 et BAEL 91 mod. 99", () => {
    expect(resolveRCNormProfile("Eurocode 2").family).toBe("eurocode-2");
    expect(resolveRCNormProfile("BAEL 91 mod. 99").family).toBe("bael-91-mod-99");
    expect(resolveRCNormProfile("BS 8110")).toBeNull();
  });

  it("bloque un référentiel non pris en charge", () => {
    expect(validateRCNormSelection("BS 8110", "", "")[0]).toContain("non pris en charge");
  });
});

describe("pré-étude d’escalier", () => {
  it("calcule la volée et signale explicitement les limites de palier et de continuité", () => {
    const result = designStairV2({
      spanM: 3,
      riseM: 1.6,
      widthM: 1.2,
      thicknessM: 0.16,
      permanentKnM2: 5,
      imposedKnM2: 3,
      gammaG: 1.35,
      gammaQ: 1.5,
      fykMpa: 500,
      gammaS: 1.15,
      coverMm: 25,
      mainBarDiameterMm: 10,
      minReinforcementRatio: 0.0015,
      maxReinforcementRatio: 0.04,
    });
    expect(result.AsRequiredMm2PerM).toBeGreaterThan(0);
    expect(result.slopeLengthM).toBeGreaterThan(3);
    expect(result.warnings.join(" ")).toContain("paliers");
    expect(result.warnings.join(" ")).toContain("continuité");
  });
});
