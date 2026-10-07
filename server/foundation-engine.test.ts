import { describe, expect, it } from "vitest";
import { calculateFoundation } from "../shared/foundation-engine";

describe("foundation engine", () => {
  it("does not size a footing until an actual geotechnical bearing value is entered", () => {
    const result = calculateFoundation({ axialLoad: 420, foundation: "semelle isolée" });
    expect(result.requiredArea).toBeNull();
    expect(result.width).toBeNull();
    expect(result.utilization).toBeNull();
    expect(result.status).toBe("données géotechniques requises");
  });

  it("sizes a preliminary footing directly from the bearing value entered from the report", () => {
    const result = calculateFoundation({ axialLoad: 420, foundation: "semelle isolée", allowableBearingOverride: 200 });
    expect(result.requiredArea).toBeCloseTo(2.1);
    expect(result.width).toBeGreaterThan(0);
    expect(result.pressure).toBeCloseTo(200);
    expect(result.status).toBe("satisfaisant");
  });

  it("flags an undersized footing against the entered value without a hidden safety factor", () => {
    const result = calculateFoundation({ axialLoad: 420, foundation: "semelle isolée", allowableBearingOverride: 200, width: 0.5, length: 0.5 });
    expect(result.pressure).toBeCloseTo(1680);
    expect(result.status).toBe("à redimensionner");
    expect(result.utilization).toBeCloseTo(8.4);
  });

  it("does not infer a pile capacity from a generic qadm", () => {
    const result = calculateFoundation({ axialLoad: 420, foundation: "pieux", allowableBearingOverride: 200 });
    expect(result.requiredArea).toBeNull();
    expect(result.status).toBe("étude géotechnique spécifique requise");
  });
});
