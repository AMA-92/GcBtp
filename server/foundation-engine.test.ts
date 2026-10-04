import { describe, expect, it } from "vitest";
import { calculateFoundation } from "../shared/foundation-engine";

describe("foundation engine", () => {
  const base = { axialLoad: 420, soil: "argile" as const, foundation: "semelle isolée" as const, safetyFactor: 2.5, depth: 1.2, groundwaterDepth: 3 };

  it("calculates required area, dimensions and pressure", () => {
    const result = calculateFoundation(base);
    expect(result.requiredArea).toBeGreaterThan(0);
    expect(result.width).toBeGreaterThan(0);
    expect(result.pressure).toBeGreaterThan(0);
    expect(result.status).toBe("satisfaisant");
  });

  it("responds to soil bearing capacity", () => {
    const weak = calculateFoundation({ ...base, soil: "remblai" });
    const rock = calculateFoundation({ ...base, soil: "roche" });
    expect(weak.requiredArea).toBeGreaterThan(rock.requiredArea);
  });

  it("flags an undersized footing", () => {
    const result = calculateFoundation({ ...base, width: 0.5, length: 0.5 });
    expect(result.status).toBe("à redimensionner");
    expect(result.utilization).toBeGreaterThan(1);
  });

  it("responds to a manually entered allowable bearing override", () => {
    const weak = calculateFoundation({ ...base, allowableBearingOverride: 80 });
    const strong = calculateFoundation({ ...base, allowableBearingOverride: 500 });
    expect(weak.requiredArea).toBeGreaterThan(strong.requiredArea);
    expect(weak.pressure).not.toBe(strong.pressure);
    expect(weak.soil.allowableBearing).toBe(80);
    expect(weak.status).not.toBe(strong.status);
  });

  it("applies the selected foundation type factor", () => {
    const isolated = calculateFoundation({ ...base, foundation: "semelle isolée" });
    const piles = calculateFoundation({ ...base, foundation: "pieux" });
    expect(piles.requiredArea).toBeGreaterThan(isolated.requiredArea);
  });
});
