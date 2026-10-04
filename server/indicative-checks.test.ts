import { describe, expect, it } from "vitest";
import { checkBeam, checkColumn, checkSlab, summarizeChecks } from "../shared/indicative-checks";

describe("indicative structural checks", () => {
  it("checks beam flexion with transparent assumptions", () => {
    const result = checkBeam({ elementId: "B1", span: 5, width: 0.25, depth: 0.45, uniformLoad: 12 });
    expect(result.type).toBe("poutre");
    expect(result.demand).toBeGreaterThan(0);
    expect(result.capacity).toBeGreaterThan(0);
    expect(result.assumptions).toContain("Vérification indicative de flexion");
  });

  it("checks column compression and slab demand", () => {
    const column = checkColumn({ elementId: "P1", axialLoad: 150, width: 0.3, depth: 0.3 });
    const slab = checkSlab({ elementId: "PL1", span: 4, thickness: 0.2, uniformLoad: 5 });
    expect(column.capacity).toBeGreaterThan(0);
    expect(slab.demand).toBeGreaterThan(0);
    expect(["satisfaisant", "à vérifier", "non satisfaisant"]).toContain(column.status);
  });

  it("summarizes checks that need professional review", () => {
    const result = summarizeChecks([checkColumn({ elementId: "P2", axialLoad: 5000, width: 0.2, depth: 0.2 })]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("P2");
  });
});
